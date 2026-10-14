/** #1995: exactly 12 pure + 10 mocked actual-source groups. No native or real GL. */
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const built = await build({
  stdin: { contents: `export { prepareEngineScene } from './engine-scene.ts';
    export { prepareEngineSceneEdges } from './engine-scene-edges.ts';
    export { EngineSceneRenderer, mountEngineScene } from './engine-scene-renderer.ts';`,
    resolveDir: fileURLToPath(new URL('../src/', import.meta.url)), sourcefile: 'edge-fixture-entry.ts', loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'esm', target: 'es2022', logLevel: 'silent',
});
const { prepareEngineScene, prepareEngineSceneEdges, EngineSceneRenderer, mountEngineScene } =
  await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text + '\n//# sourceURL=barocss-engine-scene-edge-fixture.mjs').toString('base64'));
const clone = value => structuredClone(value);
const mesh = (id = 'first', geometryId = 'tri', visible = true) => ({ id, type: 'mesh', parentId: null,
  translation: [0, 0, 0], rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1], visible, geometryId, materialId: 'red' });
function geometry(vertexCount = 3) {
  const positions = [0, 0, 0, 1, 0, 0, 0, 1, 0];
  for (let i = 3; i < vertexCount; i++) positions.push(i / vertexCount, 1, 0);
  return { format: 'barocss-gpu-triangle-geometry', version: 0, id: 'tri', coordinateSystem: 'right-handed-y-up',
    positionUnit: 'scene', winding: 'ccw', positions,
    normals: Array.from({ length: vertexCount }, () => [0, 0, 1]).flat(),
    uvs: Array.from({ length: vertexCount * 2 }, () => 0), indices: [0, 1, 2] };
}
function scene(count = 1, vertexCount = 3) {
  return { format: 'barocss-gpu-engine-scene', version: 0, id: 'scene', coordinateSystem: 'right-handed-y-up',
    positionUnit: 'scene', background: [0, 0, 0], camera: { eye: [0, 0, 5], target: [0, 0, 0], up: [0, 1, 0], fovYDegrees: 45, near: .1, far: 100 },
    geometries: [geometry(vertexCount)], materials: [{ id: 'red', type: 'unlit', colorSpace: 'linear', color: [1, 0, 0] }],
    nodes: Array.from({ length: count }, (_, i) => mesh(i === 0 ? 'first' : 'node' + i)) };
}
function edges(source = scene(), pairs = [0, 1]) {
  return { format: 'barocss-gpu-engine-scene-edges', version: 0, sceneId: source.id, color: [.02, .03, .04],
    owners: source.nodes.filter(node => node.type === 'mesh').map(node => ({ nodeId: node.id, geometryId: node.geometryId, indices: [...pairs] })) };
}
const prepare = (input, source = scene()) => prepareEngineSceneEdges(input, prepareEngineScene(source));
const refuse = (change, source = scene()) => { const input = edges(source); change(input); assert.throws(() => prepare(input, source)); };

