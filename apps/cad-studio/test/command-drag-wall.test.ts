import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server.edge';
import type { Command, Ctx } from '@barocss/cad-model/app/commands';
import type { EngineClient } from '../src/engine/client';
import type { Active } from '../src/app/commandState';
import { createValueStore } from '../src/state/valueStore';
import { useCommandPreview, ROLL_AFTER_MS } from '../src/state/useCommandPreview';
import { useCommandGizmos } from '../src/viewport/useCommandGizmos';
import type { FeatureHandle } from '../src/viewport/Viewport';

// (The preview hook schedules through window.)
(globalThis as { window?: unknown }).window ??= globalThis;
// A fillet-like command (one radius handle, step 0.5, start r = 3) and a kernel that answers after a delay and
// refuses a radius above 6.5. The pointer moves every 16 ms, as in Viewport: `toValue(start, mm)` then `onDrag`.
// `rolled` is a box whose height is dragged under a fillet (the preview while dragging is the box alone, quick;
// the whole part, which refuses a height below 4, follows when the pointer pauses) — only once the whole part
// was measured slower than ROLL_AFTER_MS; a quick whole part is shown all along (roadmap 20 ①).
const LIMIT = 6.5, START = 3, MIN_H = 4;
const doc = { nodes: [{ kind: 'box' }] } as never, selection = { faces: [], edges: [], bodies: [] };
const ctx = { doc, bodies: [], selection } as unknown as Ctx;
const cmd = { id: 'fillet', label: 'Fillet', fields: () => [{ key: 'radius', label: 'Radius', kind: 'mm', min: 0.1 }],
  build: (c: Ctx, v: Record<string, unknown>) => ({ ...c.doc, nodes: [...c.doc.nodes, { kind: 'fillet', radius: Number(v.radius) }] }),
  handles: (_c: Ctx, v: Record<string, unknown>) => [{ key: 'radius', at: [Number(v.radius), 0, 0], dir: [1, 0, 0], min: 0.1, step: 0.5 }] } as unknown as Command;
const rdoc = { nodes: [{ kind: 'extrude', h: 10 }, { kind: 'fillet', r: 2, parent: { node: 0, side: 'solid' } }] } as never;
const rctx = { doc: rdoc, bodies: [], selection } as unknown as Ctx;
const rcmd = { id: 'edit-box', label: 'Box', fields: () => [{ key: 'h', label: 'Height', kind: 'mm', min: 0.1 }],
  build: (c: Ctx, v: Record<string, unknown>) => ({ ...c.doc, nodes: [{ ...c.doc.nodes[0], h: Number(v.h) }, c.doc.nodes[1]] }),
  handles: () => [{ key: 'h', at: [0, 0, 0], dir: [0, 0, 1], min: 0.1, step: 0.5 }] } as unknown as Command;

interface Opts { hold?: number; /** The largest radius the kernel accepts at its n-th call (default: LIMIT). */ limit?: (call: number) => number; rolled?: boolean;
  /** An idle handle: no command (so no opening preview) until the first move starts a new one, as useCommandGizmos does. */ idle?: boolean; /** The document's last evaluation time. */ wholeMs?: number }
