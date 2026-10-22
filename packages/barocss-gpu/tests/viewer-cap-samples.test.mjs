// Bounded source contracts. No GPU/browser/server or package build.
// node --test --test-concurrency=1 packages/barocss-gpu/tests/viewer-cap-samples.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const temp = await mkdtemp(join(tmpdir(), 'viewer-cap-samples-'));
let Viewer, surfaceWGSL, pickWGSL, capProbeSamplesWGSL;
try {
  const outfile = join(temp, 'source.mjs');
  await build({ stdin: { contents: "export {Viewer} from './viewer.ts'; export {surfaceWGSL,pickWGSL,capProbeSamplesWGSL} from './shaders.ts';", resolveDir: fileURLToPath(new URL('../src/viewer/', import.meta.url)), loader: 'ts' }, outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  ({ Viewer, surfaceWGSL, pickWGSL, capProbeSamplesWGSL } = await import(pathToFileURL(outfile).href));
} finally { await rm(temp, { recursive: true, force: true }); }

const owner = () => Object.assign(Object.create(Viewer.prototype), { requestRender() {} });
for (const antialias of [true, false]) test(`AA ${antialias}: scene cap pipeline/probe sample counts match; pick/mask/light keep single-sample pipelines`, async () => {
  const descriptions = new Map(), device = {
    createShaderModule: desc => ({ ...desc, getCompilationInfo: async () => ({ messages: [] }) }),
    createBindGroupLayout: desc => desc, createPipelineLayout: desc => desc,
    createRenderPipelineAsync: async desc => { descriptions.set(desc.label, desc); return desc; },
    pushErrorScope() {}, popErrorScope: async () => null,
  };
  const viewer = Object.assign(owner(), { device, options: { antialias }, format: 'bgra8unorm', pipelines: new Map() });
  await viewer.createPipelines();
  for (const key of ['litCap', 'depthCap', 'oitCap']) {
    const p = descriptions.get('viewer ' + key);
    assert.equal(p.multisample.count, antialias ? 4 : 1);
    assert.equal(/@builtin\(sample_index\)/.test(p.fragment.module.code), antialias);
    assert.equal(p.layout.bindGroupLayouts[0].entries.find(e => e.binding === 6).texture.multisampled, true);
  }
  assert.equal(descriptions.has('viewer capFrontSamples'), antialias);
  if (antialias) {
    const p = descriptions.get('viewer capFrontSamples');
    assert.equal(p.fragment.targets[0].format, 'rgba16float', 'rg32float is not used for MSAA');
    assert.equal(p.multisample.count, 4);
    assert.match(p.fragment.module.code, /@location\(1\) @interpolate\(perspective, sample\) world/);
  }
  for (const key of ['capFront', 'capPick', 'capMask', 'shadowProbe', 'shadowCap']) {
    const p = descriptions.get('viewer ' + key);
    assert.equal(p.multisample, undefined);
    assert.equal(/@builtin\(sample_index\)/.test(p.fragment.module.code), false);
  }
  assert.equal(descriptions.get('viewer capFront').fragment.targets[0].format, 'rg32float');
  assert.equal(descriptions.get('viewer shadowProbe').fragment.targets[0].format, 'rg32float');
});

test('sampled scene shaders preserve the exact depth threshold and interpolate the same world point in probe/cap', () => {
  const scene = surfaceWGSL(undefined, true);
  assert.match(scene, /@location\(0\) @interpolate\(perspective, sample\) world/);
  assert.match(scene, /capFirstSample\(in\.clip, in\.world, sample\)/);
  assert.match(scene, /textureLoad\(capFrontSamples, vec2i\(pos\.xy\), i32\(sample\)\)/);
  assert.match(scene, /abs\(z - capSampleDepth\(world\)\) <= 1e-6/);
  assert.match(capProbeSamplesWGSL, /let z = capSampleDepth\(in\.world\)/);
  assert.match(capProbeSamplesWGSL, /o\.v = capProbeBits\(z, !front\)/);
  assert.match(pickWGSL, /o\.v = vec2f\(z, select\(1\.0, 0\.0, front\)\)/);
  assert.match(surfaceWGSL(), /if \(!capFirst\(in\.clip\)\)/);
});

test('11/11/10-bit half-float lanes retain every tested float32 depth bit, unlike direct half-float depth', () => {
  const f = new Float32Array(1), u = new Uint32Array(f.buffer);
  // Independent binary16 spacing, including subnormals. The encoded lanes are nonnegative integers.
  const half = x => x === 0 ? 0 : Math.round(x / 2 ** Math.max(-24, Math.floor(Math.log2(x)) - 10)) * 2 ** Math.max(-24, Math.floor(Math.log2(x)) - 10);
  for (let lane = 0; lane <= 2047; lane++) assert.equal(half(lane), lane);
  let seed = 0x3f123456;
  for (const depth of [0, 1, 0.5, 1e-12, 0.003900123, ...Array.from({ length: 4096 }, () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0xffffffff; })]) {
    f[0] = depth; const bits = u[0], lanes = [bits & 2047, (bits >>> 11) & 2047, bits >>> 22].map(half);
    const decoded = (lanes[0] | (lanes[1] << 11) | (lanes[2] << 22)) >>> 0;
    assert.equal(decoded, bits);
  }
  assert.ok(Math.abs(half(0.503123) - Math.fround(0.503123)) > 1e-6, 'direct rgba16float depth would not preserve capFirst tolerance');
});

for (const withSamples of [true, false]) test(`AA ${withSamples}: cap samples are lazy, use the supported format, and release on resize`, () => {
  const textures = [], device = {
    createTexture(desc) { const texture = { ...desc, destroyed: false, destroy() { this.destroyed = true; }, createView() { return { texture: this }; } }; textures.push(texture); return texture; },
    createBindGroup: desc => desc,
  };
  const viewer = Object.assign(owner(), { device, options: { antialias: withSamples }, canvas: { width: 640, height: 480 }, targets: null, pipelines: new Map([['output', { getBindGroupLayout: () => ({}) }]]), bindFrames() {} });
  const first = viewer.ensureTargets();
  assert.equal(first.capFrontSamples, null, 'unsectioned frames do not allocate a full-size MSAA cap probe');
  viewer.ensureCapSamples(first);
  assert.equal(first.capFrontSamples?.format ?? null, withSamples ? 'rgba16float' : null);
  assert.equal(first.capFrontSamples?.sampleCount ?? null, withSamples ? 4 : null);
  assert.equal(first.depth.sampleCount, withSamples ? 4 : 1);
  assert.equal(first.capFront.format, 'rg32float');
  assert.equal(first.capFront.sampleCount, undefined, 'single-sample ID/mask probe stays separate');
  assert.equal(viewer.ensureTargets(), first, 'unchanged size reuses the target');
  viewer.canvas.width = 1280; viewer.ensureTargets();
  assert.equal(first.capFront.destroyed, true);
  if (withSamples) assert.equal(first.capFrontSamples.destroyed, true);
});

for (const kind of ['scene-msaa', 'pick', 'scene-aa-off']) test(`${kind}: probe attachments and frame bindings never alias a sampled scene probe`, () => {
  const views = { capFront: 'single-probe', capFrontSamples: kind === 'scene-aa-off' ? null : 'sample-probe', maskDepth: 'single-depth', depth: 'sample-depth' }, passes = [];
  const enc = { beginRenderPass(desc) { const row = { desc, binds: [], pipeline: null, scissor: null }; passes.push(row); return { setBindGroup(...args) { row.binds.push(args); }, setPipeline(p) { row.pipeline = p; }, setScissorRect(...p) { row.scissor = p; }, end() {} }; } };
  const viewer = Object.assign(owner(), { clip: {}, frameGroupBare: 'no-probe-sampled', objectGroup: {}, pipelines: new Map([['capFront', 'single'], ['capFrontSamples', 'samples']]), ensureTargets: () => ({ views }), ensureCapSamples() { assert.notEqual(kind, 'pick', 'single-pixel picks must not request scene samples'); }, capped: () => true, probed: () => true, upload: () => true, drawTriangles() {} });
  viewer.drawCapFront(enc, [{ geometry: {} }], [], kind === 'pick' ? [3, 4] : null);
  assert.equal(passes.length, kind === 'scene-msaa' ? 2 : 1);
  assert.equal(passes[0].desc.colorAttachments[0].view, 'single-probe');
  assert.equal(passes[0].desc.depthStencilAttachment.view, 'single-depth');
  if (kind === 'pick') assert.deepEqual(passes[0].scissor, [3, 4, 1, 1]);
  if (kind === 'scene-msaa') {
    assert.equal(passes[1].desc.colorAttachments[0].view, 'sample-probe');
    assert.equal(passes[1].desc.depthStencilAttachment.view, 'sample-depth');
  }
  for (const p of passes) assert.equal(p.binds[0][1], 'no-probe-sampled');
});
