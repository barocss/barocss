import './test-source2.mjs';
import './test-box-preview.mjs';
import './test-history.mjs';
import './test-project.mjs';
import './test-primitives.mjs';
import './test-orbit.mjs';
import './test-parameters.mjs';
import { inspectNativeObject, objectRows } from './inspector.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { request } from 'node:http';
import * as cad from '../../packages/barocss-cad/dist/index.js';
import * as gpu from '../../packages/barocss-gpu/dist/index.js';
import { validatePreviewPacket as validateCadPacket } from '../../packages/barocss-cad/dist/index.js';
import { validatePreviewPacket as validateGpuPacket } from '../../packages/barocss-gpu/dist/index.js';
import { fixtures, constructionFixtures, objectFixtures, parameterFixture, controlPointEdit, weightEdit, vectorEdit, constructionWeightEdit, density } from './fixtures.mjs';
import { prepareCandidate, createPreviewController } from './pipeline.mjs';
import { startServer, csp } from './server.mjs';

const candidate = (fixture, overrides = {}, source = fixture.source, cadApi = cad, gpuApi = gpu) =>
  prepareCandidate(source, { surfaceId: fixture.id, countU: fixture.countU, countV: fixture.countV,
    revision: 7, options: structuredClone(fixture.options), ...overrides }, cadApi, gpuApi);
const xyz = (array, vertex) => array.slice(vertex * 3, vertex * 3 + 3);
const near = (actual, expected, tolerance = 1e-10) => {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) <= tolerance,
    `${value} differs from ${expected[index]}`));
};

test('all authored sources replay through both actual built APIs deterministically', () => {
  for (const fixture of fixtures) {
    const first = candidate(fixture), second = candidate(fixture);
    assert.deepEqual(first, second);
    assert.equal(first.source, fixture.source);
    assert.equal(first.model.lengthUnit, 'mm');
    assert.equal(first.packet.surfaceId, fixture.id);
    assert.equal(first.packet.revision, 7);
    validateCadPacket(first.packet); validateGpuPacket(first.packet);
    assert.deepEqual(first.report.grid, { countU: fixture.countU, countV: fixture.countV });
    assert.equal(first.report.certified, false);
    assert.ok(Number.isFinite(first.report.maxSampledDeviationMM));
    assert.equal(first.packet.positions.length, fixture.countU * fixture.countV * 3);
    assert.equal(first.packet.indices.length, (fixture.countU - 1) * (fixture.countV - 1) * 6);
    assert.match(first.iges.iges, /open rational B-spline geometry in MM/);
    assert.equal(first.iges.report.solid, false);
    assert.equal(first.iges.report.objects.length, 1);
    assert.equal(first.iges.report.objects[0].id, fixture.id);
  }
});

test('source-authored visible cylinder retains native radius, Y height and correct normals', () => {
  const value = candidate(fixtures[0]);
  near(value.packet.bounds.min, [0, 0, -10]);
  near(value.packet.bounds.max, [10, 30, 0]);
  for (let vertex = 0; vertex < value.packet.positions.length / 3; vertex++) {
    const [x, y, z] = xyz(value.packet.positions, vertex);
    assert.ok(Math.abs(Math.hypot(x, z) - 10) < 1e-10);
    assert.ok(y >= -1e-10 && y <= 30 + 1e-10);
    const normal = xyz(value.packet.normals, vertex);
    assert.ok(normal[0] * x + normal[2] * z > 0);
    assert.ok(Math.abs(normal[1]) < 1e-12);
  }
  const surface = value.model.objects[0];
  near(cad.evaluateSurface(surface, 0, 1), [10, 30, 0]);
  near(cad.evaluateSurface(surface, 1, 0), [0, 0, -10]);
});

test('asymmetric plane preserves U-major order, domains, millimetres and explicit scene transform', () => {
  const fixture = fixtures[1], value = candidate(fixture);
  assert.deepEqual(value.packet.positions, [1,2,2,2,9,2,7,3,2,8,10,2]);
  assert.deepEqual(value.packet.parameters, [-2,4,-2,6,3,4,3,6]);
  assert.deepEqual(value.packet.indices, [0,2,1,2,3,1]);
  assert.deepEqual(value.report.domain, { u: [-2,3], v: [4,6] });
  assert.ok(value.report.maxSampledDeviationMM < 1e-12);
  const prepared = gpu.prepareMesh(value.packet, value.options);
  for (let vertex = 0; vertex < 4; vertex++) {
    near(xyz([...prepared.positions], vertex), xyz(value.packet.positions, vertex)
      .map((coordinate, axis) => coordinate * 0.1 + fixture.options.translate[axis]), 1e-6);
  }
  const doubled = candidate(fixture, { options: { ...fixture.options, mmToSceneUnit: 0.2, translate: [0,0,0] } });
  assert.deepEqual(doubled.packet.positions, value.packet.positions);
  near(xyz([...gpu.prepareMesh(doubled.packet, doubled.options).positions], 0), [0.2,0.4,0.4], 1e-6);
});

