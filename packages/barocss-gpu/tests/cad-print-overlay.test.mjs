// Geometry and recorded adapter contracts only. No actual Model evaluation or GL/GPU raster.
// Run: node --test --test-concurrency=1 packages/barocss-gpu/tests/cad-print-overlay.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../../../', import.meta.url)), temp = await mkdtemp(join(tmpdir(), 'cad-print-overlay-'));
let PrintOverlayGeometry, printLoopSegments, clipPrintSupport, PrintOverlayGL, GpuRenderer, Renderer;
try {
  const outfile = join(temp, 'overlay.mjs');
  await build({
    stdin: { contents: 'export * from "./apps/cad-studio/src/viewport/printOverlayGeometry.ts"; export {PrintOverlayGL} from "./apps/cad-studio/src/viewport/printOverlayGL.ts"; export {GpuRenderer} from "./apps/cad-studio/src/viewport/gpuRenderer.ts"; export {Renderer} from "./apps/cad-studio/src/viewport/renderer.ts";', resolveDir: root },
    outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
    alias: { '@barocss/gpu/viewer': resolve(root, 'packages/barocss-gpu/src/viewer/index.ts'), '@barocss/gpu': resolve(root, 'packages/barocss-gpu/src/index.ts'), '@barocss/cad-model': resolve(root, 'packages/barocss-cad-model/src'), '@barocss/cad': resolve(root, 'packages/barocss-cad/src') },
  });
  ({ PrintOverlayGeometry, printLoopSegments, clipPrintSupport, PrintOverlayGL, GpuRenderer, Renderer } = await import(pathToFileURL(outfile).href));
} finally { await rm(temp, { recursive: true, force: true }); }

const loop = (points, hole = false) => ({ points: Float64Array.from(points), hole });
const layer = (k = 0) => ({ k, z: k + 0.5, contours: [loop([0, 0, 4, 0, 4, 4, 0, 4]), loop([1, 1, 1, 2, 2, 2, 2, 1], true)], overhang: [loop([0, 0, 1, 0, 0, 1])], support: [loop([2, 2, 3, 2, 2, 3])] });
const supportMesh = () => ({
  positions: Float32Array.of(0, 0, 0, 4, 0, 0, 4, 4, 0, 0, 4, 0, 0, 0, 4, 4, 0, 4, 4, 4, 4, 0, 4, 4),
  normals: Float32Array.from({ length: 24 }, (_v, i) => i % 3 === 2 ? 1 : 0),
  indices: Uint32Array.of(0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7),
  faces: [], faceOfVertex: new Float32Array(8).fill(-1), edges: [], edgeLines: new Float32Array(), edgeOfSegment: new Float32Array(), bounds: { min: [0, 0, 0], max: [4, 4, 4] },
});
const display = () => ({ request: 3, summaryKey: 7, summary: { version: 'print-layers-v1', direction: [1, 0, 0], directionSource: 'given', modelToBed: [0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 5, 1], layerHeight: { value: 1, basis: 'set' }, overhangLimit: { value: 45, basis: 'estimate' }, count: 4, height: 4, supportColumns: [], supportVolume: 8, basis: 'display mesh' }, layer: layer(), supportMesh: supportMesh(), top: 1, supports: true, printed: false });
const snapshot = value => JSON.stringify(value, (_key, v) => ArrayBuffer.isView(v) ? Array.from(v) : v);
const byName = values => new Map(values.map(value => [value.name, value]));

test('closed contour/hole winding stays supplied and all lines use actual mid-layer z', () => {
  const input = layer(), before = snapshot(input), lines = printLoopSegments(input.contours, input.z);
  assert.equal(lines.length, 8 * 6);
  assert.deepEqual(Array.from(lines.slice(18, 24)), [0, 4, 0.5, 0, 0, 0.5]);
  assert.deepEqual(Array.from(lines.slice(24, 30)), [1, 1, 0.5, 1, 2, 0.5]);
  for (let i = 2; i < lines.length; i += 3) assert.equal(lines[i], input.z);
  assert.equal(snapshot(input), before);
  assert.equal(printLoopSegments([loop([0, 0, 1, 0, 1, 1, 0, 0])], 2).length, 18, 'explicit closure does not add a zero segment');
  assert.throws(() => printLoopSegments([loop([0, NaN])], 2), /invalid layer loop/);
  assert.throws(() => printLoopSegments([], NaN), /invalid layer height/);
});

