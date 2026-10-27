// Current-source WebGL2 instance bridge contracts. Recorded GL calls/ID bytes, no raster/browser/GPU.
// Run: node --test --test-concurrency=1 packages/barocss-gpu/tests/cad-instance-bridge.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../../../', import.meta.url)), temp = await mkdtemp(join(tmpdir(), 'cad-instance-bridge-'));
let Renderer, boxBody, multiply, translation, rotation;
try {
  const outfile = join(temp, 'bridge.mjs');
  await build({
    stdin: { contents: 'export {Renderer} from "./apps/cad-studio/src/viewport/renderer.ts"; export {boxBody} from "./packages/barocss-gpu/tests/fixtures/cad-display-browser.ts"; export {multiply,translation,rotation} from "./packages/barocss-gpu/src/viewer/math.ts";', resolveDir: root },
    outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
    alias: { '@barocss/gpu/viewer': resolve(root, 'packages/barocss-gpu/src/viewer/index.ts'), '@barocss/gpu': resolve(root, 'packages/barocss-gpu/src/index.ts'), '@barocss/cad-model': resolve(root, 'packages/barocss-cad-model/src'), '@barocss/cad': resolve(root, 'packages/barocss-cad/src') },
  });
  ({ Renderer, boxBody, multiply, translation, rotation } = await import(pathToFileURL(outfile).href));
} finally { await rm(temp, { recursive: true, force: true }); }

function mockGl() {
  let resource = 0, program = null, vao = null, framebuffer = null, depth = true, func = 'LESS', readId = 0, colors = [true, true, true, true];
  const enabled = new Set(), uniforms = new Map(), draws = [], events = [];
  const cloned = value => ArrayBuffer.isView(value) ? Array.from(value) : value;
  const draw = (name, args) => draws.push({ name, args, program, vao, framebuffer, depth, func, colors: [...colors], enabled: new Set(enabled), uniforms: structuredClone(uniforms.get(program) ?? {}) });
  const api = {
    getParameter: () => 4, getShaderParameter: () => true, getProgramParameter: () => true, getUniformLocation: (p, name) => ({ p, name }),
    useProgram: p => { program = p; }, bindVertexArray: v => { vao = v; },
    bindFramebuffer: (target, value) => { if (target === 'FRAMEBUFFER') framebuffer = value; },
    enable: value => enabled.add(value), disable: value => enabled.delete(value), depthMask: value => { depth = value; }, depthFunc: value => { func = value; },
    colorMask: (...value) => { colors = value; },
    drawElements: (...args) => draw('drawElements', args), drawArrays: (...args) => draw('drawArrays', args), drawArraysInstanced: (...args) => draw('drawArraysInstanced', args),
    readPixels: (x, y, w, h, format, type, bytes) => {
      for (let k = 0; k < bytes.length; k += 4) for (let channel = 0; channel < 4; channel++) bytes[k + channel] = Math.floor(readId / 256 ** channel) % 256;
      events.push({ name: 'readPixels', args: [x, y, w, h], bytes: Array.from(bytes.subarray(0, 4)) });
    },
  };
  const gl = new Proxy(api, { get(target, key) {
    if (key in target) return target[key];
    if (/^[A-Z_0-9]+$/.test(key)) return key;
    if (key.startsWith('create')) return () => { const id = key + '-' + ++resource; events.push({ name: key, args: [id] }); return id; };
    if (key.startsWith('uniform')) return (location, ...values) => {
      const current = uniforms.get(location.p) ?? {}; current[location.name] = values.map(cloned); uniforms.set(location.p, current);
      events.push({ name: key, uniform: location.name, args: values.map(cloned) });
    };
    return (...args) => events.push({ name: key, args: args.map(cloned) });
  } });
  return { gl, draws, events, read: value => { readId = value; }, clear: () => { draws.length = 0; events.length = 0; } };
}

