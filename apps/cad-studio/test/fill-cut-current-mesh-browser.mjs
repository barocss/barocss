import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';
import { installD524MeshObserver } from './readonlymeshobserver.mjs';

const output = process.argv[2], repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
await mkdir(output);
const sourcePath = 'apps/cad-studio/test/fixtures/linear-cut-pattern.bcad';
const source = JSON.parse(await readFile(resolve(repo, sourcePath), 'utf8'));
source.nodes.push({
  kind: 'fill-feature-pattern', parent: { node: 5, side: 'solid' },
  region: { points: [[15, 6], [48, 6], [48, 28], [15, 28]], holes: [[[25, 17], [27, 17], [27, 19], [25, 19]]] },
  anchor: [10, 10], spacing: 16, count: 3, spacing2: 8, count2: 3, id: 'n6',
});
source.outputs = { b6: { node: 6, side: 'solid' } };
source.nextId = 7;
assert.equal(sha256(JSON.stringify(source)), '8919b49b3b826d20bf5515eee373c741b9ba7e7c5c1147a281bde940c136fc51');
const file = join(output, 'masked-fill-cut.bcad');
await writeFile(file, JSON.stringify(source));

const nearWidth = 4 + 1 / 32768, farWidth = 6;
function expected(width) {
  const doc = structuredClone(source);
  if (width !== 4) {
    doc.nodes[2].max[0] = width;
    delete doc.nodes[3].made;
  }
  return doc;
}

const pins = ['apps/cad-studio/test/fill-cut-current-mesh-browser.mjs', sourcePath,
  'apps/cad-studio/test/readonlymeshobserver.mjs', 'apps/cad-studio/src/viewport/gpuRenderer.ts',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts', 'packages/barocss-cad-model/src/engine/mesh.ts',
  'packages/barocss-gpu/src/viewer/geometry.ts', 'packages/barocss-gpu/src/viewer/scene.ts',
  'packages/barocss-gpu/src/viewer/viewer.ts'];
const f = await createFlow({
  name: 'fill-cut-current-mesh', envFrozen: 'D785_SOURCE_FROZEN', output,
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'One native Fill cut with constant outer bounds, current surface and edge uploads and real rim picks.',
  limits: ['Actual Studio uses an authored width delta. The observer delegates calls unchanged.',
    'The historical signature comparison uses the observed renderer inputs. Queue writes are observed before GPU memory.',
    'The coarse control distinguishes the old and new rim by pointer. The smaller edit is measured in mesh and upload coordinates.'],
  snapshotExtra: () => ({ mesh: window.__d524Mesh?.snapshot() }),
});

const bounds = { min: [0, 0, 0], max: [60, 30, 10] };
const asBytes = data => Buffer.from(data.buffer, data.byteOffset, data.byteLength);
const uploadsOf = (state, id, label) => state.mesh.uploads.findLast(upload => upload.buffer === id && upload.label === label);
function writeOf(state, id, label) {
  const write = uploadsOf(state, id, label);
  assert.ok(write?.bytes?.length, `Missing full ${label} write for the current geometry buffer`);
  return Buffer.from(write.bytes);
}

function checkUpload(state, input, geometry) {
  const { surface, edges } = geometry;
  const d = surface.data, e = edges.data, ids = surface.gpuBuffers;
  assert.deepEqual(d.bounds, bounds);
  assert.deepEqual(d.positions.values, input.positions.values);
  assert.deepEqual(d.normals.values, input.normals.values);
  assert.deepEqual(d.indices.values, input.indices.values);
  assert.deepEqual(e.positions.values, input.edgeLines.values);

  assert.deepEqual(writeOf(state, ids.positions, 'positions'), asBytes(Float32Array.from(d.positions.values)));
  assert.deepEqual(writeOf(state, ids.normals, 'normals'), asBytes(Float32Array.from(d.normals.values)));
  const wanted = asBytes((d.indices.type === 'Uint16Array' ? Uint16Array : Uint32Array).from(d.indices.values));
  const indices = writeOf(state, ids.indices, 'indices');
  assert.deepEqual(indices.subarray(0, wanted.length), wanted);
  assert.ok(indices.length - wanted.length < 4 && indices.subarray(wanted.length).every(byte => byte === 0));

  const segments = writeOf(state, edges.gpuBuffers.positions, 'lines');
  assert.equal(segments.length, e.positions.values.length / 6 * 32);
  for (let index = 0; index < e.positions.values.length; index++) {
    const offset = 32 * Math.floor(index / 6) + 4 * (index % 6);
    assert.equal(segments.readFloatLE(offset), Math.fround(e.positions.values[index]));
  }
}

async function observe(label, width) {
  f.phase = label;
  await f.same(expected(width));
  await f.page.waitForFunction(x => {
    const current = window.__d524Mesh?.snapshot().current;
    return current?.length === 1 && current[0].surface?.gpuAllocated && current[0].edges?.gpuAllocated
      && current[0].surface.data.positions.values.some((value, index) => index % 3 === 0 && value === x);
  }, 8 + width);
  const state = await f.snapshot(label);
  const call = state.mesh.calls.findLast(entry => entry.input.length === 1 && entry.input[0].key === 'b6');
  assert.ok(call);
  const [input] = call.input, [geometry] = state.mesh.current;
  assert.deepEqual(input.bounds, bounds);
  assert.equal(geometry.key, 'b6');
  assert.equal(geometry.surface.id, call.after[0].surface.id);
  assert.equal(geometry.edges.id, call.after[0].edges.id);
  assert.ok(!geometry.surface.disposed && !geometry.edges.disposed);
  assert.ok(Math.abs(state.bodies.bodies[0].volume - (18000 - 240 * width)) < 1e-8);
  checkUpload(state, input, geometry);
  return { state, input, geometry, signature: call.legacySignatures[0] };
}

