// #1965: twelve frozen CPU-only camera/display groups. Top is perspective.
// Retained #1695/#1751 raw geometry; explicit provider/context and renderer mocks.
// No native validation, sampling, Worker, browser or GPU execution/pixel claim.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = resolve(import.meta.dirname, '../../..');
const output = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-1965-modeling-view');
mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const hash = value => createHash('sha256').update(value).digest('hex');
const clone = value => structuredClone(value);
const sourcePaths = ['prism-feature-scene.ts', 'modeling-scene.ts', 'prism-feature-display.ts']
  .map(name => 'packages/barocss-cad-editor/src/' + name);
sourcePaths.push('packages/barocss-cad-editor/scripts/modeling-view-test.mjs');
const ledger = [
  'default isometric parity', 'Top camera/up and native XY orientation', 'convex projected interior pick',
  'native union projected pick', 'genuine composed slot Top ray miss versus retained material hit',
  'aspect/resize ray parity', 'invalid view refusal', 'update uses same canvas/mount count',
  'renderer refusal retains prior scene', 'pending/visible preview refuses update',
  'disposed/update-unavailable refusal', 'accepted replacement keeps requested view',
];
const receipt = { issue: 1965, status: 'started', groups: [], expectedGroups: 12,
  sources: Object.fromEntries(sourcePaths.map(path => [path, hash(readFileSync(resolve(root, path)))])),
  nativeCalls: 0, convexValidationStubs: 0, surfacePacketReplays: 0, observations: [],
  evidence: 'Actual CPU scene admission/camera/picking and display ownership. Explicit DOM/renderer/provider and convex-validator doubles; unchanged retained raw geometry with mocked serializer context. Top remains perspective. No native/GPU/browser execution or pixel claim.' };
