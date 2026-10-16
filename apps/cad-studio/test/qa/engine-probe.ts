// QA probe (engine level): builds studio documents the way the HUD commands and the sketch builder do,
// evaluates them with the same code the worker runs (evaluateDoc / stepFor / stlFor) and compares
// volume, face counts and bounds with hand-computed values. Prints one JSON line per case.
//   node test/qa/run-engine-probe.mjs
import { evaluateDoc, stepFor, stlFor } from '../../src/engine/evaluate';
import { importStep, brepMassProperties } from '@barocss/cad';
import { emptyDoc, loftTop, prefixDoc, rectanglePart, starterDoc, withNode, type ModelNode, type StudioDoc } from '../../src/engine/doc';
import type { DisplayMesh } from '../../src/engine/mesh';
import { editFields } from '../../src/app/editFields';

type Row = { id: string; name: string; ok: boolean; expected?: unknown; actual?: unknown; note?: string };
const rows: Row[] = [];
let rev = 1;

function meshVolume(m: DisplayMesh) {
  let v = 0; const p = m.positions, i = m.indices;
  for (let t = 0; t < i.length; t += 3) {
    const a = i[t] * 3, b = i[t + 1] * 3, c = i[t + 2] * 3;
    v += (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) / 6;
  }
  return v;
}
const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(1e-9, Math.abs(b));
const S = (n: number) => ({ node: n, side: 'solid' as const });
const add = (doc: StudioDoc, ...nodes: ModelNode[]) => nodes.reduce((d, n) => withNode(d, n), doc);
const box = (w: number, d: number, h: number, x = 0, y = 0, z = 0, doc = emptyDoc()) => {
  const s = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [x, y], max: [x + w, y + d] });
  return withNode(s, { kind: 'extrude', sketch: s.nodes.length - 1, height: h, ...(z ? { from: z } : {}) });
};
const cyl = (r: number, h: number, cx: number, cy: number, z = 0, doc = emptyDoc()) => {
  const s = withNode(doc, { kind: 'sketch', profile: 'circle', center: [cx, cy], radius: r });
  return withNode(s, { kind: 'extrude', sketch: s.nodes.length - 1, height: h, ...(z ? { from: z } : {}) });
};

/** Evaluates and checks the total volume (sum over bodies) within tol (relative). */
function vol(id: string, name: string, doc: StudioDoc, expected: number, opts: { tol?: number; bodies?: number; faces?: number } = {}) {
  const r = evaluateDoc(doc, rev++);
  if (!r.ok) { rows.push({ id, name, ok: false, expected, actual: 'REFUSED: ' + r.error.title + ' | ' + r.error.detail }); return null; }
  const kernel = r.bodies.reduce((s, b) => s + (b.volumeMM3 ?? NaN), 0), mesh = r.bodies.reduce((s, b) => s + meshVolume(b.mesh), 0);
  const tol = opts.tol ?? 1e-4;
  const notes: string[] = [];
  let ok = rel(kernel, expected) < tol;
  if (rel(mesh, expected) > Math.max(tol, 0.01)) notes.push(`mesh volume ${mesh.toFixed(3)} off`);
  if (opts.bodies !== undefined && r.bodies.length !== opts.bodies) { ok = false; notes.push(`bodies ${r.bodies.length} != ${opts.bodies}`); }
  const faces = r.bodies.map(b => b.mesh.faces.length);
  if (opts.faces !== undefined && faces[0] !== opts.faces) { ok = false; notes.push(`faces ${faces} != ${opts.faces}`); }
  rows.push({ id, name, ok, expected: +expected.toFixed(3), actual: { kernel: +kernel.toFixed(3), mesh: +mesh.toFixed(3), bodies: r.bodies.length, faces, bounds: r.bodies.map(b => b.mesh.bounds) }, ...(notes.length ? { note: notes.join('; ') } : {}) });
  return r;
}
/** Expects a refusal whose title explains it (not the generic fallback). */
function refuse(id: string, name: string, doc: StudioDoc, titleRe?: RegExp) {
  let r;
  try { r = evaluateDoc(doc, rev++); } catch (e) { rows.push({ id, name, ok: false, actual: 'THREW ' + String(e) }); return; }
  if (r.ok) { rows.push({ id, name, ok: false, expected: 'refusal', actual: { accepted: true, volume: r.bodies.map(b => b.volumeMM3), bodies: r.bodies.length, bounds: r.bodies.map(b => b.mesh.bounds) } }); return; }
  const generic = /could not build this/.test(r.error.title);
  const ok = !generic && (!titleRe || titleRe.test(r.error.title));
  rows.push({ id, name, ok, expected: titleRe ? String(titleRe) : 'specific refusal', actual: { title: r.error.title, hint: r.error.hint, detail: r.error.detail.slice(0, 200) } });
}
function accepts(id: string, name: string, doc: StudioDoc, check?: (r: Extract<ReturnType<typeof evaluateDoc>, { ok: true }>) => string | null) {
  const r = evaluateDoc(doc, rev++);
  if (!r.ok) { rows.push({ id, name, ok: false, actual: 'REFUSED: ' + r.error.title + ' | ' + r.error.detail.slice(0, 200) }); return; }
  const problem = check?.(r) ?? null;
  rows.push({ id, name, ok: !problem, actual: { volumes: r.bodies.map(b => b.volumeMM3 && +b.volumeMM3.toFixed(3)), faces: r.bodies.map(b => b.mesh.faces.length), bounds: r.bodies.map(b => b.mesh.bounds) }, ...(problem ? { note: problem } : {}) });
}