test('control-point edit changes native endpoint, generated mesh, bounds and native IGES', () => {
  const fixture = fixtures[0], before = candidate(fixture);
  const after = candidate(fixture, { revision: 8 }, controlPointEdit(fixture.source));
  near(cad.evaluateSurface(after.model.objects[0], 0, 1), [16,30,4]);
  near(xyz(after.packet.positions, fixture.countV - 1), [16,30,4]);
  assert.notDeepEqual(after.packet.positions, before.packet.positions);
  assert.notDeepEqual(after.packet.bounds, before.packet.bounds);
  assert.notEqual(after.iges.iges, before.iges.iges);
  assert.equal(after.packet.revision, 8);
  assert.equal(before.packet.revision, 7);
});

test('rational-weight edit changes actual interior geometry but preserves cylinder endpoints', () => {
  const fixture = fixtures[0], before = candidate(fixture);
  const after = candidate(fixture, { revision: 8 }, weightEdit(fixture.source));
  const point = cad.evaluateSurface(after.model.objects[0], 0.5, 0.5);
  near(point, [35 / 6, 15, -35 / 6]);
  assert.ok(Math.abs(Math.hypot(point[0], point[2]) - 10) > 1);
  near(cad.evaluateSurface(after.model.objects[0], 0, 0), [10,0,0]);
  near(cad.evaluateSurface(after.model.objects[0], 1, 1), [0,30,-10]);
  assert.notDeepEqual(after.packet.positions, before.packet.positions);
  assert.notEqual(after.iges.iges, before.iges.iges);
});

test('grid edit preserves native model and IGES while reducing finite cylinder sampled deviation', () => {
  const fixture = fixtures[0];
  const coarse = candidate(fixture, density.coarse), fine = candidate(fixture, { ...density.fine, revision: 8 });
  assert.deepEqual(coarse.model, fine.model);
  assert.deepEqual(coarse.iges, fine.iges);
  assert.ok(coarse.report.maxSampledDeviationMM > fine.report.maxSampledDeviationMM * 10);
  assert.equal(coarse.report.probeCount, 80);
  assert.equal(fine.report.probeCount, 2560);
  assert.equal(fine.packet.revision, 8);
});

test('accepted candidate owns source-derived data and explicit scene options', () => {
  const fixture = fixtures[1], options = structuredClone(fixture.options);
  const value = candidate(fixture, { options });
  options.translate[0] = 99; options.color[0] = 0;
  assert.deepEqual(value.options, fixture.options);
  const replay = candidate(fixture);
  assert.deepEqual(value.packet, replay.packet);
  assert.deepEqual(value.model, replay.model);
});

test('invalid parser, selected object, grid, revision and singular surface reject before candidate acceptance', () => {
  const fixture = fixtures[1], accepted = candidate(fixture), snapshot = structuredClone(accepted);
  for (const overrides of [{ surfaceId: 'absent' }, { countU: 1 }, { countV: 65 },
    { countU: 2.5 }, { revision: -1 }, { revision: 2147483648 }]) {
    assert.throws(() => candidate(fixture, overrides));
    assert.deepEqual(accepted, snapshot);
  }
  assert.throws(() => candidate(fixture, {}, '@model invalid { script: alert(1); }'));
  const collapsed = fixture.source.replace('[[[1,2,2],[2,9,2]],[[7,3,2],[8,10,2]]]',
    '[[[1,2,2],[1,2,2]],[[1,2,2],[1,2,2]]]');
  assert.throws(() => candidate(fixture, {}, collapsed), /Collapsed|normal|triangle/i);
  assert.deepEqual(accepted, snapshot);
});

test('invalid display options and corrupted actual CAD packet reject before adoption', () => {
  const fixture = fixtures[1], accepted = candidate(fixture), snapshot = structuredClone(accepted);
  for (const options of [{ ...fixture.options, mmToSceneUnit: 0 }, { ...fixture.options, mmToSceneUnit: Infinity },
    { ...fixture.options, translate: [2000,0,0] }, { ...fixture.options, color: [2,0,0] }]) {
    assert.throws(() => candidate(fixture, { options }));
  }
  const corruptedCad = { ...cad, tessellateSurface(...args) {
    const result = cad.tessellateSurface(...args);
    result.packet.lengthUnit = 'm';
    return result;
  } };
  assert.throws(() => candidate(fixture, {}, fixture.source, corruptedCad), /lengthUnit|mm/);
  assert.deepEqual(accepted, snapshot);
});

test('maximum bounded grid composes through both validators and rejects larger requests', () => {
  const fixture = fixtures[1], value = candidate(fixture, { countU: 64, countV: 64, revision: 2147483647 });
  assert.equal(value.report.vertexCount, 4096);
  assert.equal(value.report.triangleCount, 7938);
  assert.equal(value.report.probeCount, 19845);
  assert.equal(gpu.prepareMesh(value.packet, value.options).indices.length, 23814);
  assert.throws(() => candidate(fixture, { countU: 65, countV: 64 }));
});

