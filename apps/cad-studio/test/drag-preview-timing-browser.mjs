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
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const fixture = join(import.meta.dirname, 'fixtures', 'drag-preview-timing.bcad');
const f = await createFlow({ name: 'drag-timing', envFrozen: 'DRAG_TIMING_SOURCE_FROZEN', output: process.argv[2], qualification: 'DRAG_PREVIEW_TIMING_MEASUREMENT',
  limits: ['Measurement only: headless Chrome frame times are not a display vsync; worker round trips include structured clone and the product mesh build, not GPU upload.',
    'Request/reply pairs come from wrapping Worker.prototype (observation only); the node count is that of the sent document when it is readable.', 'One machine, one run; the machine load is recorded beside the numbers.'],
  initialFiles: ['apps/cad-studio/test/drag-preview-timing-browser.mjs', 'apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/test/fixtures/drag-preview-timing.bcad', 'apps/cad-studio/src/state/useCommandPreview.ts', 'apps/cad-studio/src/viewport/useCommandGizmos.ts', 'apps/cad-studio/src/engine/client.ts'],
  requiredFrozen: ['apps/cad-studio/src/state/useCommandPreview.ts'] });

/** Init script: time worker requests and replies, and record animation frames while `__dragFrames(true)`. */
function instrument() {
  const log = window.__dragLog = { sends: [], replies: [], frames: [], recording: false };
  const post = Worker.prototype.postMessage;
  Worker.prototype.postMessage = function (message, ...rest) {
    if (message && typeof message === 'object' && 'type' in message) log.sends.push({ t: performance.now(), id: message.id ?? null, type: message.type, nodes: Array.isArray(message.doc?.nodes) ? message.doc.nodes.length : null });
    return post.call(this, message, ...rest);
  };
  const handler = Object.getOwnPropertyDescriptor(Worker.prototype, 'onmessage');
  Object.defineProperty(Worker.prototype, 'onmessage', { configurable: true, enumerable: true, get() { return handler.get.call(this); },
    set(fn) { handler.set.call(this, typeof fn === 'function' ? function (event) { const d = event.data; if (d && typeof d.id === 'number' && !d.progress) log.replies.push({ t: performance.now(), id: d.id, ok: d.result ? d.result.ok ?? null : null, bodies: Array.isArray(d.result?.bodies) ? d.result.bodies.length : null, faces: d.result?.bodies?.[0]?.mesh?.faces?.length ?? null, meshRef: d.result?.bodies?.[0]?.meshRef ?? null, wall: d.result?.wallTime ?? null }); return fn.call(this, event); } : fn); } });
  const tick = t => { if (log.recording) log.frames.push(t); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  window.__dragFrames = on => { log.recording = on; if (on) log.frames = []; };
}

const sleep = ms => new Promise(done => setTimeout(done, ms));
const handleAt = () => f.page.evaluate(() => {
  const g = document.querySelector('g.gizmo-handle[data-handle="w"]'), c = g?.querySelector('circle'), p = g?.querySelector('polygon');
  const mid = e => { if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  return { root: mid(c), head: mid(p) };
});
const hudWidth = () => f.page.evaluate(() => { const fld = [...document.querySelectorAll('.hud .field')].find(x => [...x.querySelectorAll('span')].some(s => /^(W|Width)$/.test(s.textContent.trim()))); return fld?.querySelector('input')?.value ?? null; });
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
    samples.push({ i, t: await f.page.evaluate(() => performance.now()), width: await hudWidth(), status: await status() });
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
  const previews = log.sends.filter(s => s.type === 'preview').map(s => { const r = log.replies.find(x => x.id === s.id); return { ...s, t: round(s.t - t0), ms: r ? round(r.t - s.t) : null, ok: r?.ok ?? null, bodies: r?.bodies ?? null, faces: r?.faces ?? null, meshRef: r?.meshRef ?? null, wall: r?.wall ?? null }; });
  const during = log.frames.filter(t => t <= moveEnd), gaps = during.slice(1).map((t, i) => t - during[i]);
  // (The sent document is packed, so its node count is not readable: a reply of the box alone has its 6 faces, the whole part more.)
  const boxOnly = p => p.faces === 6, whole = p => p.faces !== null && p.faces > 6;
  const rolled = previews.filter(p => boxOnly(p) && p.ms !== null).map(p => p.ms), full = previews.filter(p => whole(p) && p.ms !== null).map(p => p.ms);
  const summary = { label, moves, holdMs, pointerMovesSent: moves, previewRequests: previews.length, rolledRequests: previews.filter(boxOnly).length, fullRequests: previews.filter(whole).length, unknownFaces: previews.filter(p => p.faces === null).length,
    rolledMs: { median: round(median(rolled)), p90: round(pct(rolled, 0.9)), max: round(rolled.length ? Math.max(...rolled) : null) }, fullMs: { median: round(median(full)), p90: round(pct(full, 0.9)), max: round(full.length ? Math.max(...full) : null) },
    frameGapMs: { count: gaps.length, median: round(median(gaps)), p90: round(pct(gaps, 0.9)), max: round(gaps.length ? Math.max(...gaps) : null), over50: gaps.filter(g => g > 50).length },
    widthShown: { first: samples[0]?.width, last: samples.at(-1)?.width, distinct: new Set(samples.map(s => s.width)).size } };
  f.report.observations.push({ label, summary, previews, samples });
  await writeFile(join(f.output, `${label}-timing.json`), JSON.stringify({ summary, previews, samples, frames: log.frames.map(t => round(t - t0)) }, null, 2)); await f.persist();
  return summary;
}

await f.run(async () => {
  f.phase = 'load'; await f.newPage();
  await f.context.addInitScript(instrument); await f.page.reload(); await f.page.waitForSelector('.viewport[data-renderer="webgpu"]', { timeout: 30000 }); await f.ready();
  assert.equal(await f.page.evaluate(() => typeof window.__dragFrames), 'function', 'instrumentation installed');
  f.report.load = (await import('node:os')).loadavg();
  await f.openFile(fixture, 5);
  const original = await f.doc(), idle = await f.snapshot('01-opened');
  assert.equal(idle.bodies.bodies.length, 1, 'one body');
  for (const [k, label] of [[1, 'drag1'], [2, 'drag2']]) {
    await f.openFeatureEditor(1, 'box');
    const result = await drag(label, k === 1 ? {} : { shots: [20, 50] });
    f.report.reads.push(result);
    // (Roadmap 20 ①: the whole part answers well under ROLL_AFTER_MS here, so no drag preview is the box alone.)
    assert.ok(result.fullMs.median !== null && result.fullMs.median < 120, `whole part ${JSON.stringify(result.fullMs)}`);
    assert.equal(result.rolledRequests, 0, `${label}: ${result.rolledRequests} drag previews of the box alone`);
    f.phase = `cancel ${label}`; await f.page.evaluate(() => document.activeElement?.blur()); await f.page.keyboard.press('Escape'); await sleep(300);
    await f.closeEditor(); await f.same(original);
  }
  await f.snapshot('99-unchanged');
});
