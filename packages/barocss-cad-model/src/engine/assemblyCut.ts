// A cut across placed parts (roadmap 10 ⑤): the tool solid of an assembly cut, built in the frame of each part it cuts and
// taken from every body of that occurrence's placed document. The cut is the assembly's (StudioDoc.assemblyCuts); the part's own
// document never changes, so every occurrence of one definition can be cut differently. placedBase (engine/doc.ts) applies it,
// so the viewport, the exports, the drawings, the BOM and the clearance all read the same cut part.
import { prefixDoc, type AssemblyCut, type ModelNode, type PartInstance, type StudioDoc } from './doc';
import { clean, rotationMatrix } from './placement';
import { boughtOf } from './elements';

/** The kernel's length limit: a point's coordinates and a tool's length are within ±10,000 mm, so a through tool is at most this long. */
export const KERNEL_REACH = 10000;
/** A part's box in its own frame (min and max). */
export interface PartBox { min: readonly number[]; max: readonly number[] }
let boxOf: ((doc: StudioDoc, key: object) => PartBox | null) | null = null;
/** engine/evaluate.ts hands in how a part's box is found (once per part document): what sizes a through tool. */
export function registerPartBox(f: (doc: StudioDoc, key: object) => PartBox | null): void { boxOf = f; }
export const partBoxOf = (doc: StudioDoc, key: object): PartBox | null => { try { return boxOf ? boxOf(doc, key) : null; } catch { return null; } };

/** The cuts of the assembly that cut this placed part. */
/** (A sub-assembly is not cut in v1: a cut that still names one is kept and reported, never made.) */
export const cutsOf = (inst: PartInstance, parent: Pick<StudioDoc, 'assemblyCuts'>): AssemblyCut[] => inst.doc.instances?.length ? [] : (parent.assemblyCuts ?? []).filter(c => c.targets.includes(inst.id));

type V3 = [number, number, number];
const unit = (v: readonly number[]): V3 => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };

/** The profile plane's X axis in the assembly's frame: the assembly's X (Y for a cut along X), made square to the cut direction. */
export function profileAxis(dir: readonly number[]): V3 {
  const n = unit(dir), ref: V3 = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], d = ref[0] * n[0] + ref[1] * n[1] + ref[2] * n[2];
  return unit([ref[0] - d * n[0], ref[1] - d * n[1], ref[2] - d * n[2]]);
}