test('host controller adopts only successful candidates, issues revisions, and cleans its listener', () => {
  const listeners = new Map();
  const canvas = { addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name, fn) => { assert.equal(listeners.get(name), fn); listeners.delete(name); } };
  let mounts = 0, releases = 0, reject = false, displayed;
  const fakeGpu = { ...gpu, mountMesh(_canvas, packet) {
    mounts++; displayed = structuredClone(packet);
    return {
      update(next) { if (reject) return { ok: false, error: new Error('Injected renderer rejection') };
        displayed = structuredClone(next); return { ok: true }; },
      readPixels() { return Uint8Array.of(displayed.revision); },
      dispose() { releases++; },
    };
  } };
  const host = createPreviewController(canvas, cad, fakeGpu);
  const fixture = fixtures[0], settings = { surfaceId: fixture.id, countU: fixture.countU,
    countV: fixture.countV, options: fixture.options };
  assert.equal(host.apply(fixture.source, settings).ok, true);
  const accepted = host.snapshot(), pixels = host.readPixels();
  reject = true;
  assert.equal(host.apply(controlPointEdit(fixture.source), settings).ok, false);
  assert.deepEqual(host.snapshot(), accepted);
  assert.deepEqual(host.readPixels(), pixels);
  assert.equal(host.apply('invalid source', settings).ok, false);
  assert.deepEqual(host.snapshot(), accepted);
  reject = false;
  assert.equal(host.apply(weightEdit(fixture.source), settings).ok, true);
  assert.equal(host.snapshot().revision, 2);
  assert.equal(mounts, 1);
  const external = host.snapshot(); external.packet.positions[0] = 999;
  assert.notEqual(host.snapshot().packet.positions[0], 999);
  listeners.get('webglcontextlost')();
  assert.equal(host.available, false);
  assert.throws(() => host.readPixels(), /unavailable/);
  assert.equal(host.apply(fixture.source, settings).ok, false);
  assert.match(host.status, /context lost/);
  assert.equal(host.snapshot().revision, 2);
  host.dispose(); host.dispose();
  assert.equal(releases, 1);
  assert.equal(listeners.size, 0);
});

test('loopback server serves only explicit built/example routes under strict CSP', async () => {
  const running = await startServer();
  const address = running.server.address();
  assert.equal(address.address, '127.0.0.1');
  const get = (route, { host = `127.0.0.1:${address.port}`, method = 'GET' } = {}) =>
    new Promise((resolve, reject) => {
      // Raw HTTP preserves traversal inputs that a URL client could normalize.
      const req = request({ hostname: '127.0.0.1', port: address.port, path: route,
        method, headers: { host } }, res => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8') }));
        res.on('error', reject);
      });
      req.on('error', reject); req.end();
    });
  try {
    for (const route of ['/', '/workspace.html', '/cutout-workspace.mjs', '/gallery.mjs', '/native-topology-preview.mjs', '/gallery.css', '/app.mjs', '/pipeline.mjs', '/fixtures.mjs', '/inspector.mjs', '/parameters.mjs', '/orbit.mjs', '/primitives.mjs', '/project.mjs', '/history.mjs', '/box-preview.mjs', '/style.css',
      '/cad.js', '/gpu.js', ...['types', 'math', 'iges', 'packet', 'preview', 'extrusion', 'derivatives', 'boundary', 'face', 'adjacency', 'orthogonal-adjacency', 'box-shell', 'box-solid', 'model-compiler', 'source-ast', 'semantic-model', 'lower-model', 'construction-types', 'extrusion-validation', 'expression-parser', 'parameter-semantics', 'data-copy', 'xy-profile', 'curve-source', 'xy-arc', 'axis-rectangle-extrusion', 'axis-rectangle-feature-document', 'xy-linear-sketch', 'xy-polygon-region', 'xy-polygon-preview', 'xy-polygon-prism-preview', 'xy-polygon-prism-document', 'xy-polygon-planar-face', 'xy-polygon-prism-shell', 'xy-polygon-prism-shell-preview', 'xy-polygon-prism-ray-query', 'xy-polygon-planar-face-hole', 'xy-polygon-planar-face-hole-preview', 'xy-polygon-prism-shell-hole', 'xy-polygon-prism-shell-hole-preview', 'xy-polygon-prism-hole-document', 'xy-polygon-prism-shell-hole-ray-query'].map(name => `/${name}.js`)]) {
      const response = await get(route);
      assert.equal(response.status, 200, route);
      assert.ok(response.body.length > 0, route);
      assert.equal(response.headers['content-security-policy'], csp);
      assert.equal(response.headers['cache-control'], 'no-store');
      assert.equal(response.headers['x-content-type-options'], 'nosniff');
      assert.equal(response.headers['referrer-policy'], 'no-referrer');
      assert.match(response.headers['content-type'], ['/','/workspace.html'].includes(route) ? /^text\/html/
        : route.endsWith('.css') ? /^text\/css/ : /^text\/javascript/);
    }
    assert.match(csp, /default-src 'none'/);
    assert.match(csp, /script-src 'self'/);
    assert.match(csp, /connect-src 'none'/);
    assert.ok(!csp.includes('unsafe-inline') && !csp.includes('unsafe-eval'));
    for (const route of ['/unknown', '/package.json', '/.env', '/README.md', '/browser.mjs',
      '/../../package.json', '/%2e%2e/%2e%2e/package.json', '/cad.js?source=private',
      '/packages/barocss-cad/src/math.ts', '/Users/user/.barocss-ai/v3/private-504-issue.md']) {
      assert.equal((await get(route)).status, 404, route);
    }
    for (const method of ['POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'])
      assert.equal((await get('/cad.js', { method })).status, 404, method);
    for (const host of ['example.com', '127.0.0.1.evil.example', 'localhost.evil.example',
      '0.0.0.0', '[::1]', 'localhost:123@example.com'])
      assert.equal((await get('/cad.js', { host })).status, 404, host);
    assert.equal((await get('/cad.js', { host: `localhost:${address.port}` })).status, 200);
  } finally {
    await running.close();
  }
  assert.equal(running.server.listening, false);
});


