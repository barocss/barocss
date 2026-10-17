// The chat's tools: the studio's own commands (validated by the same `available` / `fields` rules as
// the HUD and built by the same `build`), raw feature nodes for what has no command (sketched profiles,
// revolves, sweeps, lofts), the feature editor's fields, delete, measure, select and a part summary.
// Each change is evaluated by the engine before it is kept; the result is what the model reads back.
import { commandById, commands, patchValues, refOf, shownFields, type Ctx, type Field, type Values } from '../app/commands';
import { editFields } from '../app/editFields';
import { measureBetween, measureItem, type MeasurePick } from '../app/measure';
import { featureLabel, prefixDoc, withNode, type ModelNode, type StudioDoc } from '../engine/doc';
import type { BodyResult, EvalResult } from '../engine/evaluate';
import type { ToolDefinition } from './api';
import { checkNode, deleteFeature } from './features';
import type { ImageTrace, Pt } from './trace';
import { ASSEMBLY_TOOL_NAMES, ASSEMBLY_TOOLS, runAssemblyTool, solveDoc } from './assembly';
import { insideRing as inside } from '../engine/geom2';
import { resolveNames, type NameSelection } from './names';
export { resolveNames, type NameSelection };

/** A selection by persistent names (stable across evaluations, unlike mesh indices). */
/** The part as the chat turn has built it so far. */
/** `images`: traces of the images attached in this conversation (image 1 first). */
export interface ChatState { doc: StudioDoc; bodies: BodyResult[]; selection?: NameSelection; images?: ImageTrace[] }
export type Evaluate = (doc: StudioDoc) => Promise<EvalResult | null>;
export interface ToolOutcome { state: ChatState; content: string; isError: boolean; changed: boolean; summary: string }

/** Commands the chat can run (the ones that build; sketch-mode and measure UI actions are tools of their own). */
// (Loft takes sketches picked in the studio, Align a face clicked there; chat writes a loft node with
// add_features, and moves with move or rotate, instead.)
// (Not loft, align or a sweep along a curve: they need sketches, faces or curves picked in the viewport.)
export const CHAT_COMMANDS = commands.filter(c => c.build && c.id !== 'loft' && c.id !== 'align' && c.id !== 'sweep-curve').map(c => c.id);

/** What each command needs selected and what its values mean. */
export const COMMAND_DOCS: Record<string, { selection: string; values: Record<string, string> }> = {
  extrude: { selection: 'none: the newest finished sketch no feature uses yet', values: { h: 'distance along the sketch normal', draft: 'wall draft degrees (0: straight)', op: 'join | new | cut (only for a sketch drawn on a body face)', depth: 'distance | through (a cut only)' } },
  revolve: { selection: 'none: the newest finished sketch no feature uses yet', values: { axis: 'y | x: the sketch axis to turn about', deg: 'angle, up to 360', op: 'join | new | cut (sketch on a body face)' } },
  pipe: { selection: 'none: the newest finished sketch no feature uses yet', values: { h: 'straight run before and after the bend', bend: 'bend radius', bendDeg: 'bend angle', toward: 'x | -x | y | -y', op: 'join | new | cut (sketch on a body face)' } },
  'offset-face': { selection: 'faces: [one flat face of a body]', values: { d: 'distance along the face normal: + out (material added), − in (taken off)' } },
  box: { selection: 'none (or a top face to stack on)', values: { w: 'width along X', d: 'depth along Y', h: 'height along Z', x: 'min corner X', y: 'min corner Y', z: 'base Z' } },
  cylinder: { selection: 'none', values: { r: 'radius', h: 'height', x: 'centre X', y: 'centre Y', z: 'base Z' } },
  sphere: { selection: 'none', values: { r: 'radius', x: 'centre X', y: 'centre Y', z: 'Z it stands on (its bottom)' } },
  cone: { selection: 'none', values: { r: 'base radius', rt: 'top radius (0: a point)', h: 'height', x: 'centre X', y: 'centre Y', z: 'base Z' } },
  torus: { selection: 'none', values: { R: 'ring radius (axis to tube centre)', r: 'tube radius', x: 'centre X', y: 'centre Y', z: 'Z it lies on' } },
  tube: { selection: 'none', values: { r: 'outer radius', ri: 'inner radius', h: 'length', x: 'centre X', y: 'centre Y', z: 'base Z' } },
  wedge: { selection: 'none', values: { w: 'width X (high end at x)', d: 'depth Y', h: 'height Z', x: 'corner X', y: 'corner Y', z: 'base Z' } },
  prism: { selection: 'none', values: { n: 'sides (3–12)', s: 'size across the flats', h: 'height', x: 'centre X', y: 'centre Y', z: 'base Z' } },
  hole: { selection: 'faces: [one flat face facing ±X/±Y/±Z]', values: { type: 'through | blind | counterbore | countersink (90°) | tapped', d: 'diameter (tapped: the tap drill, set from thread)', depth: 'blind depth (also tapped with tend blind)', cd: 'counterbore diameter', ch: 'counterbore depth', csd: 'countersink diameter at the face', thread: 'tapped: M3 | M4 | M5 | M6 | M8 | M10 | M12 (coarse, cosmetic thread)', tend: 'tapped: through | blind', pat: 'one | row | circle (copies on the face, the first at x, y)', pn: 'copies in all (2–64)', pa: 'row: step along the first axis', pb: 'row: step along the second axis', qa: 'circle: its centre, first axis', qb: 'circle: its centre, second axis', x: 'centre, first axis of the face plane (Z face: X; X face: Y; Y face: X)', y: 'centre, second axis (Z face: Y; X face: Z; Y face: Z)' } },
  chamfer: { selection: 'edges: [edges of one body]', values: { distance: 'chamfer distance' } },
  draft: { selection: 'faces: [side faces of one body, square to Z, not touching each other — or every side of an extruded body]', values: { deg: 'draft angle in degrees (positive: the top leans in), below 45' } },
  fillet: { selection: 'edges: [edges of one body]', values: { radius: 'fillet radius' } },
  shell: { selection: 'faces to open (all of one body), or bodies: [one body] for a closed hollow', values: { t: 'wall thickness' } },
  move: { selection: 'bodies: [one body]', values: { x: 'ΔX', y: 'ΔY', z: 'ΔZ', ax: 'to X (the box corner; the HUD keeps it with ΔX — give one of the two)', ay: 'to Y', az: 'to Z' } },
  rotate: { selection: 'bodies: [one body]', values: { axis: 'x | y | z', angle: 'degrees', px: 'pivot x mm (default: the body\'s centre)', py: 'pivot y mm', pz: 'pivot z mm' } },
  scale: { selection: 'bodies: [one body]', values: { factor: 'uniform factor (1 = unchanged)', px: 'pivot x mm (default: the body\'s centre)', py: 'pivot y mm', pz: 'pivot z mm' } },
  fastener: { selection: 'none', values: { kind: 'hex-bolt (ISO 4017) | socket-screw (ISO 4762) | csk-screw (ISO 10642, countersunk: the head sinks below z, its top flush) | hex-nut (ISO 4032) | washer (ISO 7089)', size: 'M3 | M4 | M5 | M6 | M8 | M10 | M12 (coarse pitch)', length: 'bolt/screw length in mm, from the size\'s standard lengths (ISO 4017 for hex bolts, ISO 4762 for cap screws, ISO 10642 for countersunk screws, overall; as text, e.g. "20")', joint: 'free (on its own) | nut (through a clearance hole: washer + nut under the far face, `grip` below the seat) | tapped (into a tapped hole)', grip: 'with joint nut: the clamped thickness in mm below the seat (the bolt must reach grip + washer + nut + 2 pitches)', x: 'axis X', y: 'axis Y', z: 'seat Z: heads, nuts and washers sit on it, a shank goes down from it (a hole\'s rim)', insert: 'part (its features join this part) | instance (a part of its own placed in the assembly: in the bill of materials, mated like any part)', model: 'hex-bolt and hex-nut: cosmetic (a plain cylinder, the thread drawn) | modelled (the ISO 68-1 thread as helical B-spline faces: true shape and mass)' } },
  duplicate: { selection: 'bodies: [one body]', values: { dx: 'copy offset X', dy: 'copy offset Y', dz: 'copy offset Z' } },
  mirror: { selection: 'bodies: [one body]', values: { plane: 'yz | xz | xy; keeps the original', at: 'where the plane crosses its axis (yz: X; 0: through the origin)' } },
  'linear-pattern': { selection: 'bodies: [one body]', values: { axis: 'x | y | z', spacing: 'mm between copies', count: 'copies including the original', result: 'one (joined) | separate (each its own body)' } },
  'circular-pattern': { selection: 'bodies: [one body]', values: { axis: 'z | x | y (quarter turns)', count: 'copies including the original', span: 'degrees the copies spread over about Z (360: an even full turn)', px: 'Z axis position X (default 0)', py: 'Z axis position Y (default 0)', result: 'one (joined) | separate (each its own body)' } },
  split: { selection: 'bodies: [one body]', values: { axis: 'normal of the cutting plane: x | y | z | n (any direction: nx, ny, nz)', at: 'plane position (axis n: the value of nx·x + ny·y + nz·z on the plane — x + y = at for 1, 1, 0, a mitre)', nx: 'axis n: the normal\'s X', ny: 'its Y', nz: 'its Z' } },
  union: { selection: 'bodies: [two bodies]', values: {} },
  difference: { selection: 'bodies: [body to cut, tool body]', values: {} },
  intersect: { selection: 'bodies: [two bodies]', values: {} },
};

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const v3 = (v: readonly number[]) => v.map(r3);
const json = (v: unknown) => JSON.stringify(v);