const camera = () => ({ aspect: 1, target: [0, 0, 0], distance: 100, fovY: Math.PI / 4, ortho: false, eye: () => [0, 0, 10], basis: () => ({ eye: [0, 0, 10], right: [1, 0, 0], up: [0, 1, 0], forward: [0, 0, -1] }), viewProjection: () => Float32Array.from(translation([0, 0, 0])), view: () => Float32Array.from(translation([0, 0, 0])), near: () => 0.1, far: () => 1000 });
const state = mode => ({ displayMode: mode, hoverFace: null, hoverEdge: null, selectedFaces: [], selectedEdges: [], selectedBodies: [], offsets: new Map(), ghostBodies: new Set(), hiddenBodies: new Set() });
const instance = (id, x) => ({ id, bodies: [boxBody(id, [2, 2, 2], [x, 0, 0])], placement: translation([x, 0, 0]) });
const modelOf = draw => draw.uniforms.uModel[1];
const closeMatrix = (actual, expected) => actual.forEach((n, i) => assert.ok(Math.abs(n - expected[i]) < 1e-6, 'matrix element ' + i));

function fixture() {
  const recording = mockGl(), canvas = { clientWidth: 320, clientHeight: 200, width: 320, height: 200, getContext: () => recording.gl };
  const renderer = new Renderer(canvas), c = camera();
  const render = (view = state()) => {
    const previous = globalThis.window; globalThis.window = { devicePixelRatio: 1 };
    try { renderer.setState(view); recording.clear(); renderer.render(c, view); }
    finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; }
    return recording.draws;
  };
  return { renderer, recording, render, camera: c };
}

test('world-placed packets share only a fully verified moved copy and keep private selection buffers', () => {
  const f = fixture(), a = instance('a', 10), b = instance('b', 20);
  f.renderer.setInstances([a, b], []);
  const [one, two] = f.renderer.instances.map(it => it.bodies[0]);
  assert.equal(one.gpu.geometry, two.gpu.geometry); assert.equal(one.gpu.geometry.users, 2);
  assert.notEqual(one.gpu.state, two.gpu.state); assert.notEqual(one.gpu.lineState, two.gpu.lineState);
  f.renderer.setInstanceFaces([{ id: 'a', body: 0, face: 0 }]);
  assert.ok(one.gpu.stateData.some(n => n === 2)); assert.ok(two.gpu.stateData.every(n => n === 0));
  const draws = f.render(), surface = draws.filter(d => d.program === f.renderer.mesh);
  closeMatrix(modelOf(surface.find(d => d.vao === one.gpu.vao)), translation([0, 0, 0]));
  closeMatrix(modelOf(surface.find(d => d.vao === two.gpu.vao)), translation([10, 0, 0]));
  const c = instance('changed', 30); c.bodies[0].mesh.positions[c.bodies[0].mesh.positions.length - 4] += 0.01;
  f.renderer.setInstances([a, b, c], []);
  assert.notEqual(f.renderer.instances[2].bodies[0].gpu.geometry, one.gpu.geometry, 'equal topology/sample keys do not authorize sharing after an unsampled vertex changes');
});

test('pose then drag is composed after reference-to-placement for both instance surfaces and native edges', () => {
  const f = fixture(), a = instance('a', 10), b = instance('b', 20);
  f.renderer.setInstances([a, b], []);
  const pose = rotation([0, 0, 1], Math.PI / 2), drag = translation([3, 4, 5]);
  f.renderer.setInstanceTransforms(new Map([['b', pose]])); f.renderer.setInstancePreview({ id: 'b', matrix: drag });
  const draws = f.render(), item = f.renderer.instances[1].bodies[0], expected = multiply(multiply(drag, pose), translation([10, 0, 0]));
  closeMatrix(modelOf(draws.find(d => d.vao === item.gpu.vao)), expected);
  closeMatrix(modelOf(draws.find(d => d.vao === item.gpu.lineVao)), expected);
});

test('selection-only setInstances reuses uploads and deleting the last shared user releases geometry exactly once', () => {
  const f = fixture(), a = instance('a', 10), b = instance('b', 20);
  f.renderer.setInstances([a, b], []); const first = f.renderer.instances[0], geometry = first.bodies[0].gpu.geometry;
  f.recording.clear(); f.renderer.setInstances([a, b], ['b']);
  assert.equal(f.renderer.instances[0], first);
  assert.equal(f.recording.events.filter(e => e.name === 'createBuffer' || e.name === 'bufferData').length, 0);
  f.recording.clear(); f.renderer.setInstances([b], []);
  assert.equal(geometry.users, 1); assert.ok(!f.recording.events.some(e => e.name === 'deleteBuffer' && geometry.buffers.includes(e.args[0])));
  f.recording.clear(); f.renderer.setInstances([], []);
  assert.equal(geometry.users, 0); assert.equal(f.renderer.instanceShapes.size, 0);
  for (const buffer of geometry.buffers) assert.equal(f.recording.events.filter(e => e.name === 'deleteBuffer' && e.args[0] === buffer).length, 1);
});

