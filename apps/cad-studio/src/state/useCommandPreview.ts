import { useRef, type Dispatch, type SetStateAction } from 'react';
import { prefixDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { patchValues, shownFields, type Values } from '@barocss/cad-model/app/commands';
import { flattenAssembly } from '@barocss/cad-model/engine/flatten';
import { missingCommandField, type Active } from '../app/commandState';
import type { EngineClient } from '../engine/client';
import type { ValueStore } from './valueStore';
interface CommandPreviewOptions {
  command: { activeStore: ValueStore<Active | null>; bearingRootCurrent: boolean };
  worker: { engine: EngineClient; nextRevision(): number; currentBearingDoc(): StudioDoc };
  result: { setPreviewBodies: Dispatch<SetStateAction<BodyResult[] | null>>; previewFor: { current: string | null } };
}
/** The HUD preview queue and drag limits retain their original per-command subscription. */
export function useCommandPreview({ command, worker, result }: CommandPreviewOptions) {
  const { activeStore, bearingRootCurrent } = command, setActive = activeStore.set;
  const { engine, nextRevision, currentBearingDoc } = worker;
  const { setPreviewBodies, previewFor } = result;
  // Live preview: re-evaluate the candidate whenever HUD values change. One evaluation at a time, the
  // newest values next (a drag sends many): the preview keeps up as fast as the kernel does, with no
  // wait before it starts; values typed into a box wait a moment so each keystroke is not evaluated.
  const previewRun = useRef<{ busy: boolean; next: (() => Promise<void>) | null }>({ busy: false, next: null });
  /**
   * A dimension handle being dragged: its last value the kernel accepted, and once a value fails, the side
   * it failed on. The value goes back to the last good one and the drag stops there (no flicking between
   * a broken and a good preview).
   */
  const handleDrag = useRef<{ key: string; lastOk: number; wall: number; dragging: boolean } | null>(null);
  const lastTyped = useRef(0);
  /**
   * While a handle is dragged on a feature that later ones build on (a box under fillets), the preview
   * is the part up to that feature — quick, so the body keeps up with the pointer — and the whole part
   * follows when the drag pauses or ends (`fullTimer`).
   */
  const fullTimer = useRef(0);
  const watch = () => {
    // (R1d: run on each change of the command's values, followed in the store — the App does not render for a value typed
    // into the HUD or placed by the pointer.)
    let seen: Values | undefined, stop: (() => void) | undefined;
    const evaluate = (active: Active | null): (() => void) | undefined => {
      if (!active?.cmd.build || active.upload) return;
      if (!bearingRootCurrent) {
        setPreviewBodies(null);
        setActive(a => a && { ...a, preview: 'error', error: { title: 'Assembly changed', hint: 'Start Bearing again to use the current housing geometry.', detail: '' } });
        return;
      }
      let live = true;
      const missing = missingCommandField(shownFields(active.cmd.fields?.(active.ctx, active.values) ?? [], active.values), active.values);
      if (missing) { setPreviewBodies(null); setActive(a => a && { ...a, preview: 'error', error: { title: 'Enter a value', hint: `${missing.label} is empty.`, detail: '' } }); return; }
      const values = active.values, cmd = active.cmd, ctx = active.ctx;
      const job = async (full = false) => {
        if (!live) return;
        let candidate: StudioDoc;
        try { candidate = cmd.build!(ctx, values); } catch (e) {
          const current = activeStore.get();
          if (live && current?.cmd === cmd && current.values === values) {
            setPreviewBodies(null);
            setActive(a => a && a.cmd === cmd && a.values === values ? { ...a, preview: 'error', error: { title: 'Invalid input', hint: String(e), detail: '' } } : a);
          }
          return;
        }
        let shown = candidate, rolled = false;
        // A part it places as an instance (a fastener inserted as its own part) shows folded in as features.
        const placed = (candidate.instances ?? []).filter(i => !(ctx.doc.instances ?? []).some(j => j.id === i.id));
        if (placed.length) shown = flattenAssembly({ ...candidate, instances: placed });
        if (!full && handleDrag.current?.dragging && candidate.nodes.length === ctx.doc.nodes.length) {
          // (The last node the drag changed: nodes it left are the same objects, compared by content only if not.)
          let k = -1; for (let i = 0; i < candidate.nodes.length; i++) { const n = candidate.nodes[i], o = ctx.doc.nodes[i]; if (n !== o && JSON.stringify(n) !== JSON.stringify(o)) k = i; }
          if (k >= 0 && k < candidate.nodes.length - 1) { shown = prefixDoc(candidate, k + 1); rolled = true; }
        }
        window.clearTimeout(fullTimer.current);
        const result = await engine.preview(shown, nextRevision());
        if (cmd.id === 'bearing' && ctx.bearingAssembly?.root !== currentBearingDoc()) return;
        if (rolled && live) fullTimer.current = window.setTimeout(() => { if (!live) return; run.next = () => job(true); if (!run.busy) void pump(); }, 220);
        // A queued update can use an intermediate result, unless this command was replaced or refused.
        const current = activeStore.get();
        // A replaced font invalidates every old ghost, including after the new upload finishes.
        if (current?.upload || current?.values.font !== values.font) return;
        if (!live && (!previewRun.current.next || !current || current.cmd !== cmd || current.ctx !== ctx || current.preview === 'error')) return;
        const hd = handleDrag.current, hv = hd ? Number(values[hd.key]) : NaN;
        if (hd && Number.isFinite(hv)) {
          // (Only the whole part decides the wall: the part up to the feature may take what its later features refuse.)
          if (result.ok) { if (!rolled && (hd.wall === 0 || Math.sign(hv - hd.lastOk) !== hd.wall)) hd.lastOk = hv; }
          else if (hv !== hd.lastOk) {
            hd.wall = Math.sign(hv - hd.lastOk);
            setActive(a => a && a.cmd === cmd ? { ...a, values: patchValues(a.cmd, a.ctx, a.values, { [hd.key]: hd.lastOk }), preview: 'busy' } : a);
            return;
          }
        }
        if (result.ok) { previewFor.current = rolled ? '' : JSON.stringify(values); setPreviewBodies(result.bodies); setActive(a => a && a.cmd === cmd ? { ...a, preview: !rolled && JSON.stringify(a.values) === JSON.stringify(values) ? 'ok' : 'busy', error: undefined } : a); }
        else if (live) { setPreviewBodies(null); setActive(a => a && { ...a, preview: 'error', error: result.error }); }
      };
      const run = previewRun.current;
      const pump = async () => { while (run.next) { const j = run.next; run.next = null; run.busy = true; try { await j(); } finally { run.busy = false; } } };
      const typed = Date.now() - lastTyped.current < 50;
      const t = setTimeout(() => { run.next = job; if (!run.busy) void pump(); }, typed ? 140 : 0);
      return () => { live = false; clearTimeout(t); };
    };
    const follow = () => { const a = activeStore.get(); if (a?.values === seen) return; seen = a?.values; stop?.(); stop = evaluate(a); };
    follow();
    const unsubscribe = activeStore.subscribe(follow);
    return () => { unsubscribe(); stop?.(); };
  };

  return { handleDrag, lastTyped, watch };
}
