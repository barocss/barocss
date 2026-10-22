// Narrow source-level adapter regression. No browser, GPU, package build or benchmark.
// Run: node --test --test-concurrency=1 packages/barocss-gpu/tests/cad-display-contract.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

// Bundle the current TypeScript source, rather than a possibly stale package dist.
const temporary = await mkdtemp(join(tmpdir(), 'cad-display-contract-'));
let Renderer;
try {
  const outfile = join(temporary, 'renderer.mjs');
  await build({ entryPoints: [fileURLToPath(new URL('../../../apps/cad-studio/src/viewport/renderer.ts', import.meta.url))], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  ({ Renderer } = await import(pathToFileURL(outfile).href));
} finally { await rm(temporary, { recursive: true, force: true }); }

const identity = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const camera = () => ({ aspect: 1, target: [0, 0, 0], distance: 100, fovY: Math.PI / 4, ortho: false, viewProjection: identity, view: identity, near: () => 0.1, far: () => 1000 });
const baseView = mode => ({ displayMode: mode, hoverFace: null, hoverEdge: null, selectedFaces: [], selectedEdges: [], selectedBodies: [], offsets: new Map(), ghostBodies: new Set([1]), hiddenBodies: new Set([2]) });
const mesh = () => ({
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
  normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
  indices: new Uint32Array([0, 1, 2, 0, 2, 3]), faceOfVertex: new Float32Array([0, 0, 0, 0]),
  faces: [{ index: 0, id: 'native-plane-0', name: 'Native plane', kind: 'plane', normal: [0, 0, 1], centroid: [0.5, 0.5, 0], areaMM2: 1 }],
  // Only two native edges, deliberately distinct from the two triangles and their diagonal.
  edgeLines: new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0]), edgeOfSegment: new Float32Array([0, 0, 1, 1]),
  bounds: { min: [0, 0, 0], max: [1, 1, 1] },
});

function mockGl() {
  let next = 0, program = null, vao = null, depth = true, colour = [true, true, true, true], func = 'LESS', pickId = 1;
  const enabled = new Set(), uniforms = new Map(), draws = [], events = [];
  const snapshot = (name, args) => draws.push({ name, args, program, vao, depth, colour: [...colour], func, enabled: new Set(enabled), uniforms: { ...(uniforms.get(program) ?? {}) } });
  const api = {
    getParameter: () => 4, getShaderParameter: () => true, getProgramParameter: () => true,
    getUniformLocation: (p, name) => ({ p, name }),
    useProgram: p => { program = p; }, bindVertexArray: v => { vao = v; },
    enable: cap => { enabled.add(cap); }, disable: cap => { enabled.delete(cap); },
    depthMask: value => { depth = value; }, depthFunc: value => { func = value; },
    colorMask: (...value) => { colour = value; events.push({ name: 'colorMask', args: value }); },
    drawArrays: (...args) => snapshot('drawArrays', args), drawElements: (...args) => snapshot('drawElements', args), drawArraysInstanced: (...args) => snapshot('drawArraysInstanced', args),
    readPixels: (x, y, w, h, format, type, bytes) => { events.push({ name: 'readPixels', args: [x, y, w, h] }); bytes[0] = pickId; },
  };
  const gl = new Proxy(api, { get(target, key) {
    if (key in target) return target[key];
    if (/^[A-Z_0-9]+$/.test(key)) return key;
    if (key.startsWith('create')) return () => `${key}-${++next}`;
    if (key.startsWith('uniform')) return (location, ...values) => {
      const valuesForProgram = uniforms.get(location.p) ?? {}; uniforms.set(location.p, valuesForProgram);
      valuesForProgram[location.name] = values.length === 1 && ArrayBuffer.isView(values[0]) ? Array.from(values[0]) : values;
    };
    return (...args) => { events.push({ name: key, args }); };
  } });
  return { gl, draws, events, setPickId: id => { pickId = id; }, clear: () => { draws.length = 0; events.length = 0; } };
}

