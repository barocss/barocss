globalThis.window = globalThis;
const bundle = process.env.BUNDLE ?? './bundle.mjs';
const { useCommandPreview, useCommandGizmos, createValueStore } = await import(bundle);
const sleep = ms => new Promise(r => setTimeout(r, ms));
// engine: valid(values) -> bool; latency ms (number or fn)
export async function run({ name, latency, valid, start = { radius: 3 }, handles, fields, path, key = 'radius', hold = 1500, during, after, quiet }) {
  const doc = { nodes: [{ kind: 'box' }] }, ctx = { doc, bodies: [], selection: { faces: [], edges: [], bodies: [] } };
  const keys = Object.keys(start);
  const cmd = { id: 'fillet', label: 'Fillet', fields: fields ?? (() => keys.map(k => ({ key: k, label: k, kind: 'mm', min: 0.1 }))),
    build: (c, v) => ({ ...c.doc, nodes: [...c.doc.nodes, { kind: 'fillet', v: { ...v } }] }),
    handles: handles ?? ((c, v) => [{ key: 'radius', at: [Number(v.radius), 0, 0], dir: [1, 0, 0], min: 0.1, step: 0.5 }]) };
  const store = createValueStore({ cmd, ctx, values: { ...start }, preview: 'ok' });
  const log = [], ev = [];
  let calls = 0, t0 = Date.now(), lastCall = 0;
  const engine = { preview: async d => { const v = d.nodes.at(-1).v; calls++; lastCall = Date.now(); const lat = typeof latency === 'function' ? latency(v) : latency; await sleep(lat); const ok = valid(v, Date.now() - t0); ev.push(`${JSON.stringify(v)}${ok ? 'ok' : 'X'}`); return ok ? { ok, bodies: [] } : { ok, error: { title: 'refused' } }; } };
  const previewFor = { current: null };
  const p = useCommandPreview({ command: { activeStore: store, bearingRootCurrent: true }, worker: { engine, nextRevision: () => 0, currentBearingDoc: () => null }, result: { setPreviewBodies() {}, previewFor } });
  let sets = 0; const origSet = store.set; // count store writes
  const stop = p.watch();
  const gz = () => useCommandGizmos({ model: { doc, evaluated: doc, bodies: [], selection: ctx.selection, marker: null, editNode: null },
    command: { active: store.get(), ctx, setActive: store.set, handleDrag: p.handleDrag, previewFor },
    context: { sketch: null, rendering: false, drawing: false, measure: null, assemblyDraft: null, instanceCount: 0, snapStep: 1 },
    drag: { bodyDrag: null, setBodyDrag() {} } });
  const handleOf = k => gz().handles.find(h => h.id === k);
  const unsub = store.subscribe(() => { sets++; });
  await sleep(50); ev.length = 0;
  const startV = handleOf(key).value, trace = [];
  t0 = Date.now();
  for (let i = 0; i < path.length; i++) {
    const h = handleOf(key);
    if (!h) { trace.push('nohandle'); break; }
    const want = h.toValue(startV, path[i]);
    h.onDrag(want, i === path.length - 1);
    if (during) await during(i, { store, p });
    await sleep(16);
    const a = store.get();
    trace.push(`${want}->${a ? a.values[key] : 'null'}${a?.preview === 'error' ? '!' : ''}`);
  }
  const relAt = Date.now(), callsAtRel = calls;
  if (after) await after({ store, p, stop });
  const setsBeforeHold = sets;
  await sleep(hold);
  const a = store.get(), hd = p.handleDrag.current;
  const res = { name, final: a ? a.values[key] : null, preview: a?.preview, callsAfterRelease: calls - callsAtRel, lastCallMsAfterRel: lastCall - relAt, setsDuringHold: sets - setsBeforeHold, hd: hd && { lastOk: hd.lastOk, bad: hd.bad, wall: hd.wall, want: hd.want }, trace: trace.join(' '), ev: ev.join(' ') };
  stop(); unsub();
  // quiescence: any calls after stop?
  const c0 = calls, s0 = sets; await sleep(Math.max(300, (typeof latency === 'number' ? latency : 200) * 3));
  res.callsAfterStop = calls - c0; res.setsAfterStop = sets - s0;
  if (!quiet) console.log(JSON.stringify(res, null, 0).replace(/","/g, '",\n "'));
  return res;
}
