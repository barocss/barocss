// Three public Part API results from the documented bracket, packed for display only.
import assert from 'node:assert/strict';
import { part } from '@barocss/cad/api';

const DENSITY = 2.7; // g/cm³; public mass results use MMGS.
const VOLUME_ABS_TOLERANCE = 1e-6; // A fixed-example check, not a geometric accuracy guarantee.
const EXPECTED_CORNERS = [
  'extrude1.side0|extrude1.side1', 'extrude1.side0|extrude1.side3',
  'extrude1.side1|extrude1.side2', 'extrude1.side2|extrude1.side3',
].sort();
const close = (a, b) => Math.abs(a - b) <= 1e-9;
const finite = (values, name) => {
  assert.ok(values.every(Number.isFinite), `${name} must contain finite numbers`);
};
function massData(value, id) {
  assert.ok(Number.isFinite(value.volume) && value.volume > 0, `${id}: volume must be positive and finite`);
  assert.ok(Number.isFinite(value.mass) && value.mass > 0, `${id}: mass must be positive and finite`);
  assert.ok(Array.isArray(value.centroid) && value.centroid.length === 3, `${id}: centroid needs three numbers`);
  finite(value.centroid, `${id}: centroid`);
  assert.ok(Array.isArray(value.inertia) && value.inertia.length === 3, `${id}: inertia needs three rows`);
  for (const row of value.inertia) {
    assert.ok(Array.isArray(row) && row.length === 3, `${id}: inertia needs three columns`);
    finite(row, `${id}: inertia`);
  }
  return { volume: value.volume, mass: value.mass, centroid: [...value.centroid], inertia: value.inertia.map(row => [...row]) };
}
function meshData(mesh, id) {
  assert.ok(mesh.positions instanceof Float32Array, `${id}: public positions must be Float32Array`);
  assert.ok(mesh.normals instanceof Float32Array, `${id}: public normals must be Float32Array`);
  assert.ok(mesh.indices instanceof Uint32Array, `${id}: public indices must be Uint32Array`);
  const positions = Array.from(mesh.positions), normals = Array.from(mesh.normals), indices = Array.from(mesh.indices);
  assert.ok(positions.length > 0 && positions.length % 3 === 0, `${id}: complete vertices are required`);
  assert.equal(normals.length, positions.length, `${id}: each vertex needs a normal`);
  finite(positions, `${id}: positions`); finite(normals, `${id}: normals`);
  assert.ok(indices.length > 0 && indices.length % 3 === 0, `${id}: complete triangles are required`);
  assert.ok(indices.every(i => Number.isInteger(i) && i >= 0 && i < positions.length / 3), `${id}: triangle index out of range`);
  if (mesh.lines !== undefined) assert.ok(mesh.lines instanceof Float32Array, `${id}: public lines must be Float32Array`);
  const segments = mesh.lines === undefined ? [] : Array.from(mesh.lines);
  assert.equal(segments.length % 6, 0, `${id}: display lines must be segment pairs`);
  finite(segments, `${id}: lines`);
  const lines = [];
  for (let i = 0; i < segments.length; i += 6) lines.push(segments.slice(i, i + 6));
  // Preserve the public Float32 tessellation values. Do not re-tessellate or round them.
  return { positions, normals, indices, lines };
}
function capture(result, id, title, code, inputDescription, expectedVolume) {
  assert.equal(result.bodies().length, 1, `${id}: this example must have one body`);
  const meshes = result.meshes();
  assert.equal(meshes.length, 1, `${id}: this example must return one display mesh`);
  const mass = massData(result.mass({ density: DENSITY }), id);
  assert.ok(Math.abs(mass.volume - expectedVolume) <= VOLUME_ABS_TOLERANCE,
    `${id}: volume ${mass.volume} differs from analytic ${expectedVolume}`);
  assert.ok(Math.abs(mass.mass - mass.volume * DENSITY / 1000) <= VOLUME_ABS_TOLERANCE * DENSITY / 1000,
    `${id}: mass must be in grams for the authored g/cm³ density`);
  return { id, title, code, inputDescription, mass, mesh: meshData(meshes[0], id) };
}
function verifyVerticalCorners(holed) {
  const selected = holed.select().edges().along('z');
  assert.equal(selected.count, 4, 'The documented fillet must select exactly four vertical corners');
  assert.deepEqual(selected.names().sort(), EXPECTED_CORNERS, 'The documented fillet selected different edge names');
  const corners = new Set();
  for (const edge of selected.list()) {
    assert.ok(edge.straight && edge.axis === 'z', 'The fillet selector must return straight Z edges');
    const [a, b] = [edge.a, edge.b];
    assert.ok(close(a[0], b[0]) && close(a[1], b[1]), 'A selected corner must have fixed X/Y');
    assert.ok((close(a[2], 0) && close(b[2], 10)) || (close(a[2], 10) && close(b[2], 0)), 'A selected corner must span Z = 0 to 10');
    const x = close(a[0], 0) ? 0 : close(a[0], 80) ? 80 : null;
    const y = close(a[1], 0) ? 0 : close(a[1], 40) ? 40 : null;
    assert.ok(x !== null && y !== null, 'A selected edge must be an outer plate corner');
    corners.add(`${x},${y}`);
  }
  assert.equal(corners.size, 4, 'Four distinct outer plate corners are required');
  return selected.names().sort();
}
export function buildScenes() {
  // These are the same calls as samples/cad-api.test.mjs, lines 16–19.
  // No fallback changes the selector, operation, dimensions or engine behavior.
  const box = part('bracket').box({ w: 80, d: 40, h: 10 });
  const holed = box.hole(body => body.faces().facing('+z'), { d: 8, x: 20, y: 20 });
  const selectedCornerNames = verifyVerticalCorners(holed);
  const rounded = holed.fillet(body => body.edges().along('z'), { radius: 2 });
  const boxVolume = 80 * 40 * 10;
  const holeVolume = boxVolume - Math.PI * 4 ** 2 * 10;
  // Only apply this independent oracle after the actual public selector proves four outer corners.
  const cornerRemoval = (4 - Math.PI) * 2 ** 2 * 10;
  const roundedVolume = holeVolume - cornerRemoval;
  const boxCode = "import { part } from '@barocss/cad/api';\n\nconst result = part('bracket')\n  .box({ w: 80, d: 40, h: 10 })";
  const holeCode = boxCode + "\n  .hole(body => body.faces().facing('+z'), { d: 8, x: 20, y: 20 })";
  const roundedCode = holeCode + "\n  .fillet(body => body.edges().along('z'), { radius: 2 })";
  const ending = ";\n\nconst mass = result.mass({ density: 2.7 });\nconst meshes = result.meshes();";
  return {
    cases: [
      capture(box, 'box', 'An 80 × 40 × 10 mm plate', boxCode + ending,
        'Box from [0, 0, 0] to [80, 40, 10] mm. Density 2.7 g/cm³.', boxVolume),
      capture(holed, 'holed', 'The plate with a through-hole', holeCode + ending,
        'The same plate, with an 8 mm diameter through-hole at X = 20, Y = 20 mm.', holeVolume),
      capture(rounded, 'rounded', 'The plate with four rounded corners', roundedCode + ending,
        'The same holed plate, with a 2 mm fillet on its four outer vertical edges.', roundedVolume),
    ],
    analyticChecks: {
      absoluteVolumeToleranceMM3: VOLUME_ABS_TOLERANCE,
      boxVolumeMM3: boxVolume,
      holeVolumeMM3: holeVolume,
      roundedVolumeMM3: roundedVolume,
      roundedCornerRemovalMM3: cornerRemoval,
      selectedVerticalCornerNames: selectedCornerNames,
      boundary: 'Fixed-example arithmetic checks only; not a tessellation or geometric tolerance guarantee.',
    },
  };
}
