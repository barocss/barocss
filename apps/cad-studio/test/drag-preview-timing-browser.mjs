// DRAG_TIMING_SLOW=1 uses the real 48-hole >120ms fixture; one clean drag, screenshots after timing only.
// Roadmap 20 (1) and (3): while a dimension handle is dragged, how long one preview takes (the rolled part up to the dragged feature, and the whole part) and how often the screen updates.
// No Apply (each drag is cancelled with Escape and the document must be unchanged). Run 01 measured the old behaviour (every drag preview rolled back to the box: 6 faces, ~1 ms; the whole part ~20 ms).
// Since D377 a whole part under ROLL_AFTER_MS (120 ms) is shown all through the drag: asserted here as no drag preview reply of the box alone (6 faces) while the whole part is quick.
// Fixture apps/cad-studio/test/fixtures/drag-preview-timing.bcad: a 60 x 40 x 20 box (made by Box, so it offers w / d / h arrows), two holes R5 and two top-edge fillets R3 after it.
// The box's width arrow (g.gizmo-handle[data-handle="w"]) is dragged with REAL pointer events (page.mouse down / 2 px moves every 16 ms / hold / up).
// Instrumentation (an init script, observation only): Worker.prototype.postMessage and the onmessage setter are wrapped to time each request to its reply (type, id, node count of the sent document);
// requestAnimationFrame records frame times. Drag 1 has no screenshots (clean timing); drag 2 takes screenshots while moving and while held (the rolled preview and the whole part after the pause).
// Root must freeze all sources first. Run from apps/cad-studio:
//   DRAG_TIMING_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/drag-preview-timing-browser.mjs /absolute/artifacts
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { arch, cpus, loadavg, release } from 'node:os';
import { createFlow } from './flow-helper.mjs';

const slow = process.env.DRAG_TIMING_SLOW === '1';
const measured = process.env.D774_MEASURE === '1';
assert.ok(!slow || !measured, 'D774 uses the fixed ordinary drag fixture');
const fixtureName = slow ? 'drag-preview-slow.bcad' : 'drag-preview-timing.bcad';
const fixture = join(import.meta.dirname, 'fixtures', fixtureName);
const fixtureDoc = JSON.parse(await readFile(fixture, 'utf8'));
const f = await createFlow({ name: 'drag-timing', envFrozen: 'DRAG_TIMING_SOURCE_FROZEN', output: process.argv[2], qualification: measured ? 'B10-05 fixed Studio drag cadence, worker latency and retained geometry' :
    slow ? 'D403_SLOW_DRAG_TIMING_MEASUREMENT' : 'DRAG_PREVIEW_TIMING_MEASUREMENT',
  limits: ['Measurement only: headless Chrome frame times are not a display vsync; worker round trips include structured clone and the product mesh build, not GPU upload.',
    'Request/reply pairs come from wrapping Worker.prototype (observation only); the node count is that of the sent document when it is readable.', 'One desktop device. Retained Core geometry counts are not VRAM measurements.'],
  initialFiles: ['apps/cad-studio/test/drag-preview-timing-browser.mjs', 'apps/cad-studio/test/flow-helper.mjs', `apps/cad-studio/test/fixtures/${fixtureName}`, 'apps/cad-studio/src/state/useCommandPreview.ts', 'apps/cad-studio/src/viewport/useCommandGizmos.ts', 'apps/cad-studio/src/engine/client.ts'],
  requiredFrozen: ['apps/cad-studio/src/state/useCommandPreview.ts'] });