/** The visible bodies, with their faces and edges by name when `detail` (capped for big parts). */
export function describeBodies(doc: StudioDoc, bodies: BodyResult[], detail: boolean, cap = 120) {
  return bodies.map(b => {
    const ref = refOf(b), node = doc.nodes[ref.node], m = b.mesh;
    const out: Record<string, unknown> = {
      key: b.key, made_by: node ? `${ref.node}: ${featureLabel(node, ref.node, doc.nodes)}` : undefined,
      volume_mm3: b.volumeMM3 === null ? null : r3(b.volumeMM3), bounds: { min: v3(m.bounds.min), max: v3(m.bounds.max) },
      face_count: m.faces.length, edge_count: m.edges.length,
    };
    if (detail) {
      out.faces = m.faces.slice(0, cap).map(f => ({ name: f.name.split('+')[0], ...(f.name.includes('+') ? { also: f.name.split('+').slice(1) } : {}), kind: f.kind, normal: v3(f.normal), centre: v3(f.centroid), area_mm2: r3(f.areaMM2), ...(f.radius ? { radius: r3(f.radius) } : {}) }));
      out.edges = m.edges.slice(0, cap).map(e => ({ name: e.names[0], from: v3(e.a), to: v3(e.b), ...(e.straight ? { line: e.axis ? `along ${e.axis}` : 'oblique' } : { line: 'curve' }) }));
      if (m.faces.length > cap || m.edges.length > cap) out.truncated = `first ${cap} faces/edges shown`;
    }
    return out;
  });
}

function features(doc: StudioDoc) {
  return doc.nodes.map((n, i) => ({ index: i, label: featureLabel(n, i, doc.nodes), node: n }));
}

const MUTATORS = new Set(['run_command', 'add_features', 'edit_feature', 'delete_feature', 'extrude_image_layer', 'inflate_image_layer']);
const DETAIL_LIMIT = 80;

/** Evaluates a candidate document: the new state, or the engine's refusal as a tool error. */
async function accept(state: ChatState, next: StudioDoc, evaluate: Evaluate, what: string, extra: Record<string, unknown> = {}): Promise<ToolOutcome> {
  const r = await evaluate(next);
  if (!r) return fail(state, 'The evaluation was superseded; try again.');
  if (!r.ok) return fail(state, `${r.error.title}. ${r.error.hint}`, { detail: r.error.detail, kept: 'the part is unchanged' });
  const entries = r.bodies.reduce((s, b) => s + b.mesh.faces.length + b.mesh.edges.length, 0);
  // On a big part, the bodies this change made (or changed) are still listed in full, when small enough.
  const fresh = new Set(state.bodies.map(b => `${b.key}:${b.volumeMM3}`));
  const result = {
    ok: true, did: what, ...extra, feature_count: next.nodes.length,
    bodies: entries <= DETAIL_LIMIT ? describeBodies(next, r.bodies, true)
      : r.bodies.map(b => describeBodies(next, [b], !fresh.has(`${b.key}:${b.volumeMM3}`) && b.mesh.faces.length + b.mesh.edges.length <= DETAIL_LIMIT)[0]),
    ...(entries > DETAIL_LIMIT ? { note: 'faces and edges of other bodies: get_part_summary {"body": key}' } : {}),
  };
  return { state: { ...state, doc: next, bodies: r.bodies }, content: json(result), isError: false, changed: true, summary: `${what} → ${r.bodies.length} bod${r.bodies.length === 1 ? 'y' : 'ies'}${r.bodies[0]?.volumeMM3 != null ? `, ${Math.round(r.bodies.reduce((s, b) => s + (b.volumeMM3 ?? 0), 0))} mm³` : ''}` };
}