test('default instance surfaces and native edges share the base/direct scene depth; omitted hidden items are not drawn', () => {
  const f = fixture(), a = instance('visible', 10), hidden = instance('hidden', 20);
  f.renderer.setBodies([boxBody('base')]);
  const direct = boxBody('direct').mesh;
  f.renderer.setDirect([{ id: 'direct', kind: 'surface', positions: direct.positions, normals: direct.normals, indices: direct.indices, controls: [] }], []);
  f.renderer.setInstances([a, hidden], []); f.renderer.setInstances([a], []);
  const draws = f.render(), surfaces = draws.filter(d => d.program === f.renderer.mesh && d.name === 'drawElements');
  assert.equal(surfaces.length, 3, 'one base, one direct and one visible instance surface');
  assert.ok(surfaces.every(d => d.framebuffer === f.renderer.msFbo && d.enabled.has('DEPTH_TEST') && d.depth));
  const item = f.renderer.instances[0].bodies[0].gpu, edges = draws.find(d => d.vao === item.lineVao);
  assert.equal(edges.framebuffer, f.renderer.msFbo); assert.equal(edges.enabled.has('DEPTH_TEST'), true); assert.equal(edges.args[3], a.bodies[0].mesh.edgeLines.length / 6);
  assert.deepEqual(f.renderer.instances.map(it => it.item.id), ['visible']);
});

test('actual ID decoding routes RGBA32 instance/native/cap source identities without stealing base or direct winners', () => {
  const f = fixture(), a = instance('source', 10), b = instance('second', 20);
  a.bodies[0].mesh.faces[1].id = 'section-cap';
  a.sourceBodies = [7]; a.sourceFaces = [[12, -1, 14, 15, 16, 17]];
  f.renderer.setBodies([boxBody('base')]);
  const direct = boxBody('direct').mesh;
  f.renderer.setDirect([{ id: 'direct', kind: 'surface', positions: direct.positions, normals: direct.normals, indices: direct.indices, controls: [] }], []);
  f.renderer.setInstances([a, b], []); f.render();
  const firstId = 2 ** 24;
  f.recording.read(firstId); assert.deepEqual(f.renderer.pickInstanceFace(10, 20, f.camera), { id: 'source', body: 7, face: 12 });
  assert.equal(f.renderer.pickFace(10, 20, f.camera, state()), null); assert.equal(f.renderer.pickDirect(10, 20, f.camera), null);
  assert.deepEqual(f.recording.events.filter(e => e.name === 'readPixels').at(-1).bytes, [0, 0, 0, 1], 'the fourth byte carries instance namespace identity');
  assert.ok(f.recording.events.some(e => e.name === 'uniform1ui' && e.uniform === 'uInstanceId' && e.args[0] === firstId));
  f.recording.read(firstId + 1); assert.deepEqual(f.renderer.pickInstanceFace(10, 20, f.camera), { id: 'source', body: 7, face: -1, cap: true });
  f.recording.read(firstId + a.bodies[0].mesh.faces.length); assert.deepEqual(f.renderer.pickInstanceFace(10, 20, f.camera), { id: 'second', body: 0, face: 0 });
  f.recording.read(1); assert.deepEqual(f.renderer.pickFace(10, 20, f.camera, state()), { body: 0, face: 0 }); assert.equal(f.renderer.pickInstanceFace(10, 20, f.camera), null);
  f.recording.read(15 << 20); assert.equal(f.renderer.pickDirect(10, 20, f.camera), 'direct'); assert.equal(f.renderer.pickInstanceFace(10, 20, f.camera), null);
  f.recording.read(0); assert.equal(f.renderer.pickInstanceFace(10, 20, f.camera), null);
  f.renderer.setInstanceFaces([{ id: 'source', body: 7, face: 12 }, { id: 'source', body: 7, face: -1 }]);
  const gpu = f.renderer.instances[0].bodies[0].gpu;
  for (let vertex = 0; vertex < gpu.stateData.length; vertex++) assert.equal(gpu.stateData[vertex], a.bodies[0].mesh.faceOfVertex[vertex] === 0 ? 2 : 0, 'generated cap gets no native-face selection authority');
});

