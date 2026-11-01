// D427: centered tiny-body framing, real pointer picks and bounded image coverage.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

assert.ok(process.argv[2] && process.argv[3] && process.env.PW_DIR, 'Output, original fixture folder and Playwright required');
const input = resolve(process.argv[3]), backend = process.env.SMALL_CAMERA_RENDERER ?? 'webgpu';
assert.ok(['webgpu', 'webgl2'].includes(backend));
const manifest = JSON.parse(await readFile(join(input, 'cases.json'), 'utf8'));
const centered = manifest.cases.find(c => c.name === 'compound-centered');
assert.ok(centered); assert.deepEqual(centered.center, [0, 0, 0]); assert.equal(centered.radius, .001);
const fixture = join(input, centered.file), step = await readFile(fixture, 'utf8');
assert.equal(sha256(step), centered.sha256);
const { PNG } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright-core/lib/utilsBundle');
const f = await createFlow({
  name: 'small-camera-scale', envFrozen: 'SMALL_CAMERA_SOURCE_FROZEN', output: process.argv[2], qualification: 'D427_CENTERED_TINY_CAMERA_SCALE',
  inspectorSource: "export { OrbitCamera } from './src/viewport/camera'; export { evaluatePart } from '@barocss/cad-model/engine/evaluate';",
  initialFiles: ['apps/cad-studio/test/small-camera-scale-browser.mjs', join(input, 'cases.json'), fixture],
  requiredFrozen: ['apps/cad-studio/src/viewport/camera.ts', 'apps/cad-studio/src/viewport/Viewport.tsx', 'apps/cad-studio/src/viewport/gpuRenderer.ts'],
  limits: ['Original centered radius-.001mm sphere and ordinary Bracket only. Far-coordinate GPU display/picking remains D428.', 'RGB differences include body/shadow effects and are a finite fixture visibility policy, not a universal photometry oracle.', 'Live Viewer near/far are GPU raster clip planes; they are distinct from OrbitCamera near/far and may change while the body is hidden.', 'Real pointer input supplies all face/body picks. No selection setter, new public hook, download or dependency.', 'No historical actual camera pose baseline exists for D426; ordinary compatibility is current visibility/picking plus separate legacy-math unit checks.'],
});
f.report.pointerAttempts = [];
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
function pose(sample) {
  const v = sample.viewer;
  return { eye: sample.eye, points: sample.points, viewer: v && { position: v.position, target: v.target, distance: v.distance, projection: v.projection, fovY: v.fovY } };
}
async function frame(ortho) {
  await f.page.locator('.views').getByRole('button', { name: 'Top', exact: true }).click();
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
async function profile(label, tiny, ortho) {
  f.phase = `${label} public framing and image baseline`;
  await frame(ortho); await clear();
  const doc = await f.doc(), body = await f.bodies();
  const centre = tiny ? [0, 0, 0] : [32, 16, 4], r = .001;
  const boundary = tiny ? [[-r, 0, 0], [r, 0, 0], [0, -r, 0], [0, r, 0]] : [[0, 16, 4], [64, 16, 4], [32, 0, 4], [32, 32, 4]];
  const before = await camera([centre, ...boundary]); assert.equal(before.backend, backend);
  if (before.viewer) assert.equal(before.viewer.projection, ortho ? 'orthographic' : 'perspective');
  const width = Math.abs(before.points[2].page[0] - before.points[1].page[0]);
  const height = Math.abs(before.points[4].page[1] - before.points[3].page[1]);
  assert.ok(width > 100 && height > 100, 'Actual projected body span exceeds 100 CSS units on both axes');
  const canvas = f.page.locator('canvas.vp-canvas'), canvasBox = await canvas.boundingBox();
  const visibleFile = join(f.output, `${label}-visible.png`);
  const visible = PNG.sync.read(await canvas.screenshot({ path: visibleFile }));
  await writeFile(join(f.output, `${label}-before.json`), JSON.stringify({ doc, body, before, projected: { width, height } }, null, 2));
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
  const hiddenCamera = await camera([centre, ...boundary]);
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
  await canvas.screenshot({ path: join(f.output, `${label}-restored.png`) });
  const observation = { label, tiny, ortho, backend, units: { length: 'mm', image: 'pixel', page: 'CSS pixel' }, fixtureSha256: tiny ? centered.sha256 : null,
    projected: { width, height }, before, hiddenCamera, restored, pixels, pointerPicks: selected, body, documentRestoredExactly: true };
  f.report.observations.push(observation);
  await writeFile(join(f.output, `${label}-camera.json`), JSON.stringify(observation, null, 2));
  await f.snapshot(label);
}
await f.run(async () => {
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async (...args) => {
    const context = await newContext(...args);
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
              if (body.mesh) faces.set(body.meshToken, structuredClone(body.mesh.faces));
              const actual = faces.get(body.meshToken ?? body.meshRef);
              if (actual) window.__smallCameraMeshes.push({ key: body.key, faces: actual });
            }
          });
        }
      };
    });
    return context;
  };
  if (backend === 'webgl2') f.newPage = async () => {
    if (f.context) { await f.context.close(); f.report.cleanup.push('CONTEXT_CLOSED'); }
    f.context = await f.browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const page = f.page = await f.context.newPage();
    page.on('pageerror', e => f.report.errors.push(e.stack ?? String(e)));
    page.on('console', m => { if (m.type() === 'error') f.report.consoleErrors.push(m.text()); });
    page.on('download', d => f.report.downloads.push({ phase: f.phase, suggestedFilename: d.suggestedFilename() }));
    page.on('dialog', d => d.accept());
    await page.goto(`${f.server.resolvedUrls.local[0]}?renderer=webgl2`);
    await page.waitForSelector('.viewport[data-renderer="webgl2"]', { timeout: 30000 }); await f.ready();
  };
  await f.newPage(); await profile('ordinary-bracket', false, false);
  for (const ortho of [false, true]) {
    await f.newPage(); f.phase = 'Open original centered STEP';
    await f.page.setInputFiles('input[aria-label="Model file"]', fixture);
    await f.page.waitForFunction(step => window.__studioDoc?.nodes?.[0]?.step === step, step, { timeout: 60000 });
    await f.ready(); assert.equal((await f.doc()).nodes[0].step, step);
    await profile(ortho ? 'tiny-orthographic' : 'tiny-perspective', true, ortho);
  }
});