const PI = Math.PI;
// --- Basic solids -----------------------------------------------------------------------------
vol('V01', 'starter plate 64x32x8 with Ø8 through hole', starterDoc(), 64 * 32 * 8 - PI * 16 * 8, { faces: 7 });
vol('V02', 'box 10x20x30', box(10, 20, 30), 6000, { faces: 6 });
vol('V03', 'cylinder r8 h24', cyl(8, 24, 0, 0), PI * 64 * 24, { faces: 3 });
vol('V04', 'box non-integer 12.7x25.4x3.175', box(12.7, 25.4, 3.175), 12.7 * 25.4 * 3.175);
vol('V05', 'box at negative coords (-50,-50,-10)', box(20, 20, 5, -50, -50, -10), 2000);
// --- Booleans ---------------------------------------------------------------------------------
const two = box(32, 32, 16, 16, 16, 0, box(32, 32, 16));
vol('B01', 'union of 32x32x16 boxes offset 16,16 (overlap 16x16x16)', withNode(two, { kind: 'union', left: S(1), right: S(3) }), 2 * 16384 - 4096, { bodies: 1 });
vol('B02', 'subtract same pair', withNode(two, { kind: 'difference', parent: S(1), tool: S(3) }), 16384 - 4096, { bodies: 1 });
vol('B03', 'intersect same pair', withNode(two, { kind: 'intersect', left: S(1), right: S(3) }), 4096, { bodies: 1, faces: 6 });
const chain = add(box(10, 10, 10, 20, 0, 0, box(10, 10, 10, 10, 0, 0, box(10, 10, 10))), { kind: 'union', left: S(1), right: S(3) });
// Boxes 0..10 and 10..20 are joined; the third (20..30) is still separate.
vol('B04', 'face-touching boxes union (coincident faces) + a third box', chain, 3000, { bodies: 2 });
vol('B05', 'union chain of 3 face-touching boxes', withNode(chain, { kind: 'union', left: S(6), right: S(5) }), 3000, { bodies: 1, faces: 6 });
const flush = box(10, 10, 10, 0, 0, 0, box(20, 20, 10));
vol('B06', 'subtract a box flush with the top face (coincident top)', withNode(flush, { kind: 'difference', parent: S(1), tool: S(3) }), 4000 - 1000, { bodies: 1 });
const inner = box(10, 10, 5, 5, 5, 5, box(20, 20, 10));
vol('B07', 'pocket: subtract box sharing top face, inside', withNode(inner, { kind: 'difference', parent: S(1), tool: S(3) }), 4000 - 500, { bodies: 1 });
refuse('B08', 'union of boxes touching only along an edge', withNode(box(10, 10, 10, 10, 10, 0, box(10, 10, 10)), { kind: 'union', left: S(1), right: S(3) }), /touch/);
const tangent = cyl(5, 10, 15, 5, 0, box(10, 10, 10));
accepts('B09', 'subtract cylinder tangent to box side (x=10, r5 at x15)', withNode(tangent, { kind: 'difference', parent: S(1), tool: S(3) }), r => Math.abs(r.bodies[0].volumeMM3! - 1000) > 1e-3 ? `volume ${r.bodies[0].volumeMM3} != 1000` : null);
vol('B10', 'subtract tool that covers the whole body', withNode(box(20, 20, 20, -5, -5, -5, box(10, 10, 10)), { kind: 'difference', parent: S(1), tool: S(3) }), 0);
vol('B11', 'intersect disjoint boxes', withNode(box(10, 10, 10, 50, 0, 0, box(10, 10, 10)), { kind: 'intersect', left: S(1), right: S(3) }), 0);
vol('B12', 'subtract disjoint box (no-op)', withNode(box(10, 10, 10, 50, 0, 0, box(10, 10, 10)), { kind: 'difference', parent: S(1), tool: S(3) }), 1000, { bodies: 1 });
vol('B13', 'union of identical boxes', withNode(box(10, 10, 10, 0, 0, 0, box(10, 10, 10)), { kind: 'union', left: S(1), right: S(3) }), 1000, { bodies: 1, faces: 6 });
vol('B14', 'box minus cylinder through (r5 in 20x20x10)', withNode(cyl(5, 10, 10, 10, 0, box(20, 20, 10)), { kind: 'difference', parent: S(1), tool: S(3) }), 4000 - PI * 25 * 10);
vol('B15', 'cylinder ∩ box (half cylinder)', withNode(cyl(5, 10, 0, 0, 0, box(20, 20, 10, 0, -10, 0)), { kind: 'intersect', left: S(1), right: S(3) }), PI * 25 * 10 / 2);
// --- Holes ------------------------------------------------------------------------------------
const plate = rectanglePart(100, 60, 5);
const seg = (r: number, d: number) => r * r * Math.acos(d / r) - d * Math.sqrt(r * r - d * d);
vol('H01', 'hole Ø6 at (6,6) on 100x60x5', withNode(plate, { kind: 'hole', parent: S(1), center: [6, 6], radius: 3 }), 30000 - PI * 9 * 5);
vol('H02', 'notch: Ø8 hole centred 2 mm inside the edge', withNode(plate, { kind: 'hole', parent: S(1), center: [2, 30], radius: 4 }), 30000 - (PI * 16 - seg(4, 2)) * 5);
refuse('H03', 'hole off the body (x=300)', withNode(plate, { kind: 'hole', parent: S(1), center: [300, 30], radius: 4 }), /misses/);
vol('H04', 'hole tangent to the edge from inside (centre 4, r4)', withNode(plate, { kind: 'hole', parent: S(1), center: [4, 30], radius: 4 }), 30000 - PI * 16 * 5);
refuse('H05', 'hole tangent to the edge from outside (centre -4, r4): touches only', withNode(plate, { kind: 'hole', parent: S(1), center: [-4, 30], radius: 4 }), /misses/);
vol('H06', 'hole larger than the plate depth (Ø80 on 100x60)', withNode(plate, { kind: 'hole', parent: S(1), center: [50, 30], radius: 40 }), 30000 - (PI * 1600 - 2 * seg(40, 30)) * 5);
refuse('H07', 'hole radius 0', withNode(plate, { kind: 'hole', parent: S(1), center: [50, 30], radius: 0 }), /greater than zero|positive/);
refuse('H08', 'hole radius negative', withNode(plate, { kind: 'hole', parent: S(1), center: [50, 30], radius: -3 }), /greater than zero|positive/);
vol('H09', 'blind hole depth 2 (Ø10)', withNode(plate, { kind: 'hole', parent: S(1), center: [50, 30], radius: 5, depth: 2 }), 30000 - PI * 25 * 2);
vol('H10', 'side hole along X through 20x20x10 (Ø4 at y10,z5)', withNode(rectanglePart(20, 20, 10), { kind: 'hole', parent: S(1), center: [10, 5], radius: 2, axis: 'x' }), 4000 - PI * 4 * 20);
vol('H11', 'side hole from −Y face (side min)', withNode(rectanglePart(20, 20, 10), { kind: 'hole', parent: S(1), center: [10, 5], radius: 2, axis: 'y', side: 'min' }), 4000 - PI * 4 * 20);
vol('H12', 'two holes overlapping each other', add(plate, { kind: 'hole', parent: S(1), center: [50, 30], radius: 5 }, { kind: 'hole', parent: S(2), center: [55, 30], radius: 5 }),
  30000 - (2 * PI * 25 - (2 * 25 * Math.acos(5 / 10) - 5 / 2 * Math.sqrt(100 - 25))) * 5);
