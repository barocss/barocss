/** #1375 complete first-mount CODE/API qualification only. No renderer instance or GL.
 * node examples/gpu-scene/primitive-complete-mount-flow.mjs --fixture-dir <prior-cpu-flow> --output <fresh-directory>
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';

assert.equal(Number(process.versions.node.split('.')[0]), 22, 'Actual Node22 required');
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), args = process.argv.slice(2);
function option(name) { const at = args.indexOf(name); assert(at >= 0 && args[at + 1] && !args[at + 1].startsWith('--'), name + ' required'); return resolve(args[at + 1]); }
const fixtureDir = option('--fixture-dir'), output = option('--output'); await mkdir(output, { recursive: false });
const hash = value => createHash('sha256').update(value).digest('hex');
function originalJSON(value) {
  if (typeof value === 'number') { assert(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(originalJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + originalJSON(child)).join(',') + '}';
}
const clone = value => JSON.parse(originalJSON(value));
const pins = {
  'actual-result.json': '8fc5b1dba1471bdc3942485bcdfa080a916060f7aa5e80f6b9719681caa23fd4',
  'ordinary-source.original-frame.json': '58aa98f76ee25552d515e10b9795e5c0f0b66480887ec5cb904118a1fd2eb2c7',
  'ordinary-source.canonical-frame.json': '66710d2eb893c156c228d31855281850bf2d2ad21a36e69b7fb2a94c9956f6dc',
};
const pinnedBytes = {};
for (const [name, expected] of Object.entries(pins)) {
  const bytes = await readFile(resolve(fixtureDir, name)); assert.equal(hash(bytes), expected, 'Frozen actual CPU fixture ' + name); pinnedBytes[name] = bytes;
}
const cpuReceipt = JSON.parse(pinnedBytes['actual-result.json']);
assert.equal(cpuReceipt.issue, 1375); assert.equal(cpuReceipt.scope, 'CPU preflight only'); assert.deepEqual(cpuReceipt.failures, []);
assert.equal(cpuReceipt.actualGL, false); assert.equal(cpuReceipt.domReads, 0); assert.equal(cpuReceipt.getters, 0);
const previous = cpuReceipt.results.find(record => record.provider === 'ordinary-source'); assert(previous);
const original = JSON.parse(pinnedBytes['ordinary-source.original-frame.json']);
const acceptedFrame = JSON.parse(pinnedBytes['ordinary-source.canonical-frame.json']);
const previousFrameText = originalJSON(acceptedFrame), previousBufferHashes = clone(previous.buffers);
assert.equal(hash(previousFrameText), previous.canonicalFrameSHA256, 'Prior accepted CPU frame identity');
const preservedFiles = [];
for (const file of previous.files) {
  const name = basename(file.path), path = resolve(fixtureDir, name), bytes = await readFile(path);
  assert.equal(hash(bytes), file.sha256, 'Authentic full previous provenance ' + name);
  const reopenedPath = resolve(output, name); await writeFile(reopenedPath, bytes);
  preservedFiles.push({ name, path, reopenedPath, bytes: bytes.length, sha256: file.sha256 });
}
await writeFile(resolve(output, 'cpu-proof-receipt.json'), pinnedBytes['actual-result.json']);
for (const suffix of ['a', 'b', 'c', 'd']) {
  const source = await readFile(resolve(fixtureDir, 'preflight_asset_' + suffix + '.source0.css'), 'utf8');
  const native = JSON.parse(await readFile(resolve(fixtureDir, 'preflight_asset_' + suffix + '.native.json'), 'utf8'));
  assert.equal(native.source, source); assert.equal(native.sourceVersion, 0); assert.equal(native.model.name, 'preflight_asset_' + suffix);
  assert.equal(native.model.objects.length, 1); assert.equal(native.packet.surfaceId, native.model.objects[0].id);
  assert(Object.is(native.model.objects[0].controlPoints[0][0][1], -0));
  if (suffix === 'a' || suffix === 'b') {
    const row = original.scene.entries.find(entry => entry.ref.modelId === native.model.name);
    assert(row); assert.deepEqual(row.packet, native.packet); assert.equal(row.ref.geometryId, native.packet.surfaceId);
  }
}
const savedMaterials = JSON.parse(await readFile(resolve(fixtureDir, 'ordinary-source.original-materials.json'), 'utf8'));
for (const row of savedMaterials) assert.equal(row.source, row.material.source);

const pkg = resolve(repo, 'packages/barocss-gpu'), manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
const published = manifest.publishConfig.exports['.']; assert.equal(published.import, './dist/index.js'); assert.equal(published.types, './dist/index.d.ts');
const ordinary = resolve(output, 'ordinary-source.mjs'), emitted = resolve(pkg, published.import);
const bundled = await build({ entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true, platform: 'node', format: 'esm',
  target: 'node22', outfile: ordinary, metafile: true });
const graph = Object.keys(bundled.metafile.inputs);
for (const name of ['primitive-scene-renderer.ts', 'primitive-frame-preflight.ts', 'primitive-complete-mount-internal.ts', 'mesh-shaders.ts'])
  assert(graph.some(path => path.endsWith('/src/' + name)), 'Actual own source dependency ' + name);
assert(!graph.some(path => /barocss-gpu\/dist\//.test(path)), 'No own emitted fallback in ordinary source');
const providers = [['ordinary-source', await import(pathToFileURL(ordinary).href)], ['emitted-public', await import(pathToFileURL(emitted).href)]];
const namespace = Object.keys(providers[0][1]).sort(); assert.deepEqual(namespace, Object.keys(providers[1][1]).sort());
assert.equal(namespace.length, cpuReceipt.namespaceCount + 2, 'Two public factories added to actual prior namespace');
for (const name of ['completeMountCandidates', 'claimCompleteCanvas', 'releaseCompleteCanvas', 'validateCompleteMountTarget',
  'validateCompleteShaderSource', 'completeMountFailure', 'prepareCompletePrimitiveFrameData'])
  assert(!namespace.includes(name), 'Private constructor/policy/provider is not a root API');
const declarationPath = resolve(pkg, published.types), declaration = await readFile(declarationPath, 'utf8');
for (const name of ['mountPrimitiveSceneFrame', 'mountPrimitiveViewportFrame', 'PrimitiveSceneRendererV2', 'PrimitiveViewport'])
  assert(new RegExp('\\b' + name + '\\b').test(declaration));
const leafDeclaration = await readFile(resolve(pkg, 'dist/primitive-scene-renderer.d.ts'), 'utf8');
assert(/mountPrimitiveSceneFrame\(canvas:\s*HTMLCanvasElement,\s*input:\s*unknown\):\s*PrimitiveSceneRendererV2/.test(leafDeclaration));
assert(/mountPrimitiveViewportFrame\(canvas:\s*HTMLCanvasElement,\s*input:\s*unknown\):\s*PrimitiveViewport/.test(leafDeclaration));
assert(/constructor\(canvas:\s*HTMLCanvasElement,\s*input:\s*PrimitiveSceneInputV2,\s*options:\s*PrimitiveSceneOptions\)/.test(leafDeclaration), 'Old public V2 constructor retained');
assert(/constructor\(canvas:\s*HTMLCanvasElement,\s*options:\s*PrimitiveSceneOptions\)/.test(leafDeclaration), 'Old public Viewport constructor retained');

let targetReads = 0, getters = 0, reflections = 0, materialEnumeration = 0, targetRefusals = 0, cpuRefusals = 0;
const results = [], failures = [];
const untrustedTarget = () => Object.defineProperties({}, Object.fromEntries(['width', 'height', 'getContext', 'addEventListener', 'removeEventListener']
  .map(name => [name, { enumerable: true, get() { targetReads++; throw new Error('Unsupported Node target property accessed: ' + name); } }])));
async function retained() {
  assert.equal(originalJSON(acceptedFrame), previousFrameText); assert.deepEqual(previous.buffers, previousBufferHashes);
  for (const file of preservedFiles) {
    assert.equal(hash(await readFile(file.path)), file.sha256); assert.equal(hash(await readFile(file.reopenedPath)), file.sha256);
  }
  assert.equal(hash(await readFile(resolve(fixtureDir, 'actual-result.json'))), pins['actual-result.json']);
}
try {
  for (const [provider, gpu] of providers) {
    for (const name of ['mountPrimitiveSceneFrame', 'mountPrimitiveViewportFrame', 'PrimitiveSceneRendererV2', 'PrimitiveViewport', 'GPUError'])
      assert.equal(typeof gpu[name], 'function', 'Actual public ' + name);
    const checks = [];
    async function refuse(name, factoryName, input, target, targetStage, inspect) {
      let error; try { gpu[factoryName](target, input); } catch (cause) { error = cause; }
      assert(error instanceof Error, name + ': actual thrown Error');
      if (targetStage) { assert(error instanceof gpu.GPUError, name); assert(/canvas/i.test(error.message), name + ': actual target boundary'); targetRefusals++; }
      else { assert(!/requires.*HTML.*canvas/i.test(error.message), name + ': CPU candidate refused before target boundary'); cpuRefusals++; }
      inspect?.(error); assert.equal(targetReads, 0); assert.equal(getters, 0); await retained();
      checks.push({ name, factory: factoryName, stage: targetStage ? 'unsupported-node-target' : 'cpu-candidate',
        nameOfError: error.name, code: error.code ?? null, message: error.message,
        cause: error.cause instanceof Error ? { name: error.cause.name, message: error.cause.message } : null });
    }
    for (const factoryName of ['mountPrimitiveSceneFrame', 'mountPrimitiveViewportFrame']) for (const [label, frame] of [['original', original], ['canonical', acceptedFrame]]) {
      const before = originalJSON(frame);
      await refuse(label + ' null target', factoryName, frame, null, true);
      await refuse(label + ' untrusted target', factoryName, frame, untrustedTarget(), true);
      assert.equal(originalJSON(frame), before);
    }
    const empty = { ...clone(original), scene: { version: 2, entries: [] }, materials: [] };
    await refuse('empty viewport null target', 'mountPrimitiveViewportFrame', empty, null, true);
    await refuse('empty viewport untrusted target', 'mountPrimitiveViewportFrame', empty, untrustedTarget(), true);
    await refuse('empty qualified CPU refusal', 'mountPrimitiveSceneFrame', empty, untrustedTarget(), false,
      error => { assert(error instanceof gpu.GPUError); assert(/1\.\.4/.test(error.message)); });
    const emptyPath = resolve(output, provider + '.empty-viewport-frame.json'); await writeFile(emptyPath, originalJSON(empty) + '\n');
    for (const [name, change, expected] of [
      ['missing candidate material reference', f => { f.materials[0].ref.modelId = 'missing'; }, 'GPUError'],
      ['duplicate material', f => { f.materials.push(clone(f.materials[0])); }, 'GPUError'],
      ['native Surface identity mismatch', f => { f.scene.entries[0].ref.geometryId = 'wrong'; }, 'GPUError'],
      ['native packet bounds mismatch', f => { f.scene.entries[0].packet.bounds.min[0] = -999; }, 'RangeError'],
      ['invalid camera', f => { f.options.camera.near = -1; }, 'RangeError'],
      ['invalid lighting', f => { f.options.lighting.direction = [0, 0, 0]; }, 'RangeError'],
      ['uniform outside declared range', f => { f.materials[0].binding.uniforms.amount = 2; }, 'MeshMaterialError'],
      ['source-reconstructed material invalid', f => { f.materials[0].binding.material.source += ' invalid'; }, 'MeshMaterialError'],
      ['wrong frame version', f => { f.version = 1; }, 'GPUError'],
      ['unknown frame field', f => { f.extra = true; }, 'GPUError'],
      ['particles outside first-mount profile', f => { f.particles = {}; }, 'GPUError'],
      ['cloth outside first-mount profile', f => { f.cloth = null; }, 'GPUError'],
      ['material getter not invoked', f => { Object.defineProperty(f, 'materials', { enumerable: true, get() { getters++; return []; } }); }, 'GPUError'],
    ]) {
      const frame = clone(original); change(frame);
      await refuse(name, 'mountPrimitiveSceneFrame', frame, untrustedTarget(), false,
        error => assert(error instanceof (expected === 'RangeError' ? RangeError : gpu[expected])));
    }
    const viewportBad = clone(original); viewportBad.materials[0].binding.uniforms.amount = 2;
    await refuse('viewport also re-admits material', 'mountPrimitiveViewportFrame', viewportBad, untrustedTarget(), false,
      error => assert(error instanceof gpu.MeshMaterialError));
    const budgetFrame = clone(original);
    budgetFrame.materials = new Proxy(Array(5).fill(null), { ownKeys() { materialEnumeration++; throw new Error('Oversize materials must not enumerate'); } });
    await refuse('early material count', 'mountPrimitiveSceneFrame', budgetFrame, untrustedTarget(), false,
      error => assert(error instanceof gpu.GPUError)); assert.equal(materialEnumeration, 0);
    const marker = new Error('Actual complete-mount CPU reflection failure');
    await refuse('original Error identity', 'mountPrimitiveSceneFrame', new Proxy(clone(original), { getPrototypeOf() { reflections++; throw marker; } }),
      untrustedTarget(), false, error => assert.strictEqual(error, marker));
    const nonError = 'actual complete-mount non-Error';
    await refuse('non-Error original cause', 'mountPrimitiveViewportFrame', new Proxy(clone(original), { getPrototypeOf() { reflections++; throw nonError; } }),
      untrustedTarget(), false, error => { assert(error instanceof gpu.GPUError); assert.strictEqual(error.cause, nonError);
        assert.equal(Object.getOwnPropertyDescriptor(error, 'cause').enumerable, false); });

    const coldCode = `import assert from'node:assert/strict';import{readFile}from'node:fs/promises';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';
      const cfg=JSON.parse(process.argv[1]);assert.equal(Number(process.versions.node.split('.')[0]),22);const hash=v=>createHash('sha256').update(v).digest('hex');
      for(const file of cfg.files)assert.equal(hash(await readFile(file.path)),file.sha256);const original=JSON.parse(await readFile(cfg.original,'utf8')),canonical=JSON.parse(await readFile(cfg.canonical,'utf8')),empty=JSON.parse(await readFile(cfg.empty,'utf8')),out=[];
      for(const entry of cfg.entries){const gpu=await import(pathToFileURL(entry).href);assert.deepEqual(Object.keys(gpu).sort(),cfg.namespace);let targetReads=0,targetRefusals=0,cpuRefusals=0;
        const target=()=>Object.defineProperties({},Object.fromEntries(['width','height','getContext'].map(k=>[k,{get(){targetReads++;throw Error('Unsupported target accessed')}}])));
        for(const name of['mountPrimitiveSceneFrame','mountPrimitiveViewportFrame'])for(const frame of[original,canonical]){let error;try{gpu[name](target(),frame)}catch(cause){error=cause}assert(error instanceof gpu.GPUError);assert(/canvas/i.test(error.message));targetRefusals++;}
        let error;try{gpu.mountPrimitiveViewportFrame(null,empty)}catch(cause){error=cause}assert(error instanceof gpu.GPUError);assert(/canvas/i.test(error.message));targetRefusals++;
        error=undefined;try{gpu.mountPrimitiveSceneFrame(target(),empty)}catch(cause){error=cause}assert(error instanceof gpu.GPUError);assert(error.message.includes('1..4'));cpuRefusals++;assert.equal(targetReads,0);out.push({targetRefusals,cpuRefusals,targetReads});}
      console.log(JSON.stringify({node:process.version,providers:out}));`;
    const cold = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', coldCode,
      JSON.stringify({ entries: [ordinary, emitted], namespace, files: preservedFiles.map(file => ({ path: file.reopenedPath, sha256: file.sha256 })),
        original: resolve(output, 'ordinary-source.original-frame.json'), canonical: resolve(output, 'ordinary-source.canonical-frame.json'), empty: emptyPath })], { encoding: 'utf8' }));
    for (const row of cold.providers) assert.deepEqual(row, { targetRefusals: 5, cpuRefusals: 1, targetReads: 0 });
    results.push({ provider, checks, cold, preservedCPUFrameSHA256: previous.canonicalFrameSHA256, priorBufferHashes: previousBufferHashes });
  }
} catch (error) { failures.push(String(error.stack ?? error)); throw error; }
finally {
  const report = { issue: 1375, scope: 'Complete first-mount CODE/API only', parent: '89cf31f7896938efb035818f9b82e556e8b16ab3',
    head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(), targetRefusals, cpuRefusals, targetReads, getters,
    reflections, materialEnumeration, namespaceCount: namespace.length, sourceGraph: graph, pins, preservedFiles, results, failures,
    previousCPUReceipt: { accepted: cpuReceipt.accepted, refused: cpuReceipt.refused, namespaceCount: cpuReceipt.namespaceCount,
      sha256: pins['actual-result.json'], producerOrOldCampaignReplayed: false },
    providers: { ordinary: { path: ordinary, sha256: hash(await readFile(ordinary)) }, emitted: { path: emitted, sha256: hash(await readFile(emitted)) },
      declarations: { path: declarationPath, sha256: hash(declaration), leafSHA256: hash(leafDeclaration) } },
    actualGL: false, rendererInstances: 0, shaderCompilation: false, presentation: false, resourcesMeasured: false,
    futureGraphics: { status: 'UNRUN', target: 'original IAB3 / 127.0.0.1:52215 only after actual policy recovery and port-owner release',
      requirements: ['One complete first presentation of two native assets/materials; no geometry-only bootstrap/update.',
        'Actual shaders/pixels and source/cold retention, empty background once, duplicate complete canvas owner refusal.',
        'Labelled allocator/first-presentation faults, ordered primary/cleanup causes, real listener/claim/handle cleanup.',
        'Actual loss/remount/disposal and live console; no alternative target/tool/browser or user-process kill.'] },
    limits: ['Unsupported Node targets are observed refusals, not fake canvases, WebGL mocks or renderer instances.',
      'Prior qualified CPU native/material/source files are pinned and reused without CAD producer or old preflight campaign replay.',
      'Recorded prior buffer hashes are historical CPU receipts; no current GL buffers or physical memory are measured.',
      'Code/API boundaries do not complete first presentation, whole Issue1375, rendered Open, currentRoot/consumer adoption or publication.'] };
  await writeFile(resolve(output, 'actual-result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ issue: 1375, targetRefusals, cpuRefusals, targetReads, getters, reflections, materialEnumeration,
    namespaceCount: namespace.length, actualGL: false, rendererInstances: 0, failures }));
}
