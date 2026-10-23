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
    assert.equal(p.fragment.targets[0].format, 'r16uint', 'G9: a triangle key a sample, 2 bytes');
    assert.equal(p.multisample.count, 4);
    assert.match(p.fragment.module.code, /@location\(1\) @interpolate\(perspective, sample\) world/);
    assert.match(p.fragment.module.code, /@location\(2\) @interpolate\(flat\) key: u32/);
    assert.equal(p.layout.bindGroupLayouts[0].entries.find(e => e.binding === 6).texture.sampleType, 'uint');
  }
  for (const key of ['capFront', 'capPick', 'capMask', 'shadowProbe', 'shadowCap']) {
    const p = descriptions.get('viewer ' + key);
    assert.equal(p.multisample, undefined);
    assert.equal(/@builtin\(sample_index\)/.test(p.fragment.module.code), false);
  }
  assert.equal(descriptions.get('viewer capFront').fragment.targets[0].format, 'rg32float');
  assert.equal(descriptions.get('viewer shadowProbe').fragment.targets[0].format, 'rg32float');
});

test('sampled scene shaders find the probe\'s triangle by its key at the sample, and interpolate the same world point in probe/cap', () => {
  const scene = surfaceWGSL(undefined, true);
  assert.match(scene, /@location\(0\) @interpolate\(perspective, sample\) world/);
  assert.match(scene, /@location\(5\) @interpolate\(flat\) key: u32/);
  assert.match(scene, /o\.key = probeKey\(vi, ii\)/);
  assert.match(scene, /capFirstSample\(in\.clip, in\.key, sample\)/);
  assert.match(scene, /textureLoad\(capFrontSamples, vec2i\(pos\.xy\), i32\(sample\)\)\.x == key/);
  assert.match(capProbeSamplesWGSL, /o\.key = probeKey\(vi, ii\)/);
  assert.match(capProbeSamplesWGSL, /let z = capSampleDepth\(in\.world\)/);
  assert.match(capProbeSamplesWGSL, /o\.v = select\(in\.key, 0u, front\)/);
  assert.match(pickWGSL, /o\.v = vec2f\(z, select\(1\.0, 0\.0, front\)\)/);
  assert.match(surfaceWGSL(), /if \(!capFirst\(in\.clip\)\)/);
});

// (G9: probeKey, as the WGSL computes it — u32 products wrap — for the slot key in object.pick.z's high half.)
const probeKey = (slot, vi, ii) => {
  let h = (Math.imul(slot, 0x9E3779B1) ^ Math.imul(vi, 0x85EBCA77) ^ Math.imul(ii, 0xC2B2AE3D)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2C1B3C6D) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297A2D39) >>> 0;
  const k = (h ^ (h >>> 15)) & 0xffff;
  return k === 0 ? 1 : k;
};
test('G9 the triangle key: 16 bits, never 0 (0 is no cap); two triangles share one about 1 time in 65 535', () => {
  assert.match(surfaceWGSL(undefined, true), /0x9E3779B1u[\s\S]*0x85EBCA77u[\s\S]*0xC2B2AE3Du[\s\S]*0x2C1B3C6Du[\s\S]*0x297A2D39u/);
  let seed = 7, same = 0, pairs = 0;
  const rand = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
  for (let k = 0; k < 200000; k++) {
    const a = [1 + rand(500), rand(100000), rand(4)], b = [1 + rand(500), rand(100000), rand(4)];
    const ka = probeKey(...a), kb = probeKey(...b);
    assert.ok(ka >= 1 && ka <= 0xffff);
    if (a.join() === b.join()) continue;
    pairs++; if (ka === kb) same++;
  }
  // (Neighbours too: the triangles beside one another in a mesh, its first vertices a few apart.)
  for (let vi = 0; vi < 60000; vi++) { pairs++; if (probeKey(3, vi, 0) === probeKey(3, vi + 1, 0)) same++; }
  assert.ok(same / pairs < 4 / 65535, `${same} of ${pairs} pairs share a key`);
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
  assert.equal(first.capFrontSamples?.format ?? null, withSamples ? 'r16uint' : null);
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