vol('H13', 'hole on a box sitting at z=10 (from)', withNode(box(20, 20, 5, 0, 0, 10), { kind: 'hole', parent: S(1), center: [10, 10], radius: 2 }), 2000 - PI * 4 * 5);
vol('H14', 'hole through a union result', withNode(withNode(two, { kind: 'union', left: S(1), right: S(3) }), { kind: 'hole', parent: S(4), center: [24, 24], radius: 4 }), 2 * 16384 - 4096 - PI * 16 * 16);
// --- Extrude edge cases -------------------------------------------------------------------------
refuse('E01', 'extrude height 0', add(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] }, { kind: 'extrude', sketch: 0, height: 0 }), /greater than zero|positive/);
accepts('E02', 'extrude height −5 (downwards?)', add(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] }, { kind: 'extrude', sketch: 0, height: -5 }),
  r => Math.abs((r.bodies[0].volumeMM3 ?? 0) - 500) > 1e-6 ? `volume ${r.bodies[0].volumeMM3} (expected 500, below Z0)` : r.bodies[0].mesh.bounds.min[2] !== -5 ? `bounds ${JSON.stringify(r.bodies[0].mesh.bounds)}` : null);
refuse('E03', 'extrude height 1e6 (out of range)', add(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] }, { kind: 'extrude', sketch: 0, height: 1e6 }), /range/);
vol('E04', 'extrude height 10000 (at the limit)', add(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] }, { kind: 'extrude', sketch: 0, height: 10000 }), 1e6);
vol('E05', 'extrude tiny 0.001', add(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] }, { kind: 'extrude', sketch: 0, height: 0.001 }), 0.1);
refuse('E06', 'rectangle of zero width', add(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [0, 10] }, { kind: 'extrude', sketch: 0, height: 5 }), /greater than zero|valid profile/);
refuse('E07', 'NaN height', add(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] }, { kind: 'extrude', sketch: 0, height: NaN }));
refuse('E08', 'self-crossing polygon (bow-tie)', add(emptyDoc(), { kind: 'sketch', profile: 'polygon', points: [[0, 0], [10, 10], [10, 0], [0, 10]] }, { kind: 'extrude', sketch: 0, height: 5 }), /crosses itself/);
refuse('E09', 'polygon with repeated point', add(emptyDoc(), { kind: 'sketch', profile: 'polygon', points: [[0, 0], [10, 0], [10, 0], [0, 10]] }, { kind: 'extrude', sketch: 0, height: 5 }), /valid profile/);
vol('E10', 'draft 10° on 20x20 h10', add(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [20, 20] }, { kind: 'extrude', sketch: 0, height: 10, draft: 10 }),
  // A(z) = (20 − 2t)², t = z·tan 10°: V = h(400 − 40d + 4d²/3), d = h·tan 10°.
  (() => { const d = 10 * Math.tan(10 * PI / 180); return 10 * (400 - 40 * d + 4 * d * d / 3); })());
