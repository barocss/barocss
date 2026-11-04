import test from 'node:test';
import assert from 'node:assert/strict';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';
import { GpuRenderer } from '../src/viewport/gpuRenderer';
import type { ViewState } from '../src/viewport/renderer';

type Input = Record<string, unknown>;
class RecordedGeometry {
  readonly input: Input; colors: number[] = []; disposed = 0;
  constructor(input: Input) {
    this.input = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, ArrayBuffer.isView(value) || Array.isArray(value) ? Array.from(value as ArrayLike<number>) : value]));
  }
  setColors(colors: ArrayLike<number>) { this.colors = Array.from(colors); }
  fillColors(first: number, count: number, color: ArrayLike<number>) { for (let v = first; v < first + count; v++) this.colors.splice(v * 3, 3, ...Array.from(color)); }
  setUVs() {}
  dispose() { this.disposed++; }
}
class RecordedMesh {
  material: Record<string, unknown> = {}; outline: unknown = null; visible = true; pickable = true; removed = 0;
  transform = new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  constructor(readonly geometry: RecordedGeometry, readonly name?: string) {}
  remove() { this.removed++; }
}
function renderer() {
  const meshes: RecordedMesh[] = [], geometries: RecordedGeometry[] = [];
  const geometry = (input: Input) => { const made = new RecordedGeometry(input); geometries.push(made); return made; };
  const viewer = {
    createGeometry: geometry,
    add(input: Input | RecordedGeometry, options: { name?: string; material?: Record<string, unknown> } = {}) {
      const made = new RecordedMesh(input instanceof RecordedGeometry ? input : geometry(input), options.name);
      made.material = options.material ?? {}; meshes.push(made); return made;
    },
    requestRender() {}, setBackground() {}, grid: {}, dispose() {},
  };
  const api = new (GpuRenderer as unknown as new (canvas: unknown, viewer: unknown) => GpuRenderer)({}, viewer);
  type Body = { surface: RecordedMesh; edges: RecordedMesh | null; highlight: RecordedMesh | null; geometries: RecordedGeometry[] };
  type Instance = { id: string; surfaces: RecordedMesh[]; edges: RecordedMesh[] };
  const state = api as unknown as { bodies: Body[]; instances: Instance[] };
  return { api, meshes, geometries, state };
}
/** Recording upload fixture. This is not a native geometry or real GPU test. */
function body(key = 'body'): BodyResult {
  const positions = new Float64Array(3006), normals = new Float32Array(3006), faces = new Float32Array(1002);
  for (let v = 0; v < faces.length; v++) { positions[3 * v] = v % 2; normals[3 * v + 2] = 1; faces[v] = Math.floor(v / 3) % 2; }
  return { key, family: 'faceted', volume: 1, mass: 1, mesh: {
    positions, normals, indices: new Uint32Array([0, 1, 2, 3, 4, 5]), faceOfVertex: faces,
    edgeLines: new Float64Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]), edgeOfSegment: new Float32Array([0, 0, 1, 1]),
    bounds: { min: [0, 0, 0], max: [1, 1, 1] },
    faces: [0, 1].map(index => ({ index, id: `face${index}`, name: index ? 'back' : 'front', kind: 'plane', normal: [0, 0, 1], centroid: [0, 0, 0], area: 1 })), edges: [],
  } };
}
const clone = (value: BodyResult): BodyResult => structuredClone(value);
const view = (): ViewState => ({ hoverFace: null, hoverEdge: null, selectedFaces: [{ body: 0, face: 0 }], selectedEdges: [], selectedBodies: [], offsets: new Map(), ghostBodies: new Set() });
const changes = {
  indices(b: BodyResult) { b.mesh.indices[0] = 4; },
  normals(b: BodyResult) { b.mesh.normals[0] = 0.5; },
  edgeLines(b: BodyResult) { b.mesh.edgeLines[0] = 0.25; },
  faceOfVertex(b: BodyResult) { b.mesh.faceOfVertex[0] = 1; },
  edgeOfSegment(b: BodyResult) { b.mesh.edgeOfSegment[0] = 1; },
  unsampledPosition(b: BodyResult) { b.mesh.positions[1] = 0.25; },
  roundedPosition(b: BodyResult) { b.mesh.positions[0] = 0.000001; },
};
function expectRootUploaded(g: ReturnType<typeof renderer>, b: BodyResult) {
  const current = g.state.bodies[0], surface = current.surface.geometry.input;
  assert.deepEqual(surface.positions, Array.from(b.mesh.positions)); assert.deepEqual(surface.normals, Array.from(b.mesh.normals));
  assert.deepEqual(surface.indices, Array.from(b.mesh.indices));
  assert.deepEqual(surface.faces, Array.from({ length: b.mesh.indices.length / 3 }, (_, t) => b.mesh.faceOfVertex[b.mesh.indices[3 * t]]));
  assert.deepEqual(current.edges!.geometry.input.positions, Array.from(b.mesh.edgeLines));
  assert.deepEqual(current.edges!.geometry.input.edges, Array.from({ length: b.mesh.edgeLines.length / 6 }, (_, s) => b.mesh.edgeOfSegment[2 * s]));
}
for (const [name, change] of Object.entries(changes)) {
  for (const mode of ['copied input', 'mutated input'] as const) {
    test(`root ${name} change with ${mode} refreshes uploads while retaining sibling and selection`, () => {
      const g = renderer(), first = body(), sibling = body('sibling');
      g.api.setBodies([first, sibling]); g.api.setState(view());
      const old = g.state.bodies[0], kept = g.state.bodies[1], selectedColor = old.surface.geometry.colors.slice(0, 3);
      const next = mode === 'copied input' ? clone(first) : first; change(next);
      g.api.setBodies([next, clone(sibling)]); g.api.setState(view());
      assert.notEqual(g.state.bodies[0].surface, old.surface, 'changed GPU resource must be replaced');
      expectRootUploaded(g, next); assert.equal(g.state.bodies[1].surface, kept.surface);
      assert.equal(old.surface.removed, 1); assert.ok(old.geometries.every(resource => resource.disposed === 1));
      const colors = g.state.bodies[0].surface.geometry.colors;
      const selectedVertex = next.mesh.faceOfVertex.findIndex(face => face === 0);
      assert.deepEqual(colors.slice(selectedVertex * 3, selectedVertex * 3 + 3), selectedColor, 'the selected face retains its current paint after replacement');
      if (name === 'faceOfVertex') assert.notDeepEqual(colors.slice(0, 3), selectedColor, 'a vertex moved off the selected face must lose the selected paint');
    });
  }
}
for (const [name, change] of Object.entries(changes)) {
  for (const mode of ['copied input', 'mutated input'] as const) {
    test(`instance ${name} change with ${mode} refreshes its uploads and retains another instance`, () => {
      const g = renderer(), first = body(), sibling = body('sibling');
      g.api.setInstances([{ id: 'changed', bodies: [first] }, { id: 'kept', bodies: [sibling] }], ['changed']);
      g.api.setInstanceFaces([{ id: 'changed', body: 0, face: 0 }]);
      const old = g.state.instances[0], kept = g.state.instances[1], selectedColor = old.surfaces[0].geometry.colors.slice(0, 3);
      const next = mode === 'copied input' ? clone(first) : first; change(next);
      g.api.setInstances([{ id: 'changed', bodies: [next] }, { id: 'kept', bodies: [clone(sibling)] }], ['changed']);
      const current = g.state.instances[0];
      assert.notEqual(current.surfaces[0], old.surfaces[0], 'changed instance resources must be replaced');
      assert.deepEqual(current.surfaces[0].geometry.input.positions, Array.from(next.mesh.positions));
      assert.deepEqual(current.surfaces[0].geometry.input.normals, Array.from(next.mesh.normals));
      assert.deepEqual(current.surfaces[0].geometry.input.indices, Array.from(next.mesh.indices));
      assert.deepEqual(current.edges[0].geometry.input.positions, Array.from(next.mesh.edgeLines));
      assert.equal(g.state.instances[1].surfaces[0], kept.surfaces[0]);
      for (const mesh of [...old.surfaces, ...old.edges]) { assert.equal(mesh.removed, 1); assert.equal(mesh.geometry.disposed, 1); }
      const colors = current.surfaces[0].geometry.colors, selectedVertex = next.mesh.faceOfVertex.findIndex(face => face === 0);
      assert.deepEqual(colors.slice(selectedVertex * 3, selectedVertex * 3 + 3), selectedColor);
      if (name === 'faceOfVertex') assert.notDeepEqual(colors.slice(0, 3), selectedColor);
    });
  }
}
test('root and instance exact copies retain existing resources, including unchanged face painting', () => {
  const g = renderer(), b = body(); g.api.setBodies([b]); g.api.setState(view());
  const root = g.state.bodies[0]; g.api.setBodies([clone(b)]); g.api.setState(view()); assert.equal(g.state.bodies[0].surface, root.surface);
  g.api.setInstances([{ id: 'a', bodies: [b] }], ['a']); const instance = g.state.instances[0];
  g.api.setInstances([{ id: 'a', bodies: [clone(b)] }], ['a']); assert.equal(g.state.instances[0].surfaces[0], instance.surfaces[0]);
  assert.equal(root.surface.removed, 0); assert.equal(instance.surfaces[0].removed, 0);
});
test('current face names still resolve occurrence face colors on content-equal GPU geometry', () => {
  const g = renderer(), b = body(), red: Vec3 = [1, 0, 0], blue: Vec3 = [0, 0, 1];
  const looks = new Map([['body', { faces: new Map([['front', red], ['renamed', blue]]) }]]);
  g.api.setInstances([{ id: 'a', bodies: [b], looks }], []);
  assert.deepEqual(g.state.instances[0].surfaces[0].geometry.colors.slice(0, 3), red);
  const next = clone(b); next.mesh.faces[0].name = 'renamed';
  g.api.setInstances([{ id: 'a', bodies: [next], looks }], []);
  assert.deepEqual(g.state.instances[0].surfaces[0].geometry.colors.slice(0, 3), blue);
});