/** Init script: time worker requests and replies, and record animation frames while `__dragFrames(true)`. */
function instrument(measured) {
  const log = window.__dragLog = { sends: [], replies: [], frames: [], ui: [], pointer: [], recording: false };
  let widthInput = null;
  const post = Worker.prototype.postMessage;
  Worker.prototype.postMessage = function (message, ...rest) {
    if (message && typeof message === 'object' && 'type' in message) log.sends.push({ t: performance.now(), id: message.id ?? null, type: message.type, nodes: Array.isArray(message.doc?.nodes) ? message.doc.nodes.length : null });
    return post.call(this, message, ...rest);
  };
  const handler = Object.getOwnPropertyDescriptor(Worker.prototype, 'onmessage');
  Object.defineProperty(Worker.prototype, 'onmessage', { configurable: true, enumerable: true, get() { return handler.get.call(this); },
    set(fn) { handler.set.call(this, typeof fn === 'function' ? function (event) { const d = event.data; if (d && typeof d.id === 'number' && !d.progress) log.replies.push({ t: performance.now(), id: d.id, ok: d.result ? d.result.ok ?? null : null, bodies: Array.isArray(d.result?.bodies) ? d.result.bodies.length : null, faces: d.result?.bodies?.[0]?.mesh?.faces?.length ?? null, meshRef: d.result?.bodies?.[0]?.meshRef ?? null, wall: d.result?.wallTime ?? null }); return fn.call(this, event); } : fn); } });
  const tick = t => {
    if (log.recording) {
      if (!widthInput?.isConnected) widthInput = document.querySelector('.hud .field input');
      log.frames.push(t);
      log.ui.push({ t, width: widthInput?.value ?? null, geometries: measured ? window.__studioViewer?.geometries?.size ?? null : null });
    }
    requestAnimationFrame(tick);
  };
  window.addEventListener('pointermove', event => { if (log.recording && event.buttons === 1) log.pointer.push({ t: performance.now(), x: event.clientX, y: event.clientY }); }, true);
  requestAnimationFrame(tick);
  window.__dragFrames = on => { log.recording = on; if (on) { log.frames = []; log.ui = []; log.pointer = []; const field = [...document.querySelectorAll('.hud .field')].find(x => [...x.querySelectorAll('span')].some(s => /^(W|Width(?: X)?)$/.test(s.textContent.trim()))); widthInput = field?.querySelector('input') ?? null; } };
}

