// Focused source regression; no package build, browser or GPU.
// node --test --test-concurrency=1 packages/barocss-gpu/tests/viewer-display.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const temp = await mkdtemp(join(tmpdir(), 'viewer-display-'));
let Viewer, Mesh, Geometry, Camera, prepareGeometry, prepareScalars, identity;
try {
  const outfile = join(temp, 'source.mjs');
  await build({ stdin: { contents: "export {Viewer,Mesh,Geometry} from './viewer.ts'; export {Camera} from './camera.ts'; export {prepareGeometry,prepareScalars} from './geometry.ts'; export {identity} from './math.ts';", resolveDir: fileURLToPath(new URL('../src/viewer/', import.meta.url)), loader: 'ts' }, outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  ({ Viewer, Mesh, Geometry, Camera, prepareGeometry, prepareScalars, identity } = await import(pathToFileURL(outfile).href));
} finally { await rm(temp, { recursive: true, force: true }); }
const owner = () => Object.assign(Object.create(Viewer.prototype), { camera: new Camera(), alive() {}, requestRender() {}, sceneMoved() {} });
const line = material => new Mesh(new Geometry(prepareGeometry({ positions: [-1, 0, 0, 1, 0, 0], topology: 'lines', edges: [41] }), owner()), owner(), 1, { material });

for (const dpr of [1, 2]) test(`hidden dash has its own CSS-pixel packing at DPR ${dpr}; omitted style follows visible dash`, () => {
  const mesh = line({ lineDash: null, lineHidden: 0.55, lineHiddenDash: [6, 4] });
  const f = new Float32Array(64); mesh.pack(f, 0, dpr);
  assert.deepEqual([...f.slice(37, 39)], [0, 0]);
  assert.deepEqual([...f.slice(48, 50)], [6 * dpr, 4 * dpr]);
  const legacy = line({ lineDash: [3, 2], lineHidden: 0.5 });
  legacy.pack(f, 0, dpr);
  assert.deepEqual([...f.slice(48, 50)], [3 * dpr, 2 * dpr]);
  legacy.material = { lineDash: [5, 1] }; legacy.pack(f, 0, dpr);
  assert.deepEqual([...f.slice(48, 50)], [5 * dpr, dpr]);
  legacy.material = { lineHiddenDash: null }; legacy.pack(f, 0, dpr);
  assert.deepEqual([...f.slice(48, 50)], [0, 0]);
});

test('G15a: a surface finish, clear coat and oil film packed after the hatch; none, or on lines, zeros', () => {
  const tri = material => new Mesh(new Geometry(prepareGeometry({ positions: [0, 0, 0, 1, 0, 0, 0, 1, 0] }), owner()), owner(), 2, { material });
  const f = new Float32Array(64);
  const m = tri({ finish: { kind: 'turned', scale: 0.4, strength: 2, axis: [0, 0, 3], origin: [1, 2, 3] }, clearcoat: 0.5, film: 0.25 });
  m.pack(f, 0, 1);
  assert.deepEqual([...f.slice(52, 64)], [4, Math.fround(0.4), 1, 0.5, 0, 0, 1, Math.fround(0.08), 1, 2, 3, 0.25]);
  m.material = { finish: { kind: 'brushed' } }; m.pack(f, 0, 1);
  assert.deepEqual([...f.slice(52, 60)], [5, 1, 0.5, 0.5, 0, 0, 1, Math.fround(0.08)], 'defaults: scale 1, strength 0.5, Z');
  m.material = { finish: { kind: 'lacquer' }, clearcoat: 0, film: 0 }; m.pack(f, 0, 1);
  assert.deepEqual([...f.slice(52, 64)], new Array(12).fill(0), 'an unknown kind and no coat: nothing');
  m.material = { finish: null, clearcoat: 1 }; m.pack(f, 0, 1);
  assert.equal(f[52], 0); assert.equal(f[55], 1);
  const l = line({ finish: { kind: 'cast' } }); l.pack(f, 0, 1);
  assert.deepEqual([...f.slice(52, 64)], new Array(12).fill(0), 'lines: no finish');
});

test('depth-only surface and cap pipelines retain depth with colour writes disabled; pick pipelines stay unchanged', async () => {
  const descriptions = new Map();
  const device = {
    createShaderModule: desc => ({ ...desc, getCompilationInfo: async () => ({ messages: [] }) }),
    createBindGroupLayout: desc => desc, createPipelineLayout: desc => desc,
    createRenderPipelineAsync: async desc => { descriptions.set(desc.label, desc); return desc; },
    pushErrorScope() {}, popErrorScope: async () => null,
  };
  const viewer = Object.assign(owner(), { device, options: { antialias: false }, format: 'bgra8unorm', pipelines: new Map() });
  await viewer.createPipelines();
  for (const key of ['depthOnly', 'depthOnly2', 'depthCap']) {
    const p = descriptions.get(`viewer ${key}`);
    assert.equal(p.fragment.targets[0].writeMask, 0);
    assert.equal(p.depthStencil.depthWriteEnabled, true);
    assert.equal(p.depthStencil.depthCompare, 'greater-equal');
    assert.equal(p.layout.bindGroupLayouts.length, 3, 'surface draws bind the material group');
  }
  for (const key of ['lit', 'litCap', 'pick', 'capPick']) assert.equal(descriptions.get(`viewer ${key}`).fragment.targets[0].writeMask, undefined);
  const g = new Geometry(prepareGeometry({ positions: [0, 0, 0, 1, 0, 0, 0, 1, 0] }), viewer);
  const mesh = new Mesh(g, viewer, 9, { material: { opacity: 0.35, colorWrite: false } });
  assert.equal(mesh.transparent, false, 'line-only colour suppression retains an occluding depth pass');
  assert.equal(viewer.pipelineKey(mesh, false), 'depthOnly');
  assert.equal(viewer.pipelineKey(mesh, true), 'pick');
  mesh.material = { colorWrite: true }; assert.equal(mesh.transparent, true);
  assert.equal(viewer.pipelineKey(mesh, false), 'litT');
});

test('wireframe all-depth lines can explicitly retain ordinary depth-aware edge picking', () => {
  const viewer = Object.assign(owner(), { canvas: { width: 100, height: 100, clientWidth: 100, clientHeight: 100 }, camera: new Camera({ position: [0, 0, 5], target: [0, 0, 0], up: [0, 1, 0] }), clip: null, accelerate: false, clipCamera() {}, hidden: () => true });
  const mesh = line({ lineOver: true }); viewer.meshes = [mesh];
  assert.equal(viewer.pickLine(50, 50)?.edge, 41, 'legacy overlaid line behavior');
  assert.equal(viewer.pickLine(50, 50, 6, { throughSurfaces: false })?.edge, 41, 'legacy false does not change overlay semantics');
  assert.equal(viewer.pickLine(50, 50, 6, { throughSurfaces: false, respectSurfaceDepth: true }), null, 'modelling wireframe must not select occluded native edges');
  assert.equal(viewer.pickLine(50, 50, 6, { throughSurfaces: true })?.edge, 41);
});

const cube = () => {
  const positions = [], indices = [];
  for (const [axis, sign] of [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]]) {
    const u = (axis + 1) % 3, v = (axis + 2) % 3, base = positions.length / 3;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const p = [0, 0, 0]; p[axis] = sign; p[u] = a; p[v] = b * sign; positions.push(...p); }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const data = prepareGeometry({ positions, indices, faces: Array.from({ length: 12 }, (_, i) => 100 + i) });
  data.scalars = prepareScalars(data, Array(data.vertexCount).fill(7), 'vertex');
  return data;
};
for (const mode of ['shaded-with-edges', 'hidden-lines-removed', 'hidden-lines-dashed', 'wireframe', 'x-ray']) {
  for (const cap of [false, true]) for (const instanced of [false, true]) test(`${mode} preserves G20 quarter ${cap ? 'cap' : 'front'} ${instanced ? 'instance 1' : 'mesh'} metadata and restores default`, async () => {
    const origin = cap ? [-0.5, -2, 0] : [-6, 1.65, 0], direction = cap ? [0, 1, 0] : [1, -0.3, 0];
    const point = cap ? [-0.5, 0, 0] : [-1, 0.15, 0];
    const planes = [{ normal: [1, 0, 0], offset: 0 }, { normal: [0, 1, 0], offset: 0 }], clip = { ...planes[0], planes, cutout: true };
    const camera = new Camera({ position: origin, target: origin.map((x, i) => x + direction[i]), up: [0, 0, 1], projection: 'orthographic' });
    camera.clip({ min: [-20, -20, -20], max: [20, 20, 20] }); camera.ray = () => ({ origin, direction });
    const vp = camera.viewProjection(1), clipZ = p => { const c = [0, 1, 2, 3].map(r => vp[r] * p[0] + vp[4 + r] * p[1] + vp[8 + r] * p[2] + vp[12 + r]); return c[2] / c[3]; };
    const depth = Math.fround(clipZ(point));
    const viewer = Object.assign(owner(), { canvas: { width: 1, height: 1, clientWidth: 1, clientHeight: 1 }, camera, clip, orderIndependent: true, accelerate: false, clipCamera() {} });
    const mesh = new Mesh(new Geometry(cube(), viewer), viewer, 17, { material: { opacity: mode === 'x-ray' ? 0.25 : 1, colorWrite: !mode.startsWith('hidden-') && mode !== 'wireframe' }, cap: true, clipped: true });
    if (instanced) { const moved = identity(); moved[12] = 30; mesh.setInstances({ transforms: [...moved, ...identity()] }); }
    mesh.pickTransparent = false; viewer.meshes = [mesh];
    assert.deepEqual(viewer.raycast(0.5, 0.5)?.cap, cap, 'synchronous face/cap picking');
    const pass = { setScissorRect() {}, setBindGroup() {}, end() {} };
    const read = { async mapAsync() {}, unmap() {}, getMappedRange(offset) { return offset === 256 ? Float32Array.of(depth).buffer : Uint32Array.of(offset === 512 ? (instanced ? 1 : 0) : mesh.id).buffer; } };
    Object.assign(viewer, { device: { queue: { submit() {} }, createCommandEncoder: () => ({ beginRenderPass: () => pass, copyTextureToBuffer() {}, finish() {} }) }, prepareCamera: () => vp,
      visibleMeshes: () => ({ opaque: mesh.transparent ? [] : [mesh], transparent: mesh.transparent ? [mesh] : [] }), writeUniforms() {}, drawCapFront() {}, drawMesh() {}, drawCaps() {}, ensurePickTargets: () => ({ views: {}, read }) });
    const hit = await viewer.pickNow(0, 0);
    assert.equal(hit.mesh, mesh); assert.equal(hit.cap, cap); assert.equal(hit.depth, depth);
    assert.equal(hit.triangle, cap ? null : 2); assert.equal(hit.face, cap ? null : 102);
    assert.equal(hit.capPlane, cap ? 1 : undefined); assert.equal(hit.scalar, cap ? undefined : 7);
    assert.equal(hit.instance, instanced ? 1 : null);
    assert.equal(viewer.clip, clip); assert.deepEqual(mesh.transform, identity());
    // Negative controls: display-only fades never override hidden/nonpickable authority.
    mesh.pickable = false; assert.equal(viewer.raycast(0.5, 0.5), null);
    mesh.pickable = true; mesh.visible = false; assert.equal(viewer.raycast(0.5, 0.5), null); mesh.visible = true;
    if (mode === 'x-ray' && cap) {
      mesh.pickTransparent = null; assert.equal(viewer.capHit(origin, direction), null, 'without the original-opacity override the cap would be unpickable');
    }
    mesh.material = { opacity: 1, colorWrite: true }; mesh.pickTransparent = null;
    const restored = await viewer.pickNow(0, 0);
    for (const key of ['mesh', 'triangle', 'face', 'scalar', 'instance', 'cap', 'capPlane', 'depth']) assert.equal(restored[key], hit[key], `default restores ${key}`);
  });
}

test('x-ray cap pick pass draws the visually transparent mesh when its original picking opacity is opaque', () => {
  const viewer = Object.assign(owner(), { clip: {}, orderIndependent: true, pipelines: new Map([['capPick', 'pick-pipeline'], ['depthCap', 'depth-pipeline']]), objectGroup: {} });
  const mesh = new Mesh(new Geometry(prepareGeometry({ positions: [0, 0, 0, 1, 0, 0, 0, 1, 0] }), viewer), viewer, 3, { material: { opacity: 0.25 }, cap: true, clipped: true });
  mesh.pickTransparent = false;
  const drawn = []; viewer.drawTriangles = (_p, m) => drawn.push(m);
  const pass = { setPipeline() {}, setBindGroup() {} };
  assert.equal(viewer.drawCaps(pass, [mesh], {}, 'capPick'), 1);
  assert.equal(drawn[0], mesh);
  mesh.pickTransparent = true; assert.equal(viewer.drawCaps(pass, [mesh], {}, 'capPick'), 0);
});