refuse('E11', 'draft so steep the top collapses (60° on 10x10 h20)', add(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] }, { kind: 'extrude', sketch: 0, height: 20, draft: 60 }));
vol('E12', 'rectangle with a circular hole in the sketch (holes)', add(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 20], holes: [[{ kind: 'arc', start: [25, 10], center: [20, 10], direction: 'ccw' }]] }, { kind: 'extrude', sketch: 0, height: 5 }), (800 - PI * 25) * 5, { bodies: 1 });
vol('E13', 'two separate regions in one sketch', add(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10], regions: [[[20, 0], [30, 0], [30, 10], [20, 10]].map(p => ({ kind: 'line' as const, start: p as [number, number] }))] }, { kind: 'extrude', sketch: 0, height: 5 }), 1000);
vol('E14', 'rect with two holes', add(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 20], holes: [[{ kind: 'arc', start: [15, 10], center: [10, 10], direction: 'ccw' }], [[40, 5], [50, 5], [50, 15], [40, 15]].map(p => ({ kind: 'line' as const, start: p as [number, number] }))] }, { kind: 'extrude', sketch: 0, height: 4 }), (1200 - PI * 25 - 100) * 4);
refuse('E15', 'sketch hole crossing the outer boundary', add(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 20], holes: [[{ kind: 'arc', start: [45, 10], center: [40, 10], direction: 'ccw' }]] }, { kind: 'extrude', sketch: 0, height: 5 }));
vol('E16', 'two overlapping regions in one sketch', add(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10], regions: [[[5, 0], [15, 0], [15, 10], [5, 10]].map(p => ({ kind: 'line' as const, start: p as [number, number] }))] }, { kind: 'extrude', sketch: 0, height: 5 }), 750);
// Tilted / offset planes: volume is area × height whatever the plane.
const tilt = (deg: number) => { const a = deg * PI / 180; return { origin: [0, 0, 0] as [number, number, number], normal: [0, Math.sin(a), Math.cos(a)] as [number, number, number], xAxis: [1, 0, 0] as [number, number, number] }; };
vol('E17', 'rectangle 30x20 on a 30° plane, extrude 8', add(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 20], plane: tilt(30) }, { kind: 'extrude', sketch: 0, height: 8 }), 4800, { faces: 6 });
vol('E18', 'circle r5 on XZ plane (normal −Y), extrude 10', add(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 5, plane: { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] } }, { kind: 'extrude', sketch: 0, height: 10 }), PI * 250);
vol('E19', 'rect on YZ plane offset 7, extrude 3', add(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10], plane: { origin: [7, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] } }, { kind: 'extrude', sketch: 0, height: 3 }), 300);
vol('E20', 'rect with hole on a 45° plane', add(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 20], plane: tilt(45), holes: [[{ kind: 'arc', start: [25, 10], center: [20, 10], direction: 'ccw' }]] }, { kind: 'extrude', sketch: 0, height: 5 }), (800 - PI * 25) * 5);
// --- Fillet / chamfer / shell ------------------------------------------------------------------
const b32 = box(32, 32, 16);
vol('F01', 'fillet R4 on a top edge (32 long)', withNode(b32, { kind: 'fillet', parent: S(1), edges: ['n1.side0|n1.top'], radius: 4 }), 16384 - (16 - PI * 4) * 32, { faces: 7 });
vol('F02', 'chamfer 2 on a top edge (32 long)', withNode(b32, { kind: 'chamfer', parent: S(1), edges: ['n1.side0|n1.top'], distance: 2 }), 16384 - 2 * 32, { faces: 7 });
refuse('F03', 'fillet R20 larger than the 16 wall', withNode(b32, { kind: 'fillet', parent: S(1), edges: ['n1.side0|n1.top'], radius: 20 }), /too large/);
refuse('F04', 'fillet on an edge name that does not exist', withNode(b32, { kind: 'fillet', parent: S(1), edges: ['n1.nope|n1.top'], radius: 2 }), /no longer exists/);
refuse('F05', 'fillet radius 0', withNode(b32, { kind: 'fillet', parent: S(1), edges: ['n1.side0|n1.top'], radius: 0 }), /greater than zero/);
vol('F06', 'fillet R16 exactly equal to the wall height (16)', withNode(b32, { kind: 'fillet', parent: S(1), edges: ['n1.side0|n1.top'], radius: 16 }), 16384 - (256 - PI * 64) * 32);
vol('F07', 'fillet all 4 top edges R2 (corners blended)', withNode(b32, { kind: 'fillet', parent: S(1), edges: ['n1.side0|n1.top', 'n1.side1|n1.top', 'n1.side2|n1.top', 'n1.side3|n1.top'], radius: 2 }),
  // 4 edge strips (r² − πr²/4)·(L − 2r) plus 4 mitred corners, each removing r³ − 2r³/3 (a Steinmetz octant kept).
  16384 - 4 * (4 - PI) * 28 - 4 * 8 / 3);
