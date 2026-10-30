globalThis.window = globalThis;
const { useCommandPreview, useCommandGizmos, createValueStore } = await import(process.env.BUNDLE ?? './bundle.mjs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ramp = (a, b, n) => Array.from({ length: n }, (_, i) => a + (b - a) * (i + 1) / n);
async function go(lat, path, hold = 2500) {
  const doc = { nodes: [{ kind: 'extrude', h: 10 }, { kind: 'fillet', r: 2, parent: { node: 0, side: 'solid' } }] }, ctx = { doc, bodies: [], selection: { faces: [], edges: [], bodies: [] } };
  const cmd = { id: 'edit-box', label: 'Box', fields: () => [{ key: 'h', label: 'h', kind: 'mm', min: 0.1 }],
    build: (c, v) => ({ ...c.doc, nodes: [{ ...c.doc.nodes[0], h: Number(v.h) }, c.doc.nodes[1]] }),
    handles: (c, v) => [{ key: 'h', at: [0, 0, 0], dir: [0, 0, 1], min: 0.1, step: 0.5 }] };
  const store = createValueStore({ cmd, ctx, values: { h: 10 }, preview: 'ok' });
  const ev = [];
  const engine = { preview: async d => { const h = d.nodes[0].h, full = d.nodes.length === 2; await sleep(full ? lat : lat / 4); const ok = !full || h >= 4; ev.push(`${h}${full ? 'F' : 'p'}${ok ? '' : 'X'}`); return ok ? { ok, bodies: [] } : { ok, error: {} }; } };
  const previewFor = { current: null };
  const p = useCommandPreview({ command: { activeStore: store, bearingRootCurrent: true }, worker: { engine, nextRevision: () => 0, currentBearingDoc: () => null }, result: { setPreviewBodies() {}, previewFor } });
  const stop = p.watch();
  const handle = () => useCommandGizmos({ model: { doc, evaluated: doc, bodies: [], selection: ctx.selection, marker: null, editNode: null }, command: { active: store.get(), ctx, setActive: store.set, handleDrag: p.handleDrag, previewFor }, context: { sketch: null, rendering: false, drawing: false, measure: null, assemblyDraft: null, instanceCount: 0, snapStep: 1 }, drag: { bodyDrag: null, setBodyDrag() {} } }).handles[0];
  await sleep(50); ev.length = 0;
  const s = handle().value, tr = [];
  for (let i = 0; i < path.length; i++) { const h = handle(); const w = h.toValue(s, path[i]); h.onDrag(w, i === path.length - 1); await sleep(16); tr.push(`${w}->${store.get().values.h}`); }
  await sleep(hold); const n = ev.length; await sleep(1000);
  console.log(JSON.stringify({ lat, final: store.get().values.h, preview: store.get().preview, hd: p.handleDrag.current, trace: tr.join(' '), ev: ev.join(' '), evAfterHold: ev.length - n }));
  stop();
}
await go(60, [...ramp(0, -8, 8), ...Array(40).fill(-8).map((x, i) => x + (i % 3) * 0.3)]);
await go(150, [...ramp(0, -8, 8), ...Array(60).fill(-8)]);
await go(60, [...ramp(0, -8, 8), ...Array(10).fill(-8), ...ramp(-8, -3, 4), ...Array(30).fill(-3)]);