const smallSharedChanges = {
  normals(b: BodyResult) { b.mesh.normals[0] = 0.000001; },
  unsampledPosition(b: BodyResult) { b.mesh.positions[1] = 0.0000001; },
  edgeLines(b: BodyResult) { b.mesh.edgeLines[0] = 0.0000001; },
};
for (const [name, change] of Object.entries(smallSharedChanges)) {
  for (const mode of ['copied input', 'mutated input'] as const) {
    test(`shared instance ${name} ${mode} cannot rejoin its own stale shape within copy tolerance`, () => {
      const g = renderer(), first = body(), sibling = clone(first);
      const placement = new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      g.api.setInstances([{ id: 'changed', bodies: [first], placement }, { id: 'kept', bodies: [sibling], placement }], []);
      const old = g.state.instances[0], kept = g.state.instances[1];
      assert.equal(old.surfaces[0].geometry, kept.surfaces[0].geometry, 'control copies must initially share their shape');
      const next = mode === 'copied input' ? clone(first) : first; change(next);
      g.api.setInstances([{ id: 'changed', bodies: [next], placement }, { id: 'kept', bodies: [clone(sibling)], placement }], []);
      const current = g.state.instances[0];
      assert.notEqual(current.surfaces[0].geometry, old.surfaces[0].geometry, 'a changed owner cannot adopt its previous approximate copy');
      assert.deepEqual(current.surfaces[0].geometry.input.positions, Array.from(next.mesh.positions));
      assert.deepEqual(current.surfaces[0].geometry.input.normals, Array.from(next.mesh.normals));
      assert.deepEqual(current.edges[0].geometry.input.positions, Array.from(next.mesh.edgeLines));
      assert.equal(g.state.instances[1].surfaces[0], kept.surfaces[0]);
      assert.equal(kept.surfaces[0].geometry.disposed, 0, 'the unchanged sibling still owns the old shared resource');
      g.api.setInstances([], []); assert.ok(g.geometries.every(resource => resource.disposed === 1));
    });
  }
}