function fail(state: ChatState, reason: string, extra: Record<string, unknown> = {}): ToolOutcome {
  return { state, content: json({ ok: false, error: reason, ...extra }), isError: true, changed: false, summary: reason };
}

function checkValues(fields: Field[], values: Values): string | null {
  for (const f of shownFields(fields, values)) {
    const v = values[f.key];
    if (v === undefined || v === '') return `"${f.key}" (${f.label}) is required.`;
    if (f.kind === 'choice') { if (!f.options.some(o => o.value === String(v))) return `"${f.key}" is one of ${f.options.map(o => o.value).join(', ')}.`; continue; }
    const n = Number(v);
    if (!Number.isFinite(n)) return `"${f.key}" (${f.label}) must be a number.`;
    if (f.kind === 'count' && !Number.isInteger(n)) return `"${f.key}" must be a whole number.`;
    if (f.min !== undefined && n < f.min) return `"${f.key}" (${f.label}) must be at least ${f.min}.`;
    if (f.max !== undefined && n > f.max) return `"${f.key}" (${f.label}) must be at most ${f.max}.`;
  }
  return null;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const strings = (v: unknown) => Array.isArray(v) ? v.map(String) : [];

function traceOf(state: ChatState, image: unknown): ImageTrace | string {
  const list = state.images ?? [];
  if (!list.length) return 'No image is attached in this conversation.';
  const i = Number(image ?? list.length);
  return Number.isInteger(i) && list[i - 1] ? list[i - 1] : `There is no image ${String(image)} (images 1–${list.length}).`;
}

/** The silhouette's box in trace pixels: every layer is placed by it, so layers line up. */
function silhouetteBox(t: ImageTrace) {
  const pts = (t.layers.find(l => l.id === 'silhouette') ?? t.layers[0]).regions.flatMap(r => r.outer);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function imageLayers(t: ImageTrace) {
  const box = silhouetteBox(t), w = box.maxX - box.minX, h = box.maxY - box.minY;
  return {
    silhouette_aspect: Math.round(h / w * 1000) / 1000, background: t.background,
    note: 'height of the figure = width_mm × silhouette_aspect. Layer boxes are fractions of the silhouette box, x from the left, y from the bottom.',
    layers: t.layers.map(l => {
      const pts = l.regions.flatMap(r => r.outer), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const fx = (x: number) => r3((x - box.minX) / w), fy = (y: number) => r3((box.maxY - y) / h);
      return { id: l.id, name: l.name, color: l.color, area_fraction: l.areaFraction, regions: l.regions.length, holes: l.regions.reduce((s, r) => s + r.holes.length, 0),
        points: l.regions.reduce((s, r) => s + r.outer.length + r.holes.reduce((a, h) => a + h.length, 0), 0),
        box: { x: [fx(Math.min(...xs)), fx(Math.max(...xs))], y: [fy(Math.max(...ys)), fy(Math.min(...ys))] } };
    }),
  };
}

/**
 * Sketch nodes of a traced layer, scaled so the silhouette is `width` mm wide (y up), lying flat or standing.
 * A sketch's holes cut all its regions, so islands inside another region's hole (eyes inside an outline)
 * go in sketches of their own: one sketch per nesting depth.
 */
export function layerSketches(t: ImageTrace, layerId: string, width: number, at: [number, number], standing: boolean, y0: number): ModelNode[] | string {
  const layer = t.layers.find(l => l.id === layerId);
  if (!layer) return `No layer "${layerId}"; layers: ${t.layers.map(l => l.id).join(', ')}.`;
  if (!layer.regions.length) return `Layer "${layerId}" has no outline.`;
  const box = silhouetteBox(t), k = width / (box.maxX - box.minX);
  const map = (p: Pt): [number, number] => [r3(at[0] + (p[0] - box.minX) * k), r3(at[1] + (box.maxY - p[1]) * k)];
  // (Image y runs down: flipping it reverses each loop's turn, which the kernel orients itself.)
  const loop = (pts: Pt[]) => pts.map(p => ({ kind: 'line' as const, start: map(p) }));
  const depth = (r: typeof layer.regions[number]) => layer.regions.filter(o => o !== r && inside(r.outer[0], o.outer)).length;
  const levels = new Map<number, typeof layer.regions>();
  for (const r of layer.regions) { const d = depth(r); levels.set(d, [...(levels.get(d) ?? []), r]); }
  return [...levels.keys()].sort((a, b) => a - b).map(d => {
    const [first, ...rest] = levels.get(d)!;
    return {
      kind: 'sketch', profile: 'polygon', points: first.outer.map(map),
      ...(rest.length ? { regions: rest.map(r => loop(r.outer)) } : {}),
      ...(levels.get(d)!.some(r => r.holes.length) ? { holes: levels.get(d)!.flatMap(r => r.holes.map(loop)) } : {}),
      // Standing: sketch X along world X, sketch Y up world Z, extruded towards −Y (the front).
      ...(standing ? { plane: { origin: [0, y0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] } } : {}),
    } as ModelNode;
  });
}

/** A closed loop resampled to `n` points evenly along its length. */
function resample(p: Pt[], n: number): Pt[] {
  const len: number[] = [0];
  for (let i = 1; i <= p.length; i++) { const a = p[i - 1], b = p[i % p.length]; len.push(len[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const total = len[p.length], out: Pt[] = [];
  for (let k = 0, i = 0; k < n; k++) {
    const d = total * k / n; while (len[i + 1] < d) i++;
    const a = p[i], b = p[(i + 1) % p.length], t = (d - len[i]) / ((len[i + 1] - len[i]) || 1);
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}
const centroidOf = (p: Pt[]): Pt => {
  let a = 0, x = 0, y = 0;
  for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length], c = q[0] * r[1] - r[0] * q[1]; a += c; x += (q[0] + r[0]) * c; y += (q[1] + r[1]) * c; }
  return a ? [x / (3 * a), y / (3 * a)] : p[0];
};
const areaOf = (p: Pt[]) => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a / 2; };
const insidePoly = (pt: Pt, poly: Pt[]) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c; } return c; };

/** Section scales of an inflated body (pebble-like: round at the rim, full in the middle). */
export const INFLATE = [-1, -0.5, 0, 0.5, 1].map(t => ({ t, z: Math.sin(t * Math.PI / 2) / 2, s: Math.max(0.18, Math.cos(t * Math.PI / 2)) }));
const BUMP = [0, 0.4, 0.75, 1].map(t => ({ z: t, s: Math.max(0.2, Math.cos(t * Math.PI / 2)) }));

/** The front surface height (above the mid plane) of an inflated outline at a point, or null outside it. */
export function surfaceAt(outline: Pt[], centre: Pt, depth: number, p: Pt): number | null {
  // The smallest section scale that still holds the point; the sections follow z = depth/2 · √(1 − s²).
  const holds = (s: number) => insidePoly([centre[0] + (p[0] - centre[0]) / s, centre[1] + (p[1] - centre[1]) / s], outline);
  if (!holds(1)) return null;
  let lo = INFLATE[INFLATE.length - 1].s, hi = 1;
  if (holds(lo)) return depth / 2 * Math.sqrt(1 - lo * lo);
  for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (holds(m)) hi = m; else lo = m; }
  return depth / 2 * Math.sqrt(1 - hi * hi);
}