async function drive(latency: number, path: number[], { hold = 1500, limit = () => LIMIT, rolled = false, idle = false, wholeMs }: Opts = {}) {
  const key = rolled ? 'h' : 'radius', c = rolled ? rcmd : cmd, cx = rolled ? rctx : ctx, begin = rolled ? 10 : START;
  const store = createValueStore<Active | null>(idle ? null : { cmd: c, ctx: cx, values: { [key]: begin }, preview: 'ok' } as unknown as Active);
  const evaluated: number[] = [], accepted: number[] = [], sent: number[] = [];
  let refused = 0, calls = 0;
  const engine = { preview: async (d: { nodes: { radius?: number; h?: number }[] }) => {
    sent.push(d.nodes.length);
    const n = ++calls, whole = d.nodes.length === 2, r = rolled ? d.nodes[0].h! : d.nodes[d.nodes.length - 1].radius!;
    evaluated.push(r); await sleep(rolled && !whole ? latency / 4 : latency);
    if (rolled ? !whole || r >= MIN_H : r <= limit(n)) { if (!rolled || whole) accepted.push(r); return { ok: true, bodies: [] }; }
    refused++; return { ok: false, error: { title: 'refused' } };
  } };
  const previewFor = { current: null as string | null };
  let preview!: ReturnType<typeof useCommandPreview>;
  const Hooks = () => { preview = useCommandPreview({ command: { activeStore: store, bearingRootCurrent: true }, worker: { engine: engine as unknown as EngineClient, nextRevision: () => 0, currentBearingDoc: () => null as never, ...(wholeMs === undefined ? {} : { wholeMs: () => wholeMs }) }, result: { setPreviewBodies() {}, previewFor } }); return null; };
  renderToString(createElement(Hooks));
  const stop = preview.watch();
  let handle!: FeatureHandle;
  const Gizmos = () => { handle = useCommandGizmos({ model: { doc: cx.doc, evaluated: cx.doc, bodies: [], selection, marker: null, editNode: null },
    command: { active: store.get(), ctx: cx, setActive: store.set, handleDrag: preview.handleDrag, previewFor },
    context: { sketch: null, rendering: false, drawing: false, measure: null, assemblyDraft: null, instanceCount: 0, snapStep: 1 },
    drag: { bodyDrag: null, setBodyDrag() {} } }).handles[0]; return null; };
  const fresh = () => { renderToString(createElement(Gizmos)); return handle; };
  await sleep(latency + 40); evaluated.length = 0; calls = 0; sent.length = 0;
  const start = idle ? begin : fresh().value, shown: number[] = [], wanted: number[] = [];
  for (let i = 0; i < path.length; i++) {
    if (idle && i === 0) {
      // (The gizmo's first move: a new command object, the drag state, and the Active with the first value.)
      const first = Math.round((start + path[0]) / 0.5) * 0.5; wanted.push(first);
      preview.handleDrag.current = { key, lastOk: start, wall: 0, bad: null, want: first, step: 0.5, dragging: true };
      store.set({ cmd: { ...c }, ctx: { ...cx }, values: { [key]: first }, preview: 'busy' } as unknown as Active);
      await sleep(16); shown.push(Number(store.get()!.values[key])); continue;
    }
    const h = fresh();
    const want = h.toValue(start, path[i]); wanted.push(want);
    h.onDrag(want, i === path.length - 1);
    await sleep(16); shown.push(Number(store.get()!.values[key]));
  }
  await sleep(hold);
  const final = Number(store.get()!.values[key]), status = store.get()!.preview;
  stop();
  return { final, status, shown, wanted, evaluated, accepted, refused, sent, hd: preview.handleDrag.current };
}
const ramp = (a: number, b: number, n: number) => Array.from({ length: n }, (_, i) => a + (b - a) * (i + 1) / n);
const A = ramp(0, 7, 10);
const B = [...ramp(0, 7, 6), ...ramp(7, 2, 3), 2, 2, 2];
const C = [...ramp(0, 7, 6), ...Array(8).fill(7), ...ramp(7, 0, 8), ...Array(6).fill(0), ...ramp(0, 2.5, 5), 2.5, 2.5];

for (const latency of [5, 60, 150]) {
  test(`drag A past the limit settles within one step of it (kernel ${latency} ms)`, async () => {
    const { final, status, accepted } = await drive(latency, A);
    assert.ok(final <= LIMIT && final >= LIMIT - 0.5, `shown ${final}`);
    assert.equal(status, 'ok');
    assert.ok(accepted.includes(final));
  });
  test(`drag B back to a valid value while a failing preview runs keeps it (kernel ${latency} ms)`, async () => {
    const { final } = await drive(latency, B);
    assert.equal(final, 5);
  });
  test(`drag C out again after a refusal reaches the valid value, with no jump to the limit (kernel ${latency} ms)`, async () => {
    const { final, shown } = await drive(latency, C);
    assert.equal(final, 5.5);
    assert.ok(!shown.slice(-8).includes(6.5), `shown ${shown.slice(-8)}`);
  });
}

