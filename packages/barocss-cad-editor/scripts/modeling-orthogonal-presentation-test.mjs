// #1974: ten frozen CPU-only groups; original retained raw surface packets.
// Actual scene admission/raycast/display lifecycle; explicit GPU/DOM boundaries.
// No native evaluation, sampling, Worker, browser, GPU execution or pixel claim.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = realpathSync(resolve(import.meta.dirname, '../../..'));
const output = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-1974-orthogonal-presentation');
mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const hash = value => createHash('sha256').update(value).digest('hex');
const clone = value => structuredClone(value);
const scenePath = 'packages/barocss-cad-editor/src/modeling-scene.ts';
const scriptPath = 'packages/barocss-cad-editor/scripts/modeling-orthogonal-presentation-test.mjs';
const baselineCommit = '60db240e10c694633506c982fa6b8b9a197e9b5c';
const ledger = Object.freeze([
  'unchanged retained pocket and composed raw packet hashes',
  'exact six-way triangle partition and original-array parity',
  'exact axis/sign shades without synthesized triangles',
  'baseline and grouped material ray equivalence',
  'genuine composed through-slot void miss',
  'floor rim and vertical-wall original face identity',
  'invalid duplicate absent and local-index mapping refusal',
  'Top and Isometric camera parity',
  'changed aspect picking parity and geometry identity isolation',
  'prepare preview accepted restore and nonorthogonal byte parity',
]);
const receipt = { issue: 1974, status: 'started', expectedGroups: ledger.length, ledger, groups: [],
  sourceHashes: Object.fromEntries([scenePath, scriptPath].map(path => [path, hash(readFileSync(resolve(root, path)))])),
  nativeCalls: 0, surfacePacketReplays: 0, preparedFaults: 0, hitFaults: 0, observations: [],
  scope: 'Actual CPU source admission, unlit grouping, raycast, picking, and display ownership. Retained native geometry and raw arrays unchanged; request context and DOM/renderer faults are explicit doubles. No physical visibility, GPU pixels or numeric RSS claim.' };
