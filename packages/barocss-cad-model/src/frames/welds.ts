// FRd1 (O118): a frame's weld joints and their records — read off the geometry (FR S0's P1: a seam is the end face's
// outer loop, so no table of lengths), each with the person's weld (kind, size, all round, notes) or the estimate rule's,
// said as one. A joint is where a member's end meets another member:
//   - mitre: two members cut on one plane at a corner (the kernel's `with`): one seam, the mitre face's loop; a butt weld.
//   - butt:  a member ended on the face of one running through (the kernel's `with`): the end face's loop; a fillet.
//   - on-face: a member's square end lying on other members' faces with no corner between them (a leg under a top), found
//     by contact — the end face's plane on an opposite face of another member, their outlines overlapping: a fillet.
// The size, unset, is the thinner wall of the two (an estimate: a rule of thumb, not a calculation); a section with no
// wall (a sketch, a T-slot extrusion) has none, said. A record whose joint is gone is kept and listed as orphaned.
import type { BodyResult } from '../engine/evaluate';
import type { DisplayMesh } from '../engine/mesh';
import { nodeIndexOf } from '../engine/ids';
import type { InlineSection, MemberSection, StudioDoc } from '../engine/doc';
import { faceBoundary } from '../app/faceProfile';
import { partCutList } from '../app/cutList';
import { evaluatePart } from '../engine/evaluate';
import type { TableContent } from '../drawing/table';

type Vec3 = [number, number, number];
export type WeldKind = 'fillet' | 'butt';
export interface WeldRecord { joint: string; kind?: WeldKind; sizeMM?: number; allRound?: boolean; notes?: string }
export interface WeldJoint {
  /** Stable while the frame's members are: `<body>.<end>` (a mitre by its first member's end). */
  readonly id: string;
  readonly kind: 'mitre' | 'butt' | 'on-face';
  /** The member whose end it is, and the members it meets (body keys). */
  readonly body: string; readonly end: 'start' | 'end'; readonly meets: readonly string[];
  /** The end face (its name on `body`) whose outer loop the seam runs round. */
  readonly face: string;
  readonly seamMM: number;
  /** exact: the loop's sides are straight (the display mesh holds them exactly); mesh: a curved side, within the mesh's chord tolerance. */
  readonly seamBasis: 'exact' | 'mesh';
  /** A point on the seam (the loop's first corner) and its centre, for a symbol's arrow and the list. */
  readonly at: Vec3; readonly centre: Vec3;
  readonly weld: { readonly kind: WeldKind; readonly sizeMM: number | null; readonly sizeBasis: 'set' | 'estimate' | 'none'; readonly allRound: boolean; readonly notes?: string };
}
export interface WeldList { readonly joints: readonly WeldJoint[]; readonly totals: { readonly count: number; readonly seamMM: number }; readonly orphaned: readonly WeldRecord[]; readonly notes: readonly string[] }

const PLANE = 1e-6, r6 = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
const sub = (a: readonly number[], b: readonly number[]): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const perimeter = (loop: readonly Vec3[]) => { let t = 0; for (let i = 0; i < loop.length; i++) { const p = loop[i], q = loop[(i + 1) % loop.length]; t += Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]); } return t; };

/** The joints of the part's frame members, with their welds (the document's records over the rule's). */
export function weldList(doc: StudioDoc, bodies: readonly BodyResult[]): WeldList {
  const members = bodies.filter(b => b.cutPiece), byOutput = new Map(members.map(b => [b.cutPiece!.id, b]));
  const records = new Map((doc.frames?.welds ?? []).map(r => [r.joint, r])), joints: Bare[] = [], seen = new Set<string>();
  for (const b of members) {
    const piece = b.cutPiece!, frame = piece.id.includes('/') ? piece.id.slice(0, piece.id.lastIndexOf('/')) : null;
    for (const e of piece.ends) {
      const partner = frame !== null && e.with !== undefined ? byOutput.get(`${frame}/${e.with}`) : undefined;
      if (e.kind === 'mitre' && partner) {
        // (One joint a corner: the lesser of its two ends' ids names it.)
        const back = partner.cutPiece!.ends.find(x => x.kind === 'mitre' && x.with !== undefined && `${frame}/${x.with}` === piece.id && x.point === e.point);
        const mine = `${b.key}.${e.end}`, theirs = back ? `${partner.key}.${back.end}` : mine, id = mine < theirs ? mine : theirs;
        if (seen.has(id)) continue; seen.add(id);
        const j = jointOn(b, e.end, 'mitre', [partner.key], id);
        if (j) joints.push(j);
      } else if (e.kind === 'butt' && partner) {
        const j = jointOn(b, e.end, 'butt', [partner.key], `${b.key}.${e.end}`);
        if (j) { seen.add(j.id); joints.push(j); }
      } else if (e.kind === 'square' && e.with === undefined) {
        const touched = touching(b, e.end, members);
        if (touched.length) { const j = jointOn(b, e.end, 'on-face', touched, `${b.key}.${e.end}`); if (j) { seen.add(j.id); joints.push(j); } }
      }
    }
  }
  const notes: string[] = [];
  const welded = joints.map(j => withWeld(doc, bodies, j, records.get(j.id), notes));
  const orphaned = [...records.values()].filter(r => !welded.some(j => j.id === r.joint));
  return { joints: welded, totals: { count: welded.length, seamMM: r6(welded.reduce((t, j) => t + j.seamMM, 0)) }, orphaned, notes: [...new Set(notes)] };
}

