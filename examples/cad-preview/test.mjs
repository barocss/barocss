import assert from 'node:assert/strict';
import test from 'node:test';
import { request } from 'node:http';
import * as cad from '../../packages/barocss-cad/dist/index.js';
import * as gpu from '../../packages/barocss-gpu/dist/index.js';
import { validatePreviewPacket as validateCadPacket } from '../../packages/barocss-cad/dist/index.js';
import { validatePreviewPacket as validateGpuPacket } from '../../packages/barocss-gpu/dist/index.js';
import { fixtures, controlPointEdit, weightEdit, density } from './fixtures.mjs';
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
    for (const route of ['/', '/app.mjs', '/pipeline.mjs', '/fixtures.mjs', '/style.css',
      '/cad.js', '/gpu.js', ...['types', 'math', 'parser', 'iges', 'packet', 'preview'].map(name => `/${name}.js`)]) {
      const response = await get(route);
      assert.equal(response.status, 200, route);
      assert.ok(response.body.length > 0, route);
      assert.equal(response.headers['content-security-policy'], csp);
      assert.equal(response.headers['cache-control'], 'no-store');
      assert.equal(response.headers['x-content-type-options'], 'nosniff');
      assert.equal(response.headers['referrer-policy'], 'no-referrer');
      assert.match(response.headers['content-type'], route === '/' ? /^text\/html/
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
  assert(counts.parseModel > cadCalls.parseModel);
  host.dispose(); assert.equal(host.setCamera(undefined).ok, false);
});