test('instance modes retain surface depth, classify native edges and cap x-ray opacity', () => {
  const f = fixture(); f.renderer.setInstances([instance('a', 10)], []);
  const gpu = f.renderer.instances[0].bodies[0].gpu;
  for (const mode of ['shaded-with-edges', 'hidden-lines-removed', 'hidden-lines-dashed', 'wireframe', 'x-ray']) {
    const draws = f.render(state(mode)), status = f.renderer.getDisplayModeStatus();
    assert.deepEqual(status, { requested: mode, effective: mode, supported: true });
    const surface = draws.find(d => d.vao === gpu.vao);
    assert.deepEqual(surface.uniforms.uOpacity, [mode === 'x-ray' ? 0.25 : 1]);
    assert.ok(surface.depth && surface.enabled.has('DEPTH_TEST'));
    assert.deepEqual(surface.colors, Array(4).fill(!['hidden-lines-removed', 'hidden-lines-dashed', 'wireframe'].includes(mode))); 
    const edges = draws.filter(d => d.vao === gpu.lineVao);
    assert.equal(edges.length, mode === 'hidden-lines-dashed' ? 2 : 1);
    assert.equal(edges[0].enabled.has('DEPTH_TEST'), mode !== 'wireframe');
    assert.equal(edges[0].depth, mode === 'shaded-with-edges');
    if (mode === 'hidden-lines-dashed') {
      assert.equal(edges[1].func, 'GREATER'); assert.deepEqual(edges[1].uniforms.uDash, [6, 4]);
    }
  }
  f.render({ ...state('x-ray'), displayModeUnsupported: 'Render workspace supports shaded solids only.' });
  assert.equal(f.renderer.getDisplayModeStatus().supported, false);
});