test('a drag with no refusal follows the pointer, snapped to the step', async () => {
  const { final, shown, hd } = await drive(5, ramp(0, 2.3, 8));
  assert.equal(final, 5.5); // 3 + 2.3 = 5.3 -> 5.5
  assert.deepEqual(shown, [...shown].sort((a, b) => a - b));
  assert.equal(hd?.bad ?? null, null);
});

test('a stale failure never changes the current value', async () => {
  // Out to r = 10 (refused after 60 ms), then straight back to r = 4: the late failure must not reset it.
  const { final, hd } = await drive(60, [...ramp(0, 7, 4), ...ramp(7, 1, 3), 1, 1, 1, 1, 1, 1]);
  assert.equal(final, 4);
  assert.ok(hd && (hd.bad === null || hd.bad > 4));
});

const rep = <T,>(x: T, n: number) => Array<T>(n).fill(x);
const abs = (...xs: number[]) => xs.map(x => x - START);
/** Steps against the pointer's direction `dir` that the pointer did not ask for (a refusal's back-off): the shown value must not swing back and forth. */
function swings(shown: number[], wanted: number[], dir: number) {
  let n = 0;
  for (let i = 1; i < shown.length; i++) if ((shown[i] - shown[i - 1]) * dir < 0 && (wanted[i] - wanted[i - 1]) * dir >= 0) n++;
  return n;
}
const jitter = (n: number) => Array.from({ length: n }, (_, i) => 4 + (i % 5) * 0.25);
// The pointer stays past the bound (still, or jittering across two refused values): the shown value steps one way
// toward the limit and stops there, at most one step back for a real refused step; it never alternates.
const held: [string, number, number[], Opts?][] = [
  ['still, kernel 60 ms', 60, [...ramp(0, 4.5, 6), ...rep(4.5, 40)]],
  ['jittering, kernel 60 ms', 60, [...ramp(0, 4.5, 6), ...jitter(40)]],
  ['jittering, kernel 150 ms', 150, [...ramp(0, 4.5, 6), ...jitter(60)]],
  // (A whole part at 60 ms is under ROLL_AFTER_MS, so it is shown all along; at 150 ms the drag shows the box alone.)
  ['under a fillet, whole part shown, still, kernel 60 ms', 60, [...ramp(0, -8, 8), ...rep(-8, 40)], { rolled: true }],
  ['under a fillet, rolled back, still, kernel 150 ms', 150, [...ramp(0, -8, 8), ...rep(-8, 60)], { rolled: true }],
];
for (const [name, latency, path, opts] of held) {
  test(`a pointer held past the limit settles toward it without swinging back (${name})`, async () => {
    const { final, status, shown, wanted, accepted, evaluated } = await drive(latency, path, opts);
    const rolled = opts?.rolled;
    assert.ok(rolled ? final >= MIN_H && final <= MIN_H + 0.5 : final <= LIMIT && final >= LIMIT - 0.5, `shown ${final}`);
    assert.equal(status, 'ok');
    assert.ok(accepted.includes(final), `${final} was accepted by the kernel`);
    // (The first refusal backs off once; a refused probe on the way to the limit may step back once more. The whole part
    // shown while dragging the box: the last good value is the bound itself (4), so both bisect probes below it (3, 3.5)
    // are refused and each steps back once: one more.)
    const allowed = name.includes('whole part shown') ? 3 : 2;
    assert.ok(swings(shown, wanted, rolled ? -1 : 1) <= allowed, `swings ${swings(shown, wanted, rolled ? -1 : 1)}: ${shown}`);
    if (!rolled || name.includes('whole part shown')) assert.equal(new Set(shown.slice(-10)).size, 1, `tail ${shown.slice(-10)}`);
    // (A still pointer: each value goes to the kernel once, a refusal bisects at once without trying the last good value again.)
    if (name.startsWith('still')) assert.equal(new Set(evaluated).size, evaluated.length, `evaluated ${evaluated}`);
  });
}

