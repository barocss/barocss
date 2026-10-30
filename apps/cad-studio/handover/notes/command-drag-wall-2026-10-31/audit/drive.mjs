globalThis.window = globalThis;
const { useCommandPreview, useCommandGizmos, createValueStore } = await import('./bundle.mjs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LIMIT = 6.5; // largest radius the fake kernel accepts
async function scenario(name, latency, path /* mm per frame */, holdAfter = 400) {
  const doc = { nodes: [{ kind: 'box' }] }, ctx = { doc, bodies: [], selection: { faces: [], edges: [], bodies: [] } };
  const cmd = { id: 'fillet', label: 'Fillet', fields: () => [{ key: 'radius', label: 'Radius', kind: 'mm', min: 0.1 }],
    build: (c, v) => ({ ...c.doc, nodes: [...c.doc.nodes, { kind: 'fillet', radius: Number(v.radius) }] }),
    handles: (c, v) => [{ key: 'radius', at: [Number(v.radius), 0, 0], dir: [1, 0, 0], min: 0.1, step: 0.5 }] };
  const store = createValueStore({ cmd, ctx, values: { radius: 3 }, preview: 'ok' });
  const log = [];
  const engine = { preview: async d => { const r = d.nodes.at(-1).radius; await sleep(latency); const ok = r <= LIMIT; log.push(`  kernel r=${r} -> ${ok ? 'ok' : 'FAIL'}`); return ok ? { ok, bodies: [] } : { ok, error: { title: 'too large' } }; } };
  const previewFor = { current: null };
  const p = useCommandPreview({ command: { activeStore: store, bearingRootCurrent: true }, worker: { engine, nextRevision: () => 0, currentBearingDoc: () => null }, result: { setPreviewBodies() {}, previewFor } });
  const stop = p.watch();
  const handle = () => useCommandGizmos({ model: { doc, evaluated: doc, bodies: [], selection: ctx.selection, marker: null, editNode: null },
    command: { active: store.get(), ctx, setActive: store.set, handleDrag: p.handleDrag, previewFor },
    context: { sketch: null, rendering: false, drawing: false, measure: null, assemblyDraft: null, instanceCount: 0, snapStep: 1 },
    drag: { bodyDrag: null, setBodyDrag() {} } }).handles[0];
  await sleep(100); log.length = 0;
  const start = handle().value; // Viewport pointerdown: d.start = hd.value
  console.log(`\n== ${name} (kernel ${latency} ms, frame 16 ms, valid r <= ${LIMIT}) start r=${start}`);
  for (let i = 0; i < path.length; i++) {
    const h = handle(), want = h.toValue(start, path[i]), last = i === path.length - 1;
    h.onDrag(want, last);
    await sleep(16);
    for (const l of log.splice(0)) console.log(l);
    const hd = p.handleDrag.current;
    console.log(`frame ${i} pointer ${path[i].toFixed(2)} mm -> pointer value ${want}  shown r=${store.get().values.radius}  (lastOk ${hd?.lastOk}, wall ${hd?.wall})`);
  }
  await sleep(holdAfter); for (const l of log.splice(0)) console.log(l);
  console.log(`settled r=${store.get().values.radius}`);
  stop();
}
const ramp = (a, b, n) => Array.from({ length: n }, (_, i) => a + (b - a) * (i + 1) / n);
const L = Number(process.argv[2] ?? 60);
await scenario('A: drag out past the limit (+7 mm over 10 frames), release', L, ramp(0, 7, 10));
await scenario('B: drag out to +7 mm, then back to +2 mm (r 5, valid) while the failing preview is in flight', L, [...ramp(0, 7, 6), ...ramp(7, 2, 3), 2, 2, 2]);
await scenario('C: past the limit, wait, back to 0, then out to +2.5 mm (r 5.5, valid)', L, [...ramp(0, 7, 6), 7, 7, 7, 7, 7, 7, 7, 7, ...ramp(7, 0, 8), 0, 0, 0, 0, 0, 0, ...ramp(0, 2.5, 5), 2.5, 2.5]);