/** The end face of a member (its name ends `.start` / `.end`, a cut's kind after it) and its loops. */
function endFace(b: BodyResult, end: 'start' | 'end'): { index: number; name: string } | null {
  const faces = b.mesh.faces;
  for (let k = 0; k < faces.length; k++) { const n = faces[k].name; if (faces[k].kind === 'plane' && (n.endsWith(`.${end}`) || n.includes(`.${end}.`))) return { index: k, name: n }; }
  return null;
}
const outerLoop = (mesh: DisplayMesh, face: number): Vec3[] | null => { const loops = faceBoundary(mesh, face); if (!loops.length) return null; let best = loops[0], len = perimeter(best); for (const l of loops) { const p = perimeter(l); if (p > len) { best = l; len = p; } } return best; };

type Bare = Omit<WeldJoint, 'weld' | 'seamBasis'>;
function jointOn(b: BodyResult, end: 'start' | 'end', kind: WeldJoint['kind'], meets: string[], id: string): Bare | null {
  const f = endFace(b, end); if (!f) return null;
  const loop = outerLoop(b.mesh, f.index); if (!loop) return null;
  const c: Vec3 = [0, 0, 0]; for (const p of loop) { c[0] += p[0] / loop.length; c[1] += p[1] / loop.length; c[2] += p[2] / loop.length; }
  return { id, kind, body: b.key, end, meets, face: f.name, seamMM: r6(perimeter(loop)), at: [r6(loop[0][0]), r6(loop[0][1]), r6(loop[0][2])], centre: [r6(c[0]), r6(c[1]), r6(c[2])] };
}

/** The other members whose planar faces a member's square end lies on: the opposite normal, the same plane, the outlines' boxes overlapping. */
function touching(b: BodyResult, end: 'start' | 'end', members: readonly BodyResult[]): string[] {
  const f = endFace(b, end); if (!f) return [];
  const n = b.mesh.faces[f.index].normal, loop = outerLoop(b.mesh, f.index); if (!loop) return [];
  const out: string[] = [];
  for (const o of members) {
    if (o === b) continue;
    for (let k = 0; k < o.mesh.faces.length; k++) {
      const g = o.mesh.faces[k];
      if (g.kind !== 'plane' || dot(g.normal, n) > -1 + 1e-9) continue;
      const other = outerLoop(o.mesh, k); if (!other || Math.abs(dot(sub(other[0], loop[0]), n)) > PLANE) continue;
      if (overlap(loop, other, n)) { out.push(o.key); break; }
    }
  }
  return out;
}
/** Whether two loops in one plane (normal n) overlap with area: their boxes in the plane's two directions. */
function overlap(a: readonly Vec3[], b: readonly Vec3[], n: readonly number[]): boolean {
  const u: Vec3 = Math.abs(n[0]) < 0.9 ? [0, -n[2], n[1]] : [-n[2], 0, n[0]], l = Math.hypot(...u), uu: Vec3 = [u[0] / l, u[1] / l, u[2] / l];
  const v: Vec3 = [n[1] * uu[2] - n[2] * uu[1], n[2] * uu[0] - n[0] * uu[2], n[0] * uu[1] - n[1] * uu[0]];
  for (const axis of [uu, v]) {
    const pa = a.map(p => dot(p, axis)), pb = b.map(p => dot(p, axis));
    if (Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb)) <= 1e-6) return false;
  }
  return true;
}