test('pure01 valid bounded, absent/null and empty owner/empty index coverage', () => {
  const source = scene(16), input = edges(source), result = prepare(input, source);
  assert.equal(result.owners.length, 16); assert.equal(result.owners[0].indexType, 'uint16');
  assert.equal(prepare(undefined), null); assert.equal(prepare(null), null);
  input.owners = []; assert.equal(prepare(input, source).owners.length, 0);
  input.owners = [{ nodeId: 'first', geometryId: 'tri', indices: [] }];
  assert.equal(prepare(input, source).owners[0].indices.length, 0);
});
test('pure02 exact own data refuses accessors, inheritance, extra/hidden/symbol fields', () => {
  let reads = 0;
  refuse(input => Object.defineProperty(input, 'color', { enumerable: true, get() { reads++; return [0, 0, 0]; } }));
  refuse(input => Object.setPrototypeOf(input, { extra: true }));
  refuse(input => { input.extra = true; });
  refuse(input => Object.defineProperty(input.owners[0], 'nodeId', { value: 'first', enumerable: false }));
  refuse(input => { input.owners[0][Symbol('extra')] = 1; });
  refuse(input => Object.defineProperty(input.owners[0], 'indices', { enumerable: true, get() { reads++; return []; } }));
  assert.equal(reads, 0);
});
test('pure03 dense arrays and row/segment/aggregate bounds including 16/17 and 256/257', () => {
  refuse(input => { delete input.owners[0]; });
  refuse(input => { delete input.owners[0].indices[0]; });
  refuse(input => { input.color.extra = 1; });
  refuse(input => { input.owners[0].indices = new Uint16Array([0, 1]); });
  refuse(input => { input.owners[0].indices = new Array(65); });
  refuse(input => Object.defineProperty(input.owners[0].indices, '0', { enumerable: true, get() { throw new Error('must not read'); } }));
  const source = scene(17, 34), pairs = Array.from({ length: 32 }, (_, i) => [0, i + 1]).flat();
  const input = edges(source, pairs); input.owners = input.owners.slice(0, 8);
  assert.equal(prepare(input, source).owners.reduce((sum, row) => sum + row.indices.length / 2, 0), 256);
  input.owners.push({ nodeId: 'node8', geometryId: 'tri', indices: [0, 1] });
  assert.throws(() => prepare(input, source), /256/);
  assert.throws(() => prepare(edges(source, []), source), /cardinality/);
  const sixteen = edges(scene(16), []); assert.equal(prepare(sixteen, scene(16)).owners.length, 16);
  refuse(input => { input.owners[0].indices = [...pairs, 0, 33]; }, source);
});
test('pure04 finite linear color, format/version/scene and identifiers', () => {
  for (const color of [[0, 0], [0, 0, 0, 0], [-1, 0, 0], [2, 0, 0], [NaN, 0, 0], [Infinity, 0, 0], ['0', 0, 0]]) refuse(input => { input.color = color; });
  refuse(input => { input.format = 'lines'; }); refuse(input => { input.version = 1; });
  refuse(input => { input.sceneId = 'other'; }); refuse(input => { input.sceneId = ''; });
  refuse(input => { input.owners[0].nodeId = 'bad id'; });
});
test('pure05 missing and nonmesh owner references, including empty rows', () => {
  refuse(input => { input.owners[0].nodeId = 'absent'; input.owners[0].indices = []; });
  const source = scene(); const group = { ...mesh('group'), type: 'group' }; delete group.geometryId; delete group.materialId; source.nodes.push(group);
  refuse(input => { input.owners[0].nodeId = 'group'; }, source);
});
test('pure06 geometry mismatch and duplicate owner refusal', () => {
  refuse(input => { input.owners[0].geometryId = 'missing'; input.owners[0].indices = []; });
  refuse(input => { input.owners.push(clone(input.owners[0])); });
  const source = scene(); source.geometries.push({ ...geometry(), id: 'other' });
  refuse(input => { input.owners[0].geometryId = 'other'; }, source);
});
test('pure07 cardinality, finite integer and vertex range refusal', () => {
  for (const indices of [[0], [0, .5], [0, -1], [0, 3], [0, NaN], [0, Infinity], [0, '1']]) refuse(input => { input.owners[0].indices = indices; });
});
test('pure08 self and duplicate undirected pairs, independent owner identity', () => {
  for (const indices of [[1, 1], [0, 1, 0, 1], [0, 1, 1, 0]]) refuse(input => { input.owners[0].indices = indices; });
  const source = scene(2); assert.equal(prepare(edges(source), source).owners.length, 2);
});
test('pure09 Float32 local and transformed endpoint collapse refuses nontriangle edges', () => {
  const source = scene(1, 5); source.geometries[0].positions.splice(9, 6, 1, 1, 0, 1 + 1e-9, 1, 0);
  assert.throws(() => prepare(edges(source, [3, 4]), source), /collapse/);
  const transformed = scene(1, 5); transformed.geometries[0].positions.splice(9, 6, 0, 1, 0, 1e-8, 1, 0);
  transformed.nodes[0].translation = [10, 0, 0];
  assert.throws(() => prepare(edges(transformed, [3, 4]), transformed), /Transformed endpoints/);
  const triangle = scene(); triangle.geometries[0].positions = [1, 0, 0, 1 + 1e-9, 0, 0, 0, 1, 0];
  assert.throws(() => prepareEngineScene(triangle), error => error.code === 'REPRESENTATION' && error.cause?.code === 'REPRESENTATION');
});
test('pure10 independent uint32 edge indices beyond the triangle maximum', () => {
  const source = scene(1, 65537), prepared = prepareEngineScene(source), result = prepareEngineSceneEdges(edges(source, [0, 65536]), prepared);
  assert.equal(prepared.geometries[0].indexType, 'uint16'); assert.equal(result.owners[0].indexType, 'uint32');
  assert.ok(result.owners[0].indices instanceof Uint32Array); assert.deepEqual([...result.owners[0].indices], [0, 65536]);
});
test('pure11 immutable snapshots preserve signed coordinates without mutating caller inputs', () => {
  const source = scene(); source.geometries[0].positions[0] = -0; source.geometries[0].positions[3] = -1; source.geometries[0].positions[7] = -1;
  const input = edges(source), before = clone(input), preparedSource = prepareEngineScene(source), result = prepareEngineSceneEdges(input, preparedSource);
  assert.deepEqual(input, before); assert.ok(Object.is(preparedSource.scene.geometries[0].positions[0], -0));
  input.color[0] = 1; input.owners[0].indices[1] = 2; input.owners[0].nodeId = 'changed';
  assert.deepEqual([...result.owners[0].indices], [0, 1]); assert.deepEqual(result.overlay.color, before.color);
  assert.ok(Object.isFrozen(result.overlay)); assert.ok(Object.isFrozen(result.overlay.owners[0].indices));
});
test('pure12 hidden owner admission, ancestor visibility and hidden malformed/empty rows', () => {
  const source = scene(); source.nodes[0].visible = false;
  const result = prepare(edges(source), source); assert.equal(result.owners[0].node.effectiveVisible, false);
  refuse(input => { input.owners[0].indices = [0, 99]; }, source);
  refuse(input => { input.owners[0].geometryId = 'missing'; input.owners[0].indices = []; }, source);
  const parent = { ...mesh('parent'), type: 'group', visible: false }; delete parent.geometryId; delete parent.materialId;
  source.nodes[0].visible = true; source.nodes[0].parentId = parent.id; source.nodes.push(parent);
  assert.equal(prepare(edges(source), source).owners[0].node.effectiveVisible, false);
});

