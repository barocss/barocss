// D429: bounded orthographic depth conditioning, AO-on image regression and real native picks.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

assert.ok(process.argv[2] && process.argv[3] && process.argv[4] && process.env.PW_DIR, 'Output, original fixture folder, retained perspective reference and Playwright required');
const input = resolve(process.argv[3]), backend = 'webgpu';
const perspectiveReferenceFile = resolve(process.argv[4]), perspectiveReferenceBytes = await readFile(perspectiveReferenceFile);
const perspectiveReferenceHash = sha256(perspectiveReferenceBytes);
assert.equal(perspectiveReferenceHash, '327941972b5c7da65f5ac720284ee76a0295a67f68b03db31d058a0e88e84810', 'Retained reference must be the accepted D427 actual receipt');
const perspectiveReference = JSON.parse(perspectiveReferenceBytes.toString('utf8')).observations.find(o => o.label === 'tiny-perspective');
assert.ok(perspectiveReference);
const imageBudget = Object.freeze({ mean: 1, fractionAbove: .02, threshold: 1.5, roiStart: 40, roiEnd: 120 });
const gpuFiles = ['viewer.ts', 'camera.ts', 'orthographic-depth-internal.ts', 'math.ts', 'lights.ts', 'scene.ts', 'geometry.ts', 'shaders/output.ts', 'shaders/output-color.ts', 'shaders/surface.ts', 'shaders/material-layer.ts', 'shaders/grid.ts'].map(file => 'packages/barocss-gpu/src/viewer/' + file);
const manifest = JSON.parse(await readFile(join(input, 'cases.json'), 'utf8'));
const centered = manifest.cases.find(c => c.name === 'compound-centered');
assert.ok(centered); assert.deepEqual(centered.center, [0, 0, 0]); assert.equal(centered.radius, .001);
const fixture = join(input, centered.file), step = await readFile(fixture, 'utf8');
assert.equal(sha256(step), centered.sha256);
const { PNG } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright-core/lib/utilsBundle');
const f = await createFlow({
  name: 'orthographic-depth', envFrozen: 'ORTHOGRAPHIC_DEPTH_SOURCE_FROZEN', output: process.argv[2], qualification: 'D429_BOUNDED_ORTHOGRAPHIC_DEPTH_CONDITIONING',
  inspectorSource: "export { OrbitCamera } from './src/viewport/camera'; export { evaluatePart } from '@barocss/cad-model/engine/evaluate'; export { Camera } from '@barocss/gpu/viewer';",
  initialFiles: ['apps/cad-studio/test/orthographic-depth-browser.mjs', join(input, 'cases.json'), fixture, perspectiveReferenceFile], extraFrozen: gpuFiles,
  requiredFrozen: [...gpuFiles, 'apps/cad-studio/src/viewport/camera.ts', 'apps/cad-studio/src/viewport/Viewport.tsx', 'apps/cad-studio/src/viewport/gpuRenderer.ts'],
  limits: ['Original centered radius-.001mm sphere and ordinary Bracket profiles only. Far-world rendering/picking remains separate.', 'Tiny Top orthographic image criterion is fixture-specific: fixed80x80 interior ROI, luma second-difference mean<1 and fraction>1.5 below.02, with real AO ON and wide bounded visible ground/grid retained.', 'Public native pointer picks and public body visibility/Undo supply geometry and source-restoration evidence; RGB differences include body/shadow effects.', 'Live Viewer raster clip planes differ from non-exposed Orbit clip planes. No manual clip or helper-flag mutation.', 'Only tiny perspective has a prior actual pose/raster reference. Ordinary Top/Iso ortho controls are current visible/picking controls, not historical pose or pixel equivalence.', 'Passive transformed module bodies establish provenance, not semantic equivalence. Root must review screenshots.'],
});
f.report.pointerAttempts = []; f.report.imageAssessments = [];
f.report.perspectiveReference = { file: perspectiveReferenceFile, sha256: perspectiveReferenceHash, scope: 'Retained D427 actual tiny perspective observation, not an ordinary pose baseline' };
const moduleResponses = [], modulePending = [];
function captureModule(response) {
  const url = response.url(), path = decodeURIComponent(new URL(url).pathname);
  const file = gpuFiles.find(file => path.includes(file.replace('packages/', '/'))); if (!file) return;
  const entry = { source: file, url, status: response.status() }, number = moduleResponses.push(entry);
  modulePending.push((async () => { try { const bytes = await response.body(); entry.sha256 = sha256(bytes); entry.bytes = bytes.length; entry.file = `runtime-module-${number}.js`; await writeFile(join(f.output, entry.file), bytes); } catch (error) { entry.bodyFailure = String(error); } })());
}
async function flushModules() { await Promise.allSettled(modulePending); f.report.runtimeModules = { scope: 'Passive transformed source bodies, not semantic equivalence', responses: moduleResponses, missingDirectSources: gpuFiles.filter(file => !moduleResponses.some(r => r.source === file)) }; await writeFile(join(f.output, 'runtime-module-provenance.json'), JSON.stringify(f.report.runtimeModules, null, 2)); }
const settle = () => f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
async function clear() {
  await f.page.keyboard.press('Escape');
  await f.page.waitForFunction(() => {
    const s = window.__studioSelection?.selection;
    return s && ['vertices', 'edges', 'faces', 'bodies'].every(k => !s[k]?.length);
  });
  const box = await f.page.locator('canvas.vp-canvas').boundingBox();
  await f.page.mouse.move(box.x + 5, box.y + box.height - 5); await settle();
}
async function filter(wanted) {
  const button = f.page.getByRole('button', { name: 'Selection filter', exact: true });
  for (let i = 0; i < 4; i++) { if ((await button.innerText()).includes(wanted)) return; await button.click(); }
  assert.fail(`Selection filter did not reach ${wanted}`);
}
async function camera(points) {
  return f.page.evaluate(points => {
    const viewer = window.__studioViewer, c = viewer?.camera;
    const projection = c ? Array.from(c.projectionMatrix(viewer.aspect)) : null;
    const clipValid = c ? Number.isFinite(c.near) && (c.projection === 'perspective'
      ? c.near > 0 && (Number.isFinite(c.far) || c.far === Infinity) && c.far > c.near
      : Number.isFinite(c.far) && c.far > c.near) : null;
    if (c && (!clipValid || !projection.every(Number.isFinite))) throw new Error('Actual Viewer clip planes or projection matrix are invalid');
    return { eye: window.__studioEye(), points: points.map(p => ({ world: p, page: window.__studioScreenOf(p), project: window.__studioProject(p) })),
      viewer: c ? { position: [...c.position], target: [...c.target], distance: c.distance, projection: c.projection, fovY: c.fovY, near: c.near, far: c.far === Infinity ? 'Infinity' : c.far, autoClip: c.autoClip, clipValid, projectionMatrix: projection } : null,
      orbitClipPlanes: 'NOT_EXPOSED', backend: document.querySelector('.viewport')?.getAttribute('data-renderer') };
  }, points);
}
async function controls(requireVisibleHelpers) {
  const result = await f.page.evaluate(() => {
    const v = window.__studioViewer, c = v.camera, grounds = v.meshList.filter(m => m.material.shadowOnly === true);
    if (grounds.length !== 1) throw new Error('Expected the unique existing public shadow-only ground');
    const ground = grounds[0], vp = c.viewProjection(v.aspect), corners = [];
    for (let i = 0; i < ground.geometry.data.positions.length; i += 3) {
      const p = ground.geometry.data.positions, m = ground.transform, x = p[i], y = p[i + 1], z = p[i + 2];
      const world = [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
      const clip = [0, 1, 2, 3].map(k => vp[k] * world[0] + vp[k + 4] * world[1] + vp[k + 8] * world[2] + vp[k + 12]);
      corners.push({ world, clip, depth: clip[2] / clip[3] });
    }
    const sceneBounds = v.sceneBounds(), sceneRadius = sceneBounds && Math.hypot(...sceneBounds.max.map((x, k) => x - sceneBounds.min[k])) / 2;
    return { environment: structuredClone(v.environment), grid: structuredClone(v.grid), lights: structuredClone(v.lights), sceneBounds, sceneRadius,
      viewProjection: Array.from(vp), ground: { id: ground.id, bounded: ground.bounded, visible: ground.visible, transform: Array.from(ground.transform), material: JSON.parse(JSON.stringify(ground.material)), geometry: { positions: Array.from(ground.geometry.data.positions), indices: Array.from(ground.geometry.data.indices) }, corners } };
  });
  if (requireVisibleHelpers) {
    assert.ok(result.environment.ambientOcclusion && result.environment.ambientOcclusion.strength > 0, 'Actual Model AO remains ON');
    assert.equal(result.ground.bounded, true); assert.equal(result.ground.visible, true); assert.equal(result.grid.visible, true);
    assert.ok(result.ground.corners.every(c => c.clip.every(Number.isFinite) && c.clip[3] > 0 && c.depth >= 0 && c.depth <= 1), 'Ground remains inside nominal public near/far depth');
  }
  return result;
}
async function nativeMesh() {
  return f.page.evaluate(() => {
    const key = window.__studioBodies().bodies[0].key;
    const record = window.__smallCameraMeshes.findLast(mesh => mesh.key === key);
    if (!record?.native) throw new Error('Actual current native worker arrays are unavailable');
    return { key, ...structuredClone(record.native) };
  });
}
function luminance(image, x, y) { const at = 4 * (y * image.width + x); return .2126 * image.data[at] + .7152 * image.data[at + 1] + .0722 * image.data[at + 2]; }
function secondDifferences(image, roi) {
  const values = [];
  for (let y = roi.top; y < roi.bottom; y++) for (let x = roi.left; x < roi.right; x++) {
    const c = luminance(image, x, y);
    values.push(Math.abs(luminance(image, x - 1, y) - 2 * c + luminance(image, x + 1, y)), Math.abs(luminance(image, x, y - 1) - 2 * c + luminance(image, x, y + 1)));
  }
  const sorted = [...values].sort((a, b) => a - b);
  return { roi, samples: values.length, mean: values.reduce((a, b) => a + b, 0) / values.length, p95: sorted[Math.floor(.95 * (sorted.length - 1))], max: sorted.at(-1), fractionAbove: values.filter(x => x > imageBudget.threshold).length / values.length, threshold: imageBudget.threshold };
}
function pose(sample) {
  const v = sample.viewer;
  return { eye: sample.eye, points: sample.points, viewer: v && { position: v.position, target: v.target, distance: v.distance, projection: v.projection, fovY: v.fovY } };
}
async function frame(ortho, view) {
  await f.page.locator('.views').getByRole('button', { name: view === 'iso' ? 'Iso' : 'Top', exact: true }).click();
  const toggle = f.page.getByRole('button', { name: 'Ortho', exact: true });
  if ((await toggle.getAttribute('class')).split(/\s+/).includes('on') !== ortho) await toggle.click();
  await f.page.keyboard.press('f');
  // The public view transition animates. Require stable projection/eye observations before measurement.
  let previous, stable = 0;
  for (let i = 0; i < 50 && stable < 3; i++) {
    await f.page.waitForTimeout(50);
    const now = JSON.stringify(pose(await camera([[0, 0, 0]])));
    stable = now === previous ? stable + 1 : 0; previous = now;
  }
  assert.equal(stable, 3, 'Actual camera reaches a stable public Top/F view'); await settle();
}
async function picks(points) {
  const mesh = await f.page.evaluate(() => {
    const key = window.__studioBodies().bodies[0].key;
    return window.__smallCameraMeshes.findLast(mesh => mesh.key === key);
  });
  assert.ok(mesh?.faces.length, 'Real worker supplies native display face ordinals');
  const observations = [];
  for (const kind of ['faces', 'bodies']) for (const point of points) {
    await clear(); await filter(kind === 'faces' ? 'Faces' : 'Bodies');
    const at = await f.page.evaluate(p => window.__studioScreenOf(p), point);
    assert.ok(at?.length === 2 && at.every(Number.isFinite));
    assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), at), 'Pointer target is exposed canvas');
    const attempt = { kind, point, at, expectedBody: 0, actualNativeFaces: mesh.faces, status: 'RUNNING' };
    f.report.pointerAttempts.push(attempt); await f.persist();
    await f.page.mouse.move(at[0], at[1]); await f.page.mouse.click(at[0], at[1]);
    await f.page.waitForFunction(kind => window.__studioSelection?.selection[kind]?.length === 1, kind, { timeout: 10000 });
    const selected = await f.page.evaluate(() => structuredClone(window.__studioSelection.selection));
    if (kind === 'bodies') assert.equal(selected.bodies[0], 0, 'Pointer picks the current body');
    else { assert.equal(selected.faces[0].body, 0); assert.ok(Number.isInteger(selected.faces[0].face) && selected.faces[0].face >= 0 && selected.faces[0].face < mesh.faces.length, 'Pointer face ordinal belongs to the real current native display body'); }
    for (const other of ['vertices', 'edges', 'faces', 'bodies']) if (other !== kind) assert.equal(selected[other]?.length ?? 0, 0);
    attempt.status = 'PASS'; attempt.selected = selected; await f.persist();
    observations.push({ kind, point, at, selected });
  }
  return observations;
}
function coverage(visible, hidden, roi) {
  assert.equal(visible.width, hidden.width); assert.equal(visible.height, hidden.height);
  let changed = 0, total = 0;
  const box = { left: Math.max(0, Math.floor(roi.left)), top: Math.max(0, Math.floor(roi.top)), right: Math.min(visible.width, Math.ceil(roi.right)), bottom: Math.min(visible.height, Math.ceil(roi.bottom)) };
  for (let y = box.top; y < box.bottom; y++) for (let x = box.left; x < box.right; x++) {
    const at = 4 * (y * visible.width + x);
    const delta = Math.max(Math.abs(visible.data[at] - hidden.data[at]), Math.abs(visible.data[at + 1] - hidden.data[at + 1]), Math.abs(visible.data[at + 2] - hidden.data[at + 2]));
    if (delta > 20) changed++; total++;
  }
  return { box, changed, total, fraction: changed / total, rgbThreshold: 20 };
}
async function profile(label, tiny, ortho, view = 'top') {
  f.phase = `${label} public framing and image baseline`;
  await frame(ortho, view); await clear();
  const doc = await f.doc(), body = await f.bodies();
  const centre = tiny ? [0, 0, 0] : [32, 16, 4], r = .001;
  const boundary = tiny ? [[-r, 0, 0], [r, 0, 0], [0, -r, 0], [0, r, 0]] : [[0, 16, 4], [64, 16, 4], [32, 0, 4], [32, 32, 4]];
  const before = await camera([centre, ...boundary]); assert.equal(before.backend, backend);
  const beforeControls = await controls(true), beforeNative = await nativeMesh();
  assert.equal(beforeNative.positionsType, 'Float64Array'); assert.equal(beforeNative.edgeLinesType, 'Float64Array');
  if (tiny) { assert.ok(beforeControls.sceneRadius > 28 && beforeControls.sceneRadius < 29, 'Default public scene remains wide; bounded ground is retained'); assert.deepEqual(beforeControls.environment.ambientOcclusion, { radius: 1, strength: .9 }); }
  let perspectiveCompatibility = null;
  if (tiny && !ortho) {
    assert.deepEqual(pose(before), pose(perspectiveReference.before));
    for (const field of ['near', 'far', 'projectionMatrix']) assert.deepEqual(before.viewer[field], perspectiveReference.before.viewer[field]);
    assert.equal(body.bodies[0].volume, perspectiveReference.body.bodies[0].volume); assert.deepEqual(body.bodies[0].centroid, perspectiveReference.body.bodies[0].centroid);
    perspectiveCompatibility = { reference: perspectiveReferenceFile, poseExact: true, rasterClipExact: true, projectionExact: true, volumeCentroidExact: true };
  }
  if (before.viewer) assert.equal(before.viewer.projection, ortho ? 'orthographic' : 'perspective');
  const width = Math.abs(before.points[2].page[0] - before.points[1].page[0]);
  const height = Math.abs(before.points[4].page[1] - before.points[3].page[1]);
  assert.ok(width > 100 && height > 100, 'Actual projected body span exceeds 100 CSS units on both axes');
  const canvas = f.page.locator('canvas.vp-canvas'), canvasBox = await canvas.boundingBox();
  const visibleFile = join(f.output, `${label}-visible.png`);
  const visible = PNG.sync.read(await canvas.screenshot({ path: visibleFile }));
  await writeFile(join(f.output, `${label}-before.json`), JSON.stringify({ doc, body, before, beforeControls, beforeNative, projected: { width, height } }, null, 2));
  const imageRoi = { left: Math.round(before.points[0].page[0] - canvasBox.x + imageBudget.roiStart), right: Math.round(before.points[0].page[0] - canvasBox.x + imageBudget.roiEnd), top: Math.round(before.points[0].page[1] - canvasBox.y + imageBudget.roiStart), bottom: Math.round(before.points[0].page[1] - canvasBox.y + imageBudget.roiEnd) };
  assert.ok(imageRoi.left > 0 && imageRoi.top > 0 && imageRoi.right < visible.width - 1 && imageRoi.bottom < visible.height - 1);
  const imageMetrics = secondDifferences(visible, imageRoi), imageRequired = tiny && ortho && view === 'top';
  f.report.imageAssessments.push({ label, required: imageRequired, imageBudget, imageMetrics }); await f.persist();
  await writeFile(join(f.output, `${label}-image-metrics.json`), JSON.stringify({ imageBudget, imageMetrics, required: imageRequired }, null, 2));
  await writeFile(join(f.output, `${label}-visible.rgba`), visible.data);
  if (imageRequired) { assert.ok(imageMetrics.mean < imageBudget.mean, 'Fixture Top ortho AO-on luma mean stays below1.0'); assert.ok(imageMetrics.fractionAbove < imageBudget.fractionAbove, 'Fixture Top ortho AO-on high-frequency fraction stays below.02'); }
  const points = [];
  if (tiny) for (const x of [-.0003, .0001, .0003]) for (const y of [-.0003, .0001, .0003]) points.push([x, y, Math.sqrt(r * r - x * x - y * y)]);
  else points.push([55, 5, 8]);
  f.phase = `${label} real pointer face and body picks`;
  const selected = await picks(points);
  assert.equal(selected.length, tiny ? 18 : 2);
  await f.same(doc);
  f.phase = `${label} same-pose public visibility contrast`;
  const visibleControl = f.page.getByRole('checkbox', { name: 'Visible', exact: true });
  assert.equal(await visibleControl.isChecked(), true);
  // Hiding clears selection and removes this control; observe the accepted document after the real click.
  await visibleControl.click();
  await f.changed(doc);
  const hiddenDoc = await f.doc(), overrides = Object.values(hiddenDoc.bodies ?? {});
  assert.equal(overrides.length, 1); assert.deepEqual(overrides[0], { hidden: true });
  assert.deepEqual(hiddenDoc.nodes, doc.nodes, 'Visibility action preserves all geometry nodes');
  await f.page.waitForFunction(() => {
    const s = window.__studioSelection?.selection;
    return s && ['vertices', 'edges', 'faces', 'bodies'].every(k => !s[k]?.length);
  });
  await settle();
  const hiddenCamera = await camera([centre, ...boundary]), hiddenControls = await controls(false);
  assert.deepEqual(await nativeMesh(), beforeNative, 'Hiding preserves canonical native worker arrays');
  assert.deepEqual(pose(hiddenCamera), pose(before), 'Hiding a body preserves pose/FOV/projection; raster clips may change');
  const hiddenFile = join(f.output, `${label}-hidden.png`);
  const hidden = PNG.sync.read(await canvas.screenshot({ path: hiddenFile }));
  const center = before.points[0].page;
  const roi = { left: center[0] - canvasBox.x - width * .35, right: center[0] - canvasBox.x + width * .35,
    top: center[1] - canvasBox.y - height * .35, bottom: center[1] - canvasBox.y + height * .35 };
  const pixels = coverage(visible, hidden, roi);
  assert.ok(pixels.changed > 5000 && pixels.fraction > .1, 'Visible body/shadow changes a substantial bounded image area');
  await f.undo(); await f.same(doc); await clear();
  const restored = await camera([centre, ...boundary]); assert.deepEqual(pose(restored), pose(before));
  const restoredControls = await controls(true); assert.deepEqual(restoredControls, beforeControls, 'Restoration returns the same actual helpers/effects/public scene and clip state');
  assert.deepEqual(await nativeMesh(), beforeNative, 'Undo preserves canonical native worker arrays');
  await canvas.screenshot({ path: join(f.output, `${label}-restored.png`) });
  const observation = { label, tiny, ortho, view, backend, beforeControls, hiddenControls, restoredControls, nativeSourceHash: sha256(JSON.stringify(beforeNative)), imageRequired, imageMetrics, imageBudget, perspectiveCompatibility, units: { length: 'mm', image: 'pixel', page: 'CSS pixel' }, fixtureSha256: tiny ? centered.sha256 : null,
    projected: { width, height }, before, hiddenCamera, restored, pixels, pointerPicks: selected, body, documentRestoredExactly: true };
  f.report.observations.push(observation);
  await writeFile(join(f.output, `${label}-camera.json`), JSON.stringify(observation, null, 2));
  await f.snapshot(label);
}
await f.run(async () => {
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async (...args) => {
    const context = await newContext(...args); context.on('response', captureModule);
    await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await context.route('https://fonts.gstatic.com/**', route => route.fulfill({ status: 204, body: '' }));
    await context.addInitScript(() => {
      const RealWorker = window.Worker;
      window.__smallCameraMeshes = [];
      window.Worker = class extends RealWorker {
        constructor(...args) {
          super(...args);
          const faces = new Map();
          this.addEventListener('message', ({ data }) => {
            for (const body of data?.result?.bodies ?? []) {
              if (body.mesh) faces.set(body.meshToken, { faces: structuredClone(body.mesh.faces), native: { positionsType: body.mesh.positions.constructor.name, positions: Array.from(body.mesh.positions), normals: Array.from(body.mesh.normals), indices: Array.from(body.mesh.indices), edgeLinesType: body.mesh.edgeLines.constructor.name, edgeLines: Array.from(body.mesh.edgeLines), bounds: structuredClone(body.mesh.bounds), faceMetadata: structuredClone(body.mesh.faces), edgeMetadata: structuredClone(body.mesh.edges) } });
              const actual = faces.get(body.meshToken ?? body.meshRef);
              if (actual) window.__smallCameraMeshes.push({ key: body.key, ...actual });
            }
          });
        }
      };
    });
    return context;
  };
  try {
    for (const view of ['top', 'iso']) { await f.newPage(); await profile(`ordinary-${view}-orthographic`, false, true, view); }
    for (const ortho of [false, true]) {
      await f.newPage(); f.phase = 'Open original centered STEP';
      await f.page.setInputFiles('input[aria-label="Model file"]', fixture);
      await f.page.waitForFunction(step => window.__studioDoc?.nodes?.[0]?.step === step, step, { timeout: 60000 });
      await f.ready(); assert.equal((await f.doc()).nodes[0].step, step);
      await profile(ortho ? 'tiny-top-orthographic' : 'tiny-perspective', true, ortho);
    }

    await flushModules();
    for (const source of ['packages/barocss-gpu/src/viewer/viewer.ts', 'packages/barocss-gpu/src/viewer/orthographic-depth-internal.ts']) assert.ok(moduleResponses.some(r => r.source === source && r.status === 200 && r.sha256 && !r.bodyFailure), `Actual direct module body required: ${source}`);
  } finally { await flushModules(); }
});