/**
 * Runs one tool call against the turn's state. Assembly tools act on the instances and mates; a part
 * tool with `part` set to an instance id builds that part (in its own coordinates), and the assembly is
 * re-solved after it, as after a change of the base part.
 */
export async function runTool(state: ChatState, name: string, input: unknown, evaluate: Evaluate): Promise<ToolOutcome> {
  const args = isObj(input) ? input : {};
  if (ASSEMBLY_TOOL_NAMES.has(name)) {
    const out = await runAssemblyTool(state, name, args, evaluate);
    return { state: { ...state, doc: out.doc }, content: out.content, isError: out.isError, changed: out.changed, summary: out.summary };
  }
  const { part, ...rest } = args;
  if (part === undefined || part === 'base') {
    const out = await runPartTool(state, name, rest, evaluate);
    if (!out.changed || !state.doc.mates?.length) return out;
    // Parts mated to the base part follow its edit.
    const solved = solveDoc(out.state.doc, state.doc.instances);
    return { ...out, state: { ...out.state, doc: solved.doc }, ...(solved.problems.length ? { content: out.content.replace(/}$/, `,"unmet_mates":${JSON.stringify(solved.problems)}}`) } : {}) };
  }
  const inst = state.doc.instances?.find(i => i.id === part);
  if (!inst) return fail(state, `No part "${String(part)}"; parts: base${(state.doc.instances ?? []).map(i => `, ${i.id}`).join('')}.`);
  if (name === 'select') return fail(state, 'The viewport selection shows the base part\'s faces only; select without "part".');
  const r = await evaluate(inst.doc);
  const sub: ChatState = { doc: inst.doc, bodies: r?.ok ? r.bodies : [], ...(state.images ? { images: state.images } : {}) };
  const out = await runPartTool(sub, name, rest, evaluate);
  const content = out.content.replace(/^\{/, `{"part":${JSON.stringify(inst.id)},`);
  if (!out.changed) return { ...out, state, content };
  const doc = { ...state.doc, instances: state.doc.instances!.map(i => i.id === inst.id ? { ...i, doc: out.state.doc } : i) };
  const solved = solveDoc(doc, state.doc.instances);
  return { ...out, state: { ...state, doc: solved.doc }, content: solved.problems.length ? content.replace(/}$/, `,"unmet_mates":${JSON.stringify(solved.problems)}}`) : content, summary: `${inst.id}: ${out.summary}` };
}