// The mock records actual renderer commands/resources. It does not rasterize pixels.
const constants = ['VERTEX_SHADER', 'FRAGMENT_SHADER', 'COMPILE_STATUS', 'LINK_STATUS', 'ARRAY_BUFFER', 'ELEMENT_ARRAY_BUFFER',
  'STATIC_DRAW', 'FLOAT', 'FRAMEBUFFER', 'READ_FRAMEBUFFER', 'DRAW_FRAMEBUFFER', 'RENDERBUFFER', 'TEXTURE0', 'TEXTURE_2D',
  'TEXTURE_MIN_FILTER', 'TEXTURE_MAG_FILTER', 'TEXTURE_WRAP_S', 'TEXTURE_WRAP_T', 'NEAREST', 'CLAMP_TO_EDGE', 'RGBA8',
  'DEPTH_COMPONENT24', 'COLOR_ATTACHMENT0', 'DEPTH_ATTACHMENT', 'FRAMEBUFFER_COMPLETE', 'BLEND', 'SCISSOR_TEST', 'STENCIL_TEST',
  'POLYGON_OFFSET_FILL', 'RASTERIZER_DISCARD', 'DITHER', 'SAMPLE_COVERAGE', 'SAMPLE_ALPHA_TO_COVERAGE', 'CULL_FACE', 'BACK', 'CCW',
  'DEPTH_TEST', 'LESS', 'LEQUAL', 'COLOR_BUFFER_BIT', 'DEPTH_BUFFER_BIT', 'TRIANGLES', 'LINES', 'UNSIGNED_SHORT', 'UNSIGNED_INT',
  'PIXEL_PACK_BUFFER', 'PACK_ALIGNMENT', 'PACK_ROW_LENGTH', 'PACK_SKIP_ROWS', 'PACK_SKIP_PIXELS', 'RGBA', 'UNSIGNED_BYTE',
  'CURRENT_PROGRAM', 'VERTEX_ARRAY_BINDING', 'READ_FRAMEBUFFER_BINDING', 'DRAW_FRAMEBUFFER_BINDING', 'TEXTURE_BINDING_2D', 'RENDERBUFFER_BINDING'];