const receiptPath = resolve(output, 'verification.json');
writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
writeFileSync(resolve(output, 'case-ledger.json'), JSON.stringify(ledger, null, 2) + '\n', { flag: 'wx' });
const persist = () => writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
async function group(index, run) {
  assert.equal(index, receipt.groups.length, 'Frozen ten-group order');
  await run(); receipt.groups.push({ name: ledger[index], status: 'PASS' }); persist();
  console.log(JSON.stringify({ group: index + 1, name: ledger[index], status: 'PASS' }));
}
const originalRatio = Object.getOwnPropertyDescriptor(globalThis, 'devicePixelRatio');
const originalBoundary = Object.getOwnPropertyDescriptor(globalThis, '__orthogonalPresentationBoundary');
try {
  Object.defineProperty(globalThis, 'devicePixelRatio', { value: 1, configurable: true, writable: true });
  const boundary = { rewritePrepared: null, rewriteHit: null,
    forbidden() { receipt.nativeCalls++; throw Error('Native/GPU execution is outside this CPU fixture'); } };
  Object.defineProperty(globalThis, '__orthogonalPresentationBoundary', { value: boundary, configurable: true });
  const source = name => resolve(root, 'packages/barocss-cad-editor/src/' + name + '.ts');
  const gpuSource = name => resolve(root, 'packages/barocss-gpu/src/' + name + '.ts');
  const baselineSource = execFileSync('git', ['show', baselineCommit + ':' + scenePath], { cwd: root, encoding: 'utf8' });
  assert.equal(hash(baselineSource), '5013401eabc80619bf0e7610e557e9f252e26a80c0521e56e12e30f875827c74');
  receipt.baseline = { commit: baselineCommit, sourceSHA256: hash(baselineSource) };
  writeFileSync(resolve(output, 'baseline-modeling-scene.ts'), baselineSource, { flag: 'wx' });
  const gpuEntry = ['engine-scene', 'engine-camera-ray', 'engine-raycast', 'kernel-face-preview']
    .map(name => `export * from ${JSON.stringify(gpuSource(name))};`).join('\n') + `
    import {raycastEngineScene as actualRaycast} from ${JSON.stringify(gpuSource('engine-raycast'))};
    import {prepareKernelFacePreview as actualPrepare} from ${JSON.stringify(gpuSource('kernel-face-preview'))};
    export function raycastEngineScene(...args) {
      const hit = actualRaycast(...args), b = globalThis.__orthogonalPresentationBoundary;
      return b.rewriteHit ? b.rewriteHit(hit, ...args) : hit;
    }
    export function prepareKernelFacePreview(...args) {
      const result = actualPrepare(...args), b = globalThis.__orthogonalPresentationBoundary;
      return b.rewritePrepared ? b.rewritePrepared(result) : result;
    }
    export const mountEngineScene = globalThis.__orthogonalPresentationBoundary.forbidden;
  `;
  const entry = ['modeling-scene', 'modeling-union', 'modeling-composition', 'modeling-circle', 'prism-feature-display']
    .map(name => `export * from ${JSON.stringify(source(name))};`).join('\n')
    + '\nexport * from "@barocss/gpu";'
    + '\nexport {prepareModelingScene as baselinePrepare, pickModelingScene as baselinePick} from "baseline-modeling-scene";'
    + `\nexport {raycastEngineScene as actualRaycast} from ${JSON.stringify(gpuSource('engine-raycast'))};`;
  const built = await require('esbuild').build({ stdin: { contents: entry, resolveDir: root, loader: 'ts' },
    bundle: true, platform: 'node', format: 'esm', write: false, metafile: true,
    plugins: [{ name: 'isolated-source-and-cpu-boundaries', setup(build) {
      // Explicit source aliases prevent shared node_modules workspace links from
      // resolving a product import into a different checkout.
      build.onResolve({ filter: /^@barocss\/gpu$/ }, () => ({ path: 'gpu', namespace: 'boundary' }));
      build.onResolve({ filter: /^@barocss\/cad-editor$/ }, () => ({ path: source('index') }));
      build.onResolve({ filter: /^baseline-modeling-scene$/ }, () => ({ path: 'baseline', namespace: 'boundary' }));
      build.onResolve({ filter: /^@barocss\/(?:cad|viewer|cad-interop)$|(?:\.wasm|modeling-engine|engine-scene-renderer)/ }, args => {
        throw Error('Native/GPU or unscoped runtime import prohibited: ' + args.path);
      });
      build.onLoad({ filter: /.*/, namespace: 'boundary' }, ({ path }) => ({ loader: 'ts',
        resolveDir: path === 'baseline' ? resolve(root, 'packages/barocss-cad-editor/src') : root,
        contents: path === 'baseline' ? baselineSource : gpuEntry }));
    } }],
  });
  receipt.runtimeSourceHashes = {};
  for (const input of Object.keys(built.metafile.inputs)) {
    if (input === '<stdin>' || input.startsWith('boundary:')) continue;
    const absolute = realpathSync(isAbsolute(input) ? input : resolve(root, input));
    const path = relative(root, absolute);
    assert.ok(!path.startsWith('..') && !isAbsolute(path), 'Every product import is inside this isolated checkout');
    assert.match(path, /^packages\/barocss-(?:cad-editor|gpu)\/src\/[^/]+\.ts$/);
    assert.ok(!/(?:modeling-engine|engine-scene-renderer|\.wasm)/.test(path));
    receipt.runtimeSourceHashes[path] = hash(readFileSync(absolute));
  }
  assert.equal(receipt.runtimeSourceHashes[scenePath], receipt.sourceHashes[scenePath]);
  receipt.bundleSHA256 = hash(built.outputFiles[0].text);
  receipt.boundarySHA256 = hash(gpuEntry); receipt.bundleInputs = Object.keys(built.metafile.inputs);
  writeFileSync(resolve(output, 'gpu-boundary.ts'), gpuEntry, { flag: 'wx' });
  writeFileSync(resolve(output, 'metafile.json'), JSON.stringify(built.metafile, null, 2) + '\n', { flag: 'wx' });
  writeFileSync(resolve(output, 'orthogonal-cpu.mjs'), built.outputFiles[0].text, { flag: 'wx' });
  const api = await import(pathToFileURL(resolve(output, 'orthogonal-cpu.mjs')));
  const fixtureHashes = {
    'packages/barocss-cad/test/modeling-offset-evidence/baseline-transfer.json': 'c0a29404b5ffb8dc66eb9e6f8073b9e1545e94f3fe4c055d65ca95a9ca8fd536',
    'packages/barocss-cad/test/modeling-offset-evidence/baseline.preview.json': 'a002c69effe7ddb48890f1a3a76a7f0dcf04332483a441b3c5ddf80634c4413c',
    'packages/barocss-cad/test/modeling-composition-evidence/baseline-transfer.json': '9a8ac520f0d4577b3a7e0ff411182e1c176eaaf8c73ac75073c129ae6380b79f',
    'packages/barocss-cad-editor/scripts/fixtures/modeling-composition/bracket-preview.json': '419397690a131dd229e1cd03bf112227f529d91a468905c691088b710091544c',
    'packages/barocss-cad-editor/scripts/fixtures/modeling-circle/baseline-native.json': '7338e8c36033d6a324760c9fc101d9509b73e89f223246395250c83cee6cc4e8',
    'packages/barocss-cad-editor/scripts/fixtures/modeling-hole/baseline-native.json': '3ee3d585448a24ad6d8fcdbc3cddd927eb6e13b399db6a707444940080fc4024',
  };
  const fixtures = Object.entries(fixtureHashes).map(([path, expected]) => {
    const bytes = readFileSync(resolve(root, path)); assert.equal(hash(bytes), expected); return JSON.parse(bytes);
  });
  const [pocketCapture, pocketRaw, composedCapture, bracketCapture, circleCapture, holeCapture] = fixtures;
  const fixtureCopies = clone(fixtures); receipt.fixtureHashes = fixtureHashes;
  const revision = 7, taskToken = 'presentation_cpu_context';
  const context = bodyId => ({ documentId: 'cad_model', bodyId, documentRevision: String(revision),
    kernelResultRevision: String(revision), topologyRevision: String(revision), taskToken });
  function replay(native, packets) {
    return (surface, options) => {
      assert.deepEqual(options, { countU: 2, countV: 2, revision });
      const packet = packets.find(value => value.surfaceId === surface.id); assert.ok(packet);
      const original = native.sources.find(value => value.sourceId === packet.sourceId); assert.ok(original);
      assert.equal(original.panelId, packet.panelId);
      assert.deepEqual(original.model.objects.find(value => value.kind === 'surface' && value.id === surface.id), surface);
      assert.deepEqual(packet.options, { countU: 2, countV: 2, revision: 0 });
      receipt.surfacePacketReplays++; return clone(packet.result);
    };
  }
  const pocketNative = pocketCapture.bodies.part.native, parentNative = composedCapture.bodies.bracket.native;
  const slotNative = composedCapture.bodies.slotted.native;
  const pocket = api.projectModelingUnion(pocketNative, 'pocket', context(pocketNative.bodies[0].id), replay(pocketNative, pocketRaw), 'difference');
  const bracket = api.projectModelingUnion(parentNative, 'bracket', context(parentNative.bodies[0].id), replay(parentNative, bracketCapture.preview), 'union');
  const slotted = api.projectModelingComposition(slotNative, 'slotted', context(slotNative.bodies[0].id), replay(slotNative, composedCapture.preview), bracket);
  function packetFor(components) { return { profile: 'model-body-faces', documentId: 'cad_model', revision, taskToken, components,
    outcomes: components.map(c => ({ role: c.family === 'convex-planar' ? c.component.role : c.role,
      solidId: c.family === 'convex-planar' ? c.component.report.solidId : c.solidId, family: c.family, status: 'solid' })) }; }
  const pocketPacket = packetFor([pocket]), composedPacket = packetFor([bracket, slotted]);
  const packetsBefore = clone([pocketPacket, composedPacket]);
  const prepare = (component, aspect = 1, orientation = 'top') => api.prepareModelingScene(
    component === pocket ? pocketPacket : composedPacket, aspect, component.role, orientation);
  const baseline = (component, aspect = 1, orientation = 'top') => api.baselinePrepare(
    component === pocket ? pocketPacket : composedPacket, aspect, component.role, orientation);
  const displays = new Map([pocket, bracket, slotted].map(c => [c.role, prepare(c)]));
  const baselines = new Map([pocket, bracket, slotted].map(c => [c.role, baseline(c)]));
  function originalIndex(display, hit, original) {
    const geometry = display.scene.geometries.find(g => g.id === hit.geometryId); assert.ok(geometry);
    const triplet = geometry.indices.slice(hit.triangleIndex * 3, hit.triangleIndex * 3 + 3);
    const found = [];
    for (let offset = 0; offset < original.indices.length; offset += 3)
      if (triplet.every((value, corner) => value === original.indices[offset + corner])) found.push(offset / 3);
    assert.equal(found.length, 1, 'Independent exact original occurrence lookup'); return found[0];
  }
  const sub = (a, b) => a.map((value, axis) => value - b[axis]);
  const dot = (a, b) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = value => value.map(n => n / Math.hypot(...value));
  const displayPoint = ([x, y, z]) => [x, z, -y];
  function pixelAt(scene, nativePoint, width, height) {
    const camera = scene.camera, backward = unit(sub(camera.eye, camera.target));
    const right = unit(cross(camera.up, backward)), vertical = cross(backward, right);
    const relativePoint = sub(displayPoint(nativePoint), camera.eye), depth = -dot(relativePoint, backward);
    assert.ok(depth > camera.near && depth < camera.far);
    const tangent = Math.tan(camera.fovYDegrees * Math.PI / 360);
    const ndc = [dot(relativePoint, right) / (depth * tangent * width / height), dot(relativePoint, vertical) / (depth * tangent)];
    const pixel = [Math.round((ndc[0] + 1) * width / 2 - .5), Math.round((ndc[1] + 1) * height / 2 - .5)];
    assert.ok(pixel[0] >= 0 && pixel[0] < width && pixel[1] >= 0 && pixel[1] < height); return pixel;
  }
  function pickPoint(display, nativePoint, width = 640, height = 640) {
    const pixel = pixelAt(display.scene, nativePoint, width, height);
    return { pixel, pick: api.pickModelingScene(display, width, height, ...pixel) };
  }
  const ray = (origin, direction) => ({ format: 'barocss-gpu-engine-ray', version: 0,
    coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', origin, direction, near: 0, far: 200 });
  function compareRay(component, query) {
    const display = displays.get(component.role), old = baselines.get(component.role);
    const current = api.actualRaycast(display.scene, query), prior = api.actualRaycast(old.scene, query);
    assert.ok(current); assert.ok(prior);
    for (const key of ['distance', 'point', 'barycentric', 'uv', 'normal']) assert.deepEqual(current[key], prior[key], key);
    assert.equal(originalIndex(display, current, old.scene.geometries[0]), prior.triangleIndex);
    return current;
  }
  await group(0, () => {
    assert.equal(pocket.lineage.panels.length, 46); assert.equal(bracket.lineage.panels.length, 14); assert.equal(slotted.lineage.panels.length, 44);
    assert.deepEqual(pocketRaw, pocketCapture.preview);
    for (const [component, raw] of [[pocket, pocketRaw], [bracket, bracketCapture.preview], [slotted, composedCapture.preview]]) {
      for (const [i, chunk] of component.mesh.chunks.entries()) {
        for (const [target, key] of [['positionsMM', 'positions'], ['normals', 'normals'], ['parametersUV', 'parameters'], ['indices', 'indices']])
          assert.deepEqual(chunk[target], raw[i].result.packet[key]);
      }
    }
    assert.deepEqual(fixtures, fixtureCopies); assert.equal(receipt.surfacePacketReplays, 104);
    receipt.observations.push({ rawPanels: { pocket: 46, bracket: 14, slotted: 44 }, rawReplayCount: 104, nativeCalls: 0 });
  });
  await group(1, () => {
    const ids = new Set();
    for (const component of [pocket, bracket, slotted]) {
      const display = displays.get(component.role), original = baselines.get(component.role).scene.geometries[0], seen = [];
      assert.equal(display.scene.geometries.length, 6); assert.equal(display.scene.nodes.length, 6);
      assert.equal(api.prepareEngineScene(display.scene).draws.length, 6);
      for (const geometry of display.scene.geometries) {
        assert.ok(!ids.has(geometry.id)); ids.add(geometry.id);
        for (const key of ['positions', 'normals', 'uvs']) {
          assert.deepEqual(geometry[key], original[key]); assert.strictEqual(geometry[key], display.scene.geometries[0][key]);
          assert.ok(Object.isFrozen(geometry[key]));
        }
        assert.equal(geometry.winding, original.winding);
        for (let local = 0; local < geometry.indices.length / 3; local++)
          seen.push(originalIndex(display, { geometryId: geometry.id, triangleIndex: local }, original));
      }
      assert.deepEqual(seen.sort((a, b) => a - b), Array.from({ length: original.indices.length / 3 }, (_, i) => i));
      assert.equal(new Set(seen).size, seen.length);
    }
  });
  await group(2, () => {
    const scales = [.62, .86, .72, .94, .52, 1], colors = new Set();
    for (const component of [pocket, bracket, slotted]) {
      const display = displays.get(component.role), original = baselines.get(component.role).scene.geometries[0];
      for (const node of display.scene.nodes) {
        const geometry = display.scene.geometries.find(g => g.id === node.geometryId), material = display.scene.materials.find(m => m.id === node.materialId);
        const triangle = originalIndex(display, { geometryId: geometry.id, triangleIndex: 0 }, original), panel = component.lineage.panels[Math.floor(triangle / 2)];
        const direction = panel.axis * 2 + (panel.sign === 1 ? 1 : 0);
        assert.deepEqual(material, { id: 'orthogonal_shade_' + direction, type: 'unlit', colorSpace: 'linear', color: [.3, .58, .8].map(c => c * scales[direction]) });
        colors.add(JSON.stringify(material.color));
        for (let local = 0; local < geometry.indices.length / 3; local++) {
          const p = component.lineage.panels[Math.floor(originalIndex(display, { geometryId: geometry.id, triangleIndex: local }, original) / 2)];
          assert.equal(p.axis, panel.axis); assert.equal(p.sign, panel.sign);
        }
        assert.deepEqual(node.translation, [0, 0, 0]); assert.deepEqual(node.rotationXYZW, [0, 0, 0, 1]); assert.deepEqual(node.scale, [1, 1, 1]);
      }
    }
    assert.equal(colors.size, 6);
    const up = displays.get('pocket').scene.nodes.find(n => n.materialId === 'orthogonal_shade_5');
    const geometry = displays.get('pocket').scene.geometries.find(g => g.id === up.geometryId);
    const z = new Set(geometry.indices.map(i => geometry.positions[i * 3 + 1]));
    assert.deepEqual([...z].sort((a, b) => a - b), [4, 8], 'Floor and rim retain identical +Z shade');
  });
  await group(3, () => {
    const queries = [
      [pocket, ray([16.2, 100, -12.3], [0, -1, 0])], [pocket, ray([4.2, 100, -4.3], [0, -1, 0])],
      [pocket, ray([16.2, 6, -12.3], [-1, 0, 0])], [pocket, ray([16.2, 6, -12.3], [1, 0, 0])],
      [pocket, ray([16.2, 6, -12.3], [0, 0, -1])], [pocket, ray([16.2, 6, -12.3], [0, 0, 1])],
      [bracket, ray([24.2, 100, -4.3], [0, -1, 0])], [slotted, ray([12.2, 100, -4.3], [0, -1, 0])],
    ];
    for (const [component, query] of queries) compareRay(component, query);
    receipt.observations.push({ exactMaterialRayComparisons: queries.length });
  });
  await group(4, () => {
    const display = displays.get('slotted'), old = baselines.get('slotted');
    for (const query of [ray([20.2, 100, -4.3], [0, -1, 0]), ray([20.2, -100, -4.3], [0, 1, 0])]) {
      assert.equal(api.actualRaycast(display.scene, query), null); assert.equal(api.actualRaycast(old.scene, query), null);
    }
    assert.equal(pickPoint(display, [20, 4, 8]).pick, null); assert.ok(pickPoint(display, [12, 4, 8]).pick);
    receipt.observations.push({ composedSlotTopMiss: true, retainedMaterialHit: true });
  });
  await group(5, () => {
    for (const [name, point, orientation, axis, sign] of [
      ['floor', [16, 12, 4], 'top', 2, 1], ['rim', [4, 4, 8], 'top', 2, 1], ['vertical-wall', [8, 12, 6.5], 'isometric', 0, 1],
    ]) {
      const display = prepare(pocket, 1, orientation), old = baseline(pocket, 1, orientation), { pixel, pick } = pickPoint(display, point);
      assert.ok(pick, name); assert.deepEqual(pick, api.baselinePick(old, 640, 640, ...pixel));
      assert.equal(pick.provenance.axis, axis); assert.equal(pick.provenance.sign, sign);
      assert.equal(pick.provenance.id, pick.reference.nativeFaceId); assert.equal(pick.reference.taskToken, taskToken);
      const binding = api.resolveModelingFaceReference(display, pick.reference);
      assert.ok(binding); assert.ok(pick.triangleIndex * 3 >= binding.indexRange[0] && pick.triangleIndex * 3 < binding.indexRange[1]);
      assert.deepEqual(pick.provenance, pocket.lineage.panels.find(p => p.id === pick.reference.nativeFaceId));
      receipt.observations.push({ name, pixel, originalTriangleIndex: pick.triangleIndex, nativeFaceId: pick.reference.nativeFaceId });
    }
  });
  await group(6, () => {
    const display = displays.get('pocket'), point = [16, 12, 4], { pixel, pick } = pickPoint(display, point);
    assert.throws(() => api.pickModelingScene(clone(display), 640, 640, ...pixel), /original accepted/);
    assert.throws(() => api.resolveModelingFaceReference(clone(display), pick.reference), /original accepted/);
    assert.equal(api.resolveModelingFaceReference(display, { ...pick.reference, taskToken: 'stale' }), null);
    const otherIds = [displays.get('bracket').scene.geometries[0].id, prepare(pocket).scene.geometries[0].id];
    const hitChanges = [
      ['absent geometry', hit => ({ ...hit, geometryId: 'missing' })],
      ...otherIds.map((id, i) => ['foreign geometry ' + i, hit => ({ ...hit, geometryId: id })]),
      ...[-1, .5, NaN, Infinity, 10000].map(index => ['local index ' + index, hit => ({ ...hit, triangleIndex: index })]),
    ];
    for (const [name, change] of hitChanges) {
      boundary.rewriteHit = hit => { receipt.hitFaults++; assert.ok(hit); return change(hit); };
      try { assert.throws(() => api.pickModelingScene(display, 640, 640, ...pixel), /orthogonal draw mapping/, name); }
      finally { boundary.rewriteHit = null; }
    }
    // Explicit malformed prepared-boundary doubles, not public access to the
    // private map. Genuine GPU preparation runs first and stays unchanged.
    for (const [name, alter, expected] of [
      ['duplicate original occurrence', p => p.faces[1].indexRange = [...p.faces[0].indexRange], /duplicate original/],
      ['missing original occurrence', p => p.faces[0].indexRange[1] -= 3, /missing original/],
      ['out-of-range occurrence', p => p.faces[0].indexRange[1] = p.packet.indices.length + 3, /map range/],
    ]) {
      boundary.rewritePrepared = prepared => { receipt.preparedFaults++; const invalid = clone(prepared); alter(invalid); return invalid; };
      try { assert.throws(() => prepare(pocket), expected, name); } finally { boundary.rewritePrepared = null; }
    }
    for (const mutate of [p => p.components[0].mesh.chunks[1].faceToken = p.components[0].mesh.chunks[0].faceToken,
      p => p.components[0].mesh.chunks[0].indices[0] = 99]) {
      const invalid = clone(pocketPacket); mutate(invalid); assert.throws(() => api.prepareModelingScene(invalid));
    }
    assert.deepEqual(pickPoint(display, point).pick, pick);
    // Exact shared top/+X edge: draw order may choose another valid occurrence.
    // Force only this ray via the explicit boundary; both intersections and the
    // winning hit still come from the actual engine raycast source.
    const edgeRay = ray([40, 16, -12], [-Math.SQRT1_2, -Math.SQRT1_2, 0]);
    const edgeHits = display.scene.nodes.map(node => api.actualRaycast({ ...display.scene, nodes: [node] }, edgeRay)).filter(Boolean);
    assert.ok(edgeHits.length >= 2); assert.equal(edgeHits[0].distance, edgeHits[1].distance);
    assert.notDeepEqual(edgeHits[0].normal, edgeHits[1].normal);
    boundary.rewriteHit = (_hit, scene) => api.actualRaycast(scene, edgeRay);
    try {
      const selected = api.pickModelingScene(display, 640, 640, ...pixel);
      const old = baselines.get('pocket'), prior = api.baselinePick(old, 640, 640, ...pixel);
      assert.ok(selected); assert.ok(prior);
      const actual = api.actualRaycast(display.scene, edgeRay), original = old.scene.geometries[0];
      assert.equal(selected.triangleIndex, originalIndex(display, actual, original));
      const binding = api.resolveModelingFaceReference(display, selected.reference);
      assert.ok(binding && selected.triangleIndex * 3 >= binding.indexRange[0] && selected.triangleIndex * 3 < binding.indexRange[1]);
      assert.ok(edgeHits.some(hit => hit.geometryId === actual.geometryId && hit.triangleIndex === actual.triangleIndex));
      receipt.observations.push({ equalDistanceEdge: true, originalTriangleIndex: selected.triangleIndex,
        baselineTriangleIndex: prior.triangleIndex, exactTieIdentityRequired: false });
    } finally { boundary.rewriteHit = null; }
  });
  await group(7, () => {
    for (const component of [pocket, bracket, slotted]) for (const orientation of ['top', 'isometric']) {
      const display = prepare(component, 1, orientation), old = baseline(component, 1, orientation);
      assert.deepEqual(display.scene.camera, old.scene.camera); assert.deepEqual(display.scene.background, old.scene.background);
      if (orientation === 'top') {
        const camera = display.scene.camera; assert.deepEqual(camera.up, [0, 0, -1]);
        assert.equal(camera.eye[0], camera.target[0]); assert.equal(camera.eye[2], camera.target[2]); assert.ok(camera.eye[1] > camera.target[1]);
        const center = pixelAt(display.scene, [12, 4, 8], 640, 640), x = pixelAt(display.scene, [13, 4, 8], 640, 640), y = pixelAt(display.scene, [12, 5, 8], 640, 640);
        assert.ok(x[0] > center[0]); assert.ok(y[1] > center[1]);
      }
    }
  });
  await group(8, () => {
    const identities = new Set();
    for (const component of [pocket, bracket, slotted]) for (const [width, height] of [[800, 480], [400, 720]]) {
      const display = prepare(component, width / height), old = baseline(component, width / height);
      assert.deepEqual(display.scene.camera, old.scene.camera);
      for (const geometry of display.scene.geometries) { assert.ok(!identities.has(geometry.id)); identities.add(geometry.id); }
      const point = component === pocket ? [16, 12, 4] : [12, 4, 8], { pixel, pick } = pickPoint(display, point, width, height);
      assert.ok(pick); assert.deepEqual(pick, api.baselinePick(old, width, height, ...pixel));
      if (component === slotted) assert.equal(pickPoint(display, [20, 4, 8], width, height).pick, null);
    }
    const alias = clone(pocket); alias.role = 'pocket_alias'; const packet = packetFor([pocket, alias]);
    for (const role of ['pocket', 'pocket_alias']) {
      const display = api.prepareModelingScene(packet, 1, role, 'top');
      for (const geometry of display.scene.geometries) { assert.ok(!identities.has(geometry.id)); identities.add(geometry.id); }
      assert.equal(pickPoint(display, [16, 12, 4]).pick.role, role);
    }
    const next = clone(pocketPacket); next.taskToken = 'replacement_context'; next.components[0].mesh.context.taskToken = next.taskToken;
    const replacement = api.prepareModelingScene(next, 1, 'pocket', 'top');
    const oldPick = pickPoint(displays.get('pocket'), [16, 12, 4]).pick;
    assert.equal(api.resolveModelingFaceReference(replacement, oldPick.reference), null);
    assert.equal(pickPoint(replacement, [16, 12, 4]).pick.reference.taskToken, next.taskToken);
    for (const geometry of replacement.scene.geometries) assert.ok(!identities.has(geometry.id));
    receipt.observations.push({ viewportPairs: [[800, 480], [400, 720]], geometryIdentitiesIsolated: true });
  });
  function harness() {
    const h = { width: 640, height: 640, children: [], renderers: [], failMount: false, resizeCalls: 0 };
    const host = { getBoundingClientRect: () => ({ width: h.width, height: h.height }),
      appendChild(canvas) { h.children.push(canvas); assert.ok(h.children.length <= 2); },
      ownerDocument: { createElement(tag) {
        assert.equal(tag, 'canvas');
        const style = { visibility: '', set cssText(value) { assert.match(value, /visibility:hidden/); this.visibility = 'hidden'; } };
        return { width: 0, height: 0, style, setAttribute() {}, remove() { const index = h.children.indexOf(this); if (index >= 0) h.children.splice(index, 1); } };
      } } };
    h.display = api.createPrismFeatureDisplay(host, (canvas, scene) => {
      if (h.failMount) throw Error('frozen mount refusal'); api.prepareEngineScene(scene);
      const renderer = { canvas, scene, disposals: 0, refusal: null, failResize: false,
        update(next) { if (this.refusal) return { ok: false, error: this.refusal }; api.prepareEngineScene(next); this.scene = next; return { ok: true }; },
        resize(width, height) { h.resizeCalls++; if (this.failResize) throw Error('frozen resize refusal'); canvas.width = width; canvas.height = height; },
        dispose() { this.disposals++; } };
      h.renderers.push(renderer); return renderer;
    }); return h;
  }
  await group(9, async () => {
    const h = harness(), accepted = displays.get('pocket');
    (await h.display.prepare(accepted)).commit(); const renderer = h.renderers[0], canvas = h.children[0];
    const resized = prepare(pocket, 800 / 480); h.width = 800; h.height = 480; h.display.updateScene(resized); h.display.resize();
    assert.strictEqual(renderer.scene, resized.scene); assert.strictEqual(h.children[0], canvas); assert.equal(h.renderers.length, 1);
    renderer.refusal = Error('frozen update refusal');
    assert.throws(() => h.display.updateScene(displays.get('slotted')), /frozen update/); renderer.refusal = null;
    assert.strictEqual(renderer.scene, resized.scene); assert.equal(canvas.style.visibility, 'visible');
    h.failMount = true; await assert.rejects(h.display.prepare(displays.get('slotted')), /frozen mount/); h.failMount = false;
    assert.deepEqual(h.children, [canvas]); assert.equal(canvas.style.visibility, 'visible');
    const preview = await h.display.preparePreview(displays.get('slotted')); preview.show();
    assert.equal(h.children.length, 2); assert.equal(canvas.style.visibility, 'hidden');
    assert.throws(() => h.display.updateScene(accepted), /pending or visible/);
    const sizes = h.resizeCalls; preview.dispose(); assert.equal(h.resizeCalls, sizes);
    assert.deepEqual(h.children, [canvas]); assert.equal(canvas.style.visibility, 'visible'); assert.strictEqual(renderer.scene, resized.scene);
    const refused = await h.display.preparePreview(displays.get('slotted')); h.renderers.at(-1).failResize = true;
    assert.throws(() => refused.show(), /frozen resize/); refused.dispose(); assert.equal(canvas.style.visibility, 'visible');
    const candidate = await h.display.prepare(displays.get('slotted')); candidate.commit();
    assert.equal(renderer.disposals, 1); assert.equal(h.children.length, 1); assert.strictEqual(h.renderers.at(-1).scene, displays.get('slotted').scene);
    h.display.dispose(); assert.equal(h.children.length, 0);
    // Genuine retained nonorthogonal families still use byte-identical scenes.
    const circleNative = circleCapture.bodies.post.native, circlePreview = clone(circleCapture.preview);
    circlePreview.packet.surfaceId = circlePreview.report.meshId = 'modeling_circle_post'; circlePreview.packet.revision = circlePreview.report.revision = revision;
    const circle = api.projectModelingCircle(circleNative, circlePreview, 'post', context(circleNative.parent.bundle.topology.id));
    const native = holeCapture.bodies.plate.native, bundle = native.bundle, blank = holeCapture.bodies.blank.native;
    const qualificationKeys = ['kind', 'version', 'lengthUnit', 'geometryAuthority', 'solid', 'topologyCertified', 'embeddedStoredGeometryCertified',
      'materialComponentCount', 'genus', 'faceCount', 'vertexCount', 'edgeCount', 'loopCount', 'edgeUseCount', 'weightedEuler'];
    const hole = { family: 'stored-rational-plate-hole', role: 'plate', solidId: bundle.request.bodyId, preview: clone(holeCapture.holeMesh),
      qualification: Object.fromEntries(qualificationKeys.map(k => [k, native.certificate[k]])), lineage: { bodyId: bundle.request.bodyId,
        faces: bundle.faces.map(({ id, role, surface, orientation, outerLoopId, innerLoopIds }) => ({ id, role, surfaceId: surface.id, orientation, outerLoopId, innerLoopIds: [...innerLoopIds] })),
        vertices: clone(bundle.topology.vertices), edges: bundle.topology.edges.map(({ id, curve, vertexIds, sourceParameterRange }) => ({ id, curveId: curve.id, vertexIds: [...vertexIds], sourceParameterRange: [...sourceParameterRange] })),
        loops: bundle.topology.loops.map(({ id, faceId, role, uses }) => ({ id, faceId, role, uses: uses.map(({ id, edgeId, sense, pcurve }) => ({ id, edgeId, sense, pcurveId: pcurve.curve.id, domain: [...pcurve.domain] })) })) } };
    Object.assign(hole.preview.mesh.context, context(hole.solidId));
    const convex = { family: 'convex-planar', component: { role: 'blank', ...Object.fromEntries(['mesh', 'boundaries', 'internalDiagonals', 'report'].map(k => [k, clone(holeCapture.blankMesh[k])])),
      lineage: { kind: 'model-output', name: 'blank', solidId: holeCapture.blankMesh.report.solidId, graph: { vertices: clone(blank.graph.vertices), faces: clone(blank.graph.faces),
        edges: blank.graph.edges.map(({ id, vertexIds, uses }) => clone({ id, vertexIds, uses })) } } } };
    for (const [packet, role] of [[packetFor([circle]), 'post'], [packetFor([convex, hole]), 'plate'], [packetFor([convex, hole]), 'blank']])
      for (const orientation of ['top', 'isometric']) {
        const display = api.prepareModelingScene(packet, 1.25, role, orientation), prior = api.baselinePrepare(packet, 1.25, role, orientation);
        assert.equal(JSON.stringify(display), JSON.stringify(prior)); assert.equal(display.scene.geometries.length, 1);
      }
    const prism = { profile: 'model-outputs', documentId: 'cad_model', revision, components: [convex.component],
      outcomes: [{ role: 'blank', solidId: convex.component.report.solidId, status: 'solid' }] };
    assert.equal(JSON.stringify(api.prepareModelingScene(prism)), JSON.stringify(api.baselinePrepare(prism)));
    receipt.observations.push({ nonorthogonalByteParity: ['convex-planar', 'stored-rational-circle-prism', 'stored-rational-plate-hole'], acceptedRestore: true });
  });
  assert.deepEqual([pocketPacket, composedPacket], packetsBefore); assert.deepEqual(fixtures, fixtureCopies);
  for (const [path, expected] of Object.entries(fixtureHashes)) assert.equal(hash(readFileSync(resolve(root, path))), expected);
  assert.equal(receipt.groups.length, 10); assert.equal(receipt.nativeCalls, 0); assert.equal(receipt.surfacePacketReplays, 104);
  receipt.status = 'PASS'; persist(); console.log(JSON.stringify({ status: 'PASS', groups: 10, nativeCalls: 0, surfacePacketReplays: 104 }));
} catch (error) {
  receipt.status = 'FAIL'; receipt.failure = { name: error.name, message: error.message, stack: error.stack }; persist(); throw error;
} finally {
  for (const [name, descriptor] of [['devicePixelRatio', originalRatio], ['__orthogonalPresentationBoundary', originalBoundary]]) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
  }
}