/** A member's section as the document gives it (a frame's override, else the frame's; a library row resolved). */
function sectionOf(doc: StudioDoc, b: BodyResult): InlineSection | null {
  const id = b.cutPiece!.id, slash = id.lastIndexOf('/'), nodeId = slash < 0 ? id : id.slice(0, slash), member = slash < 0 ? -1 : Number(id.slice(slash + 1));
  const node = doc.nodes[nodeIndexOf(doc.nodes, nodeId)];
  let s: MemberSection | undefined;
  if (node?.kind === 'frame') s = node.overrides?.find(o => o.member === member)?.section ?? node.section;
  else if (node?.kind === 'frame-member') s = node.section;
  if (s?.kind === 'library') { const id2 = s.id; return doc.frames?.sections?.find(r => r.id === id2)?.section ?? null; }
  return s && s.kind !== 'sketch' ? s : null;
}
/** A section's wall (mm) and whether its outer outline is straight-sided: the size rule's input and the seam's basis. */
function wallOf(s: InlineSection | null): { wall: number | null; straight: boolean } {
  const num = (v: unknown) => typeof v === 'number' ? v : NaN;
  if (!s) return { wall: null, straight: false };
  switch (s.kind) {
    case 'rect-tube': return { wall: num(s.wall), straight: num(s.outerRadius) === 0 };
    case 'round-tube': return { wall: num(s.wall), straight: false };
    case 'angle': return { wall: num(s.thickness), straight: num(s.rootRadius) === 0 && num(s.toeRadius) === 0 };
    case 'channel': return { wall: Math.min(num(s.web), num(s.flange)), straight: num(s.rootRadius) === 0 };
    case 'tslot': return { wall: null, straight: false };
  }
}

function withWeld(doc: StudioDoc, bodies: readonly BodyResult[], j: Bare, r: WeldRecord | undefined, notes: string[]): WeldJoint {
  const own = wallOf(sectionOf(doc, bodies.find(b => b.key === j.body)!));
  const walls = [own.wall, ...j.meets.map(k => wallOf(sectionOf(doc, bodies.find(b => b.key === k)!)).wall)].filter((w): w is number => w !== null && Number.isFinite(w));
  const kind: WeldKind = r?.kind ?? (j.kind === 'mitre' ? 'butt' : 'fillet');
  const estimate = walls.length === j.meets.length + 1 ? Math.min(...walls) : null;
  if (r?.sizeMM === undefined && estimate !== null) notes.push('sizes unset are the thinner wall of the two members: an estimate (a rule of thumb, not a calculation)');
  if (r?.sizeMM === undefined && estimate === null) notes.push('a member with no wall (a sketch or T-slot section) gives no size estimate: set one');
  const sizeMM = r?.sizeMM ?? estimate, sizeBasis = r?.sizeMM !== undefined ? 'set' as const : estimate !== null ? 'estimate' as const : 'none' as const;
  return { ...j, seamBasis: own.straight ? 'exact' : 'mesh', weld: { kind, sizeMM, sizeBasis, allRound: r?.allRound ?? true, ...(r?.notes ? { notes: r.notes } : {}) } };
}

/** The weld list as a drawing table (the 'weld-list' source): W1… in order, the members by their cut-list items. */
export function weldListTable(w: WeldList, items: ReadonlyMap<string, number>): TableContent {
  const item = (k: string) => items.get(k) ?? k;
  const rows: TableContent['rows'] = w.joints.map((j, k) => [`W${k + 1}`, j.kind === 'on-face' ? 'ON FACE' : j.kind.toUpperCase(), [j.body, ...j.meets].map(item).join(' · '), j.weld.kind.toUpperCase(),
    j.weld.sizeMM === null ? null : `${+j.weld.sizeMM.toFixed(2)}${j.weld.sizeBasis === 'estimate' ? '*' : ''}`, j.seamMM, j.weld.allRound ? 'YES' : 'NO']);
  const mesh = w.joints.flatMap((j, k) => j.seamBasis === 'mesh' ? [`W${k + 1}`] : []);
  return {
    title: 'WELD LIST',
    columns: [{ key: 'weld', label: 'WELD' }, { key: 'joint', label: 'JOINT' }, { key: 'members', label: 'ITEMS' }, { key: 'kind', label: 'WELD KIND' }, { key: 'size', label: 'SIZE', unit: 'mm', align: 'end' },
      { key: 'seam', label: 'SEAM', unit: 'mm', digits: 1 }, { key: 'round', label: 'ALL ROUND' }],
    rows,
    notes: [
      `${w.totals.count} welds, seams ${+w.totals.seamMM.toFixed(1)} mm in all`,
      ...(w.joints.some(j => j.weld.sizeBasis === 'estimate') ? ['* the thinner wall of the members: an estimate, not a calculation'] : []),
      ...(mesh.length ? [`${mesh.join(', ')}: seam along a curved side, to the display mesh's chord tolerance`] : []),
    ],
  };
}
/** The drawing tables' 'weld-list' source: the part's frame joints (evaluated when the bodies are not given). */
export function weldListSource(ctx: { doc: StudioDoc; bodies?: readonly BodyResult[] }): TableContent | { error: string } {
  const e = ctx.bodies ? null : evaluatePart(ctx.doc, 0), bodies = ctx.bodies ?? (e?.ok ? e.bodies : []);
  const w = weldList(ctx.doc, bodies);
  if (!w.joints.length) return { error: 'no weld joints (frame members meeting at a corner, a butt or a face)' };
  const list = partCutList(ctx.doc, bodies), items = new Map<string, number>();
  for (const r of list?.rows ?? []) for (const k of r.pieces) items.set(k, r.item);
  return weldListTable(w, items);
}