async function widthEdit(from, to) {
  await f.openFeatureEditor(3, 'original Fill cut tool');
  const width = f.editor().getByRole('spinbutton', { name: 'Width', exact: true });
  assert.equal(Number(await width.inputValue()), from);
  await width.fill(String(to));
  await f.editor().getByRole('button', { name: 'Apply', exact: true }).click();
  await f.same(expected(to));
  await f.closeEditor();
}

function assertNewGeometry(before, after) {
  assert.notEqual(after.geometry.surface.id, before.geometry.surface.id);
  assert.notEqual(after.geometry.edges.id, before.geometry.edges.id);
  assert.notEqual(after.geometry.surface.gpuBuffers.positions, before.geometry.surface.gpuBuffers.positions);
  assert.notEqual(after.geometry.edges.gpuBuffers.positions, before.geometry.edges.gpuBuffers.positions);
  assert.notDeepEqual(after.input.positions, before.input.positions);
  assert.notDeepEqual(after.input.edgeLines, before.input.edgeLines);
}

async function pick(x, frame, hit, label) {
  f.phase = label;
  await f.page.keyboard.press('Escape');
  const xy = await f.page.evaluate(x => window.__studioScreenOf([x, 10, 10]), x);
  assert.ok(xy?.length === 2 && xy.every(Number.isFinite));
  await f.page.mouse.click(...xy);
  if (hit) await f.page.waitForFunction(() => window.__studioSelection?.selection.edges.length === 1);
  const state = await f.snapshot(label, () => ({}));
  const { edges, faces, bodies } = state.selection.selection;
  assert.deepEqual([edges.length, faces.length, bodies.length], [hit ? 1 : 0, 0, 0]);
  if (!hit) return;
  assert.equal(edges[0].body, 0);
  const edge = frame.input.edges[edges[0].edge];
  assert.ok(edge?.straight);
  const ends = [edge.a, edge.b].sort((a, b) => a[1] - b[1]);
  for (const [i, want] of [[0, [x, 8, 10]], [1, [x, 12, 10]]]) {
    assert.ok(ends[i].every((value, axis) => Math.abs(value - want[axis]) < 1e-8), JSON.stringify({ ends, want }));
  }
}

await f.run(async () => {
  await f.newPage();
  await f.page.evaluate(installD524MeshObserver, { capturePayloads: true });
  try {
    await f.openFile(file, 7);
    await f.page.locator('.views').getByRole('button', { name: 'Top', exact: true }).click();
    await f.page.keyboard.press('f');
    const start = await observe('01-original-width', 4);
    const filter = f.page.getByRole('button', { name: 'Selection filter', exact: true });
    for (let attempt = 0; attempt < 4 && !(await filter.innerText()).includes('Edges'); attempt++) await filter.click();
    assert.ok((await filter.innerText()).includes('Edges'));
    await pick(12, start, true, '02-original-rim-pick');
    await pick(14, start, false, '03-future-rim-miss');

    await widthEdit(4, nearWidth);
    const near = await observe('04-sub-quantization-width', nearWidth);
    assertNewGeometry(start, near);
    const lengths = ['positions', 'normals', 'indices', 'edgeLines', 'faceOfVertex', 'edgeOfSegment'];
    for (const field of lengths) assert.equal(near.input[field].values.length, start.input[field].values.length);
    const changed = lengths.filter(field => JSON.stringify(near.input[field]) !== JSON.stringify(start.input[field]));
    const collision = near.signature === start.signature;
    f.report.observations.push({ nearDeltaMm: nearWidth - 4, legacySignatureCollision: collision, changed,
      inputLengths: Object.fromEntries(lengths.map(field => [field, start.input[field].values.length])),
      startSignature: start.signature, nearSignature: near.signature,
      initialUploadCount: start.state.mesh.uploadCount, nearUploadCount: near.state.mesh.uploadCount });
    await f.persist();

    await widthEdit(nearWidth, farWidth);
    const far = await observe('05-coarse-width', farWidth);
    assertNewGeometry(near, far);
    await pick(14, far, true, '06-current-rim-pick');
    await pick(12, far, false, '07-retired-rim-miss');

    await f.undo();
    const undo = await observe('08-undo-to-near-width', nearWidth);
    assertNewGeometry(far, undo);
    assert.deepEqual(undo.input, near.input);
    await f.redo();
    const redo = await observe('09-redo-to-coarse-width', farWidth);
    assertNewGeometry(undo, redo);
    assert.deepEqual(redo.input, far.input);
    f.report.observations.push({ redoUploadCount: redo.state.mesh.uploadCount, nativeQueueObserved: redo.state.mesh.nativeQueueObserved });
    assert.deepEqual(f.report.downloads, []);
  } finally {
    await f.page.evaluate(() => window.__d524Mesh?.restore());
  }
});