function fixture(dpr = 1) {
  const recording = mockGl(), canvas = { clientWidth: 320, clientHeight: 200, width: 0, height: 0, getContext: () => recording.gl };
  const renderer = new Renderer(canvas);
  renderer.setBodies([0, 1, 2].map(() => ({ mesh: mesh() })));
  renderer.setSectionHatch([{ body: 0, segments: new Float32Array([0, 0, 0, 1, 1, 0]) }]);
  const render = view => {
    const priorWindow = globalThis.window; globalThis.window = { devicePixelRatio: dpr };
    try { renderer.setState(view); recording.clear(); renderer.render(camera(), view); }
    finally { if (priorWindow === undefined) delete globalThis.window; else globalThis.window = priorWindow; }
    return recording.draws;
  };
  return { renderer, recording, canvas, render };
}

const surfaceDraws = (f, draws) => draws.filter(d => d.program === f.renderer.mesh && d.name === 'drawElements');
const nativeEdges = (f, draws) => draws.filter(d => d.program === f.renderer.line && f.renderer.bodies.some(b => b.lineVao === d.vao));
const aoDraw = (f, draws) => draws.find(d => d.program === f.renderer.ao);
const hatchDraws = (f, draws) => draws.filter(d => f.renderer.hatch.some(h => h.line.vao === d.vao));

for (const dpr of [1, 2]) {
  test(`WebGL2 DPR ${dpr}: line-only modes retain solid/ghost depth and suppress colour, hatch, AO and contact shadow`, () => {
    const f = fixture(dpr);
    for (const mode of ['hidden-lines-removed', 'hidden-lines-dashed', 'wireframe']) {
      const draws = f.render(baseView(mode)), surfaces = surfaceDraws(f, draws);
      assert.equal(surfaces.length, 2, 'durable hidden body is not drawn');
      for (const draw of surfaces) { assert.deepEqual(draw.colour, [false, false, false, false]); assert.equal(draw.depth, true); }
      assert.equal(hatchDraws(f, draws).length, 0);
      assert.equal(draws.some(d => d.program === f.renderer.shadow), false);
      assert.deepEqual(aoDraw(f, draws).uniforms.uStrength, [0]);
      assert.deepEqual(f.renderer.getDisplayModeStatus(), { requested: mode, effective: mode, supported: true });
      assert.equal(f.canvas.width, 320 * dpr); assert.equal(f.canvas.height, 200 * dpr);
    }
  });

  test(`WebGL2 DPR ${dpr}: hidden dashes are a separate depth-tested [6,4] CSS-pixel pass`, () => {
    const f = fixture(dpr), draws = f.render(baseView('hidden-lines-dashed')), edges = nativeEdges(f, draws);
    assert.equal(edges.length, 4, 'one visible and one hidden native-edge pass per visible body');
    for (let bi = 0; bi < 2; bi++) {
      const [solid, hidden] = edges.slice(bi * 2, bi * 2 + 2);
      assert.deepEqual(solid.uniforms.uDash, [0, 0]); assert.equal(solid.func, 'LESS');
      assert.deepEqual(hidden.uniforms.uDash, [6 * dpr, 4 * dpr]); assert.equal(hidden.func, 'GREATER');
      for (const draw of [solid, hidden]) {
        assert.equal(draw.depth, false); assert.equal(draw.enabled.has('DEPTH_TEST'), true);
        assert.equal(draw.args[3], 2, 'uses the two native edges, not triangle edges');
        assert.deepEqual(draw.uniforms.uColor.slice(3), [bi === 1 ? 0.35 : 0.9]);
      }
    }
    const removed = nativeEdges(f, f.render(baseView('hidden-lines-removed')));
    assert.equal(removed.length, 2); assert.ok(removed.every(d => d.func === 'LESS' && d.uniforms.uDash.every(n => n === 0)));
  });

  test(`WebGL2 DPR ${dpr}: wireframe disables depth only for native edges and default restores appearance`, () => {
    const f = fixture(dpr), wires = nativeEdges(f, f.render(baseView('wireframe')));
    assert.equal(wires.length, 2);
    for (const draw of wires) { assert.equal(draw.enabled.has('DEPTH_TEST'), false); assert.equal(draw.depth, false); assert.deepEqual(draw.uniforms.uDash, [0, 0]); }
    const restored = f.render(baseView(undefined)), surfaces = surfaceDraws(f, restored);
    assert.deepEqual(surfaces.map(d => d.depth), [true, false], 'operation ghost returns to its existing no-depth-write pass');
    assert.ok(surfaces.every(d => d.colour.every(Boolean) && d.uniforms.uOpacity[0] === 1));
    assert.equal(hatchDraws(f, restored).length, 1); assert.ok(restored.some(d => d.program === f.renderer.shadow));
    assert.ok(aoDraw(f, restored).uniforms.uStrength[0] > 0); assert.equal(f.renderer.aoEnabled, true);
    for (const draw of nativeEdges(f, restored)) { assert.equal(draw.enabled.has('DEPTH_TEST'), true); assert.equal(draw.depth, true); assert.deepEqual(draw.uniforms.uDash, [0, 0]); }
    assert.ok(hatchDraws(f, restored).every(d => d.depth === true), 'baseline resets the depth mask before default native edges and hatch, including after operation ghosts');
    assert.deepEqual(f.renderer.getDisplayModeStatus(), { requested: 'shaded-with-edges', effective: 'shaded-with-edges', supported: true });
  });

  test(`WebGL2 DPR ${dpr}: x-ray preserves hidden/ghost authority and ordinary face picking`, () => {
    const f = fixture(dpr), view = baseView('x-ray'), draws = f.render(view), surfaces = surfaceDraws(f, draws);
    assert.equal(surfaces.length, 2);
    assert.deepEqual(surfaces.map(d => d.uniforms.uOpacity), [[0.25], [0.25]]);
    assert.deepEqual(surfaces.map(d => d.uniforms.uGhost), [[0], [1]]);
    assert.deepEqual(surfaces.map(d => d.depth), [true, false]);
    f.recording.clear();
    assert.deepEqual(f.renderer.pickFace(12, 15, camera(), view), { body: 0, face: 0 });
    const picked = f.recording.draws.filter(d => d.program === f.renderer.pick);
    assert.equal(picked.length, 1, 'ghost and hidden bodies stay excluded from ID/depth picking');
    assert.equal(picked[0].vao, f.renderer.bodies[0].vao);
    assert.deepEqual(f.recording.events.find(e => e.name === 'readPixels').args, [12 * dpr, 185 * dpr, 1, 1]);
    for (const mode of [undefined, 'hidden-lines-removed', undefined, 'hidden-lines-dashed', undefined, 'wireframe', undefined]) {
      const next = baseView(mode); f.render(next);
      assert.deepEqual(f.renderer.pickFace(12, 15, camera(), next), { body: 0, face: 0 }, `${mode ?? 'default'} preserves the same face ID`);
      f.recording.setPickId(0);
      assert.equal(f.renderer.pickFace(12, 15, camera(), next), null, 'background ID stays a miss');
      f.recording.setPickId(1);
    }
  });
}

