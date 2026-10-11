/** #1455 ONE complete authored Split Body pair -> existing EngineScene CPU flow.
 * Node22 after the affected GPU build:
 * node examples/gpu-scene/split-body-engine-scene-flow.mjs --output ABS_FRESH --native-dir ABS_1437_DEMO
 * Both helper graphs use actual CAD source. GPU graph is source or actual public emitted entry.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
assert.equal(Number(process.versions.node.split('.')[0]), 22);
const args = process.argv.slice(2); assert.equal(args.length, 4);
function argument(name) { const i = args.indexOf(name); assert.ok(i >= 0 && isAbsolute(args[i + 1]), name + ' requires an absolute path'); return resolve(args[i + 1]); }
const output = argument('--output'), nativeDir = argument('--native-dir'); await mkdir(output, { recursive: false });
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), pkg = resolve(repo, 'packages/barocss-gpu');
const parent = '515aabfe4b848f9eb6e9e45ba94b1e21724bfce7', helper = resolve(repo, 'examples/gpu-scene/split-body-engine-scene.ts');
const manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
const parentFile = name => execFileSync('git', ['show', parent + ':packages/barocss-gpu/' + name], { cwd: repo, encoding: 'utf8' });
assert.equal(await readFile(resolve(pkg, 'src/index.ts'), 'utf8'), parentFile('src/index.ts'));
assert.deepEqual(manifest, JSON.parse(parentFile('package.json')));
const gpuSource = resolve(pkg, manifest.exports['.'].import), gpuEmitted = resolve(pkg, manifest.publishConfig.exports['.'].import);
const hash = v => createHash('sha256').update(v).digest('hex');
function plain(v) { if (ArrayBuffer.isView(v)) return Array.from(v); if (v && typeof v === 'object') return Array.isArray(v) ? v.map(plain) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)])); return v; }
function signed(v) { if (typeof v === 'number') { assert.ok(Number.isFinite(v)); return Object.is(v, -0) ? '-0' : JSON.stringify(v); }
  if (v === null || typeof v !== 'object') return JSON.stringify(v); assert.ok(!ArrayBuffer.isView(v));
  return Array.isArray(v) ? '[' + v.map(signed).join(',') + ']' : '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + signed(v[k])).join(',') + '}'; }
const copy = v => JSON.parse(signed(v));
function frozen(v) { if (v && typeof v === 'object' && !ArrayBuffer.isView(v)) { assert.ok(Object.isFrozen(v)); Object.values(v).forEach(frozen); } }
function references(v, out = new Set()) { if (v && typeof v === 'object' && !out.has(v)) { out.add(v); Object.values(v).forEach(x => references(x, out)); } return out; }
function independent(a, b) { const right = references(b); for (const ref of references(a)) assert.ok(!right.has(ref)); }
function keys(v, names) { assert.deepEqual(Object.keys(v).sort(), [...names].sort()); }
function near(actual, expected, tolerance = 1e-10) { assert.ok(Math.abs(actual - expected) <= tolerance, actual + ' differs from ' + expected); }
async function receipt(path) { const b = await readFile(path); return { path, bytes: b.length, sha256: hash(b) }; }
async function save(path, value) { const text = signed(plain(value)) + '\n'; assert.ok(text.length <= 16777216 && Buffer.byteLength(text) <= 16777216); await writeFile(path, text, { flag: 'wx' }); return receipt(path); }
const pins = {
  main: { name: 'main-cut-y3.authored.json', bytes: 8240, sha256: 'b558f2f4bb29d97080032e74c1839e75558c3a04bd28c8966ecad5d5b0910a56', nativeName: 'main-cut-y3-result.json', nativeBytes: 2137460, nativeSHA: '7afc644a94c60d96223331903695dc7ce19ec34c8216ee317cf07635cde75092', volumes: ['390', '650'], cut: 3 },
  edited: { name: 'second-cut-only-y4.authored.json', bytes: 8240, sha256: 'f9607e0f355f73bbf60f0aed942d94926580e9d9553add8f915e32dc55c7fa6a', nativeName: 'second-cut-only-y4-result.json', nativeBytes: 2136691, nativeSHA: 'fd0666f817cd5fe936ef9a0109b020db007ff8995fda6e7004cb12c17fa80821', volumes: ['520', '520'], cut: 4 },
};
const originals = {};
for (const [name, pin] of Object.entries(pins)) { const bytes = await readFile(resolve(nativeDir, pin.name)); assert.equal(bytes.length, pin.bytes); assert.equal(hash(bytes), pin.sha256);
  const nativeBytes = await readFile(resolve(nativeDir, pin.nativeName)); assert.equal(nativeBytes.length, pin.nativeBytes); assert.equal(hash(nativeBytes), pin.nativeSHA);
  const path = resolve(output, name + '.original-authored.json'); await writeFile(path, bytes, { flag: 'wx' });
  originals[name] = { text: bytes.toString('utf8'), authored: JSON.parse(bytes.toString('utf8')), pinnedNative: JSON.parse(nativeBytes.toString('utf8')), file: await receipt(path) }; }
const providers = [];
for (const [label, gpuPath] of [['source-CAD-source-GPU', gpuSource], ['source-CAD-emitted-GPU', gpuEmitted]]) {
  const path = resolve(output, label + '.mjs');
  const gpuOverride = { name: 'exact-public-GPU-entry', setup(b) {
    b.onResolve({ filter: /(?:^@barocss\/gpu$|barocss-gpu\/src\/index\.(?:js|ts)$)/ }, () => ({ path: gpuPath }));
  } };
  const entry = 'export {prepareSplitBodyEngineScene} from ' + JSON.stringify(helper) + ';\nexport {prepareEngineScene,raycastEngineScene} from ' + JSON.stringify(gpuPath) + ';';
  const bundle = await build({ stdin: { contents: entry, resolveDir: repo, sourcefile: label + '.entry.mjs' }, plugins: [gpuOverride], outfile: path,
    bundle: true, format: 'esm', platform: 'node', target: 'node22', metafile: true });
  const graph = Object.keys(bundle.metafile.inputs); assert.ok(graph.some(p => p.includes('barocss-cad/src/')));
  assert.ok(!graph.some(p => p.includes('barocss-cad/dist/')), 'CAD source is explicit in both routes');
  if (label === 'source-CAD-source-GPU') { assert.ok(graph.some(p => p.includes('barocss-gpu/src/'))); assert.ok(!graph.some(p => p.includes('barocss-gpu/dist/'))); }
  else { assert.ok(graph.some(p => p.endsWith('barocss-gpu/dist/index.js'))); assert.ok(!graph.some(p => p.includes('barocss-gpu/src/'))); }
  const api = await import(pathToFileURL(path).href); assert.equal(typeof api.prepareSplitBodyEngineScene, 'function'); providers.push({ label, path, graph, api });
}
const roles = ['lower', 'upper', 'cap', 'base', 'uMin', 'uMax'];
const mapXYZ = values => { const out = []; for (let at = 0; at < values.length; at += 3) out.push(values[at], values[at + 2], -values[at + 1]); return out; };
const bufferRecord = prepared => prepared.geometries.map(g => ({ positions: Array.from(g.positions), normals: Array.from(g.normals),
  uvs: Array.from(g.uvs), indices: Array.from(g.indices), indexType: g.indexType, bufferBytes: g.bufferBytes }));
let accepted = 0, refused = 0, getterCalls = 0; const rows = [], retained = [], coldCases = [];
for (const provider of providers) {
  const records = [], failures = [];
  for (const [name, original] of Object.entries(originals)) {
    const result = provider.api.prepareSplitBodyEngineScene(original.text), pin = pins[name];
    keys(result, ['format', 'version', 'authoredText', 'split', 'meshes', 'scene', 'prepared', 'qualification']);
    assert.equal(result.format, 'barocss-gpu-example-split-body-engine-scene'); assert.equal(result.version, 0); assert.equal(result.authoredText, original.text);
    // Authored input contains original.assets/recipe, not a caller-supplied preconstructed Body.
    assert.deepEqual(result.split.request.body, original.pinnedNative.request.body); assert.deepEqual(result.split.request.cutAsset, original.authored.cutAsset);
    assert.equal(result.split.outputs.length, 2); assert.equal(result.meshes.length, 2);
    const volume = result.split.proof.volume; assert.deepEqual(volume.originalExactVolumeMM3, { numerator: '1040', denominator: '1' });
    assert.deepEqual(volume.actualOutputExactVolumeMM3, pin.volumes.map(numerator => ({ numerator, denominator: '1' })));
    assert.deepEqual(volume.sumExactVolumeMM3, { numerator: '1040', denominator: '1' }); assert.deepEqual(volume.conservationResidual, { numerator: '0', denominator: '1' });
    keys(result.qualification, ['sourceFrame', 'targetFrame', 'sceneUnitsPerMillimeter', 'basis', 'textureUV', 'components']);
    assert.equal(result.qualification.sourceFrame, 'authored-xyz-mm'); assert.equal(result.qualification.targetFrame, 'right-handed-y-up');
    assert.equal(result.qualification.sceneUnitsPerMillimeter, 1); assert.equal(result.qualification.basis, 'x,z,-y'); assert.equal(result.qualification.textureUV, 'derived-zero');
    assert.equal(result.scene.geometries.length, 12); assert.equal(result.scene.nodes.length, 14); assert.equal(result.scene.materials.length, 1);
    assert.equal(result.prepared.draws.length, 12); assert.equal(result.prepared.vertexWork, 1152);
    let corners = 0, triangles = 0;
    for (let component = 0; component < 2; component++) {
      const mesh = result.meshes[component], qualification = result.qualification.components[component], body = result.split.outputs[component].body;
      assert.deepEqual(mesh.body, body); assert.equal(Object.keys(body).length, 13); assert.equal(mesh.options.evaluationId, 'gpu_split_eval_' + component); assert.equal(mesh.options.meshId, 'gpu_split_mesh_' + component);
      keys(qualification, ['index', 'bodyId', 'groupNodeId', 'faces']); assert.equal(qualification.index, component); assert.equal(qualification.bodyId, body.body.id);
      assert.equal(qualification.groupNodeId, 'split_group_' + component); assert.equal(qualification.faces.length, 6);
      const group = result.scene.nodes.find(n => n.id === qualification.groupNodeId); assert.equal(group.type, 'group'); assert.equal(group.parentId, null); assert.equal(group.visible, true);
      assert.deepEqual(mesh.renderChunks.map(c => c.role), roles); assert.equal(mesh.report.renderVertexCount, 576); assert.equal(mesh.report.triangleCount, 192);
      for (let faceIndex = 0; faceIndex < 6; faceIndex++) {
        const chunk = mesh.renderChunks[faceIndex], nativeFace = body.faces.find(f => f.id === chunk.faceId), q = qualification.faces[faceIndex], index = component * 6 + faceIndex;
        const geometry = result.scene.geometries[index], prepared = result.prepared.geometries[index];
        keys(q, ['geometryId', 'nodeId', 'faceId', 'role', 'orientation', 'supportRef', 'authorityIndices', 'faceSampleIndices', 'triangleIndices', 'parametersUV', 'quantizationGapsMM']);
        assert.equal(q.geometryId, 'split_geometry_' + component + '_' + faceIndex); assert.equal(q.nodeId, 'split_node_' + component + '_' + faceIndex);
        assert.equal(q.faceId, nativeFace.id); assert.equal(q.role, nativeFace.role); assert.equal(q.orientation, nativeFace.orientation); assert.deepEqual(q.supportRef, nativeFace.supportRef);
        for (const field of ['authorityIndices', 'faceSampleIndices', 'triangleIndices', 'parametersUV', 'quantizationGapsMM']) { assert.deepEqual(q[field], chunk[field]); assert.notStrictEqual(q[field], chunk[field]); }
        assert.equal(geometry.id, q.geometryId); assert.deepEqual(geometry.positions, mapXYZ(chunk.positionsMM)); assert.deepEqual(geometry.normals, mapXYZ(chunk.normals));
        assert.deepEqual(geometry.indices, chunk.indices); assert.ok(geometry.uvs.every(n => Object.is(n, +0))); assert.equal(geometry.uvs.length, 2 * chunk.authorityIndices.length);
        const node = result.scene.nodes.find(n => n.id === q.nodeId); assert.equal(node.parentId, group.id); assert.equal(node.geometryId, geometry.id);
        assert.ok(prepared.positions instanceof Float32Array); assert.ok(prepared.normals instanceof Float32Array); assert.ok(prepared.uvs instanceof Float32Array); assert.ok(prepared.indices instanceof Uint16Array);
        corners += prepared.vertexCount; triangles += prepared.triangleCount;
        for (let corner = 0; corner < chunk.authorityIndices.length; corner++) {
          const at = corner * 3, position = [chunk.positionsMM[at], chunk.positionsMM[at + 2], -chunk.positionsMM[at + 1]];
          for (let axis = 0; axis < 3; axis++) near(prepared.positions[at + axis], Math.fround(position[axis]), 0);
          const sample = mesh.faceSamples[chunk.faceSampleIndices[corner]];
          assert.equal(sample.faceId, nativeFace.id); assert.equal(sample.vertexIndex, chunk.authorityIndices[corner]); assert.deepEqual(sample.uv, chunk.parametersUV.slice(corner * 2, corner * 2 + 2));
          const authority = mesh.packet.positionsMM.slice(chunk.authorityIndices[corner] * 3, chunk.authorityIndices[corner] * 3 + 3);
          assert.equal(chunk.quantizationGapsMM[corner], Math.hypot(...authority.map((n, axis) => n - chunk.positionsMM[at + axis])));
        }
        for (let t = 0; t < prepared.indices.length; t += 3) {
          const vertices = [0, 1, 2].map(k => Array.from(prepared.positions.slice(3 * prepared.indices[t + k], 3 * prepared.indices[t + k] + 3)));
          const a = vertices[1].map((n, axis) => n - vertices[0][axis]), b = vertices[2].map((n, axis) => n - vertices[0][axis]);
          const cross = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
          const normal = Array.from(prepared.normals.slice(3 * prepared.indices[t], 3 * prepared.indices[t] + 3));
          assert.ok(Math.hypot(...cross) > 0); assert.ok(cross.reduce((sum, n, axis) => sum + n * normal[axis], 0) > 0);
          const nativeTriangle = mesh.packet.triangles[chunk.triangleIndices[t / 3]]; assert.equal(nativeTriangle.faceId, nativeFace.id);
          assert.deepEqual(nativeTriangle.vertexIndices, chunk.authorityIndices.slice(t, t + 3));
        }
      }
    }
    assert.equal(corners, 1152); assert.equal(triangles, 384);
    const buffers = bufferRecord(result.prepared), bufferBytes = buffers.reduce((sum, g) => sum + g.bufferBytes, 0);
    assert.equal(result.prepared.bufferBytes, bufferBytes); assert.equal(bufferBytes, 1152 * (3 * 4 + 3 * 4 + 2 * 4 + 2));
    frozen(result); for (const previous of retained) independent(result, previous.result);
    // Native roof at X20 is Z3.25; native Y1 belongs only to component0 for both cuts.
    // The ray avoids the coincident cut Faces and maps through actual qualified cap metadata.
    const ray = { format: 'barocss-gpu-engine-ray', version: 0, coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', origin: [20, 10, -1], direction: [0, -1, 0], near: 0, far: 100 };
    const hit = provider.api.raycastEngineScene(result.scene, ray); assert.ok(hit); assert.equal(hit.geometryId, 'split_geometry_0_2'); assert.equal(hit.nodeId, 'split_node_0_2'); near(hit.distance, 6.75);
    [20, 3.25, -1].forEach((n, axis) => near(hit.point[axis], n)); assert.deepEqual(hit.uv, [0, 0]);
    const qualifiedHit = result.qualification.components[0].faces.find(f => f.geometryId === hit.geometryId); assert.ok(qualifiedHit); assert.equal(qualifiedHit.role, 'cap');
    const authorityTriangleIndex = qualifiedHit.triangleIndices[hit.triangleIndex]; assert.ok(Number.isInteger(authorityTriangleIndex));
    const authorityTriangle = result.meshes[0].packet.triangles[authorityTriangleIndex]; assert.equal(authorityTriangle.faceId, qualifiedHit.faceId);
    assert.deepEqual(authorityTriangle.vertexIndices, qualifiedHit.authorityIndices.slice(hit.triangleIndex * 3, hit.triangleIndex * 3 + 3));
    const hidden = copy(result.scene); hidden.nodes.find(n => n.id === 'split_group_0').visible = false;
    const hiddenPrepared = provider.api.prepareEngineScene(hidden); assert.equal(hiddenPrepared.draws.length, 6); assert.equal(hiddenPrepared.geometries.length, 12); assert.equal(hiddenPrepared.bufferBytes, bufferBytes);
    const hiddenHit = provider.api.raycastEngineScene(hidden, ray); assert.equal(hiddenHit, null);
    const prefix = resolve(output, provider.label + '.' + name), fullPath = prefix + '.full-consumer.json', scenePath = prefix + '.scene.json', bufferPath = prefix + '.buffers.json', mapPath = prefix + '.qualification.json';
    const files = [original.file, await save(fullPath, result), await save(scenePath, result.scene), await save(bufferPath, buffers), await save(mapPath, result.qualification),
      await save(prefix + '.visibility-ray.json', { hidden, hiddenDraws: hiddenPrepared.draws.length, hit, qualifiedHit, authorityTriangleIndex, authorityTriangle, hiddenHit, rasterPick: false, nativePrecisePick: false })];
    const digest = hash(signed(plain(result))), typedDigest = hash(signed(buffers));
    const mutable = result.prepared.geometries[0].positions, old = mutable[0]; mutable[0] = old + .5;
    assert.equal(result.scene.geometries[0].positions[0], old); assert.notEqual(result.prepared.geometries[1].positions, mutable); mutable[0] = old;
    assert.equal(hash(signed(plain(result))), digest); retained.push({ result, digest, typedDigest, files });
    const record = { provider: provider.label, name, corners, triangles, bufferBytes, draws: 12, volumes: pin.volumes, digest, typedDigest,
      authoredPath: original.file.path, fullPath, scenePath, bufferPath, mapPath, files };
    records.push(record); coldCases.push(record); accepted++;
  }
  const last = retained.at(-1);
  for (const [name, value, code] of [['nontext', { toString() { getterCalls++; return originals.main.text; } }, 'INPUT'],
    ['truncated_codec', originals.main.text.slice(0, -5), 'SOURCE'], ['oversized_text', ' '.repeat(2097153), 'SOURCE']]) {
    let error; try { provider.api.prepareSplitBodyEngineScene(value); } catch (cause) { error = cause; }
    assert.ok(error instanceof Error, name); assert.equal(error.name, 'SplitBodyEngineSceneError'); assert.equal(error.code, code); assert.ok(error.message.length <= 1024);
    if (code === 'SOURCE') { assert.ok(error.cause instanceof Error, 'Actual codec error retained'); assert.equal(error.cause.code, 'CODEC'); }
    assert.equal(hash(signed(plain(last.result))), last.digest); assert.equal(hash(signed(bufferRecord(last.result.prepared))), last.typedDigest);
    for (const file of last.files) assert.equal(hash(await readFile(file.path)), file.sha256); assert.equal(getterCalls, 0);
    failures.push({ name, code: error.code, causeName: error.cause?.name ?? null, filesRetained: true }); refused++;
  }
  rows.push({ provider: provider.label, graph: provider.graph, records, failures });
}
assert.equal(rows[0].records[0].digest, rows[1].records[0].digest); assert.equal(rows[0].records[1].digest, rows[1].records[1].digest);
assert.notEqual(rows[0].records[0].typedDigest, rows[0].records[1].typedDigest, 'Genuine authored cut changes derived paired geometry');
const coldCode = String.raw`
import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';
assert.equal(Number(process.versions.node.split('.')[0]),22);const cfg=JSON.parse(readFileSync(process.argv[2],'utf8')),hash=v=>createHash('sha256').update(v).digest('hex');
function plain(v){if(ArrayBuffer.isView(v))return Array.from(v);if(v&&typeof v==='object')return Array.isArray(v)?v.map(plain):Object.fromEntries(Object.entries(v).map(([k,x])=>[k,plain(x)]));return v;}
function signed(v){if(typeof v==='number')return Object.is(v,-0)?'-0':JSON.stringify(v);if(v===null||typeof v!=='object')return JSON.stringify(v);return Array.isArray(v)?'['+v.map(signed).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+signed(v[k])).join(',')+'}';}
const rows=[];for(const provider of cfg.providers){const api=await import(pathToFileURL(provider.path).href);for(const c of cfg.cases.filter(c=>c.provider===provider.label)){for(const f of c.files)assert.equal(hash(readFileSync(f.path)),f.sha256);const text=readFileSync(c.authoredPath,'utf8'),result=api.prepareSplitBodyEngineScene(text);assert.equal(result.authoredText,text);assert.equal(hash(signed(plain(result))),c.digest);assert.deepEqual(plain(result),JSON.parse(readFileSync(c.fullPath,'utf8')));assert.deepEqual(result.scene,JSON.parse(readFileSync(c.scenePath,'utf8')));assert.deepEqual(result.qualification,JSON.parse(readFileSync(c.mapPath,'utf8')));assert.equal(result.prepared.draws.length,12);assert.equal(result.prepared.bufferBytes,c.bufferBytes);rows.push({provider:provider.label,name:c.name,digest:c.digest,draws:12,bufferBytes:c.bufferBytes});}}
console.log(JSON.stringify({node:process.version,pid:process.pid,ppid:process.ppid,rows,CADSourceBoth:true,parentPreparedAuthority:false,actualGL:false}));
`;
const coldPath = resolve(output, 'cold-complete-split-file.mjs'), configPath = resolve(output, 'cold-config.json');
await writeFile(coldPath, coldCode, { flag: 'wx' }); await writeFile(configPath, JSON.stringify({ providers: providers.map(({ label, path }) => ({ label, path })), cases: coldCases }, null, 2) + '\n', { flag: 'wx' });
const stdout = execFileSync(process.execPath, [coldPath, configPath], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }); await writeFile(resolve(output, 'cold.stdout'), stdout, { flag: 'wx' });
const cold = JSON.parse(stdout); assert.notEqual(cold.pid, process.pid); assert.equal(cold.ppid, process.pid); assert.equal(cold.rows.length, 4);
const report = { issue: 1455, stage: 'CPU_PAIRED_SPLIT_BODY_ENGINE_SCENE', parent, node: process.version, accepted, refused, getterCalls, rows, pins, cold,
  CADSourceBoth: true, CADEmittedAcceptance: false, GPUEmittedEntry: await receipt(gpuEmitted), helper: await receipt(helper),
  publicCompatibility: { fixedParent: parent, barrelByteExact: true, manifestUnchanged: true, newLibraryAPI: false },
  actualGL: false, rendererAcceptance: false, lifetimeAcceptance: false, rasterPicking: false, nativePrecisePicking: false,
  support: 'Complete original split authored files, both whole Bodies/native mesh maps, explicit once-only basis, existing EngineScene copies/typed buffers, group visibility, qualified CPU triangle-ray mapping and genuine full-text cold reconstruction. No new library API, mesher/kernel, codec, graphics or publication.' };
const resultPath = resolve(output, 'actual-result.json'); await writeFile(resultPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ issue: 1455, accepted, refused, getterCalls, coldRows: cold.rows.length, result: await receipt(resultPath), actualGL: false }));
