// D426: real native display mesh transport precision. GPU world-coordinate rendering is not qualified.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

assert.ok(process.argv[2] && process.argv[3], 'Output and original fixture folders required');
const input = resolve(process.argv[3]);
const manifest = JSON.parse(await readFile(join(input, 'cases.json'), 'utf8'));
assert.deepEqual(manifest.cases.map(c => c.name), ['compound-far', 'compound-centered']);
const cases = await Promise.all(manifest.cases.map(async c => ({ ...c, step: await readFile(join(input, c.file), 'utf8') })));
for (const c of cases) assert.equal(sha256(c.step), c.sha256);
const backend = process.env.NATIVE_MESH_RENDERER ?? 'webgpu';
assert.ok(['webgpu', 'webgl2'].includes(backend));
const f = await createFlow({
  name: 'native-mesh-precision', envFrozen: 'NATIVE_MESH_PRECISION_SOURCE_FROZEN', output: process.argv[2],
  qualification: 'D426_NATIVE_WORLD_MESH_PRECISION',
  inspectorSource: "export { evaluatePart } from '@barocss/cad-model/engine/evaluate';",
  initialFiles: ['apps/cad-studio/test/native-mesh-precision-browser.mjs', join(input, 'cases.json'), ...cases.map(c => join(input, c.file))],
  requiredFrozen: ['packages/barocss-cad-model/src/engine/mesh.ts', 'packages/barocss-cad-model/src/engine/evaluate.ts', 'apps/cad-studio/src/viewport/renderer.ts', 'apps/cad-studio/src/viewport/gpuRenderer.ts'],
  snapshotExtra: () => ({ quantityTraffic: window.__quantityTraffic, actualBackend: document.querySelector('.viewport')?.getAttribute('data-renderer') }),
  limits: ['Original two STEP fixtures and ordinary Bracket only; no general native mesh qualification.', 'World CPU mesh coordinates and transport are checked. Far-world GPU visibility, pixel precision and picking remain D427 scope.', 'WebGL mode checks only ordinary Bracket compatibility; GPU attributes remain Float32 by explicit upload conversion.', 'No Save/export/download, schema or dependency change.'],
});
async function row(label) {
  return f.page.locator('aside[aria-label="Selection"] .kv').filter({ hasText: new RegExp(`^${label}`) }).first().locator('b').first().innerText();
}
async function inspect(label, tiny) {
  const doc = await f.doc(), adopted = await f.bodies();
  const summary = { mass: await row('Mass'), bounds: await row('Bounds') };
  await f.page.locator('.ol-row:not(.stale) > button.ol').first().click();
  const text = { volume: await row('Volume'), mass: await row('Mass'), area: await row('Surface area'), bounds: await row('Bounds') };
  const traffic = await f.page.evaluate(() => window.__quantityTraffic);
  const result = traffic.findLast(e => e.ok && e.bodies?.length === 1 && e.bodies[0].volume === adopted.bodies[0].volume);
  assert.ok(result, 'Real worker fields match the adopted volume');
  const raw = result.bodies[0], bounds = raw.bounds;
  const geometry = meshStatistics(raw);
  assert.equal(raw.positionsType, 'Float64Array', 'Real native world positions retain doubles');
  assert.equal(raw.edgeLinesType, 'Float64Array', 'Real native world edge lines retain doubles');
  assert.ok(raw.positions.every(Number.isFinite), 'Every real world position is finite');
  assert.ok(geometry.unique > 1 && geometry.nondegenerate > 0 && geometry.degenerate === 0);
  assert.equal(await f.page.locator('.viewport').getAttribute('data-renderer'), backend);
  assert.ok(bounds?.min?.length === 3 && bounds.max?.length === 3, 'Real display mesh bounds captured');
  const extents = bounds.max.map((value, i) => value - bounds.min[i]);
  const shownBounds = text.bounds.split(' × ');
  for (const [i, value] of extents.entries()) {
    assert.equal(Number(shownBounds[i]) === 0, value === 0, 'Never manufacture nonzero mesh bounds');
  }
  if (tiny) {
    assert.ok(geometry.vertices > 100 && geometry.unique > 100 && geometry.nondegenerate > 100);
    assert.equal(text.volume, '4.19e-9 mm³'); assert.equal(text.mass, '1.13e-11 g');
    assert.equal(text.area, '1.26e-5 mm²'); assert.equal(summary.mass, '1.13e-11 g');
    assert.ok(Math.abs(raw.volume / (4 * Math.PI * .001 ** 3 / 3) - 1) < 1e-6);
    assert.deepEqual(adopted.bodies[0].centroid, raw.centroid);
    assert.ok(extents.every(value => value > .0019 && value < .00201), 'World extents remain radius-.001 sphere-sized');
    for (const [i, span] of geometry.spans.entries()) assert.equal(span, extents[i], 'Bounds are from the actual transported positions');
  } else {
    for (const value of [text.volume, text.mass, text.area]) assert.ok(!value.includes('e-') && Number.parseFloat(value) > 0, 'Ordinary Bracket retains ordinary nonzero text');
  }
  await f.same(doc);
  const observation = { label, tiny, text, summary, raw, adopted, geometry, backend, extents, collapsedDisplayBounds: extents.some(value => value === 0), docUnchanged: true };
  f.report.observations.push(observation);
  await writeFile(join(f.output, `${label}-display.json`), JSON.stringify(observation, null, 2));
  await f.snapshot(label);
}
function meshStatistics(raw) {
  const p = raw.positions, indices = raw.indices, unique = new Set();
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < p.length; v += 3) {
    unique.add(`${p[v]},${p[v + 1]},${p[v + 2]}`);
    for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[v + k]); max[k] = Math.max(max[k], p[v + k]); }
  }
  let nondegenerate = 0, degenerate = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    if (Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) > 0) nondegenerate++;
    else degenerate++;
  }
  return { vertices: p.length / 3, unique: unique.size, nondegenerate, degenerate, min, max, spans: max.map((v, k) => v - min[k]) };
}