function mockGL(canvas) {
  let serial = 0;
  const gl = { NO_ERROR: 0, events: [], handles: [], failures: [], enabled: new Set(), vao: null, arrayBuffer: null,
    read: null, draw: null, texture: null, renderbuffer: null, program: null, lost: false, depthWrite: true, line: 1, offset: [0, 0], color: [], world: [],
    maxima: {},
    failNext(operation, predicate = () => true, mode = 'throw') { this.failures.push({ operation, predicate, mode }); },
    trip(operation, args = []) { const index = this.failures.findIndex(f => f.operation === operation && f.predicate(args, this));
      if (index < 0) return false; const [failure] = this.failures.splice(index, 1); this.events.push(['fault', operation]);
      if (failure.mode === 'null') return true; throw new Error('mock ' + operation + ' failure'); },
    live(kind) { return this.handles.filter(handle => !handle.deleted && (!kind || handle.kind === kind)); },
    allocate(kind) { if (this.trip('create' + kind)) return null; const handle = { kind, id: ++serial, deleted: false, attempts: 0 };
      this.handles.push(handle); this.events.push(['allocate', kind, handle.id]);
      this.maxima[kind] = Math.max(this.maxima[kind] ?? 0, this.live(kind).length); return handle; },
    remove(handle) { if (!handle) return; handle.attempts++; this.events.push(['delete', handle.kind, handle.id]);
      this.trip('delete' + handle.kind); assert.equal(handle.deleted, false, 'no double deletion'); handle.deleted = true; },
    isContextLost() { return this.lost; }, getError() { this.trip('getError'); return 0; },
    getContextAttributes() { return { alpha: false, antialias: false, depth: true, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: true }; },
    get drawingBufferWidth() { return canvas.width; }, get drawingBufferHeight() { return canvas.height; },
    getShaderParameter() { return true; }, getShaderInfoLog() { return ''; },
    getProgramParameter() { return true; }, getProgramInfoLog() { return ''; }, getUniformLocation(_program, name) { return { name }; },
    checkFramebufferStatus() { return this.FRAMEBUFFER_COMPLETE; },
    bindVertexArray(vao) { this.vao = vao; this.events.push(['vao', vao?.id ?? null]); },
    bindBuffer(target, buffer) { if (target === this.ARRAY_BUFFER) this.arrayBuffer = buffer;
      else if (target === this.ELEMENT_ARRAY_BUFFER) { assert.ok(this.vao, 'index writes require a bound owned VAO'); this.vao.index = buffer; } },
    bufferData(target, data) { const buffer = target === this.ARRAY_BUFFER ? this.arrayBuffer : this.vao.index;
      buffer.data = Array.from(data); buffer.type = data.constructor.name; this.trip('bufferData', [target, buffer]); },
    vertexAttribPointer(location) { this.vao.attributes ??= {}; this.vao.attributes[location] = this.arrayBuffer; },
    bindFramebuffer(target, framebuffer) { if (target === this.FRAMEBUFFER || target === this.READ_FRAMEBUFFER) this.read = framebuffer;
      if (target === this.FRAMEBUFFER || target === this.DRAW_FRAMEBUFFER) this.draw = framebuffer; },
    bindTexture(_target, texture) { this.texture = texture; }, bindRenderbuffer(_target, renderbuffer) { this.renderbuffer = renderbuffer; },
    enable(cap) { this.enabled.add(cap); }, disable(cap) { this.enabled.delete(cap); },
    depthFunc(value) { this.depth = value; }, depthMask(value) { this.depthWrite = value; }, lineWidth(value) { this.line = value; },
    polygonOffset(factor, units) { this.offset = [factor, units]; }, useProgram(program) { this.program = program; },
    uniformMatrix4fv(uniform, _transpose, data) { if (uniform.name === 'world') this.world = Array.from(data); },
    uniform3fv(_uniform, color) { this.color = Array.from(color); },
    clear() { this.draw.draws = []; },
    drawElements(mode, count, type) { this.trip('drawElements', [mode]); assert.ok(this.vao?.index && this.vao?.attributes[0]);
      const record = { mode, count, type, indices: [...this.vao.index.data], position: this.vao.attributes[0].id,
        ebo: this.vao.index.id, vao: this.vao.id, framebuffer: this.draw.id, program: this.program.id,
        color: [...this.color], world: [...this.world], depth: this.depth, depthWrite: this.depthWrite,
        biased: this.enabled.has(this.POLYGON_OFFSET_FILL), offset: [...this.offset], line: this.line };
      this.draw.draws.push(record); this.events.push(['draw', record]); },
    blitFramebuffer() { canvas.presentation = clone(this.read.draws); this.trip('blitFramebuffer'); this.events.push(['present', this.read.id]); },
    readPixels(_x, _y, _w, _h, _format, _type, output) { this.trip('readPixels'); const draws = this.read ? this.read.draws : canvas.presentation;
      output.fill((draws?.length ?? 0) & 255); },
    getParameter(name) { const values = new Map([[this.CURRENT_PROGRAM, this.program], [this.VERTEX_ARRAY_BINDING, this.vao],
      [this.READ_FRAMEBUFFER_BINDING, this.read], [this.DRAW_FRAMEBUFFER_BINDING, this.draw], [this.TEXTURE_BINDING_2D, this.texture],
      [this.RENDERBUFFER_BINDING, this.renderbuffer]]); return values.get(name) ?? null; },
  };
  constants.forEach((name, i) => { gl[name] = i + 1; }); gl.depth = gl.LESS;
  for (const kind of ['Shader', 'Program', 'VertexArray', 'Buffer', 'Framebuffer', 'Texture', 'Renderbuffer']) {
    gl['create' + kind] = () => gl.allocate(kind); gl['delete' + kind] = handle => gl.remove(handle);
  }
  for (const name of ['shaderSource', 'compileShader', 'attachShader', 'linkProgram', 'detachShader', 'enableVertexAttribArray',
    'activeTexture', 'texParameteri', 'texStorage2D', 'renderbufferStorage', 'framebufferTexture2D', 'framebufferRenderbuffer',
    'drawBuffers', 'readBuffer', 'viewport', 'cullFace', 'frontFace', 'depthRange', 'colorMask', 'clearColor', 'clearDepth', 'pixelStorei']) gl[name] = () => {};
  return gl;
}
class MockCanvas {
  constructor() { this._width = 4; this._height = 4; this.listeners = new Map(); this.presentation = []; this.contextCalls = 0; this.gl = mockGL(this); }
  get width() { return this._width; } set width(value) { this._width = value; this.presentation = []; }
  get height() { return this._height; } set height(value) { this._height = value; this.presentation = []; }
  getContext(kind) { assert.equal(kind, 'webgl2'); this.contextCalls++; return this.gl; }
  addEventListener(name, listener) { this.listeners.set(name, listener); } removeEventListener(name) { this.listeners.delete(name); }
  lose() { this.gl.lost = true; this.listeners.get('webglcontextlost')?.({ preventDefault() {} }); }
}
const originalCanvas = globalThis.HTMLCanvasElement; globalThis.HTMLCanvasElement = MockCanvas;
after(() => { if (originalCanvas === undefined) delete globalThis.HTMLCanvasElement; else globalThis.HTMLCanvasElement = originalCanvas; });
function mounted(source = scene(), overlay = edges(source)) {
  const canvas = new MockCanvas(), renderer = mountEngineScene(canvas, source, { width: 8, height: 8 }, overlay);
  return { canvas, gl: canvas.gl, renderer };
}
function cleanState(gl) {
  assert.equal(gl.depth, gl.LESS); assert.equal(gl.depthWrite, true); assert.equal(gl.line, 1);
  assert.equal(gl.enabled.has(gl.POLYGON_OFFSET_FILL), false); assert.deepEqual(gl.offset, [0, 0]); assert.equal(gl.vao, null);
}
function disposed(renderer, gl) { renderer.dispose(); renderer.dispose(); assert.equal(gl.live().length, 0); assert.ok(gl.handles.every(handle => handle.attempts === 1)); }