test('a changed body cannot regain its prior shared shape after body order changes', () => {
  const g = renderer(), a = body('A'), b = body('B');
  for (let i = 0; i < b.mesh.positions.length; i += 3) b.mesh.positions[i] += 5;
  b.mesh.bounds = { min: [5, 0, 0], max: [6, 1, 1] };
  const placement = new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  g.api.setInstances([{ id: 'a', bodies: [a, b], placement }], []);
  const previous = g.state.instances[0].surfaces.map(surface => surface.geometry);
  const changed = clone(a); changed.mesh.normals[0] = 0.000001;
  g.api.setInstances([{ id: 'a', bodies: [clone(b), changed], placement }], []);
  const current = g.state.instances[0].surfaces;
  assert.equal(current[0].geometry, previous[1], 'unchanged reordered sibling retains its shape');
  assert.notEqual(current[1].geometry, previous[0], 'body identity owns the exclusion despite a new ordinal');
  assert.deepEqual(current[1].geometry.input.normals, Array.from(changed.mesh.normals));
  g.api.setInstances([], []); assert.ok(g.geometries.every(resource => resource.disposed === 1));
});

test('a shared reference retains creation-time values after its caller buffer is mutated', () => {
  const g = renderer(), reference = body(), original = clone(reference);
  const placement = new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  g.api.setInstances([{ id: 'reference', bodies: [reference], placement }, { id: 'kept', bodies: [clone(original)], placement }], []);
  const previous = g.state.instances[0].surfaces[0].geometry;
  reference.mesh.normals[0] = 0.5;
  g.api.setInstances([{ id: 'reference', bodies: [reference], placement }, { id: 'kept', bodies: [clone(original)], placement }, { id: 'new copy', bodies: [clone(original)], placement }], []);
  assert.equal(g.state.instances[1].surfaces[0].geometry, previous);
  assert.equal(g.state.instances[2].surfaces[0].geometry, previous, 'a new original copy must find the original uploaded reference');
  g.api.setInstances([], []); assert.ok(g.geometries.every(resource => resource.disposed === 1));
});