vol('F08', 'chamfer 3 on a vertical edge', withNode(b32, { kind: 'chamfer', parent: S(1), edges: ['n1.side0|n1.side1'], distance: 3 }), 16384 - 4.5 * 16);
vol('S01', 'shell 2 open top (32x32x16)', withNode(b32, { kind: 'shell', parent: S(1), thickness: 2, open: ['n1.top'] }), 16384 - 28 * 28 * 14);
vol('S02', 'shell 2 closed (32x32x16)', withNode(b32, { kind: 'shell', parent: S(1), thickness: 2, open: [] }), 16384 - 28 * 28 * 12);
refuse('S03', 'shell 8 on 16-high box closed (leaves no hollow)', withNode(b32, { kind: 'shell', parent: S(1), thickness: 8, open: [] }), /too thick/);
vol('S04', 'shell 0.1 thin wall open top', withNode(b32, { kind: 'shell', parent: S(1), thickness: 0.1, open: ['n1.top'] }), 16384 - 31.8 * 31.8 * 15.9);
vol('S05', 'shell open top and one side', withNode(b32, { kind: 'shell', parent: S(1), thickness: 2, open: ['n1.top', 'n1.side0'] }), 16384 - 28 * 30 * 14);
refuse('S06', 'shell thickness 0', withNode(b32, { kind: 'shell', parent: S(1), thickness: 0, open: ['n1.top'] }), /greater than zero/);
vol('S07', 'shell the starter plate (with hole) open top, 1 wall', withNode(starterDoc(), { kind: 'shell', parent: S(2), thickness: 1, open: ['n1.top'] }),
  (64 * 32 * 8 - PI * 16 * 8) - ((62 * 30 - PI * 25) * 7), { tol: 1e-3 });