async function runPartTool(state: ChatState, name: string, input: unknown, evaluate: Evaluate): Promise<ToolOutcome> {
  const args = isObj(input) ? input : {};
  if ('__invalid_json' in args) return fail(state, 'The tool input was not valid JSON; send it again.');
  switch (name) {
    case 'get_part_summary': {
      // Big parts (lofted figures) have hundreds of faces: list them for one body at a time, the rest by count.
      const only = typeof args.body === 'string' ? args.body : null;
      if (only && !state.bodies.some(b => b.key === only)) return fail(state, `No body "${only}"; bodies: ${state.bodies.map(b => b.key).join(', ') || 'none'}.`);
      const many = state.bodies.reduce((n, b) => n + b.mesh.faces.length + b.mesh.edges.length, 0) > 160;
      const list = describeBodies(state.doc, state.bodies, false).map((b, i) => only === b.key || (!only && !many) ? describeBodies(state.doc, [state.bodies[i]], true, 60)[0] : b);
      const body = { feature_count: state.doc.nodes.length, parameters: state.doc.parameters,
        features: features(state.doc).map(f => ({ ...f, node: f.node.kind === 'sketch' ? { kind: 'sketch', profile: f.node.profile } : f.node })),
        bodies: list, ...(many && !only ? { note: 'Faces and edges are listed per body: call again with {"body": key}.' } : {}) };
      return { state, content: json(body), isError: false, changed: false, summary: `${state.doc.nodes.length} features, ${state.bodies.length} bod${state.bodies.length === 1 ? 'y' : 'ies'}` };
    }
    case 'run_command': {
      const cmd = commandById(String(args.command));
      if (!cmd?.build) return fail(state, `Unknown command "${String(args.command)}". Commands: ${CHAT_COMMANDS.join(', ')}.`);
      const { selection, unknown } = resolveNames(state.bodies, { faces: strings(args.faces), edges: strings(args.edges), bodies: strings(args.bodies) });
      if (unknown.length) return fail(state, `No face, edge or body named ${unknown.map(n => `"${n}"`).join(', ')} on the current part. Use the names from the last result or get_part_summary.`);
      const point = Array.isArray(args.point) && args.point.length === 3 ? args.point.map(Number) as [number, number, number] : undefined;
      const ctx: Ctx = { doc: state.doc, bodies: state.bodies, selection, pick: point };
      const avail = cmd.available(ctx);
      if (!avail.ok) return fail(state, `${cmd.label} can’t run: ${avail.reason}`);
      const fields = cmd.fields?.(ctx) ?? [];
      const given = isObj(args.values) ? args.values : {};
      const bad = Object.keys(given).filter(k => !fields.some(f => f.key === k));
      if (bad.length) return fail(state, `${cmd.label} has no value ${bad.map(k => `"${k}"`).join(', ')}; its values are ${fields.map(f => `${f.key} (${f.label})`).join(', ') || 'none'}.`);
      const values: Values = patchValues(cmd, ctx, cmd.defaults?.(ctx) ?? {}, Object.fromEntries(Object.entries(given).map(([k, v]) => [k, typeof v === 'number' ? v : String(v)])));
      const why = checkValues(fields, values);
      if (why) return fail(state, `${cmd.label}: ${why}`);
      const next = cmd.build(ctx, values);
      const shown = Object.fromEntries(shownFields(fields, values).map(f => [f.key, values[f.key]]));
      return accept(state, next, evaluate, `${cmd.label} ${json(shown)}`, { added: next.nodes.slice(state.doc.nodes.length).map((n, k) => `${state.doc.nodes.length + k}: ${featureLabel(n, state.doc.nodes.length + k, next.nodes)}`) });
    }
    case 'add_features': {
      const list = Array.isArray(args.features) ? args.features : null;
      if (!list?.length) return fail(state, '"features" is a non-empty list of feature nodes.');
      let doc = state.doc;
      for (const [k, node] of list.entries()) {
        const why = checkNode(node, doc.nodes, doc.parameters);
        if (why) return fail(state, `Feature ${k + 1} of ${list.length} (would be index ${doc.nodes.length}): ${why}`, { kept: 'nothing was added' });
        doc = withNode(doc, node as ModelNode);
      }
      return accept(state, doc, evaluate, `added ${list.length} feature${list.length > 1 ? 's' : ''}`, { added: doc.nodes.slice(state.doc.nodes.length).map((n, k) => `${state.doc.nodes.length + k}: ${featureLabel(n, state.doc.nodes.length + k, doc.nodes)}`) });
    }
    case 'edit_feature': {
      const index = Number(args.index), nodes = state.doc.nodes;
      if (!Number.isInteger(index) || !nodes[index]) return fail(state, `There is no feature ${String(args.index)} (features 0–${nodes.length - 1}).`);
      let next: ModelNode[];
      if (args.feature !== undefined) {
        const why = checkNode(args.feature, nodes.slice(0, index), state.doc.parameters);
        if (why) return fail(state, `Feature ${index}: ${why}`);
        next = nodes.map((n, i) => i === index ? args.feature as ModelNode : n);
      } else {
        const fields = editFields(nodes, index), given = isObj(args.values) ? args.values : {};
        if (!Object.keys(given).length) return fail(state, `Pass "values" or a whole "feature". Feature ${index}'s values: ${fields.map(f => `${f.key} (${f.label} = ${String(f.get(nodes))})`).join(', ') || 'none — replace it with "feature"'}.`);
        next = [...nodes];
        for (const [key, v] of Object.entries(given)) {
          const f = fields.find(x => x.key === key);
          if (!f) return fail(state, `Feature ${index} has no value "${key}"; its values are ${fields.map(x => `${x.key} (${x.label})`).join(', ') || 'none'}.`);
          if (f.kind === 'number') { if (typeof v !== 'number' || !Number.isFinite(v)) return fail(state, `"${key}" must be a number.`); next = f.set(next, v); }
          else if (f.kind === 'choice') { if (!f.options.some(o => o.value === v)) return fail(state, `"${key}" is one of ${f.options.map(o => o.value).join(', ')}.`); next = f.set(next, String(v)); }
          else next = f.set(next, Boolean(v));
        }
      }
      return accept(state, prefixDoc({ ...state.doc, nodes: next }, next.length), evaluate, `edited ${index}: ${featureLabel(next[index], index, next)}`);
    }
    case 'delete_feature': {
      const r = deleteFeature(state.doc, Number(args.index));
      if ('error' in r) return fail(state, r.error);
      return accept(state, r.doc, evaluate, `deleted feature${r.removed.length > 1 ? 's' : ''} ${r.removed.join(', ')}`, { note_indices: 'later features moved down; face and edge names were renumbered' });
    }
    case 'get_image_layers': {
      const t = traceOf(state, args.image);
      if (typeof t === 'string') return fail(state, t);
      const out = imageLayers(t);
      return { state, content: json(out), isError: false, changed: false, summary: `${out.layers.length} layers: ${out.layers.map(l => `${l.id} ${l.color}`).join(', ')}` };
    }
    case 'extrude_image_layer': {
      const t = traceOf(state, args.image);
      if (typeof t === 'string') return fail(state, t);
      const width = Number(args.width_mm), height = Number(args.height), base = Number(args.base ?? 0);
      if (!(width > 0)) return fail(state, '"width_mm" (the silhouette\'s width) must be positive.');
      if (!(height > 0)) return fail(state, '"height" (the layer\'s thickness) must be positive.');
      if (!Number.isFinite(base)) return fail(state, '"base" must be a number.');
      const at: [number, number] = Array.isArray(args.at) && args.at.length === 2 ? [Number(args.at[0]), Number(args.at[1])] : [0, 0];
      const standing = args.orientation === 'standing';
      const sketches = layerSketches(t, String(args.layer ?? 'silhouette'), width, at, standing, Number(args.y ?? 0));
      if (typeof sketches === 'string') return fail(state, sketches);
      let doc = state.doc;
      for (const sketch of sketches) {
        doc = withNode(doc, sketch);
        doc = withNode(doc, { kind: 'extrude', sketch: doc.nodes.length - 1, height, ...(base ? { from: base } : {}) });
      }
      return accept(state, doc, evaluate, `image ${String(args.image ?? (state.images?.length ?? 1))} ${String(args.layer ?? 'silhouette')} ${width} mm wide, ${height} thick${base ? ` from ${base}` : ''}${standing ? ', standing' : ''}`,
        { added: doc.nodes.slice(state.doc.nodes.length).map((n, k) => `${state.doc.nodes.length + k}: ${featureLabel(n, state.doc.nodes.length + k, doc.nodes)}`) });
    }
    case 'inflate_image_layer': {
      // A rounded, puffed-up solid of a traced layer (a plush or figure look) instead of a flat slab.
      const t = traceOf(state, args.image);
      if (typeof t === 'string') return fail(state, t);
      const width = Number(args.width_mm), depth = Number(args.depth), mode = args.mode === 'bump' ? 'bump' : 'body';
      if (!(width > 0)) return fail(state, '"width_mm" (the silhouette\'s width) must be positive.');
      if (!(depth > 0)) return fail(state, mode === 'body' ? '"depth" (front-to-back thickness) must be positive.' : '"depth" (how far the bump stands out) must be positive.');
      const layerId = String(args.layer ?? 'silhouette'), layer = t.layers.find(l => l.id === layerId);
      if (!layer) return fail(state, `No layer "${layerId}"; layers: ${t.layers.map(l => l.id).join(', ')}.`);
      const sil = t.layers.find(l => l.id === 'silhouette') ?? t.layers[0];
      const box = silhouetteBox(t), k = width / (box.maxX - box.minX);
      const at: [number, number] = Array.isArray(args.at) && args.at.length === 2 ? [Number(args.at[0]), Number(args.at[1])] : [0, 0];
      const map = (p: Pt): Pt => [at[0] + (p[0] - box.minX) * k, at[1] + (box.maxY - p[1]) * k];
      const standing = args.orientation === 'standing';
      // Standing: the mid plane is XZ at y = `y`, the front towards −Y.
      const plane = standing ? { plane: { origin: [0, Number(args.y ?? 0), 0] as [number, number, number], normal: [0, -1, 0] as [number, number, number], xAxis: [1, 0, 0] as [number, number, number] } } : {};
      const bodyDepth = Number(args.body_depth ?? 0);
      if (mode === 'bump' && !(bodyDepth > 0)) return fail(state, 'A bump sits on an inflated silhouette: pass "body_depth", the depth that silhouette was inflated with (same image, width_mm and at).');
      // The largest silhouette region carries the surface.
      const silOutline = sil.regions.length ? sil.regions[0].outer.map(map) : [];
      let doc = state.doc; const skipped: string[] = [];
      for (const [ri, region] of layer.regions.entries()) {
        const outline = resample(region.outer.map(map), 48), c = centroidOf(outline);
        let z0 = 0, sections: { z: number; s: number }[];
        if (mode === 'body') sections = INFLATE.map(sec => ({ z: sec.z * depth, s: sec.s }));
        // An outline stroke is mostly hole; a filled area with a small hole (a muzzle round a nose) is inflated whole.
        else if (region.holes.reduce((sum, h) => sum + Math.abs(areaOf(h)), 0) > 0.5 * Math.abs(areaOf(region.outer))) { skipped.push(`region ${ri + 1} is an outline stroke`); continue; }
        else {
          const h = surfaceAt(silOutline, centroidOf(silOutline), bodyDepth, c);
          if (h === null) { skipped.push(`region ${ri + 1} lies outside the silhouette`); continue; }
          // Sunk a little into the body so it joins it.
          z0 = h - Math.min(depth * 0.5, bodyDepth * 0.1);
          sections = BUMP.map(sec => ({ z: z0 + sec.z * depth, s: sec.s }));
        }
        const refs: { sketch: number; z: number }[] = [];
        for (const sec of sections) {
          doc = withNode(doc, { kind: 'sketch', profile: 'polygon', points: outline.map(p => [r3(c[0] + (p[0] - c[0]) * sec.s), r3(c[1] + (p[1] - c[1]) * sec.s)] as [number, number]), ...plane });
          refs.push({ sketch: doc.nodes.length - 1, z: r3(sec.z) });
        }
        doc = withNode(doc, { kind: 'loft', sections: refs, smooth: true });
      }
      if (doc === state.doc) return fail(state, `Nothing to inflate: ${skipped.join('; ') || 'the layer has no outline'}.`);
      return accept(state, doc, evaluate, `image ${String(args.image ?? (state.images?.length ?? 1))} ${layerId} inflated (${mode}) ${width} mm wide, ${depth} deep${standing ? ', standing' : ''}`,
        { ...(skipped.length ? { skipped } : {}), note: mode === 'body' ? `the body spans ${-depth / 2}…${depth / 2} about its mid plane` : 'bumps are separate bodies sunk into the surface; union them only if one solid is needed (each union is slow)' });
    }
    case 'measure': {
      const names = [String(args.a ?? ''), ...(args.b === undefined ? [] : [String(args.b)])];
      const picks: { body: number; pick: MeasurePick }[] = [];
      for (const n of names) {
        const { selection } = resolveNames(state.bodies, { faces: [n] });
        const e = selection.faces[0] ? null : resolveNames(state.bodies, { edges: [n] }).selection.edges[0];
        const f = selection.faces[0];
        if (f) picks.push({ body: f.body, pick: { body: f.body, face: f.face } });
        else if (e) picks.push({ body: e.body, pick: { body: e.body, edge: e.edge } });
        else return fail(state, `No face or edge named "${n}".`);
      }
      const mesh = (i: number) => state.bodies[picks[i].body].mesh;
      const out = picks.length === 1 ? measureItem(mesh(0), picks[0].pick) : (() => {
        const m = measureBetween(mesh(0), picks[0].pick, mesh(1), picks[1].pick);
        return { distance: r3(m.distance), from: v3(m.a), to: v3(m.b), ...(m.angle === undefined ? {} : { angle_deg: r3(m.angle) }), ...(m.normalDistance === undefined ? {} : { normal_distance: r3(m.normalDistance) }) };
      })();
      return { state, content: json(out), isError: false, changed: false, summary: json(out) };
    }
    case 'select': {
      const sel: NameSelection = { faces: strings(args.faces), edges: strings(args.edges), bodies: strings(args.bodies) };
      const { unknown } = resolveNames(state.bodies, sel);
      if (unknown.length) return fail(state, `No face, edge or body named ${unknown.map(n => `"${n}"`).join(', ')}.`);
      const count = sel.faces.length + sel.edges.length + sel.bodies.length;
      return { state: { ...state, selection: sel }, content: json({ ok: true, selected: sel }), isError: false, changed: false, summary: `${count} selected` };
    }
  }
  return fail(state, `Unknown tool "${name}".`);
}