await f.run(async () => {
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async (...args) => {
    const context = await newContext(...args);
    await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await context.route('https://fonts.gstatic.com/**', route => route.fulfill({ status: 204, body: '' }));
    await context.addInitScript(() => {
      const RealWorker = window.Worker;
      window.__quantityTraffic = [];
      window.Worker = class extends RealWorker {
        constructor(...args) {
          super(...args);
          const meshes = new Map();
          this.addEventListener('message', ({ data }) => {
            if (data?.result) window.__quantityTraffic.push({ id: data.id, ok: data.result.ok, error: structuredClone(data.result.error), bodies: data.result.bodies?.map(b => {
              if (b.mesh) meshes.set(b.meshToken, { bounds: structuredClone(b.mesh.bounds), positionsType: b.mesh.positions.constructor.name, edgeLinesType: b.mesh.edgeLines.constructor.name, positions: Array.from(b.mesh.positions), edgeLines: Array.from(b.mesh.edgeLines), indices: Array.from(b.mesh.indices) });
              return { key: b.key, volume: b.volume, mass: b.mass, area: b.area, centroid: structuredClone(b.centroid), massRef: b.massRef, ...structuredClone(meshes.get(b.meshToken ?? b.meshRef)) };
            }) });
            if (data?.masses) for (const patch of data.masses) for (const event of window.__quantityTraffic) for (const b of event.bodies ?? []) {
              if (b.massRef === patch.ref) Object.assign(b, structuredClone(patch.fields));
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
    await page.waitForSelector('.viewport[data-renderer="webgl2"]', { timeout: 30000 });
    await f.ready();
  };
  await f.newPage(); f.phase = 'ordinary Bracket display'; await inspect('ordinary-bracket', false);
  for (const c of backend === 'webgpu' ? cases : []) {
    await f.newPage(); f.phase = `Open ${c.name} display`;
    await f.page.setInputFiles('input[aria-label="Model file"]', resolve(input, c.file));
    await f.page.waitForFunction(step => window.__studioDoc?.nodes?.[0]?.step === step, c.step, { timeout: 60000 });
    await f.ready();
    assert.equal((await f.doc()).nodes[0].step, c.step);
    const notice = await f.waitToast(/STEP opened/);
    assert.match(notice, /4.19e-9 mm³ in all/);
    f.report.reads.push({ label: c.name, inputSha256: c.sha256, notice });
    await inspect(c.name, true);
  }
  assert.equal(f.report.downloads.length, 0);
});