const sleep = ms => new Promise(done => setTimeout(done, ms));
const handleAt = () => f.page.evaluate(() => {
  const g = document.querySelector('g.gizmo-handle[data-handle="w"]'), c = g?.querySelector('circle'), p = g?.querySelector('polygon');
  const mid = e => { if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  return { root: mid(c), head: mid(p) };
});
const hudWidth = () => f.page.evaluate(() => { const fld = [...document.querySelectorAll('.hud .field')].find(x => [...x.querySelectorAll('span')].some(s => /^(W|Width(?: X)?)$/.test(s.textContent.trim()))); return fld?.querySelector('input')?.value ?? null; });
const status = () => f.page.evaluate(() => document.querySelector('.hud .status')?.textContent?.trim() ?? null);

const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const pct = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const round = v => v === null ? null : Math.round(v * 10) / 10;

/** One drag of the width arrow: `moves` moves of 2 px every 16 ms, a hold of `holdMs`, release; `shots` are taken at the listed move numbers and during the hold. Returns the timing summary. */
async function drag(label, { moves = 70, holdMs = 900, shots = [] }) {
  f.phase = `drag ${label}`;
  await f.page.locator('g.gizmo-handle[data-handle="w"]').waitFor({ timeout: 30000 });
  const { root, head } = await handleAt(); assert.ok(root && head, 'width arrow drawn');
  const len = Math.hypot(head[0] - root[0], head[1] - root[1]), u = [(head[0] - root[0]) / len, (head[1] - root[1]) / len];
  await f.page.evaluate(() => { window.__dragLog.sends = []; window.__dragLog.replies = []; window.__dragFrames(true); });
  const t0 = await f.page.evaluate(() => performance.now()), samples = [];
  await f.page.mouse.move(head[0], head[1]); await f.page.mouse.down();
  for (let i = 1; i <= moves; i++) {
    const s0 = Date.now(), at = [head[0] + u[0] * 2 * i, head[1] + u[1] * 2 * i];
    await f.page.mouse.move(at[0], at[1]);
    if (!measured) samples.push({ i, t: await f.page.evaluate(() => performance.now()), width: await hudWidth(), status: await status() });
    if (shots.includes(i)) await f.snapshot(`${label}-moving-${i}`);
    const wait = 16 - (Date.now() - s0); if (wait > 0) await sleep(wait);
  }
  const moveEnd = await f.page.evaluate(() => performance.now());
  if (shots.length) { await sleep(60); await f.snapshot(`${label}-held-60ms`); }
  await sleep(holdMs);
  if (shots.length) await f.snapshot(`${label}-held-${holdMs}ms`);
  await f.page.mouse.up(); await sleep(400);
  const log = await f.page.evaluate(() => { window.__dragFrames(false); return JSON.parse(JSON.stringify(window.__dragLog)); });
  if (shots.length) await f.snapshot(`${label}-released`);
  const previews = log.sends.filter(s => s.type === 'preview').map(s => { const r = log.replies.find(x => x.id === s.id); return { ...s, t: round(s.t - t0), ms: r ? round(r.t - s.t) : null, ok: r?.ok ?? null, bodies: r?.bodies ?? null, faces: r?.faces ?? null, meshRef: r?.meshRef ?? null, wall: r?.wall ?? null, workerWallMs: r?.wall == null ? null : round(r.wall * 1000) }; });
  const during = log.frames.filter(t => t <= moveEnd), gaps = during.slice(1).map((t, i) => t - during[i]);
  // (The sent document is packed, so its node count is not readable: a reply of the box alone has its 6 faces, the whole part more.)
  const boxOnly = p => p.faces === 6, whole = p => p.faces !== null && p.faces > 6;
  const rolled = previews.filter(p => boxOnly(p) && p.ms !== null).map(p => p.ms), full = previews.filter(p => whole(p) && p.ms !== null).map(p => p.ms);
  const widthChanges = log.ui.filter((sample, i) => sample.t <= moveEnd && (i === 0 || sample.width !== log.ui[i - 1].width));
  const uiGaps = widthChanges.slice(1).map((sample, i) => sample.t - widthChanges[i].t), pointerGaps = log.pointer.slice(1).map((sample, i) => sample.t - log.pointer[i].t);
  const duringUI = log.ui.filter(sample => sample.t <= moveEnd);
  const widths = (measured ? duringUI : samples).map(sample => sample.width);
  const geometrySamples = duringUI.map(sample => sample.geometries).filter(Number.isInteger);
  const summary = { label, moves, holdMs, pointerMovesSent: moves, previewRequests: previews.length, rolledRequests: previews.filter(boxOnly).length, fullRequests: previews.filter(whole).length, unknownFaces: previews.filter(p => p.faces === null).length,
    rolledMs: { median: round(median(rolled)), p90: round(pct(rolled, 0.9)), max: round(rolled.length ? Math.max(...rolled) : null) }, fullMs: { median: round(median(full)), p90: round(pct(full, 0.9)), max: round(full.length ? Math.max(...full) : null) },
    frameGapMs: { count: gaps.length, median: round(median(gaps)), p90: round(pct(gaps, 0.9)), max: round(gaps.length ? Math.max(...gaps) : null), over50: gaps.filter(g => g > 50).length },
    pointerDelivered: log.pointer.length, pointerGapMs: { median: round(median(pointerGaps)), p90: round(pct(pointerGaps, .9)), max: round(pointerGaps.length ? Math.max(...pointerGaps) : null) },
    widthUpdateGapMs: { count: widthChanges.length, median: round(median(uiGaps)), p90: round(pct(uiGaps, .9)), max: round(uiGaps.length ? Math.max(...uiGaps) : null) },
    fullWorkerWallMs: full.length ? previews.filter(p => whole(p) && p.workerWallMs !== null).map(p => p.workerWallMs) : [],
    geometryCount: geometrySamples.length ? { samples: geometrySamples.length, min: Math.min(...geometrySamples),
      median: median(geometrySamples), max: Math.max(...geometrySamples) } : null,
    widthShown: { first: widths[0], last: widths.at(-1), distinct: new Set(widths).size } };
  f.report.observations.push({ label, summary, previews, samples });
  await writeFile(join(f.output, `${label}-timing.json`), JSON.stringify({ summary, previews, samples, frames: log.frames.map(t => round(t - t0)), ui: log.ui.map(sample => ({ ...sample, t: round(sample.t - t0) })), pointer: log.pointer.map(sample => ({ ...sample, t: round(sample.t - t0) })) }, null, 2)); await f.persist();
  return summary;
}

await f.run(async () => {
  f.phase = 'load';
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return url.origin === origin ? route.continue() : route.abort();
    });
    return context;
  };
  await f.newPage();
  await f.context.addInitScript(instrument, measured); await f.page.reload(); await f.page.waitForSelector('.viewport[data-renderer="webgpu"]', { timeout: 30000 }); await f.ready();
  assert.equal(await f.page.evaluate(() => typeof window.__dragFrames), 'function', 'instrumentation installed');
  f.report.load = loadavg();
  if (measured) {
    const browser = await f.page.evaluate(() => {
      const viewer = window.__studioViewer, info = viewer?.device?.adapterInfo;
      const adapter = info ? { vendor: info.vendor, architecture: info.architecture, device: info.device, description: info.description } : null;
      return { adapter, userAgent: navigator.userAgent, pixels: [viewer.canvas.width, viewer.canvas.height], dpr: devicePixelRatio };
    });
    assert.ok(browser.adapter?.vendor, 'Identify the actual Studio device');
    f.report.host = { ...browser, cpu: cpus()[0].model, cpuCount: cpus().length, arch: arch(), osRelease: release() };
  }
  await f.openFile(fixture, fixtureDoc.nodes.length);
  const original = await f.doc(), idle = slow ? { bodies: await f.bodies() } : await f.snapshot('01-opened');
  assert.equal(idle.bodies.bodies.length, 1, 'one body');
  const trials = measured ? [[0, 'warmup'], [1, 'sample-1'], [2, 'sample-2'], [3, 'sample-3']] :
    slow ? [[1, 'slow-drag']] : [[1, 'drag1'], [2, 'drag2']];
  for (const [k, label] of trials) {
    await f.openFeatureEditor(1, 'box');
    f.report.initialWorkerReads = await f.page.evaluate(() => JSON.parse(JSON.stringify(window.__dragLog)));
    const result = await drag(label, measured ? { moves: 36 } : slow ? { holdMs: 1800 } : k === 1 ? {} : { shots: [20, 50] });
    f.report.reads.push(result);
    // Quick mode keeps D377's whole-part contract; slow mode measures the existing roll behavior.
    if (measured) {
      assert.ok(result.pointerDelivered >= 30 && result.frameGapMs.count >= 10);
      assert.ok(result.fullMs.median !== null && result.widthShown.distinct > 1);
      assert.ok(result.geometryCount?.samples >= 10);
      if (k > 0) await f.snapshot(label + '-released');
    } else if (slow) {
      assert.ok(result.fullWorkerWallMs.some(ms => ms > 120), `actual changed whole preview must exceed 120ms: ${JSON.stringify(result.fullWorkerWallMs)}`);
      assert.ok(result.rolledRequests > 0, 'the existing slow path shows rolled geometry while dragging');
      assert.ok(result.widthShown.distinct > 1, 'the real pointer drag updates the displayed width');
      await f.snapshot('slow-drag-released');
    } else {
      assert.ok(result.fullMs.median !== null && result.fullMs.median < 120, `whole part ${JSON.stringify(result.fullMs)}`);
      assert.equal(result.rolledRequests, 0, `${label}: ${result.rolledRequests} drag previews of the box alone`);
    }
    f.phase = `cancel ${label}`; await f.page.evaluate(() => document.activeElement?.blur()); await f.page.keyboard.press('Escape'); await sleep(300);
    await f.closeEditor(); await f.same(original);
  }
  await f.snapshot('99-unchanged');
  if (measured) f.report.loadAfter = loadavg();
  assert.deepEqual(f.report.downloads, []);
});