/** A cut's tool: one sketch on a plane and the solid grown from it along the normal, all in the part's own frame. */
export interface CutChunk { origin: V3; normal: V3; xAxis: V3; height: number }
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * The cut in the part's own frame: the assembly point p is the part's R⁻¹ (p − t) (R, t the occurrence's rotation and position), the direction
 * and the profile axis turned by R⁻¹ alone. A number depth: the profile plane and a solid of that depth along the direction. 'through':
 * the axis through the profile's centre, the tool starting just outside the part's box on one side and ending just past it on the other
 * (the box along the axis, `box`; without one, 4,900 mm either way from the axis' point nearest the part's origin). Its `partial` is set
 * when the part is longer along the axis than the kernel's length limit lets a tool be: the tool is then the middle of that length.
 */
export function cutTool(cut: AssemblyCut, inst: PartInstance, box?: PartBox | null): { chunk: CutChunk; partial: boolean; foot: V3 } {
  const R = rotationMatrix(inst.rotation), turn = (v: V3): V3 => [clean(R[0] * v[0] + R[3] * v[1] + R[6] * v[2], 1e-12), clean(R[1] * v[0] + R[4] * v[1] + R[7] * v[2], 1e-12), clean(R[2] * v[0] + R[5] * v[1] + R[8] * v[2], 1e-12)];
  const n = turn(unit(cut.dir)), x = turn(profileAxis(cut.dir)), o = turn([cut.at[0] - inst.position[0], cut.at[1] - inst.position[1], cut.at[2] - inst.position[2]]);
  const along = dot(o, n), foot: V3 = [o[0] - along * n[0], o[1] - along * n[1], o[2] - along * n[2]];
  if (cut.depth !== 'through') return { chunk: { origin: o, normal: n, xAxis: x, height: cut.depth }, partial: false, foot };
  // (The part's extent along the axis, from its box's corners, measured from the foot; a margin round it.)
  let lo = -THROUGH_FALLBACK, hi = THROUGH_FALLBACK;
  if (box) {
    lo = Infinity; hi = -Infinity;
    for (let c = 0; c < 8; c++) { const s = dot([c & 1 ? box.max[0] : box.min[0], c & 2 ? box.max[1] : box.min[1], c & 4 ? box.max[2] : box.min[2]], n); lo = Math.min(lo, s); hi = Math.max(hi, s); }
    const margin = 1 + 0.01 * (hi - lo); lo -= margin; hi += margin;
  }
  let partial = false;
  if (hi - lo > KERNEL_REACH) { const mid = (lo + hi) / 2; lo = mid - KERNEL_REACH / 2; hi = mid + KERNEL_REACH / 2; partial = true; }
  return { chunk: { origin: [foot[0] + lo * n[0], foot[1] + lo * n[1], foot[2] + lo * n[2]], normal: n, xAxis: x, height: hi - lo }, partial, foot };
}
/** How far a through tool reaches without a box to size it from, either way, mm. */
const THROUGH_FALLBACK = 4900;

/** The tool's nodes: the profile on its plane, and the solid grown from it. */
const toolNodes = (cut: AssemblyCut, c: CutChunk): ModelNode[] => {
  const plane = { origin: c.origin, normal: c.normal, xAxis: c.xAxis };
  const sketch: ModelNode = cut.profile.kind === 'circle'
    ? { kind: 'sketch', profile: 'circle', center: [0, 0], radius: cut.profile.radius, plane }
    : { kind: 'sketch', profile: 'rectangle', min: [-cut.profile.w / 2, -cut.profile.d / 2], max: [cut.profile.w / 2, cut.profile.d / 2], plane };
  return [sketch, { kind: 'extrude', sketch: 0, height: c.height }];
};

/**
 * The placed part (unplaced: its own frame) with these cuts taken from each of its bodies: per body, per cut, a tool and a
 * difference, in the cut's order. The differences are marked (`made.command` 'assembly-cut'), so a body keeps the key and the look
 * key it has in the definition (engine/ids.ts reads through them). Bought elements are left whole.
 */
export function cutBase(base: StudioDoc, inst: PartInstance, cuts: readonly AssemblyCut[], box?: PartBox | null, cutBought = false): StudioDoc {
  const nodes: ModelNode[] = [...base.nodes];
  for (const ref of Object.values(base.outputs)) {
    // (A bought element — a key, a bearing, a ring — is not cut: it is bought whole, and stays the BOM's bought line.)
    const top = base.nodes[ref.node]; if (!cutBought && top && boughtOf(top).bought) continue;
    let at = ref;
    for (const cut of cuts) {
      const sketchAt = nodes.length, [sketch, extrude] = toolNodes(cut, cutTool(cut, inst, box).chunk);
      nodes.push(sketch, { ...extrude, sketch: sketchAt } as ModelNode);
      nodes.push({ kind: 'difference', parent: at, tool: { node: nodes.length - 1, side: 'solid' }, made: { command: 'assembly-cut', values: { cut: cut.id } } });
      at = { node: nodes.length - 1, side: 'solid' };
    }
  }
  return prefixDoc({ ...base, nodes }, nodes.length);
}

/**
 * What a cut makes of this part, as the BOM compares it, in the part's own frame and rounded as a part's shape is, with no cut id or name:
 * a circle has no axis of its own; a through cut is its axis line (the direction up to sign, the point nearest the part's origin), so the
 * same hole entered from the other face is the same; a depth cut is where it starts, its direction and its depth.
 */
export function cutShapeOf(inst: PartInstance, parent: Pick<StudioDoc, 'assemblyCuts'>): string {
  const round = (v: unknown): unknown => typeof v === 'number' ? Math.round(v * 1e6) / 1e6 + 0 : Array.isArray(v) ? v.map(round) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, round(x)])) : v;
  const sign = (v: V3): V3 => { const k = v.findIndex(c => Math.abs(c) > 1e-9); return k >= 0 && v[k] < 0 ? [-v[0], -v[1], -v[2]] : v; };
  return JSON.stringify(cutsOf(inst, parent).map(c => {
    const t = cutTool(c, inst), through = c.depth === 'through', rectangle = c.profile.kind === 'rectangle';
    return round({ profile: c.profile, ...(through ? { axis: sign(t.chunk.normal), through: t.foot } : { start: t.chunk.origin, dir: t.chunk.normal, depth: c.depth }), ...(rectangle ? { x: through ? sign(t.chunk.xAxis) : t.chunk.xAxis } : {}) });
  }));
}