const receiptPath = resolve(output, 'verification.json');
writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
const persist = () => writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
async function group(name, run) {
  assert.equal(name, ledger[receipt.groups.length], 'Frozen 12-group order');
  await run(); receipt.groups.push(name); persist();
  console.log(JSON.stringify({ group: receipt.groups.length, name, status: 'PASS' }));
}
const originalRatio = Object.getOwnPropertyDescriptor(globalThis, 'devicePixelRatio');
const originalBoundary = Object.getOwnPropertyDescriptor(globalThis, '__modelingViewBoundary');
try {
  Object.defineProperty(globalThis, 'devicePixelRatio', { value: 1, configurable: true, writable: true });
  Object.defineProperty(globalThis, '__modelingViewBoundary', { configurable: true, value: {
    validateConvex(solid) { receipt.convexValidationStubs++; return solid.report; },
    forbidden() { receipt.nativeCalls++; throw Error('Native or GPU execution is outside this CPU flow'); },
  } });
  const source = name => resolve(root, 'packages/barocss-cad-editor/src/' + name + '.ts');
  const gpuModules = ['engine-scene', 'engine-camera-ray', 'engine-raycast', 'kernel-face-preview'];
  const gpuEntry = gpuModules.map(name => `export * from ${JSON.stringify(resolve(root, 'packages/barocss-gpu/src/' + name + '.ts'))};`).join('\n')
    + '\nexport const mountEngineScene = globalThis.__modelingViewBoundary.forbidden;';
  const entry = ['prism-feature-scene', 'modeling-scene', 'prism-feature-display', 'modeling-union', 'modeling-composition']
    .map(name => `export * from ${JSON.stringify(source(name))};`).join('\n')
    + '\nexport * from "@barocss/gpu";'
    + `\nexport {tessellateConvexPlanarSolid} from ${JSON.stringify(resolve(root, 'packages/barocss-cad/src/convex-planar-solid-mesh.ts'))};`;
  const built = await require('esbuild').build({ stdin: { contents: entry, resolveDir: root, loader: 'ts' },
    bundle: true, platform: 'node', format: 'esm', write: false, metafile: true,
    plugins: [{ name: 'explicit-cpu-boundaries', setup(build) {
      build.onResolve({ filter: /^@barocss\/gpu$/ }, () => ({ path: 'gpu', namespace: 'boundary' }));
      build.onResolve({ filter: /^\.\/convex-planar-solid\.js$/ }, () => ({ path: 'validator', namespace: 'boundary' }));
      build.onResolve({ filter: /^@barocss\/cad$|(?:\.wasm|modeling-engine|engine-scene-renderer)/ }, args => {
        throw Error('Native/GPU runtime import prohibited: ' + args.path);
      });
      build.onLoad({ filter: /.*/, namespace: 'boundary' }, ({ path }) => ({ resolveDir: root, loader: 'ts',
        contents: path === 'gpu' ? gpuEntry : 'export const validateConvexPlanarSolid = globalThis.__modelingViewBoundary.validateConvex;' }));
    } }],
  });
  const inputs = Object.keys(built.metafile.inputs);
  const allowedCad = new Set(['convex-planar-solid-mesh.ts', 'convex-planar-solid-mass-internal.ts',
    'convex-planar-solid-proof-internal.ts', 'section-rational-internal.ts']);
  for (const path of inputs) {
    assert.ok(!/(?:\.wasm|modeling-engine|engine-scene-renderer|convex-planar-solid\.ts)/.test(path), 'No native/renderer runtime input');
    if (path.includes('barocss-cad/src/')) assert.ok(allowedCad.has(path.split('/').at(-1)), 'Only frozen pure convex projection dependencies');
  }
  receipt.bundleInputs = inputs; receipt.bundleSHA256 = hash(built.outputFiles[0].text);
  writeFileSync(resolve(output, 'cpu-view.mjs'), built.outputFiles[0].text);
  const api = await import(pathToFileURL(resolve(output, 'cpu-view.mjs')));
  const baselinePath = 'packages/barocss-cad/test/modeling-composition-evidence/baseline-transfer.json';
  const bracketPath = 'packages/barocss-cad-editor/scripts/fixtures/modeling-composition/bracket-preview.json';
  const baselineBytes = readFileSync(resolve(root, baselinePath)), bracketBytes = readFileSync(resolve(root, bracketPath));
  assert.equal(hash(baselineBytes), '9a8ac520f0d4577b3a7e0ff411182e1c176eaaf8c73ac75073c129ae6380b79f');
  assert.equal(hash(bracketBytes), '419397690a131dd229e1cd03bf112227f529d91a468905c691088b710091544c');
  const baseline = JSON.parse(baselineBytes), bracketCapture = JSON.parse(bracketBytes);
  const beforeBaseline = clone(baseline), beforeBracket = clone(bracketCapture);
  assert.equal(bracketCapture.status, 'PASS'); assert.equal(bracketCapture.tessellationAttempts, 14);
  const packets = [...bracketCapture.preview, ...baseline.preview]; assert.equal(packets.length, 58);
  receipt.fixtures = { [baselinePath]: hash(baselineBytes), [bracketPath]: hash(bracketBytes) };
  function replayPanel(surface, options) {
    assert.deepEqual(options, { countU: 2, countV: 2, revision: options.revision });
    assert.ok(Number.isSafeInteger(options.revision));
    const packet = packets.find(value => value.surfaceId === surface.id); assert.ok(packet);
    const native = packet.panelId.startsWith('m4_') ? baseline.bodies.bracket.native : baseline.bodies.slotted.native;
    const source = native.sources.find(value => value.sourceId === packet.sourceId); assert.ok(source);
    assert.equal(source.panelId, packet.panelId);
    assert.deepEqual(source.model.objects.find(value => value.kind === 'surface' && value.id === surface.id), surface);
    assert.deepEqual(packet.options, { countU: 2, countV: 2, revision: 0 });
    receipt.surfacePacketReplays++; return clone(packet.result);
  }
  // Provider delivery/request context is mocked; native solid IDs, coefficients,
  // sampled arrays and lineage are preserved exactly from the retained captures.
  const revision = 7, taskToken = 'view_mock_provider';
  const context = bodyId => ({ documentId: 'cad_model', bodyId, documentRevision: String(revision),
    kernelResultRevision: String(revision), topologyRevision: String(revision), taskToken });
  const parentNative = baseline.bodies.bracket.native, slotNative = baseline.bodies.slotted.native;
  const bracket = api.projectModelingUnion(parentNative, 'bracket', context(parentNative.bodies[0].id), replayPanel, 'union');
  const slotted = api.projectModelingComposition(slotNative, 'slotted', context(slotNative.bodies[0].id), replayPanel, bracket);
  const solid = baseline.evidence[1].native.solid;
  const projected = api.tessellateConvexPlanarSolid(solid, { maximumFanTriangles: 40 });
  const convex = { role: 'base', ...Object.fromEntries(['mesh', 'boundaries', 'internalDiagonals', 'report'].map(key => [key, projected[key]])),
    lineage: { kind: 'model-output', name: 'base', solidId: solid.report.solidId,
      graph: { vertices: clone(solid.graph.vertices), faces: clone(solid.graph.faces),
        edges: solid.graph.edges.map(({ id, vertexIds, uses }) => clone({ id, vertexIds, uses })) } } };
  const convexPacket = { profile: 'model-outputs', documentId: 'cad_model', revision, components: [convex],
    outcomes: [{ role: 'base', solidId: convex.report.solidId, status: 'solid' }] };
  const components = [bracket, slotted, { family: 'convex-planar', component: convex }];
  const packet = { profile: 'model-body-faces', documentId: 'cad_model', revision, taskToken, components,
    outcomes: components.map(component => ({ role: component.family === 'convex-planar' ? component.component.role : component.role,
      solidId: component.family === 'convex-planar' ? component.component.report.solidId : component.solidId, family: component.family, status: 'solid' })) };
  const beforePacket = clone(packet);
  const prepare = (role = 'slotted', aspect = 1, orientation = 'top') => api.prepareModelingScene(packet, aspect, role, orientation);
  const top = prepare(), iso = prepare('slotted', 1, 'isometric');
  const sub = (a, b) => a.map((value, axis) => value - b[axis]);
  const dot = (a, b) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = value => value.map(n => n / Math.hypot(...value));
  const displayPoint = ([x, y, z]) => [x, z, -y];
  function project(scene, nativePoint, width, height) {
    const camera = scene.camera, backward = unit(sub(camera.eye, camera.target));
    const right = unit(cross(camera.up, backward)), vertical = cross(backward, right);
    const relative = sub(displayPoint(nativePoint), camera.eye), depth = -dot(relative, backward);
    assert.ok(depth > camera.near && depth < camera.far);
    const tangent = Math.tan(camera.fovYDegrees * Math.PI / 360);
    const ndc = [dot(relative, right) / (depth * tangent * width / height), dot(relative, vertical) / (depth * tangent)];
    const continuous = [(ndc[0] + 1) * width / 2 - .5, (ndc[1] + 1) * height / 2 - .5];
    const pixel = continuous.map(Math.round);
    assert.ok(pixel[0] >= 0 && pixel[0] < width && pixel[1] >= 0 && pixel[1] < height);
    return { continuous, pixel };
  }
  function rayAt(display, point, width = 640, height = 640) {
    const { pixel } = project(display.scene, point, width, height);
    const prepared = api.prepareEngineCameraRay(display.scene.camera, { format: 'barocss-gpu-engine-camera-ray-request', version: 0,
      pixelOrigin: 'bottom-left', sampling: 'pixel-center', viewportWidth: width, viewportHeight: height, pixelX: pixel[0], pixelY: pixel[1] });
    return { pixel, prepared, hit: api.raycastEngineScene(display.scene, prepared.ray), pick: api.pickModelingScene(display, width, height, ...pixel) };
  }
  function oldCamera(scene, aspect) {
    const positions = scene.geometries.flatMap(geometry => geometry.positions);
    const min = [0, 1, 2].map(axis => Math.min(...positions.filter((_, index) => index % 3 === axis)));
    const max = [0, 1, 2].map(axis => Math.max(...positions.filter((_, index) => index % 3 === axis)));
    const target = min.map((value, axis) => (value + max[axis]) / 2);
    const radius = Math.max(.001, Math.hypot(...max.map((value, axis) => (value - min[axis]) / 2)));
    const halfAngle = Math.min(Math.PI / 7.2, Math.atan(Math.tan(Math.PI / 7.2) * aspect));
    const distance = radius * 1.2 / Math.sin(halfAngle), direction = [1, .75, 1], length = Math.hypot(...direction);
    return { eye: direction.map((value, axis) => target[axis] + value * distance / length), target,
      up: [0, 1, 0], fovYDegrees: 50, near: Math.max(.0001, distance - radius * 1.1), far: distance + radius * 1.1 };
  }
  function harness() {
    const h = { width: 640, height: 640, children: [], canvases: [], renderers: [], updates: 0, sizeReads: 0, resizeCalls: 0 };
    const host = { getBoundingClientRect() { h.sizeReads++; return { width: h.width, height: h.height }; },
      appendChild(canvas) { h.children.push(canvas); assert.ok(h.children.length <= 2); },
      ownerDocument: { createElement(tag) {
        assert.equal(tag, 'canvas');
        const style = { visibility: '', set cssText(value) { assert.match(value, /visibility:hidden/); this.visibility = 'hidden'; } };
        const canvas = { width: 0, height: 0, style, attrs: {}, removals: 0,
          setAttribute(name, value) { this.attrs[name] = value; },
          remove() { this.removals++; const index = h.children.indexOf(this); if (index >= 0) h.children.splice(index, 1); } };
        h.canvases.push(canvas); return canvas;
      } } };
    h.display = api.createPrismFeatureDisplay(host, (canvas, scene, viewport) => {
      api.prepareEngineScene(scene);
      const renderer = { scene, canvas, width: viewport.width, height: viewport.height, disposals: 0, refusal: null, thrown: null,
        update(next) {
          assert.equal(this, renderer, 'Renderer method keeps its receiver'); h.updates++;
          if (this.thrown) throw this.thrown;
          if (this.refusal) return { ok: false, error: this.refusal };
          api.prepareEngineScene(next); this.scene = next; return { ok: true };
        },
        resize(width, height) { h.resizeCalls++; this.width = canvas.width = width; this.height = canvas.height = height; },
        dispose() { this.disposals++; } };
      h.renderers.push(renderer); return renderer;
    });
    h.accept = async display => { const candidate = await h.display.prepare(display); candidate.commit(); return h.renderers.at(-1); };
    return h;
  }

  await group(ledger[0], () => {
    for (const aspect of [1, .75, 1.5]) {
      const implicit = api.preparePrismFeatureScene(convexPacket, 'result', aspect);
      const explicit = api.preparePrismFeatureScene(convexPacket, 'result', aspect, 'isometric');
      assert.deepEqual(implicit, explicit); assert.deepEqual(implicit.scene.camera, oldCamera(implicit.scene, aspect));
      for (const role of ['base', 'bracket', 'slotted']) {
        const implicit = api.prepareModelingScene(packet, aspect, role), explicit = prepare(role, aspect, 'isometric');
        assert.deepEqual(implicit, explicit); assert.deepEqual(implicit.scene.camera, oldCamera(implicit.scene, aspect));
      }
    }
    assert.deepEqual({ ...top.scene, camera: null }, { ...iso.scene, camera: null }); assert.deepEqual(top.packet, iso.packet);
  });
  await group(ledger[1], () => {
    for (const display of [top, prepare('bracket'), prepare('base'), api.preparePrismFeatureScene(convexPacket, 'result', 1, 'top')]) {
      const camera = display.scene.camera;
      assert.deepEqual(camera.up, [0, 0, -1]); assert.equal(camera.eye[0], camera.target[0]);
      assert.equal(camera.eye[2], camera.target[2]); assert.ok(camera.eye[1] > camera.target[1]); assert.equal(camera.fovYDegrees, 50);
      const centre = project(display.scene, [12, 4, 8], 640, 640).continuous;
      const x = project(display.scene, [13, 4, 8], 640, 640).continuous;
      const y = project(display.scene, [12, 5, 8], 640, 640).continuous;
      assert.ok(x[0] > centre[0]); assert.equal(x[1], centre[1]);
      assert.ok(y[1] > centre[1]); assert.equal(y[0], centre[0]);
      api.prepareEngineScene(display.scene);
    }
  });
  await group(ledger[2], () => {
    const standalone = api.preparePrismFeatureScene(convexPacket, 'result', 1, 'top'), nested = prepare('base');
    assert.deepEqual(standalone.scene, nested.scene);
    const pixel = project(standalone.scene, [12, 4, 8], 640, 640).pixel;
    const direct = api.pickPrismFeatureScene(standalone, 640, 640, ...pixel), mixed = api.pickModelingScene(nested, 640, 640, ...pixel);
    assert.ok(direct); assert.deepEqual(mixed, direct); assert.equal(mixed.role, 'base');
    assert.equal(mixed.solidId, solid.report.solidId); assert.ok(mixed.boundaries.length >= 3);
  });
  await group(ledger[3], () => {
    const display = prepare('bracket');
    for (const point of [[24, 4, 8], [4, 20, 8]]) {
      const result = rayAt(display, point); assert.ok(result.hit); assert.ok(result.pick);
      assert.equal(result.pick.family, 'orthogonal-cell'); assert.equal(result.pick.role, 'bracket');
      assert.equal(result.pick.reference.taskToken, taskToken); assert.ok(result.pick.provenance.lineage.length);
      assert.ok(api.resolveModelingFaceReference(display, result.pick.reference));
    }
    assert.equal(rayAt(display, [20, 16, 8]).pick, null);
  });
  await group(ledger[4], () => {
    const slot = rayAt(top, [20, 4, 8]), material = rayAt(top, [12, 4, 8]);
    assert.equal(slot.hit, null); assert.equal(slot.pick, null);
    assert.ok(material.hit); assert.ok(Math.abs(material.hit.point[1] - 8) <= 1e-7); assert.ok(material.pick);
    assert.equal(material.pick.role, 'slotted'); assert.equal(material.pick.reference.taskToken, taskToken);
    assert.ok(api.resolveModelingFaceReference(top, material.pick.reference));
    assert.throws(() => api.resolveModelingFaceReference(clone(top), material.pick.reference), /original accepted/);
    receipt.observations.push({ viewport: [640, 640], slotNativeXYZ: [20, 4, 8], slotPixel: slot.pixel,
      slotHit: false, materialNativeXYZ: [12, 4, 8], materialPixel: material.pixel,
      materialFace: material.pick.reference.nativeFaceId, materialPoint: material.hit.point });
  });
  await group(ledger[5], async () => {
    const h = harness(), renderer = await h.accept(top), canvas = h.children[0];
    for (const [width, height] of [[800, 480], [400, 720]]) {
      h.width = width; h.height = height; h.display.resize();
      assert.equal(renderer.scene, top.scene, 'Resize uses retained visible camera; no picking-only reframe');
      const dimensions = h.display.dimensions(); assert.deepEqual(dimensions, { width, height });
      assert.deepEqual([canvas.width, canvas.height, renderer.width, renderer.height], [width, height, width, height]);
      for (const display of [top, prepare('slotted', width / height)]) {
        const slot = rayAt(display, [20, 4, 8], width, height), material = rayAt(display, [12, 4, 8], width, height);
        assert.equal(slot.pick, null); assert.equal(slot.hit, null); assert.ok(material.pick); assert.ok(material.hit);
        assert.deepEqual(material.prepared.camera, display.scene.camera);
      }
      const refit = prepare('slotted', width / height); h.display.updateScene(refit);
      assert.equal(renderer.scene, refit.scene); assert.equal(h.children[0], canvas);
      assert.ok(rayAt(refit, [12, 4, 8], width, height).pick);
      h.display.updateScene(top);
    }
    assert.equal(h.renderers.length, 1); h.display.dispose();
  });
  await group(ledger[6], () => {
    let reads = 0;
    const hostile = new Proxy({}, { get() { reads++; throw Error('packet read'); }, getOwnPropertyDescriptor() { reads++; throw Error('packet reflection'); } });
    for (const orientation of [null, '', 'front', 'TOP', 0, {}]) {
      assert.throws(() => api.preparePrismFeatureScene(hostile, 'result', 1, orientation), /unknown camera orientation/);
      assert.throws(() => api.prepareModelingScene(hostile, 1, 'slotted', orientation), /unknown camera orientation/);
    }
    assert.equal(reads, 0);
    for (const aspect of [0, NaN, Infinity, 2049]) assert.throws(() => prepare('slotted', aspect), /invalid viewport aspect/);
  });
  await group(ledger[7], async () => {
    const h = harness(), renderer = await h.accept(iso), canvas = h.children[0];
    const sizeReads = h.sizeReads, resizes = h.resizeCalls;
    h.display.updateScene(top); assert.equal(renderer.scene, top.scene); h.display.updateScene(iso); assert.equal(renderer.scene, iso.scene);
    assert.equal(h.updates, 2); assert.equal(h.sizeReads, sizeReads); assert.equal(h.resizeCalls, resizes);
    assert.deepEqual(h.children, [canvas]); assert.equal(h.canvases.length, 1); assert.equal(h.renderers.length, 1);
    assert.equal(canvas.style.visibility, 'visible'); assert.equal(canvas.removals, 0); assert.equal(renderer.disposals, 0);
    h.display.dispose();
  });
  await group(ledger[8], async () => {
    const h = harness(), renderer = await h.accept(iso), canvas = h.children[0];
    for (const error of [new Error('renderer admission refusal'), new AggregateError([new Error('context lost')], 'rollback unavailable')]) {
      renderer.refusal = error; assert.throws(() => h.display.updateScene(top), value => value === error);
      assert.equal(renderer.scene, iso.scene); assert.deepEqual(h.children, [canvas]); assert.equal(renderer.disposals, 0);
    }
    renderer.refusal = null; renderer.thrown = new Error('renderer throws');
    assert.throws(() => h.display.updateScene(top), value => value === renderer.thrown); assert.equal(renderer.scene, iso.scene);
    renderer.thrown = null; h.display.updateScene(top); assert.equal(renderer.scene, top.scene); h.display.dispose();
  });
  await group(ledger[9], async () => {
    const h = harness(), renderer = await h.accept(top), accepted = h.children[0];
    const promise = h.display.preparePreview(iso);
    assert.throws(() => h.display.updateScene(iso), /candidate.*pending or visible/);
    const candidate = await promise, preview = h.children[1];
    assert.throws(() => h.display.updateScene(iso), /candidate.*pending or visible/);
    candidate.show(); assert.equal(accepted.style.visibility, 'hidden'); assert.equal(preview.style.visibility, 'visible');
    assert.throws(() => h.display.updateScene(iso), /candidate.*pending or visible/);
    assert.equal(h.updates, 0); assert.equal(renderer.scene, top.scene);
    candidate.dispose(); assert.equal(accepted.style.visibility, 'visible'); assert.deepEqual(h.children, [accepted]);
    h.display.updateScene(iso); assert.equal(renderer.scene, iso.scene); h.display.dispose();
  });
  await group(ledger[10], async () => {
    const empty = harness(); assert.throws(() => empty.display.updateScene(top), /accepted renderer/); empty.display.dispose();
    const h = harness(), renderer = await h.accept(iso), canvas = h.children[0], update = renderer.update;
    delete renderer.update; assert.throws(() => h.display.updateScene(top), /does not support scene updates/);
    assert.equal(renderer.scene, iso.scene); assert.deepEqual(h.children, [canvas]); renderer.update = update;
    h.display.dispose(); assert.throws(() => h.display.updateScene(top), /disposed/); assert.equal(h.updates, 0); assert.equal(renderer.disposals, 1);
  });
  await group(ledger[11], async () => {
    const h = harness(), old = await h.accept(top), replacement = prepare('bracket', 1, 'top');
    const candidate = await h.display.preparePreview(replacement); candidate.show(); candidate.commit(); candidate.dispose();
    const renderer = h.renderers.at(-1); assert.equal(renderer.scene, replacement.scene);
    assert.deepEqual(renderer.scene.camera.up, [0, 0, -1]); assert.equal(old.disposals, 1); assert.equal(h.children.length, 1);
    assert.ok(rayAt(replacement, [12, 4, 8]).pick); h.display.updateScene(top); assert.equal(renderer.scene, top.scene);
    assert.equal(rayAt(top, [20, 4, 8]).pick, null); assert.equal(h.renderers.length, 2); h.display.dispose();
  });
  assert.deepEqual(packet, beforePacket); assert.deepEqual(baseline, beforeBaseline); assert.deepEqual(bracketCapture, beforeBracket);
  assert.equal(receipt.groups.length, 12); assert.equal(receipt.nativeCalls, 0); assert.equal(receipt.convexValidationStubs, 1);
  assert.equal(receipt.surfacePacketReplays, 58); assert.equal(fileURLToPath(import.meta.url), resolve(root, sourcePaths.at(-1)));
  receipt.status = 'PASS'; persist(); console.log(JSON.stringify(receipt));
} catch (error) {
  receipt.status = 'FAIL'; receipt.failure = { group: receipt.groups.length + 1, name: ledger[receipt.groups.length] ?? 'setup/final invariants',
    error: String(error), stack: String(error?.stack ?? '') }; persist();
  writeFileSync(resolve(output, 'first-failure.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  throw error;
} finally {
  if (originalRatio) Object.defineProperty(globalThis, 'devicePixelRatio', originalRatio); else delete globalThis.devicePixelRatio;
  if (originalBoundary) Object.defineProperty(globalThis, '__modelingViewBoundary', originalBoundary); else delete globalThis.__modelingViewBoundary;
}