test('after release the committed value is one the kernel accepted, within a step of the limit', async () => {
  // (Release does not stop the bisect: it goes on from the pointer's value and Enter waits for the preview to settle.)
  for (const latency of [60, 150]) {
    const { final, status, accepted } = await drive(latency, A);
    assert.equal(status, 'ok');
    assert.ok(accepted.includes(final) && final <= LIMIT && final > LIMIT - 0.5 - 1e-9, `${latency}: ${final}`);
  }
});

test('a value past the old bound that becomes valid is reached (a later drag-in-place check)', async () => {
  // The kernel refuses 7 on its first call, accepts everything up to 9 after: the in-flight second try of 7 succeeds,
  // so the bound is lifted and the pointer at 8 is followed instead of held at 7.
  const { final, status, accepted } = await drive(60, abs(7, 7.5, 7.5, 7, ...rep(7, 9), ...rep(8, 10)), { limit: n => n <= 1 ? 6.5 : 9 });
  assert.equal(final, 8);
  assert.equal(status, 'ok');
  assert.ok(accepted.includes(8));
});

test('a stale failure arriving after the pointer moved to a valid value does not move the shown value', async () => {
  // Out to 7 (refused 60 ms later), then at once back to 5: the failure comes late and must leave 5 alone.
  const { final, shown, status } = await drive(60, abs(7, ...rep(5, 12)));
  assert.deepEqual(shown.slice(1).filter(x => x !== 5), [], `shown ${shown}`);
  assert.equal(final, 5);
  assert.equal(status, 'ok');
});

test('a refusal arriving late for a farther value does not widen the bound', async () => {
  // 7 is refused while the pointer has already moved on to 8 (refused too, later): the bound stays at the nearer 7,
  // so the pointer coming back to 7 is held, not tried again.
  const { shown, final } = await drive(60, abs(7, ...rep(8, 8), ...rep(7, 24)));
  assert.ok(shown.slice(6).every(x => x <= LIMIT), `shown ${shown}`);
  assert.equal(final, LIMIT);
});

test('a quick whole part is shown all through a handle drag under later features (roadmap 20 ①)', async () => {
  // (The whole part answers in 20 ms, under ROLL_AFTER_MS: no preview of the box alone, so the fillet never disappears.)
  const { final, status, sent } = await drive(20, ramp(0, -3, 12), { rolled: true, hold: 400 });
  assert.ok(sent.length > 3, `previews ${sent}`);
  assert.deepEqual(sent.filter(n => n !== 2), [], `sent ${sent}`);
  assert.equal(final, 7);
  assert.equal(status, 'ok');
});

test(`a whole part slower than ${ROLL_AFTER_MS} ms rolls the drag preview back to the dragged feature, and the whole part follows`, async () => {
  const { final, status, sent } = await drive(ROLL_AFTER_MS + 60, ramp(0, -3, 12), { rolled: true, hold: 900 });
  // (The command's opening preview measured the whole part: the drag's previews are the box alone from the start.)
  assert.equal(sent[0], 1, `sent ${sent}`);
  assert.equal(sent.at(-1), 2, `the whole part follows the pause: ${sent}`);
  assert.equal(final, 7);
  assert.equal(status, 'ok');
});

test('an idle handle drag on a slow part rolls back from its first preview, from the document\'s evaluation time', async () => {
  // (No opening preview measured the whole part: the document's last evaluation time says it is slow.)
  // (The first move already changes the height, 10 -> 9.5: an unchanged value previews the document as it is.)
  const { sent, final, status } = await drive(ROLL_AFTER_MS + 60, ramp(-0.5, -3, 12), { rolled: true, idle: true, wholeMs: ROLL_AFTER_MS + 60, hold: 900 });
  assert.equal(sent[0], 1, `sent ${sent}`);
  assert.equal(sent.at(-1), 2, `the whole part follows the pause: ${sent}`);
  assert.equal(final, 7);
  assert.equal(status, 'ok');
});

test('an idle handle drag on a quick part shows the whole part from its first preview', async () => {
  const { sent, final } = await drive(20, ramp(-0.5, -3, 12), { rolled: true, idle: true, wholeMs: 20, hold: 400 });
  assert.deepEqual(sent.filter(n => n !== 2), [], `sent ${sent}`);
  assert.equal(final, 7);
});