test('printed support uses G19 clipping and closes the top with no native face authority', () => {
  const mesh = supportMesh(), before = snapshot(mesh), clipped = clipPrintSupport(mesh, 2);
  assert.equal(clipPrintSupport(mesh), mesh, 'full supplied extrusion has no copy or second transform');
  let capArea = 0, volume = 0;
  for (let i = 0; i < clipped.indices.length; i += 3) {
    const [a, b, c] = Array.from(clipped.indices.slice(i, i + 3), n => Array.from(clipped.positions.slice(n * 3, n * 3 + 3)));
    assert.ok([a, b, c].every(point => point[2] <= 2));
    if ([a, b, c].every(point => point[2] === 2)) capArea += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
    volume += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  assert.equal(capArea, 16); assert.ok(Math.abs(volume - 32) < 1e-6); assert.equal(snapshot(mesh), before);
  assert.equal(clipPrintSupport(mesh, -1).indices.length, 0);
  assert.throws(() => clipPrintSupport(mesh, NaN), /invalid printed height/);
});

test('summary, full support and unchanged layer drawings retain resource identities across toggles and lazy layers', () => {
  const geometry = new PrintOverlayGeometry(), input = display(), before = snapshot(input), first = byName(geometry.update(input));
  assert.equal(first.get('supports').positions, input.supportMesh.positions);
  assert.equal(first.get('supports').indices, input.supportMesh.indices);
  const second = byName(geometry.update({ ...input, request: 4, layer: layer(1), top: 2 }));
  assert.equal(second.get('bed'), first.get('bed')); assert.equal(second.get('supports'), first.get('supports'));
  assert.notEqual(second.get('contours'), first.get('contours'));
  const off = byName(geometry.update({ ...input, supports: false }));
  assert.equal(off.get('supports'), first.get('supports')); assert.equal(off.get('supports').visible, false); assert.equal(off.get('support-loops').visible, false);
  const clipped = byName(geometry.update({ ...input, printed: true }));
  assert.notEqual(clipped.get('supports'), first.get('supports'));
  assert.equal(clipped.get('bed'), first.get('bed')); assert.equal(clipped.get('contours'), off.get('contours'));
  assert.equal(snapshot(input), before); assert.deepEqual(geometry.update(null), []);
});

function gpuFixture() {
  const meshes = [], planes = Object.freeze([{ normal: [0, 0, 1], offset: 100 }]);
  const renderer = Object.create(GpuRenderer.prototype);
  renderer.viewer = { clipPlanes: planes, requestRender() {}, add(input, options) {
    const mesh = { ...options, visible: true, geometry: { input, dispose() { this.disposed = true; } }, remove() { this.removed = true; } };
    meshes.push(mesh); return mesh;
  } };
  return { renderer, meshes, planes };
}

test('GPU additions have no native authority; lazy layer and support toggles reuse resources; null frees them', () => {
  const f = gpuFixture(), input = display(), before = snapshot(input);
  f.renderer.setPrintDisplay(input); const first = new Map(f.meshes.map(mesh => [mesh.name, mesh]));
  for (const mesh of first.values()) {
    for (const flag of ['pickable', 'castShadow', 'receiveShadow', 'cap', 'clipped', 'bounded']) assert.equal(mesh[flag], false);
    assert.equal(mesh.pickTransparent, true); assert.equal(mesh.geometry.input.faces, undefined); assert.equal(mesh.geometry.input.edges, undefined);
    assert.equal(mesh.transform, undefined, 'already-bed geometry receives no second modelToBed');
  }
  f.renderer.setPrintDisplay({ ...input, supports: false });
  assert.equal(f.meshes.length, first.size); assert.equal(first.get('print:supports').visible, false);
  f.renderer.setPrintDisplay({ ...input, layer: layer(1), top: 2 });
  assert.equal(first.get('print:supports').removed, undefined); assert.equal(first.get('print:bed').removed, undefined); assert.equal(first.get('print:contours').removed, true);
  assert.equal(f.renderer.viewer.clipPlanes, f.planes); assert.equal(snapshot(input), before);
  const alive = [...f.renderer.print.meshes.values()]; f.renderer.setPrintDisplay(null);
  assert.ok(alive.every(mesh => mesh.removed && mesh.geometry.disposed)); assert.equal(f.renderer.print, undefined);
});

function glFixture() {
  const events = [], draws = [], enabled = new Set(); let serial = 0, depth = true, func = 'LESS';
  const api = { getShaderParameter: () => true, getProgramParameter: () => true, getUniformLocation: (_p, name) => name,
    enable: flag => enabled.add(flag), disable: flag => enabled.delete(flag), depthMask: value => { depth = value; }, depthFunc: value => { func = value; },
    drawElements: (...args) => draws.push({ args, depth, func, enabled: new Set(enabled) }), drawArraysInstanced: (...args) => draws.push({ args, depth, func, enabled: new Set(enabled) }),
  };
  const gl = new Proxy(api, { get(target, key) {
    if (key in target) return target[key]; if (/^[A-Z_0-9]+$/.test(key)) return key;
    if (key.startsWith('create')) return () => ({ id: ++serial });
    return (...args) => events.push({ name: key, args: args.map(value => ArrayBuffer.isView(value) ? Array.from(value) : value) });
  } });
  return { gl, events, draws, state: () => ({ depth, func }) };
}
const identity = Float32Array.of(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);

test('GL owns a colour-only final pass, same support/bed resources and actual bed positions', () => {
  const f = glFixture(), renderer = Object.create(Renderer.prototype); renderer.gl = f.gl;
  const input = display(); renderer.setPrintDisplay(input); const pass = renderer.print;
  const first = new Map(pass.draws), uploads = f.events.filter(event => event.name === 'bufferData').length;
  renderer.setPrintDisplay({ ...input, supports: false });
  assert.equal(f.events.filter(event => event.name === 'bufferData').length, uploads);
  assert.equal(pass.draws.size, first.size);
  pass.render(identity, 800, 600, 2);
  assert.equal(f.draws.length, 3, 'bed, contours and overhang only when supports are off');
  for (const draw of f.draws) { assert.equal(draw.depth, false); assert.equal(draw.func, 'LEQUAL'); assert.ok(draw.enabled.has('BLEND')); }
  assert.equal(f.state().depth, true); assert.equal(f.state().func, 'LESS');
  assert.equal(f.events.some(event => event.name === 'uniformMatrix4fv' && event.args[0] === 'uModel'), false);
  const contour = [...pass.draws.keys()].find(source => source.name === 'contours');
  assert.deepEqual(Array.from(contour.positions.slice(0, 6)), [0, 0, input.layer.z, 4, 0, input.layer.z]);
  renderer.setPrintDisplay(null); assert.equal(pass.draws.size, 0);
  const deletions = f.events.filter(event => event.name === 'deleteVertexArray').length; assert.equal(deletions, first.size);
  renderer.dispose(); assert.equal(renderer.print, null);
});

test('GL shader failure and GPU upload failure are explicit and discard partial overlay resources', () => {
  const f = glFixture(); f.gl.getShaderParameter = () => false;
  assert.throws(() => new PrintOverlayGL(f.gl), /Print overlay shader/);
  assert.ok(f.events.some(event => event.name === 'deleteProgram'));
  const gpu = gpuFixture(), add = gpu.renderer.viewer.add;
  gpu.renderer.viewer.add = (...args) => { if (gpu.meshes.length === 1) throw new Error('print upload unavailable'); return add(...args); };
  assert.throws(() => gpu.renderer.setPrintDisplay(display()), /print upload unavailable/);
  assert.ok(gpu.meshes.every(mesh => mesh.removed && mesh.geometry.disposed));
  assert.equal(gpu.renderer.print.meshes.size, 0);
});