// --- Revolve, sweep, loft ------------------------------------------------------------------------
vol('R01', 'torus: circle r5 at (30,10) revolved 360 about Y', add(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [30, 10], radius: 5 }, { kind: 'revolve', sketch: 0, axis: 'y', angleDegrees: 360 }), 2 * PI * 30 * PI * 25);
vol('R02', 'rect (10..20 × 0..10) revolved 360 about Y (tube)', add(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [10, 0], max: [20, 10] }, { kind: 'revolve', sketch: 0, axis: 'y', angleDegrees: 360 }), PI * 300 * 10);
vol('R03', 'same rect revolved 90°', add(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [10, 0], max: [20, 10] }, { kind: 'revolve', sketch: 0, axis: 'y', angleDegrees: 90 }), PI * 300 * 10 / 4);
vol('R04', 'rect touching the axis (0..10) revolved 360 → cylinder', add(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] }, { kind: 'revolve', sketch: 0, axis: 'y', angleDegrees: 360 }), PI * 100 * 10);
refuse('R05', 'rect crossing the axis (−5..10)', add(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [-5, 0], max: [10, 10] }, { kind: 'revolve', sketch: 0, axis: 'y', angleDegrees: 360 }), /turn about this axis/);
vol('R06', 'revolve about X: circle r3 at (5,20)', add(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [5, 20], radius: 3 }, { kind: 'revolve', sketch: 0, axis: 'x', angleDegrees: 360 }), 2 * PI * 20 * PI * 9);
vol('R07', 'revolve 359°', add(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [10, 0], max: [20, 10] }, { kind: 'revolve', sketch: 0, axis: 'y', angleDegrees: 359 }), PI * 300 * 10 * 359 / 360);
refuse('R08', 'revolve 0°', add(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [10, 0], max: [20, 10] }, { kind: 'revolve', sketch: 0, axis: 'y', angleDegrees: 0 }));
vol('P01', 'pipe: circle r5, run 8, bend R20 90°, run 8', add(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 5 }, { kind: 'sweep', sketch: 0, path: [{ kind: 'straight', length: 8 }, { kind: 'bend', radius: 20, angleDegrees: 90, toward: 'x' }, { kind: 'straight', length: 8 }] }), PI * 25 * (16 + PI / 2 * 20));
refuse('P02', 'pipe bend tighter than the section (R4 for r5)', add(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 5 }, { kind: 'sweep', sketch: 0, path: [{ kind: 'straight', length: 8 }, { kind: 'bend', radius: 4, angleDegrees: 90, toward: 'x' }, { kind: 'straight', length: 8 }] }), /too tight/);
vol('P03', 'pipe: square 10x10 centred, run 10, bend R20 45° toward −y, run 10', add(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [-5, -5], max: [5, 5] }, { kind: 'sweep', sketch: 0, path: [{ kind: 'straight', length: 10 }, { kind: 'bend', radius: 20, angleDegrees: 45, toward: '-y' }, { kind: 'straight', length: 10 }] }), 100 * (20 + PI / 4 * 20));
const sq = { kind: 'sketch' as const, profile: 'rectangle' as const, min: [0, 0] as [number, number], max: [20, 20] as [number, number] };
vol('L01', 'loft 20x20 → 10x10 over 10 (frustum)', add(emptyDoc(), sq, loftTop(sq, 'scaled', 0.5), { kind: 'loft', sections: [{ sketch: 0, z: 0 }, { sketch: 1, z: 10 }] }), 10 / 3 * (400 + 100 + 200));
accepts('L02', 'loft square → circle (closed, positive volume between the two prisms)', add(emptyDoc(), sq, loftTop(sq, 'circle', 0.5), { kind: 'loft', sections: [{ sketch: 0, z: 0 }, { sketch: 1, z: 10 }] }),
  r => { const v = r.bodies[0].volumeMM3 ?? NaN; return v > PI * 25 * 10 && v < 4000 ? null : `volume ${v} outside (${PI * 250}, 4000)`; });