test('WebGL2 unsupported direct/proposal overlays preserve the prior effective mode and permit explicit default', () => {
  const f = fixture(); f.render(baseView('wireframe'));
  f.renderer.setDirect([{ id: 'curve', kind: 'curve', positions: new Float32Array([0, 0, 0, 1, 1, 0]), controls: [] }], []);
  f.render(baseView('hidden-lines-dashed'));
  let status = f.renderer.getDisplayModeStatus();
  assert.equal(status.requested, 'hidden-lines-dashed'); assert.equal(status.effective, 'wireframe'); assert.equal(status.supported, false); assert.match(status.reason, /direct.*proposal/);
  f.render(baseView(undefined)); assert.equal(f.renderer.getDisplayModeStatus().effective, 'shaded-with-edges');
  f.renderer.setDirect([], []);
  f.renderer.setProposalOverlay({ added: { mesh: mesh() } });
  f.render(baseView('x-ray')); status = f.renderer.getDisplayModeStatus();
  assert.equal(status.requested, 'x-ray'); assert.equal(status.effective, 'shaded-with-edges'); assert.equal(status.supported, false);
  f.renderer.setProposalOverlay(null); f.render(baseView('x-ray'));
  assert.deepEqual(f.renderer.getDisplayModeStatus(), { requested: 'x-ray', effective: 'x-ray', supported: true });
});