test('isolation scales original base/ghost/instance alpha, removes faded pick authority and restores all five modes', () => {
  const f = fixture(), a = { id: 'a', placement: translation([-0.6, 0, 0]), bodies: [boxBody('a', [0.2, 0.2, 0.2], [-0.6, 0, 0])] }, b = { id: 'b', placement: translation([0.6, 0, 0]), bodies: [boxBody('b', [0.2, 0.2, 0.2], [0.6, 0, 0])], sourceBodies: [7], sourceFaces: [[12, -1, 14, 15, 16, 17]] };
  b.bodies[0].mesh.faces[1].id = 'section-cap';
  f.renderer.setBodies([boxBody('base'), boxBody('ghost'), boxBody('hidden')]);
  f.renderer.setSectionHatch([0, 1, 2].map(body => ({ body, segments: new Float32Array([0, 0, 0, 1, 1, 0]) })));
  f.renderer.setInstances([a, b, instance('hidden-instance', 30)], ['b']); f.renderer.setInstances([a, b], ['b']);
  const [one, two] = f.renderer.instances.map(it => it.bodies[0].gpu), shapes = [one.geometry, two.geometry];
  const source = JSON.stringify([a, b], (_key, value) => ArrayBuffer.isView(value) ? [...value] : value);
  const baseState = mode => ({ ...state(mode), ghostBodies: new Set([1]), hiddenBodies: new Set([2]) });
  const alpha = draw => draw.uniforms.uOpacity[0] * (1 - draw.uniforms.uGhost[0] * 0.65);
  const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} expected ${expected}`);
  const meshDraw = (draws, vao) => draws.find(d => d.program === f.renderer.mesh && d.vao === vao);
  const firstEdgePoint = packet => {
    const L = packet.bodies[0].mesh.edgeLines;
    return [(1 + (L[0] + L[3]) / 2) * 160, (1 - (L[1] + L[4]) / 2) * 100];
  };
  // Isolate filtering is the subject here; pixel depth occlusion has its own renderer contracts.
  f.renderer.depthsAround = () => () => true;
  for (const mode of ['shaded-with-edges', 'hidden-lines-removed', 'hidden-lines-dashed', 'wireframe', 'x-ray']) {
    const initial = f.render(baseState(mode)), original = f.renderer.bodies.slice(0, 2).map(gpu => meshDraw(initial, gpu.vao));
    const originalAlpha = original.map(alpha), originalDepth = original.map(d => d.depth), modeAlpha = mode === 'x-ray' ? 0.25 : 1;
    const originalEdges = f.renderer.bodies.slice(0, 2).map(gpu => initial.find(d => d.vao === gpu.lineVao).uniforms.uColor[3]);
    const originalHatch = f.renderer.hatch.slice(0, 2).map(h => initial.find(d => d.vao === h.line.vao)?.uniforms.uColor[3]);
    const isolated = { ...baseState(mode), isolatedInstances: ['b'] }, draws = f.render(isolated);
    for (let bi = 0; bi < 2; bi++) {
      const draw = meshDraw(draws, f.renderer.bodies[bi].vao); near(alpha(draw), originalAlpha[bi] * 0.15); assert.equal(draw.depth, false);
      near(draws.find(d => d.vao === f.renderer.bodies[bi].lineVao).uniforms.uColor[3], originalEdges[bi] * 0.15);
      if (originalHatch[bi] !== undefined) near(draws.find(d => d.vao === f.renderer.hatch[bi].line.vao).uniforms.uColor[3], originalHatch[bi] * 0.15);
    }
    assert.equal(meshDraw(draws, f.renderer.bodies[2].vao), undefined);
    near(alpha(meshDraw(draws, one.vao)), modeAlpha * 0.15); near(alpha(meshDraw(draws, two.vao)), modeAlpha);
    assert.equal(meshDraw(draws, one.vao).depth, false); assert.equal(meshDraw(draws, two.vao).depth, true);
    assert.ok(draws.filter(d => d.vao === one.lineVao).every(d => Math.abs(d.uniforms.uColor[3] - 0.9 * 0.15) < 1e-12));
    assert.ok(draws.filter(d => d.vao === two.lineVao).every(d => d.uniforms.uColor[3] === 0.9));
    const firstId = 2 ** 24;
    f.recording.read(firstId); assert.deepEqual(f.renderer.pickInstanceFace(10, 20, f.camera), { id: 'b', body: 7, face: 12 });
    assert.ok([...f.renderer.instanceIds.values()].every(hit => hit.id === 'b'));
    const picks = f.recording.draws.filter(d => d.program === f.renderer.pick);
    assert.ok(picks.some(d => d.vao === two.vao)); assert.ok(!picks.some(d => d.vao === one.vao || f.renderer.bodies.some(gpu => gpu.vao === d.vao)), 'base, ghost, hidden and faded surfaces have no native/cap ID draw');
    f.recording.read(firstId + 1); assert.deepEqual(f.renderer.pickInstanceFace(10, 20, f.camera), { id: 'b', body: 7, face: -1, cap: true });
    assert.equal(f.renderer.pickEdge(...firstEdgePoint(a), f.camera, isolated), null);
    assert.equal(f.renderer.pickInstanceEdge(...firstEdgePoint(a), f.camera), null, 'faded native edges cannot be selected');
    const focusEdge = f.renderer.pickInstanceEdge(...firstEdgePoint(b), f.camera); assert.equal(focusEdge?.id, 'b'); assert.equal(focusEdge?.body, 7);
    f.render({ ...baseState(mode), isolatedInstances: ['a'] });
    f.recording.read(firstId); assert.deepEqual(f.renderer.pickInstanceFace(10, 20, f.camera), { id: 'a', body: 0, face: 0 });
    const restored = f.render({ ...baseState(mode), isolatedInstances: [] });
    for (let bi = 0; bi < 2; bi++) { const draw = meshDraw(restored, f.renderer.bodies[bi].vao); near(alpha(draw), originalAlpha[bi]); assert.equal(draw.depth, originalDepth[bi]); }
    near(alpha(meshDraw(restored, one.vao)), modeAlpha); near(alpha(meshDraw(restored, two.vao)), modeAlpha);
    assert.equal(one.geometry, shapes[0]); assert.equal(two.geometry, shapes[1]);
    f.recording.read(firstId); assert.deepEqual(f.renderer.pickInstanceFace(10, 20, f.camera), { id: 'a', body: 0, face: 0 });
    f.recording.read(firstId + a.bodies[0].mesh.faces.length); assert.deepEqual(f.renderer.pickInstanceFace(10, 20, f.camera), { id: 'b', body: 7, face: 12 });
    assert.equal(f.renderer.pickInstanceEdge(...firstEdgePoint(a), f.camera)?.id, 'a');
    assert.deepEqual(f.renderer.instances.map(it => it.item.id), ['a', 'b']);
    assert.equal(JSON.stringify([a, b], (_key, value) => ArrayBuffer.isView(value) ? [...value] : value), source);
  }
});