refuse('L03', 'loft sections downwards (z 10 → 0)', add(emptyDoc(), sq, loftTop(sq, 'scaled', 0.5), { kind: 'loft', sections: [{ sketch: 0, z: 10 }, { sketch: 1, z: 0 }] }), /climb/);
vol('L04', 'loft scale 100% (prism)', add(emptyDoc(), sq, loftTop(sq, 'scaled', 1), { kind: 'loft', sections: [{ sketch: 0, z: 0 }, { sketch: 1, z: 10 }] }), 4000);
// --- Patterns / transforms ---------------------------------------------------------------------
const c16 = box(16, 16, 16);
vol('T01', 'linear pattern ×3 spacing 24 (disjoint)', withNode(c16, { kind: 'linear-pattern', parent: S(1), axis: 'x', spacing: 24, count: 3 }), 3 * 4096);
vol('T02', 'linear pattern ×3 spacing 8 (overlapping copies)', withNode(c16, { kind: 'linear-pattern', parent: S(1), axis: 'x', spacing: 8, count: 3 }), 32 * 16 * 16);
vol('T03', 'linear pattern ×2 spacing 16 (touching faces)', withNode(c16, { kind: 'linear-pattern', parent: S(1), axis: 'x', spacing: 16, count: 2 }), 2 * 4096);
vol('T04', 'circular pattern ×4 about Z of a box at x 20..30', withNode(box(10, 10, 5, 20, -5, 0), { kind: 'circular-pattern', parent: S(1), axis: 'z', angleDegrees: 90, count: 4 }), 4 * 500);
vol('T05', 'mirror YZ keeps original (box at x 5..15)', withNode(box(10, 10, 10, 5, 0, 0), { kind: 'mirror', parent: S(1), plane: 'yz' }), 2000);
vol('T06', 'mirror of a box touching the plane (0..10) → merged?', withNode(box(10, 10, 10), { kind: 'mirror', parent: S(1), plane: 'yz' }), 2000);
vol('T07', 'split X=8 of 32 box → two bodies', withNode(b32, { kind: 'split', parent: S(1), axis: 'x', at: 8 }), 16384, { bodies: 2 });
refuse('T08', 'split plane outside the body', withNode(b32, { kind: 'split', parent: S(1), axis: 'x', at: 100 }), /misses/);
refuse('T09', 'split plane exactly on a face (x=0)', withNode(b32, { kind: 'split', parent: S(1), axis: 'x', at: 0 }), /misses/);
vol('T10', 'rotate Z 30° keeps volume', withNode(b32, { kind: 'rotate', parent: S(1), axis: 'z', angleDegrees: 30 }), 16384);
// Documented limit: only quarter turns about X/Y (refused with a plain reason).
refuse('T11', 'rotate X 45° (non-quarter)', withNode(b32, { kind: 'rotate', parent: S(1), axis: 'x', angleDegrees: 45 }), /quarter turns/);
refuse('T12', 'circular pattern ×6 about X (the UI never builds this; it steps by 90°)', withNode(box(10, 10, 5, 0, 20, 0), { kind: 'circular-pattern', parent: S(1), axis: 'x', angleDegrees: 60, count: 6 }), /quarter turns/);
vol('T13', 'linear pattern of a holed plate ×2', withNode(starterDoc(), { kind: 'linear-pattern', parent: S(2), axis: 'y', spacing: 40, count: 2 }), 2 * (16384 - PI * 128));
// --- Dependents / edits --------------------------------------------------------------------------
{
  // Feature editor on the starter: the extrude's sketch width 64 → 80 keeps the hole.
  const d = starterDoc(), f = editFields(d.nodes, 1).find(x => x.key === 'w')!;
  const edited = prefixDoc({ ...d, nodes: f.set(d.nodes, 80) }, 3);
  vol('D01', 'feature editor: starter width 64 → 80 recomputes', edited, 80 * 32 * 8 - PI * 128);
  const h = editFields(d.nodes, 1).find(x => x.key === 'h')!;
  vol('D02', 'feature editor: starter height 8 → 20, hole still through', prefixDoc({ ...d, nodes: h.set(d.nodes, 20) }, 3), 64 * 32 * 20 - PI * 16 * 20);
  const w = editFields(d.nodes, 1).find(x => x.key === 'w')!;
  refuse('D03', 'feature editor: width shrinks so the hole (x=32) is off the plate', prefixDoc({ ...d, nodes: w.set(d.nodes, 20) }, 3), /misses/);
  const fil = withNode(b32, { kind: 'fillet', parent: S(1), edges: ['n1.side0|n1.top'], radius: 4 });
  const fh = editFields(fil.nodes, 1).find(x => x.key === 'h')!;
  vol('D04', 'fillet follows an edit of the box height 16 → 30', prefixDoc({ ...fil, nodes: fh.set(fil.nodes, 30) }, 3), 32 * 32 * 30 - (16 - PI * 4) * 32);
  const df = editFields(starterDoc().nodes, 2).map(x => x.label);
  rows.push({ id: 'D05', name: 'hole editor exposes diameter/centre fields', ok: df.length > 0, actual: df });
  const ff = editFields(fil.nodes, 2).map(x => x.label);
  rows.push({ id: 'D06', name: 'fillet editor exposes radius', ok: ff.some(l => /Radius/i.test(l)), actual: ff });
  // A box with a negative dimension typed in the editor.
  const neg = editFields(d.nodes, 1).find(x => x.key === 'h')!;
  // A negative distance extrudes below the sketch plane (accepted by design, as E02); the hole follows.
  vol('D07', 'feature editor: height −8 (extrudes downwards)', prefixDoc({ ...d, nodes: neg.set(d.nodes, -8) }, 3), 16384 - PI * 128);
  refuse('D08', 'feature editor: width 0', prefixDoc({ ...d, nodes: w.set(d.nodes, 0) }, 3), /greater than zero/);
}
// --- STEP / STL round trip ---------------------------------------------------------------------
for (const [id, name, doc] of [['X01', 'starter plate', starterDoc()], ['X02', 'filleted box', withNode(b32, { kind: 'fillet', parent: S(1), edges: ['n1.side0|n1.top'], radius: 4 })],
  ['X03', 'torus', add(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [30, 10], radius: 5 }, { kind: 'revolve', sketch: 0, axis: 'y', angleDegrees: 360 })],
  ['X04', 'shell open top', withNode(b32, { kind: 'shell', parent: S(1), thickness: 2, open: ['n1.top'] })],
  ['X05', 'loft square→circle', add(emptyDoc(), sq, loftTop(sq, 'circle', 0.5), { kind: 'loft', sections: [{ sketch: 0, z: 0 }, { sketch: 1, z: 10 }] })],
  ['X06', 'pipe', add(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 5 }, { kind: 'sweep', sketch: 0, path: [{ kind: 'straight', length: 8 }, { kind: 'bend', radius: 20, angleDegrees: 90, toward: 'x' }, { kind: 'straight', length: 8 }] })],
  ['X07', 'two bodies', box(10, 10, 10, 50, 0, 0, box(10, 10, 10))],
  ['X08', 'tilted-plane extrude', add(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 20], plane: tilt(30) }, { kind: 'extrude', sketch: 0, height: 8 })]] as const) {
  const r = evaluateDoc(doc, rev++);
  if (!r.ok) { rows.push({ id, name: 'STEP round trip: ' + name, ok: false, actual: 'model refused' }); continue; }
  const want = r.bodies.reduce((s, b) => s + (b.volumeMM3 ?? 0), 0);
  const s = stepFor(doc, name);
  if (!('text' in s)) { rows.push({ id, name: 'STEP round trip: ' + name, ok: false, actual: 'export refused: ' + s.error }); continue; }
  try {
    // Reopened through the studio's own STEP import feature (what Open does).
    const back = evaluateDoc(withNode(emptyDoc(), { kind: 'import', name, step: s.text }), rev++);
    const got = back.ok ? back.bodies.reduce((a, b) => a + (b.volumeMM3 ?? 0), 0) : NaN;
    const faces = back.ok ? back.bodies.map(b => b.mesh.faces.length) : [];
    rows.push({ id, name: 'STEP export → reopen: ' + name, ok: back.ok && rel(got, want) < 1e-6, expected: +want.toFixed(4), actual: back.ok ? { volume: +got.toFixed(4), bodies: back.bodies.length, faces, origFaces: r.bodies.map(b => b.mesh.faces.length) } : 'REFUSED ' + back.error.title + ' | ' + back.error.detail.slice(0, 160) });
  } catch (e) { rows.push({ id, name: 'STEP round trip: ' + name, ok: false, actual: 'THREW ' + String(e) }); }
  // STL: binary, 84-byte header + 50 bytes per triangle; its signed volume close to the exact one.
  const stl = stlFor(doc, r.bodies[0].key);
  if (!stl) { rows.push({ id: id + 's', name: 'STL export: ' + name, ok: false, actual: 'null (studio falls back to display mesh)' }); continue; }
  const dv = new DataView(stl.buffer, stl.byteOffset, stl.byteLength), n = dv.getUint32(80, true);
  let v = 0;
  for (let t = 0; t < n; t++) {
    const o = 84 + t * 50 + 12, P = [0, 1, 2].map(k => [0, 1, 2].map(c => dv.getFloat32(o + k * 12 + c * 4, true)));
    const [a, b, c] = P; v += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  const one = r.bodies[0].volumeMM3 ?? 0;
  rows.push({ id: id + 's', name: 'STL export volume: ' + name, ok: stl.byteLength === 84 + 50 * n && rel(v, one) < 0.01, expected: +one.toFixed(3), actual: { triangles: n, bytes: stl.byteLength, volume: +v.toFixed(3) } });
}
// STEP export of an empty part, and of brepMassProperties on import (independent reader).
{
  const s = stepFor(emptyDoc(), 'empty');
  rows.push({ id: 'X09', name: 'STEP export of an empty part explains itself', ok: 'error' in s && /no body/.test(s.error), actual: s });
  const t = stepFor(starterDoc(), 'p');
  if ('text' in t) { try { const solids = importStep(t.text); const m = (solids as unknown as { solids?: unknown[] }).solids ?? solids; rows.push({ id: 'X10', name: 'importStep (kernel) reads the exported starter', ok: true, actual: Array.isArray(m) ? `${m.length} solids` : typeof m }); void brepMassProperties; } catch (e) { rows.push({ id: 'X10', name: 'importStep reads exported starter', ok: false, actual: String(e) }); } }
}
// --- Rapid sequence through the snapshot cache (the worker reuses the last snapshot) ---------------
{
  // Preview a refused candidate, then the accepted model: the cache must not leak the refusal or stale shapes.
  evaluateDoc(withNode(plate, { kind: 'hole', parent: S(1), center: [300, 30], radius: 4 }), rev++);
  vol('C01', 'after a refused preview, the plain plate evaluates exactly', plate, 30000);
  evaluateDoc(withNode(plate, { kind: 'hole', parent: S(1), center: [50, 30], radius: 10 }), rev++);
  evaluateDoc(withNode(plate, { kind: 'hole', parent: S(1), center: [50, 30], radius: 11 }), rev++);
  vol('C02', 'after previews of Ø20/Ø22, Ø8 commit evaluates exactly', withNode(plate, { kind: 'hole', parent: S(1), center: [50, 30], radius: 4 }), 30000 - PI * 16 * 5);
  // Undo to an earlier document after many edits.
  vol('C03', 'undo back to the starter after edits', starterDoc(), 16384 - PI * 128);
}

for (const r of rows) console.log(JSON.stringify(r));
const bad = rows.filter(r => !r.ok);
console.log(`\n${rows.length - bad.length}/${rows.length} cases as expected; ${bad.length} findings: ${bad.map(r => r.id).join(' ')}`);