test('renderer01 absent/empty overlay keeps legacy triangle commands and resource counts', () => {
  for (const overlay of [null, { ...edges(), owners: [] }]) {
    const { canvas, gl, renderer } = mounted(scene(), overlay);
    assert.deepEqual(canvas.presentation.map(draw => draw.mode), [gl.TRIANGLES]); assert.equal(canvas.presentation[0].biased, false);
    assert.equal(gl.live('Buffer').length, 4); assert.equal(gl.live('VertexArray').length, 1);
    assert.equal(gl.live('Program').length, 1); assert.equal(gl.live('Framebuffer').length, 1);
    cleanState(gl); disposed(renderer, gl);
  }
});
test('renderer02 all fills precede depth-tested one-pixel lines and state is restored', () => {
  const source = scene(3), overlay = edges(source); overlay.owners = overlay.owners.slice(0, 2); overlay.owners[1].indices = [];
  const { canvas, gl, renderer } = mounted(source, overlay), draws = canvas.presentation;
  assert.deepEqual(draws.map(draw => draw.mode), [gl.TRIANGLES, gl.TRIANGLES, gl.TRIANGLES, gl.LINES]);
  assert.deepEqual(draws.slice(0, 3).map(draw => draw.biased), [true, true, false]);
  assert.deepEqual(draws[0].offset, [1, 1]); assert.deepEqual(draws[1].offset, [1, 1]);
  const line = draws[3]; assert.equal(line.depth, gl.LEQUAL); assert.equal(line.depthWrite, false); assert.equal(line.line, 1); assert.equal(line.biased, false);
  assert.equal(new Set(draws.map(draw => draw.framebuffer)).size, 1); assert.equal(new Set(draws.map(draw => draw.program)).size, 1);
  assert.equal(gl.live('Buffer').length, 5); assert.equal(gl.live('VertexArray').length, 2);
  cleanState(gl); disposed(renderer, gl);
});
test('renderer03 multiple owners share positions, independently choose indices and preserve triangle EBOs', () => {
  const source = scene(3, 65537), overlay = edges(source); overlay.owners[1].indices = [0, 65536]; overlay.owners[2].indices = [];
  const { canvas, gl, renderer } = mounted(source, overlay), draws = canvas.presentation;
  assert.equal(new Set(draws.map(draw => draw.position)).size, 1); assert.equal(gl.live('Buffer').length, 6);
  assert.deepEqual(draws.map(draw => draw.type), [gl.UNSIGNED_SHORT, gl.UNSIGNED_SHORT, gl.UNSIGNED_SHORT, gl.UNSIGNED_SHORT, gl.UNSIGNED_INT]);
  assert.equal(new Set(draws.slice(0, 3).map(draw => draw.ebo)).size, 1);
  assert.deepEqual(draws[0].indices, [0, 1, 2]); assert.deepEqual(draws[4].indices, [0, 65536]);
  const triangleVAO = gl.live('VertexArray').find(vao => vao.id === draws[0].vao); assert.deepEqual(triangleVAO.index.data, [0, 1, 2]);
  const hidden = scene(); hidden.nodes[0].visible = false; assert.equal(renderer.update(hidden, edges(hidden)).ok, true);
  assert.deepEqual(canvas.presentation, []); assert.equal(gl.live('Buffer').length, 0); assert.equal(gl.live('VertexArray').length, 0);
  disposed(renderer, gl);
});
test('renderer04 successful replacement/omitted/null clear and nonfatal post-swap cleanup', () => {
  const { canvas, gl, renderer } = mounted(), next = scene(); next.id = 'replacement';
  const overlay = edges(next, [1, 2]); assert.equal(renderer.update(next, overlay).ok, true);
  assert.equal(renderer.getScene().id, 'replacement'); assert.deepEqual(canvas.presentation.at(-1).indices, [1, 2]);
  assert.equal(renderer.update(next).ok, true); assert.deepEqual(canvas.presentation.map(draw => draw.mode), [gl.TRIANGLES]);
  assert.equal(renderer.update(next, overlay).ok, true); assert.equal(renderer.update(next, null).ok, true); assert.equal(gl.live('Buffer').length, 4);
  gl.failNext('deleteBuffer'); next.id = 'cleanup_committed';
  assert.equal(renderer.update(next, edges(next)).ok, true); assert.equal(renderer.getScene().id, 'cleanup_committed');
  assert.equal(canvas.presentation.at(-1).mode, gl.LINES); assert.equal(gl.live('Buffer').length, 6, 'one mock driver deletion refusal is not a confirmed release');
  renderer.dispose(); renderer.dispose(); assert.equal(gl.live().length, 1); assert.ok(gl.handles.every(handle => handle.attempts === 1));
});
test('renderer05 malformed scene/sidecar updates and mount refuse before GPU effects', () => {
  const { canvas, gl, renderer } = mounted(), before = clone(canvas.presentation), count = gl.events.length;
  const bad = edges(); bad.owners[0].indices = [0, 99]; assert.equal(renderer.update(scene(), bad).ok, false);
  assert.equal(gl.events.length, count); assert.deepEqual(canvas.presentation, before);
  const badScene = scene(); badScene.nodes[0].geometryId = 'absent'; assert.equal(renderer.update(badScene, edges()).ok, false);
  assert.equal(gl.events.length, count); assert.equal(renderer.getScene().id, 'scene');
  const rejected = new MockCanvas(); assert.throws(() => new EngineSceneRenderer(rejected, scene(), { width: 8, height: 8 }, bad));
  assert.equal(rejected.contextCalls, 0); disposed(renderer, gl);
});
test('renderer06 edge VAO/index allocation and upload failures release candidate exactly once', () => {
  for (const operation of ['createVertexArray', 'createBuffer', 'bufferData']) {
    const { canvas, gl, renderer } = mounted(), before = clone(canvas.presentation), handles = gl.live().length;
    if (operation === 'createVertexArray') gl.failNext('createVertexArray', (_args, gl) => gl.live('VertexArray').length === 3, 'null');
    else if (operation === 'createBuffer') gl.failNext('createBuffer', (_args, gl) => gl.live('Buffer').length === 9, 'null');
    else gl.failNext('bufferData', ([target, buffer], gl) => target === gl.ELEMENT_ARRAY_BUFFER && buffer.data.length === 2);
    const result = renderer.update(scene(), edges()); assert.equal(result.ok, false); assert.deepEqual(canvas.presentation, before);
    assert.equal(gl.live().length, handles); assert.ok(gl.handles.every(handle => handle.attempts <= 1)); cleanState(gl); disposed(renderer, gl);
  }
});
test('renderer07 candidate fill/line/readback/present failures rollback the accepted pair', () => {
  for (const operation of ['fill', 'line', 'readPixels', 'blitFramebuffer']) {
    const { canvas, gl, renderer } = mounted(), before = clone(canvas.presentation), handles = gl.live().length;
    if (operation === 'fill' || operation === 'line') gl.failNext('drawElements', ([mode]) => mode === gl[operation === 'fill' ? 'TRIANGLES' : 'LINES']);
    else gl.failNext(operation);
    const next = scene(); next.id = 'candidate';
    assert.equal(renderer.update(next, edges(next, [1, 2])).ok, false); assert.equal(renderer.getScene().id, 'scene');
    assert.deepEqual(canvas.presentation, before); assert.equal(gl.live().length, handles); cleanState(gl); disposed(renderer, gl);
  }
  const { renderer, gl } = mounted(); gl.failNext('blitFramebuffer'); gl.failNext('blitFramebuffer');
  const result = renderer.update(scene(), edges()); assert.equal(result.ok, false); assert.ok(result.error instanceof AggregateError);
  assert.throws(() => renderer.render(), /unavailable/); assert.equal(renderer.getScene().id, 'scene'); disposed(renderer, gl);
});
test('renderer08 resize retains matching immutable edges and restores prior size/presentation on failure', () => {
  const source = scene(), overlay = edges(source), { canvas, gl, renderer } = mounted(source, overlay);
  overlay.owners[0].indices = [1, 2]; source.id = 'mutated'; renderer.resize(12, 10);
  assert.equal(canvas.width, 12); assert.equal(canvas.height, 10); assert.equal(renderer.getScene().id, 'scene');
  assert.deepEqual(canvas.presentation.at(-1).indices, [0, 1]); const before = clone(canvas.presentation), handles = gl.live().length;
  gl.failNext('blitFramebuffer'); assert.throws(() => renderer.resize(16, 14), /failure/);
  assert.equal(canvas.width, 12); assert.equal(canvas.height, 10); assert.deepEqual(canvas.presentation, before); assert.equal(gl.live().length, handles);
  gl.failNext('createVertexArray', (_args, gl) => gl.live('VertexArray').length === 3, 'null');
  assert.throws(() => renderer.resize(18, 16), /edge vertex array/); assert.deepEqual(canvas.presentation, before);
  assert.throws(() => renderer.resize(0, 10)); cleanState(gl); disposed(renderer, gl);
});
test('renderer09 terminal context loss, exclusive canvas, failed mount and idempotent disposal accounting', () => {
  const { canvas, gl, renderer } = mounted(); assert.throws(() => mountEngineScene(canvas, scene(), { width: 8, height: 8 }), /claimed/);
  canvas.lose(); assert.equal(renderer.update(scene(), edges()).ok, false); assert.throws(() => renderer.render(), /lost/);
  assert.throws(() => renderer.resize(10, 10), /lost/); assert.equal(renderer.getScene().id, 'scene'); disposed(renderer, gl);
  assert.equal(canvas.listeners.size, 0); assert.throws(() => renderer.getScene(), /disposed/);
  const failed = new MockCanvas(); failed.gl.failNext('createVertexArray', (_args, gl) => gl.live('VertexArray').length === 1, 'null');
  assert.throws(() => mountEngineScene(failed, scene(), { width: 8, height: 8 }, edges()), /edge vertex array/);
  assert.equal(failed.gl.live().length, 0); assert.equal(failed.listeners.size, 0); assert.equal(failed.width, 4);
  const retry = mountEngineScene(failed, scene(), { width: 8, height: 8 }, edges()); disposed(retry, failed.gl);
});
test('renderer10 repeated bounded replacement and caller mutation preserve accepted edge snapshots', () => {
  const source = scene(16, 34), overlay = edges(source, []), pairs = Array.from({ length: 16 }, (_, i) => [0, i + 1]).flat();
  overlay.owners.forEach(owner => { owner.indices = [...pairs]; });
  const { canvas, gl, renderer } = mounted(source, overlay); assert.equal(gl.live('VertexArray').length, 17); assert.equal(gl.live('Buffer').length, 20);
  overlay.owners[0].indices[1] = 2; overlay.color[0] = 1; source.geometries[0].positions[3] = .5;
  renderer.resize(9, 9); assert.deepEqual(canvas.presentation[16].indices, pairs); assert.equal(canvas.presentation[16].color[0], .02);
  for (let i = 0; i < 4; i++) { const next = scene(16, 34), input = edges(next, pairs); next.id = 'repeat' + i; input.sceneId = next.id;
    assert.equal(renderer.update(next, input).ok, true); assert.equal(gl.live('VertexArray').length, 17); assert.equal(gl.live('Buffer').length, 20); }
  assert.equal(gl.maxima.VertexArray, 34); assert.equal(gl.maxima.Buffer, 40); assert.equal(gl.maxima.Program, 2);
  assert.equal(gl.maxima.Framebuffer, 2); assert.equal(gl.maxima.Texture, 2); assert.equal(gl.maxima.Renderbuffer, 2);
  assert.equal(canvas.presentation.filter(draw => draw.mode === gl.LINES).reduce((sum, draw) => sum + draw.count / 2, 0), 256);
  cleanState(gl); disposed(renderer, gl);
});