export const isMutator = (name: string) => MUTATORS.has(name);

const nameList = { type: 'array', items: { type: 'string' } };
const commandDoc = CHAT_COMMANDS.map(id => {
  const c = commandById(id)!, d = COMMAND_DOCS[id];
  const values = Object.entries(d.values).map(([k, v]) => `${k}: ${v}`).join('; ');
  return `- ${id} (${c.label}) — select ${d.selection}${values ? `; values: ${values}` : ''}`;
}).join('\n');

const PART_TOOLS: ToolDefinition[] = [
  {
    name: 'get_part_summary',
    description: 'The current part: every feature node by index (sketch outlines abbreviated), parameters, and each visible body with volume and bounds, and its faces and edges by persistent name (e.g. face "n1.top", edge "n1.side0|n1.side1"). On a big part, faces and edges are listed for the one body named in "body". Call it before referring to faces or edges you have not seen in a result.',
    input_schema: { type: 'object', properties: { body: { type: 'string', description: 'A body key (e.g. "b27") to list the faces and edges of.' } }, additionalProperties: false },
  },
  {
    name: 'run_command',
    description: `Runs one studio command, exactly as the toolbar and its HUD would: the same availability rules, value ranges and defaults (omitted values take the HUD default). Faces, edges and bodies are selected by name; the command applies to that selection. Commands:\n${commandDoc}\nThe result has the bodies after evaluation (volume, bounds, face and edge names) or the refusal reason; nothing changes on a refusal.`,
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', enum: CHAT_COMMANDS },
        values: { type: 'object', description: 'Command values by key (numbers in mm or degrees; choices as strings).', additionalProperties: { type: ['number', 'string'] } },
        faces: { ...nameList, description: 'Face names to select.' },
        edges: { ...nameList, description: 'Edge names to select.' },
        bodies: { ...nameList, description: 'Body keys to select (e.g. "b1").' },
        point: { type: 'array', items: { type: 'number' }, description: 'Optional picked point [x, y, z] on the face (hole default centre).' },
      },
      required: ['command'], additionalProperties: false,
    },
  },
  {
    name: 'add_features',
    description: `Appends raw feature nodes for what no command covers: sketched profiles and the solids made from them (polygon or line/arc outlines, sketches on other planes, extrudes with draft or a start Z, revolves, sweeps, lofts), blind holes, or feature-level control. Nodes are checked, appended in order (each new node gets the next index) and evaluated together; on any error nothing is added. Node kinds (dimensions in mm; Dim = number or {"parameter": name}):
- {"kind":"sketch","profile":"rectangle","min":[x,y],"max":[x,y]} | {"kind":"sketch","profile":"circle","center":[x,y],"radius":r} | {"kind":"sketch","profile":"polygon","points":[[x,y],...]} | {"kind":"sketch","profile":"loop","segments":[{"kind":"line","start":[x,y]} | {"kind":"arc","start":[x,y],"center":[x,y],"direction":"ccw"|"cw"}, ...]}; optional "plane":{origin,normal,xAxis} (default XY at Z 0), "regions" (more loops), "holes" (loops cut out; straight extrudes only)
- {"kind":"extrude","sketch":i,"height":h,"from"?:z,"draft"?:deg}
- {"kind":"revolve","sketch":i,"axis":"x"|"y","origin"?:[a,b],"angleDegrees":deg} (about the sketch's own axis)
- {"kind":"sweep","sketch":i,"path":[{"kind":"straight","length":l} | {"kind":"bend","radius":r,"angleDegrees":deg,"toward":"x"|"-x"|"y"|"-y"}]} (from the sketch plane up +Z)
- {"kind":"loft","sections":[{"sketch":i,"z":z},...],"smooth"?:bool}
- {"kind":"hole","parent":Ref,"center":[a,b],"radius":r,"axis"?:"x"|"y"|"z","side"?:"min"|"max","depth"?:d} (omit depth for through)
- {"kind":"fillet","parent":Ref,"edges":[names],"radius":r} | {"kind":"chamfer","parent":Ref,"edges":[names],"distance":d} | {"kind":"shell","parent":Ref,"thickness":t,"open":[face names]}
- {"kind":"union"|"intersect","left":Ref,"right":Ref} | {"kind":"difference","parent":Ref,"tool":Ref} | {"kind":"split","parent":Ref,"axis":"x"|"y"|"z","at":v}
- {"kind":"translate","parent":Ref,"offset":[dx,dy,dz]} | {"kind":"rotate","parent":Ref,"axis":"x"|"y"|"z","angleDegrees":deg} | {"kind":"mirror","parent":Ref,"plane":"xy"|"xz"|"yz"} | {"kind":"scale","parent":Ref,"factor":k} | {"kind":"linear-pattern","parent":Ref,"axis":a,"spacing":s,"count":n} | {"kind":"circular-pattern","parent":Ref,"axis":a,"angleDegrees":deg,"count":n}
Ref = {"node": index of the feature that made a visible body, "side": "solid"} (split halves: "negative"/"positive"). Body key "b5" is {"node":5,"side":"solid"}.`,
    input_schema: { type: 'object', properties: { features: { type: 'array', items: { type: 'object' }, minItems: 1 } }, required: ['features'], additionalProperties: false },
  },
  {
    name: 'edit_feature',
    description: 'Changes an existing feature, as the feature editor does: "values" sets its editable dimensions by key (an extrude also edits its sketch: w, d, c0, c1 for a rectangle; dia, cc0, cc1 for a circle; h height; from; draft — a hole: dia, c0, c1, depth; fillet r; chamfer d; shell t; …). Call it with an index and no values to list the keys. Or pass a whole replacement "feature" node (same rules as add_features). Later features follow the edit.',
    input_schema: { type: 'object', properties: { index: { type: 'integer' }, values: { type: 'object', additionalProperties: { type: ['number', 'string', 'boolean'] } }, feature: { type: 'object' } }, required: ['index'], additionalProperties: false },
  },
  {
    name: 'delete_feature',
    description: 'Deletes a feature (and the sketches only it used). Refused while a later feature uses it. Later features move down one index per deleted node; names in results are renumbered accordingly.',
    input_schema: { type: 'object', properties: { index: { type: 'integer' } }, required: ['index'], additionalProperties: false },
  },
  {
    name: 'get_image_layers',
    description: 'The traced outlines of an attached image (a character, logo, icon or silhouette): its silhouette and its flat colour regions, each with colour, share of the figure, region and hole counts and its box within the silhouette, plus the silhouette\'s aspect ratio. Use it before extrude_image_layer.',
    input_schema: { type: 'object', properties: { image: { type: 'integer', description: 'Image number in this conversation (1 = first; default the latest).' } }, additionalProperties: false },
  },
  {
    name: 'extrude_image_layer',
    description: 'Builds a solid from a traced image layer: its outline (with holes and separate islands) scaled so the whole silhouette is width_mm wide, extruded `height` mm, starting `base` mm off the sketch plane. Every layer of an image uses the same scale and placement, so stacking them makes a relief (a keychain, badge, cookie cutter or figure plaque): the silhouette as the base, then colour layers on top of it (base = the base\'s thickness) to raise details like eyes, mouth and outlines. orientation "flat" lies on XY (thickness up +Z); "standing" stands it on XZ (figure upright, thickness towards −Y, `y` sets the plane). Later run_command union can join the layers into one body.',
    input_schema: {
      type: 'object',
      properties: {
        image: { type: 'integer' }, layer: { type: 'string', description: 'Layer id from get_image_layers (default "silhouette").' },
        width_mm: { type: 'number' }, height: { type: 'number' }, base: { type: 'number' },
        orientation: { type: 'string', enum: ['flat', 'standing'] }, at: { type: 'array', items: { type: 'number' }, description: '[x, y] of the silhouette\'s lower-left corner on the sketch plane (default [0, 0]).' },
        y: { type: 'number', description: 'Standing only: the Y of the sketch plane.' },
      },
      required: ['width_mm', 'height'], additionalProperties: false,
    },
  },
  {
    name: 'inflate_image_layer',
    description: 'A rounded three-dimensional version of a traced image layer (a plush, toy or figure look rather than a flat slab). mode "body": each region of the layer (normally the silhouette) becomes a smooth pebble-like solid, depth mm front to back, symmetric about its mid plane, round all along its rim. mode "bump": each region (eyes, nose, cheeks, buttons, a muzzle) becomes a smooth dome standing depth mm out of the front surface of the inflated silhouette, placed where it is in the picture — pass body_depth (the silhouette\'s depth) and the same width_mm/at/orientation. Filled areas are inflated by their outer outline (small holes, like a nose inside a muzzle, are covered); outline strokes are skipped. Bumps stay separate bodies sunk into the surface.',
    input_schema: {
      type: 'object',
      properties: {
        image: { type: 'integer' }, layer: { type: 'string' }, mode: { type: 'string', enum: ['body', 'bump'] },
        width_mm: { type: 'number' }, depth: { type: 'number' }, body_depth: { type: 'number' },
        orientation: { type: 'string', enum: ['flat', 'standing'] }, at: { type: 'array', items: { type: 'number' } }, y: { type: 'number' },
      },
      required: ['width_mm', 'depth'], additionalProperties: false,
    },
  },
  {
    name: 'measure',
    description: 'Measures one face or edge (area, length, radius), or the distance between two (and the angle between planes or straight edges, the normal distance between parallel planes).',
    input_schema: { type: 'object', properties: { a: { type: 'string', description: 'Face or edge name.' }, b: { type: 'string', description: 'Optional second face or edge name.' } }, required: ['a'], additionalProperties: false },
  },
  {
    name: 'select',
    description: 'Highlights faces, edges or bodies in the user’s viewport when the turn ends (for example to show what was filleted). Does not change the part.',
    input_schema: { type: 'object', properties: { faces: nameList, edges: nameList, bodies: nameList }, additionalProperties: false },
  },
];

