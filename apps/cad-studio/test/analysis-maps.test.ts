import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import { rectanglePart, withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { refOf } from '@barocss/cad-model/app/bodyRef';
import { wallSamples } from '@barocss/cad-model/chat/analysis';
import { thicknessMap } from '../src/viewport/scalarMaps';
import { mouldView } from '../src/engine/mouldView';
import { GpuRenderer } from '../src/viewport/gpuRenderer';

// G6: the analysis maps' data and the renderer's use of it. The thickness map is IM4's wall samples per display triangle
// (a shelled box: its walls read the shell's thickness, the nominal); the mould's view is the moulding report's tooling
// (IM7's plate with a Ø10 hole along +Z: one flat loop, the halves 48000 and the block less the part less that); the
// renderer sets a body's field once per map, draws the loops and halves, spreads them and keeps picks off the bodies.

const bodiesOf = (doc: StudioDoc): BodyResult[] => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return r.bodies; };
const shelled = () => { const d = rectanglePart(40, 30, 20); return withNode(d, { kind: 'shell', parent: refOf(bodiesOf(d)[0]), thickness: 2, open: [] } as never); };
const holedPlate = (): StudioDoc => {
  const d = withNode(rectanglePart(60, 40, 10), { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [30, 20], radius: 5 });
  return { ...d, process: 'injection', mould: { version: 1, pull: [0, 0, 1], finish: 'smooth' } };
};

test('G6 the thickness map: one value a display triangle, the wall samples\' local thickness; a shelled box\'s nominal its shell, the thick limit nominal / 0.6', () => {
  const [b] = bodiesOf(shelled()), m = thicknessMap(b), w = wallSamples(b);
  assert.equal(m.per, 'triangle'); assert.equal(m.values.length, b.mesh.indices.length / 3); assert.equal(m.body, b.key);
  for (let t = 0; t < m.values.length; t++) assert.ok(Number.isFinite(w.local[t]) ? Math.abs(m.values[t] - w.local[t]) < 1e-5 : Number.isNaN(m.values[t]));
  const nominal = m.thresholds.find(x => x.label === 'nominal')!.value;
  assert.ok(Math.abs(nominal - 2) < 0.05, `nominal ${nominal}`);
  assert.ok(Math.abs(m.range[1] - nominal / 0.6) < 1e-9 && m.range[0] === 0 && m.above);
  assert.deepEqual(m.legend.stops.map(s => s[0]), [0, nominal, nominal / 0.6]);
});

test('G6 the mould\'s view: IM7\'s plate with a Ø10 hole along +Z — one flat closed loop; its halves 48000 and the block less the part less that (as the tooling\'s, 1e-6); none without a pull', () => {
  const doc = holedPlate(), b = bodiesOf(doc);
  const lines = mouldView(doc, b, false)!;
  assert.equal(lines.halves, null); assert.ok(lines.loops.length >= 1 && lines.loops.every(l => l.closed && l.flat), JSON.stringify(lines.loops.map(l => [l.closed, l.flat])));
  const v = mouldView(doc, b, true)!;
  assert.equal(v.why, null); assert.ok(v.halves);
  const sum = (bs: BodyResult[]) => bs.reduce((t, x) => t + x.volumeMM3!, 0), part = 60 * 40 * 10 - Math.PI * 25 * 10, block = 80 * 60 * 30;
  assert.ok(Math.abs(sum(v.halves!.plus) - 48000) <= 1e-6 * 48000, String(sum(v.halves!.plus)));
  assert.ok(Math.abs(sum(v.halves!.plus) + sum(v.halves!.minus) - (block - part)) <= 1e-6 * block);
  assert.equal(mouldView({ ...doc, mould: undefined }, b, true), null);
});

/** A stand-in for the viewer: meshes keeping their transform, material, pickable and colour map; geometries their field. */
function fakeViewer() {
  const log = { added: 0, removed: 0, scalars: 0, lines: 0 };
  const makeGeometry = () => ({ data: {}, setColors() {}, fillColors() {}, setUVs() {}, setScalars(v: unknown) { log.scalars++; (this as { field?: unknown }).field = v; }, dispose() {} });
  class Mesh {
    material: Record<string, unknown> = {}; outline: unknown = null; visible = true; pickable = true; clipped = true; cap = false; capColor: unknown = null; colorMap: unknown = null; transform: ArrayLike<number> = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    constructor(readonly geometry: ReturnType<typeof makeGeometry>, readonly name?: string) {}
    get bounds() { return null; }
    remove() { log.removed++; }
  }
  const meshes: Mesh[] = [];
  const viewer = {
    add(input: { topology?: string } | ReturnType<typeof makeGeometry>, o: { name?: string; material?: Record<string, unknown> } = {}) { log.added++; if ((input as { topology?: string }).topology === 'lines') log.lines++; const m = new Mesh('setScalars' in input ? input : makeGeometry(), o.name); m.material = { ...o.material }; meshes.push(m); return m; },
    createGeometry: () => makeGeometry(), requestRender() {}, setBackground() {}, grid: {}, dispose() {}, get meshList() { return meshes; }, clipPlane: null,
  };
  return { viewer, log, meshes };
}

test('G6 the renderer: a body\'s field set once per map and cleared; the mould\'s loops and halves drawn, spread ± along the pull, the bodies kept from picks while the halves show', () => {
  const doc = holedPlate(), bodies = bodiesOf(doc), { viewer, log, meshes } = fakeViewer();
  const r = new (GpuRenderer as unknown as new (c: unknown, v: unknown) => GpuRenderer)({}, viewer);
  r.setBodies(bodies);
  const view = { hoverFace: null, hoverEdge: null, selectedFaces: [], selectedEdges: [], selectedBodies: [], offsets: new Map(), ghostBodies: new Set<number>() };
  r.setState(view);
  const surface = (r as unknown as { bodies: { surface: { colorMap: unknown; pickable: boolean; geometry: { field?: unknown } } }[] }).bodies[0].surface;
  const map = thicknessMap(bodies[0]);
  r.setScalarMaps([map]); r.setScalarMaps([map]);
  assert.equal(log.scalars, 1, 'set once for the same map'); assert.ok(surface.colorMap); assert.equal(surface.geometry.field, map.values);
  r.setScalarMaps(null);
  assert.equal(surface.colorMap, null); assert.equal(surface.geometry.field, null);
  // The mould: its loops one line mesh, each half a see-through surface (with edges).
  const v = mouldView(doc, bodies, true)!, shown = { pull: v.pull, loops: v.loops, plus: v.halves!.plus, minus: v.halves!.minus, spread: 0 };
  const before = log.added;
  r.setMould(shown);
  const halves = meshes.filter(m => m.name?.startsWith('half:'));
  assert.equal(halves.length, shown.plus.length + shown.minus.length); assert.ok(log.lines >= 1 && log.added > before, JSON.stringify({ log, before, loops: shown.loops.map(l => l.points.length) }));
  assert.ok(halves.every(m => (m.material.opacity as number) < 1));
  assert.equal(surface.pickable, false, 'the part not picked while the halves show');
  // Spread: moved only (nothing made), + up the pull, − down.
  const made = log.added;
  r.setMould({ ...shown, spread: 12 });
  assert.equal(log.added, made);
  const z = (name: string) => meshes.find(m => m.name === name)!.transform[14];
  assert.deepEqual([z('half:+:0'), z('half:-:0')], [12, -12]);
  // Gone: released, and the part picked again.
  r.setMould(null);
  assert.ok(log.removed >= made - before); assert.equal(surface.pickable, true);
});