test('camera-only host updates never recompute CAD and retain native geometry transactionally', () => {
  const counts = {};
  const trackedCad = {};
  for (const [name, value] of Object.entries(cad)) trackedCad[name] = typeof value === 'function'
    ? (...args) => { counts[name] = (counts[name] ?? 0) + 1; return value(...args); } : value;
  const listeners = new Map();
  const canvas = { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  let reject = false, updates = 0;
  const fakeGpu = { ...gpu, mountMesh(_canvas, packet, options) {
    let acceptedPacket = structuredClone(packet), acceptedOptions = structuredClone(options);
    return { update(next, settings) {
      updates++;
      if (reject) return { ok: false, error: new Error('Injected camera rejection') };
      const prepared = gpu.prepareMesh(next, settings);
      acceptedPacket = prepared.packet; acceptedOptions = prepared.options;
      return { ok: true };
    }, readPixels: () => Uint8Array.of(acceptedPacket.revision), dispose() {},
    get packet() { return structuredClone(acceptedPacket); }, get options() { return structuredClone(acceptedOptions); } };
  } };
  const host = createPreviewController(canvas, trackedCad, fakeGpu);
  const fixture = fixtures[0];
  assert.equal(host.setCamera(undefined).ok, false);
  assert(host.apply(fixture.source, { surfaceId: fixture.id, countU: fixture.countU, countV: fixture.countV, options: fixture.options }).ok);
  const initial = host.snapshot(), cadCalls = structuredClone(counts);
  const native = snapshot => Object.fromEntries(['source','model','packet','report','iges','revision'].map(key => [key,snapshot[key]]));
  for (const eye of [[0,0,6],[6,0,0],[4,3,6]]) {
    const camera = { eye, target: [0,0,0], up: [0,1,0], fovYDegrees: 45, near: .01, far: 100 };
    const before = host.snapshot();
    assert(host.setCamera(camera).ok);
    assert.equal(host.snapshot().viewRevision, before.viewRevision + 1);
    assert.deepEqual(native(host.snapshot()), native(initial));
    camera.eye[0] = 999;
    assert.notEqual(host.snapshot().options.camera.eye[0], 999);
  }
  assert.deepEqual(counts, cadCalls, 'No parse, tessellation, CAD validation or export on camera-only actions');
  const accepted = host.snapshot(), acceptedPixels = host.readPixels();
  for (const camera of [ { eye:[0,0,6], target:[0,0,6], up:[0,1,0], fovYDegrees:45, near:.01, far:100 },
    { eye:[0,0,6], target:[0,0,0], up:[0,0,1], fovYDegrees:45, near:.01, far:100 },
    { eye:[0,0,6], target:[0,0,0], up:[0,1,0], fovYDegrees:9, near:.01, far:100 } ]) {
    assert.equal(host.setCamera(camera).ok, false); assert.deepEqual(host.snapshot(), accepted);
  }
  reject = true;
  assert.equal(host.setCamera(undefined).ok, false);
  assert.deepEqual(host.snapshot(), accepted); assert.deepEqual(host.readPixels(), acceptedPixels);
  reject = false; assert(host.setCamera(undefined).ok);
  assert.equal(Object.hasOwn(host.snapshot().options, 'camera'), false);
  assert.deepEqual(native(host.snapshot()), native(initial)); assert.deepEqual(counts, cadCalls);
  assert(updates >= 4);
  const camera = { eye:[4,3,6], target:[0,0,0], up:[0,1,0], fovYDegrees:45, near:.01, far:100 };
  assert(host.setCamera(camera).ok);
  const beforeEdit = host.snapshot();
  assert(host.apply(controlPointEdit(fixture.source), { surfaceId: fixture.id, countU: fixture.countU,
    countV: fixture.countV, options: {...fixture.options,camera} }).ok);
  assert.equal(host.snapshot().revision, beforeEdit.revision + 1);
  assert.equal(host.snapshot().viewRevision, beforeEdit.viewRevision + 1);
  assert.deepEqual(host.snapshot().options.camera, camera);
  assert(counts.compileCadModel > cadCalls.compileCadModel);
  host.dispose(); assert.equal(host.setCamera(undefined).ok, false);
});


test('explicit v1 compiles actual source and preserves selected construction and export identity', () => {
  for (const fixture of constructionFixtures) {
    const accepted = candidate(fixture, { sourceVersion: 1 });
    const compiled = cad.compileCadModel(fixture.source, {sourceVersion:1});
    assert.equal(accepted.sourceVersion, 1);
    assert.deepEqual(accepted.model, compiled.model);
    assert.deepEqual(accepted.constructions, compiled.constructions);
    assert.deepEqual(accepted.selectedConstruction, compiled.constructions.find(f => f.outputId === fixture.id));
    const surface = compiled.model.objects.find(o => o.id === fixture.id);
    const mesh = cad.tessellateSurface(surface, { countU: fixture.countU, countV: fixture.countV, revision: 7 });
    assert.deepEqual(accepted.packet, mesh.packet); assert.deepEqual(accepted.report, mesh.report);
    assert.deepEqual(accepted.iges, cad.exportIGES(compiled.model, [fixture.id]));
    assert.equal(accepted.model.version, 0); assert.equal(accepted.packet.version, 0);
    assert.equal(accepted.iges.report.objects.length, 1);
    assert.equal(accepted.iges.report.objects[0].id, fixture.id);
    assert.equal(accepted.selectedConstruction.operation, 'extrude');
    assert.equal(accepted.selectedConstruction.inputId, fixture.id === 'wall' ? 'arc' : 'polyline');
    assert(accepted.selectedConstruction.span.end > accepted.selectedConstruction.span.start);
    accepted.constructions[0].vector[0] = 999;
    assert.notEqual(candidate(fixture, { sourceVersion: 1 }).constructions[0].vector[0], 999);
  }
  const legacy = candidate(fixtures[0]);
  for (const key of ['sourceVersion', 'constructions', 'selectedConstruction']) assert(!Object.hasOwn(legacy, key));
  assert.deepEqual(legacy, candidate(fixtures[0], { sourceVersion: 0 }));
});

test('source versions are explicit and never fall back to the other compiler', () => {
  const fixture = constructionFixtures[0];
  for (const sourceVersion of [undefined, 0, 2, '1', null, false, NaN])
    assert.throws(() => candidate(fixture, { sourceVersion }));
  assert.throws(() => candidate(fixtures[0], { sourceVersion: 1 }));
  assert.throws(() => candidate(fixture, { sourceVersion: 1, surfaceId: 'arc' }), /surface/);
  assert.throws(() => candidate(fixture, { sourceVersion: 1, surfaceId: 'absent' }), /surface/);
  for (const source of [fixture.source.replace('curve: #arc', 'curve: #missing'),
    fixture.source.replace('@extrude #wall', '@extrude #arc'),
    fixture.source.replace('@extrude', '@revolve'),
    fixture.source.replace('vector: [0,0,30]', 'script: alert(1)')])
    assert.throws(() => candidate(fixture, { sourceVersion: 1 }, source));
  const versions = [];
  const api = { ...cad, compileCadModel(source, options) { versions.push(options.sourceVersion); return cad.compileCadModel(source, options); } };
  assert.throws(() => candidate(fixture, { sourceVersion: 0 }, fixture.source, api));
  assert.deepEqual(versions, [0]);
  assert.throws(() => candidate(fixtures[0], { sourceVersion: 1 }, fixtures[0].source, api));
  assert.deepEqual(versions, [0, 1]);
});

test('construction vector and rational source edits change actual canonical geometry', () => {
  const fixture = constructionFixtures[0], initial = candidate(fixture, { sourceVersion: 1 });
  const vector = candidate(fixture, { sourceVersion: 1 }, vectorEdit(fixture.source));
  near(initial.packet.bounds.max, [10,10,30]);
  near(vector.packet.bounds.max, [10,10,40]);
  assert.deepEqual(vector.selectedConstruction.vector, [0,0,40]);
  const rational = candidate(fixture, { sourceVersion: 1 }, constructionWeightEdit(fixture.source));
  const surface = rational.model.objects.find(o => o.id === fixture.id);
  near(cad.evaluateSurface(surface, .5, .5), [35/6,35/6,15]);
  assert.notDeepEqual(rational.packet.positions, initial.packet.positions);
  assert.notEqual(rational.iges.iges, initial.iges.iges);
  for (const value of [vector,rational]) {
    assert.equal(value.selectedConstruction.outputId, initial.selectedConstruction.outputId);
    assert.equal(value.selectedConstruction.inputId, initial.selectedConstruction.inputId);
    assert.equal(value.selectedConstruction.operation, initial.selectedConstruction.operation);
    assert.deepEqual(value.options.camera, initial.options.camera);
  }
});

test('one transactional controller retains construction lineage on rejected source or view', () => {
  const calls = {};
  const api = Object.fromEntries(Object.entries(cad).map(([key,value]) => [key, typeof value === 'function'
    ? (...args) => { calls[key] = (calls[key] ?? 0) + 1; return value(...args); } : value]));
  const listeners = new Map(), canvas = {addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
  let fail = false, mounts = 0;
  const rendering = {...gpu, mountMesh(_canvas, packet) {
    mounts++; let shown = structuredClone(packet);
    return {update(next) {if(fail)return {ok:false,error:new Error('Injected constructed candidate failure')};
      shown=structuredClone(next);return {ok:true};},readPixels:()=>Uint8Array.of(shown.revision),dispose(){}};
  }};
  const host = createPreviewController(canvas,api,rendering), fixture = constructionFixtures[0];
  const settings = {sourceVersion:1,surfaceId:fixture.id,countU:fixture.countU,countV:fixture.countV,options:structuredClone(fixture.options)};
  assert(host.apply(fixture.source, settings).ok);
  const accepted = host.snapshot(), pixels = host.readPixels(), counts = structuredClone(calls);
  const camera = {...fixture.options.camera,eye:[6,0,0]};
  assert(host.setCamera(camera).ok);
  const view = host.snapshot();
  assert.equal(view.revision,accepted.revision); assert.equal(view.viewRevision,accepted.viewRevision+1);
  for(const key of ['source','sourceVersion','constructions','selectedConstruction','model','packet','report','iges'])
    assert.deepEqual(view[key],accepted[key]);
  assert.deepEqual(calls,counts,'Camera-only actions must not compile, evaluate, tessellate or export CAD');
  for(const [source,changes] of [[fixture.source,{sourceVersion:0}],[fixture.source,{sourceVersion:2}],
    [fixture.source.replace('curve: #arc','curve: #missing'),{}],
    [fixture.source.replace('vector: [0,0,30]','vector: [0,0,0]'),{}],
    [fixture.source.replace('[0,10,0]','[10,0,0]').replace('weights: [1,0.7071067811865476,1]','weights: [1,1,1]'),{}],
    [fixture.source,{surfaceId:'arc'}],[fixture.source,{countU:65}]]) {
    assert.equal(host.apply(source,{...settings,...changes}).ok,false); assert.deepEqual(host.snapshot(),view);
    assert.deepEqual(host.readPixels(),pixels);
  }
  fail=true;assert.equal(host.apply(vectorEdit(fixture.source),settings).ok,false);assert.deepEqual(host.snapshot(),view);
  assert.equal(host.setCamera(undefined).ok,false);assert.deepEqual(host.snapshot(),view);fail=false;
  const options={...settings.options,camera:view.options.camera};
  assert(host.apply(vectorEdit(fixture.source),{...settings,options}).ok);
  assert.equal(host.snapshot().revision,accepted.revision+1);assert.deepEqual(host.snapshot().options.camera,camera);
  const exposed=host.snapshot();exposed.constructions[0].vector[2]=999;
  assert.notEqual(host.snapshot().constructions[0].vector[2],999);
  assert(host.apply(fixtures[0].source,{surfaceId:'cylinder',countU:17,countV:9,options:fixtures[0].options}).ok);
  assert(!Object.hasOwn(host.snapshot(),'constructions'));assert.equal(mounts,1);host.dispose();
});

test('valid construction can still fail the actual preview regularity boundary', () => {
  const fixture = constructionFixtures[0];
  const source = fixture.source.replace('[0,10,0]','[10,0,0]')
    .replace('weights: [1,0.7071067811865476,1]','weights: [1,1,1]');
  assert.equal(cad.compileCadModel(source, {sourceVersion:1}).constructions.length, 1);
  assert.throws(() => candidate(fixture, { sourceVersion: 1 }, source), /Cancelling|normal|Collapsed/);
});


test('bounded native object metadata uses only accepted data with distinct bound labels', () => {
  for (const fixture of objectFixtures) {
    const value = candidate(fixture, { sourceVersion: fixture.sourceVersion ?? 0 });
    assert.equal(value.model.objects.length,4);
    const arc = inspectNativeObject(value, 'arc');
    assert.deepEqual(arc.degrees,{curve:2});assert.deepEqual(arc.originalDomains,{curve:[0,1]});
    assert.deepEqual(arc.knotCounts,{curve:6});assert.deepEqual(arc.poleCounts,{total:3});
    assert.deepEqual(arc.weightRange,[Math.SQRT1_2,1]);
    assert.deepEqual(arc.controlPointBoundsMM,{min:[0,0,0],max:[10,10,0]});
    const wall = inspectNativeObject(value,'wall');
    assert.deepEqual(wall.degrees,{u:2,v:1});assert.deepEqual(wall.originalDomains,{u:[0,1],v:[0,1]});
    assert.deepEqual(wall.poleCounts,{u:3,v:2,total:6});
    assert.deepEqual(wall.controlPointBoundsMM,{min:[0,0,0],max:[10,10,30]});
    assert.deepEqual(wall.displayedSampledMeshBoundsMM,value.packet.bounds);
    assert.equal(wall.nativeSource,fixture.sourceVersion===1?'construction-v1':'native-v0');
    assert.equal(Object.hasOwn(wall,'construction'),fixture.sourceVersion===1);
    if(fixture.sourceVersion===1)assert.deepEqual(wall.construction,value.constructions.find(f=>f.outputId==='wall'));
    wall.controlPointBoundsMM.max[0]=999;assert.equal(inspectNativeObject(value,'wall').controlPointBoundsMM.max[0],10);
    assert.equal(objectRows(value).filter(row=>row.supportedSurface).length,2);
    assert.throws(()=>objectRows({...value,model:{objects:Array(17).fill(value.model.objects[0])}}),/limit/);
  }
});

test('inspection and surface selection retain one accepted identity with zero inspection CAD calls', () => {
  for(const fixture of objectFixtures) {
    const calls={};const tracked=Object.fromEntries(Object.entries(cad).map(([name,value])=>[name,typeof value==='function'
      ?(...args)=>{calls[name]=(calls[name]??0)+1;return value(...args);}:value]));
    const listeners=new Map(),canvas={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
    let reject=false,mounts=0,shown;
    const rendering={...gpu,mountMesh(_canvas,packet){mounts++;shown=structuredClone(packet);return {
      update(next){if(reject)return{ok:false,error:new Error('Selection renderer failure')};shown=structuredClone(next);return{ok:true};},
      readPixels:()=>Uint8Array.of(shown.revision),dispose(){}};}};
    const host=createPreviewController(canvas,tracked,rendering);
    const settings={sourceVersion:fixture.sourceVersion??0,surfaceId:'wall',countU:17,countV:9,options:structuredClone(fixture.options)};
    assert(host.apply(fixture.source,settings).ok);const initial=host.snapshot(),pixels=host.readPixels(),counts=structuredClone(calls);
    assert(host.inspectObject('arc').ok);assert.equal(host.inspectedId,'arc');
    assert.deepEqual(host.snapshot(),initial);assert.deepEqual(host.readPixels(),pixels);assert.deepEqual(calls,counts);
    const description=host.inspection();description.controlPointBoundsMM.max[0]=999;
    assert.equal(host.inspection().controlPointBoundsMM.max[0],10);
    const rowCopy=host.objects();rowCopy[0].id='foreign';assert.equal(host.objects()[0].id,'arc');
    const inspected=host.inspection();let getterCalls=0;const foreign={get id(){getterCalls++;return 'wall';}};
    for(const id of ['unknown',foreign,{},['wall'],null,new String('wall')]) {
      assert.equal(host.showSurface(id).ok,false);assert.equal(host.inspectObject(id).ok,false);
      assert.equal(host.inspectedId,'arc');assert.deepEqual(host.inspection(),inspected);assert.deepEqual(host.snapshot(),initial);
    }
    assert.equal(getterCalls,0);assert.equal(host.showSurface('arc').ok,false);assert.deepEqual(host.snapshot(),initial);
    // A rejected editor attempt must not become the source/settings for selection.
    assert.equal(host.apply('invalid pending source',{...settings,countU:65,options:{...settings.options,mmToSceneUnit:0}}).ok,false);
    reject=true;assert.equal(host.showSurface('oblique_wall').ok,false);assert.equal(host.inspectedId,'arc');
    assert.deepEqual(host.snapshot(),initial);assert.deepEqual(host.readPixels(),pixels);reject=false;
    assert(host.showSurface('oblique_wall').ok);const second=host.snapshot();
    assert.equal(second.packet.surfaceId,'oblique_wall');assert.equal(second.iges.report.objects[0].id,'oblique_wall');
    assert.deepEqual(second.source,initial.source);assert.deepEqual(second.model,initial.model);assert.deepEqual(second.constructions,initial.constructions);
    assert.deepEqual(second.options,initial.options);assert.deepEqual(second.report.grid,initial.report.grid);
    assert.equal(second.revision,initial.revision+1);assert.equal(second.viewRevision,initial.viewRevision+1);
    assert.equal(host.inspectedId,'oblique_wall');
    assert(host.showSurface('wall').ok);const returned=host.snapshot();
    assert.deepEqual({...returned.packet,revision:initial.packet.revision},initial.packet);assert.deepEqual(returned.iges,initial.iges);
    assert.equal(returned.revision,second.revision+1);assert.equal(mounts,1);
    assert(host.inspectObject('polyline').ok);
    assert(host.apply(fixtures[0].source,{surfaceId:'cylinder',countU:17,countV:9,options:fixtures[0].options}).ok);
    assert.equal(host.inspectedId,'cylinder');assert.deepEqual(host.objects().map(row=>row.id),['cylinder']);
    assert.equal(host.inspectObject('polyline').ok,false);assert.equal(host.showSurface('wall').ok,false);
    assert(host.apply(fixture.source,settings).ok);assert.equal(host.objects().length,4);
    listeners.get('webglcontextlost')();assert.equal(host.inspectObject('arc').ok,false);assert.equal(host.showSurface('wall').ok,false);
    host.dispose();assert.equal(host.inspectObject('arc').ok,false);assert.equal(host.showSurface('wall').ok,false);
  }
});


test('typed parameter adoption preserves accepted settings, shared inputs and pending source', () => {
 const listeners=new Map(),canvas={addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)};let fail=false;
 const counts={};const tracked=Object.fromEntries(Object.entries(cad).map(([k,v])=>[k,typeof v==='function'? (...args)=>{counts[k]=(counts[k]??0)+1;return v(...args);}:v]));
 const rendering={...gpu,mountMesh(_canvas,packet){let shown=packet;return{update(next){if(fail)return{ok:false,error:new Error('Typed draw failure')};shown=next;return{ok:true};},readPixels:()=>Uint8Array.of(shown.revision),dispose(){}};}};
 const host=createPreviewController(canvas,tracked,rendering),fixture=parameterFixture;
 assert(host.apply(fixture.source,{sourceVersion:1,surfaceId:'wall',countU:17,countV:9,options:fixture.options}).ok);
 assert.deepEqual(host.parameterState().sharedOutputs,['wall','second_wall']);
 const initial=host.snapshot(),pixels=host.readPixels();
 assert.equal(host.applyParameters({vector:[0,0,40]},initial.source+' /* pending */').ok,false);assert.deepEqual(host.snapshot(),initial);assert.deepEqual(host.readPixels(),pixels);
 for(const request of [{vector:[0,0,0]},{vector:[-10,10,0]},{vector:[1e9,0,30]},{weight:{index:1,value:0}},{weight:{index:99,value:1}},{vector:[NaN,0,30]},{field:1}]){assert.equal(host.applyParameters(request,initial.source).ok,false);assert.deepEqual(host.snapshot(),initial);}
 fail=true;assert.equal(host.applyParameters({vector:[0,0,40]},initial.source).ok,false);assert.deepEqual(host.snapshot(),initial);fail=false;
 assert(host.applyParameters({vector:[0,0,40],weight:{index:1,value:.2}},initial.source).ok);const adopted=host.snapshot();
 assert.deepEqual(adopted.options,initial.options);assert.deepEqual(adopted.report.grid,initial.report.grid);assert.equal(adopted.revision,initial.revision+1);
 assert.deepEqual(adopted.model.objects.map(o=>o.id),initial.model.objects.map(o=>o.id));
 assert.deepEqual(adopted.model.objects.find(o=>o.id==='unused'),initial.model.objects.find(o=>o.id==='unused'));
 for(const id of ['wall','second_wall'])assert.notDeepEqual(adopted.model.objects.find(o=>o.id===id).weights,initial.model.objects.find(o=>o.id===id).weights);
 assert.deepEqual(adopted.constructions.find(f=>f.outputId==='second_wall').vector,[3,0,15]);
 const called=structuredClone(counts);assert(host.inspectObject('arc').ok);assert(host.setCamera(adopted.options.camera).ok);assert.deepEqual(counts,called);
 const source=host.snapshot().source;listeners.get('webglcontextlost')();assert.equal(host.applyParameters({},source).ok,false);host.dispose();assert.equal(host.applyParameters({},source).ok,false);
});


test('removed CAD compiler names and obsolete routes remain absent', async () => {
  for(const name of ['parseModel','compileConstruction','CadSyntaxError','ConstructionSyntaxError'])assert.equal(Object.hasOwn(cad,name),false);
  assert.equal(typeof gpu.compileScene,'function');
  const server=await startServer();
  try{for(const name of ['parser','compiler','legacy-diagnostics'])assert.equal((await fetch(server.url+'/'+name+'.js')).status,404);}finally{await server.close();}
});

test('unified structured diagnostics reject source before render and retain accepted document', () => {
  for (const sourceVersion of [0, 1]) {
    const fixture = sourceVersion === 0 ? fixtures[0] : constructionFixtures[0];
    let mounts = 0, updates = 0;
    const canvas = { addEventListener() {}, removeEventListener() {} };
    const rendering = { ...gpu, mountMesh() { mounts++; return { update() { updates++; return {ok:true}; }, dispose() {} }; } };
    const host = createPreviewController(canvas, cad, rendering);
    assert(host.apply(fixture.source, {sourceVersion, surfaceId:fixture.id, countU:fixture.countU, countV:fixture.countV, options:fixture.options}).ok);
    const accepted = host.snapshot(), history = host.historyState();
    const rejected = host.apply(fixture.source.replace('length-unit: mm', 'length-unit: metres'), {sourceVersion, surfaceId:fixture.id, countU:fixture.countU, countV:fixture.countV, options:fixture.options});
    assert.equal(rejected.ok, false);
    assert(rejected.diagnostics.length > 0);
    const diagnostic = rejected.diagnostics[0];
    assert.equal(diagnostic.severity, 'error'); assert(diagnostic.code && diagnostic.message);
    assert(diagnostic.range.line >= 1 && diagnostic.range.column >= 1);
    assert(diagnostic.range.end >= diagnostic.range.start);
    assert.deepEqual(host.snapshot(), accepted); assert.deepEqual(host.historyState(), history);
    assert.equal(mounts, 1); assert.equal(updates, 0);
    rejected.diagnostics[0].message = 'caller mutation';
    assert.notEqual(host.status, 'caller mutation'); host.dispose();
  }
});