/** Part tools take `part` (an instance id; default the base part); then the assembly tools. */
export const TOOLS: ToolDefinition[] = [
  ...PART_TOOLS.map(t => t.name === 'select' ? t : { ...t, input_schema: { ...t.input_schema, properties: { ...(t.input_schema.properties as object), part: { type: 'string', description: 'The part to work on: an instance id from add_part (default "base", the document\'s own part).' } } } }),
  ...ASSEMBLY_TOOLS,
];

export const SYSTEM_PROMPT = `You are the modeling assistant inside barocss CAD Studio, a parametric part modeler. The user describes a part or a change; you build it with the tools, which edit the part's feature tree exactly like the studio's own commands. Every change you make is evaluated by the geometry kernel and the result (bodies, volumes, bounds, face and edge names, or the exact refusal) comes back to you.

Conventions: millimetres; Z is up; sketches and boxes start on the XY plane at Z 0 unless placed otherwise; a box's x, y are its minimum corner. Holes go through the whole body by default. Faces and edges are referred to by their persistent names from results (e.g. the top face of the first extrude is "n1.top", a vertical corner edge "n1.side0|n1.side1"); vertical edges are the straight edges "along z".

Work like an engineer: prefer the commands (box, cylinder, hole, fillet, chamfer, shell, patterns, Booleans) and use add_features for profiles and solids no command makes. Make each change, read the result, and correct yourself when a tool refuses or a volume or bound is not what the request implies. Ask a short question only when the request is genuinely ambiguous; otherwise choose sensible dimensions and say what you chose. When the user attaches images (a sketch, a photo, a dimensioned drawing), model the part they show: take dimensions written on a drawing as given; read views (top, front, side) together; for a photo or an undimensioned sketch, estimate proportions from the picture and scale them by any one known size, and if no size is given or implied, ask for one key dimension before building. Always say which dimensions you read and which you assumed.

A picture that is not an engineering drawing — a character, mascot, logo or icon bitmap — has been traced for you: get_image_layers lists its silhouette and colour regions, and extrude_image_layer turns them into solids at one shared scale. Unless the user asks otherwise, make a relief of it: the silhouette as a base about 3–5 mm thick at a size that suits the request (around 60 mm wide if none is given), then the colour layers that carry the character's features raised 0.6–2 mm on top of the base (base = the base's thickness), the small dark details (eyes, outlines) highest. Skip layers that are just the main body colour or the background. When the user wants it three-dimensional or "realistic" (a figure, toy, plush, 실사화), use inflate_image_layer: the silhouette as a rounded body (depth about 35–50 % of its width; orientation "standing" for a figure that stands up), then the features as bumps on it (eyes, nose, muzzle, cheeks; 1–4 mm), each from its colour layer — leave out the body colour itself and thin outline strokes. Add what the picture implies but a silhouette cannot show — a flat base to stand on, a separate inflated part — with the other tools, sized from the picture's proportions; spheres are a revolved half-circle loop (add_features: a loop sketch of a line and an arc, revolved 360° about its axis). Say which approach you took.

For a machine, mechanism or anything made of several parts (a gearbox, a hinge, a vice, a robot arm, furniture), make an assembly: build the main or fixed part as the base part (or ground it), add each other part with add_part and build it with the part tools and "part": its id, in its own coordinates (so a shaft is modelled along its own Z, centred), then place it with mates — concentric for shafts in bores and pins in holes, coincident or distance for faces that sit on each other, angle for set orientations — and read each result: what the part can still do, or why a mate was refused. Copy repeated parts with add_part copy_of. Check the whole with get_assembly.

Finish with one or two sentences: what was built and its key numbers (volume, overall size). The user can undo your whole turn with one undo.`;
