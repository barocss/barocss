import { createPreviewLifetime, ownedPreview } from './previewLifetime';
import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import { prefixDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { patchValues, shownFields, type Values } from '@barocss/cad-model/app/commands';
import { bodyName } from '@barocss/cad-model/app/bodies';
import { refOf } from '@barocss/cad-model/app/bodyRef';
import { awaitingExtrudeEndFace } from '@barocss/cad-model/app/extrudeEndFacePick';
import { awaitingRevolveAxis } from '@barocss/cad-model/app/revolveAxisEdit';
import { awaitingAlignTarget } from '@barocss/cad-model/app/alignCommand';
import { flattenAssembly } from '@barocss/cad-model/engine/flatten';
import { awaitingMirrorPlane, missingCommandField, type Active } from '../app/commandState';
import { commandNumberRule, featureNumberInvalid, featureNumberRange } from '../app/featureNumberInput';
import { edgeFinishFailure, failedFeatureText } from '../app/failedFeature';
import type { EngineClient } from '../engine/client';
import type { ValueStore } from './valueStore';
interface CommandPreviewOptions {
  command: { activeStore: ValueStore<Active | null>; bearingRootCurrent: boolean };
  /** `wholeMs`: the last whole-document evaluation's time, the cost of a whole-part preview until one of this document is measured. */
  worker: { engine: EngineClient; nextRevision(): number; currentBearingDoc(): StudioDoc; wholeMs?(): number };
  result: { setPreviewBodies: Dispatch<SetStateAction<BodyResult[] | null>>; previewFor: { current: string | null } };
}
/** A whole-part preview slower than this (ms) makes a handle drag show only the part up to the dragged feature (roadmap 20 ①). */
export const ROLL_AFTER_MS = 120;
/** The step-snapped value halfway between the last good value and the bound, or null when they are one step apart (or the pointer is not past the bound). */
function bisectValue(hd: { lastOk: number; bad: number | null; want: number; wall: number; step: number }): number | null {
  // (Only while the pointer asks for a value at or past the bound: a pointer between them is evaluated as it is.)
  if (hd.bad === null || (hd.want - hd.bad) * hd.wall < 0) return null;
  const gap = hd.bad - hd.lastOk, step = hd.step;
  if (!(Math.abs(gap) > step * (1 + 1e-9))) return null;
  let half = Math.round(gap / 2 / step) * step;
  if (!half) half = step * Math.sign(gap);
  return Math.abs(half) < Math.abs(gap) ? Math.round((hd.lastOk + half) * 1e6) / 1e6 : null;
}
/** The HUD preview queue and drag limits retain their original per-command subscription. */
export function useCommandPreview({ command, worker, result }: CommandPreviewOptions) {
  const { activeStore, bearingRootCurrent } = command, setActive = activeStore.set;
  const { engine, nextRevision, currentBearingDoc, wholeMs } = worker;
  const { setPreviewBodies, previewFor } = result;
  // Live preview: re-evaluate the candidate whenever HUD values change. One evaluation at a time, the
  // newest values next (a drag sends many): the preview keeps up as fast as the kernel does, with no
  // wait before it starts; values typed into a box wait a moment so each keystroke is not evaluated.
  const previewRun = useRef<{ busy: boolean; next: (() => Promise<void>) | null }>({ busy: false, next: null });
  /**
   * A dimension handle being dragged: its last value the kernel accepted, and once a value fails, the side
   * it failed on (`wall`) and the nearest failing value on that side (`bad`). The value at or past `bad` is
   * held at the last good one (no flicking between a broken and a good preview); the values between the two
   * are still tried, and the preview bisects toward the real limit (`step` apart at the end).
   */
  const handleDrag = useRef<{ key: string; lastOk: number; wall: number; bad: number | null; want: number; step: number; dragging: boolean } | null>(null);
  const lastTyped = useRef(0);
  /**
   * While a handle is dragged on a feature that later ones build on (a box under fillets), the preview is the
   * whole part as long as it keeps up: once a whole-part preview on this document took longer than ROLL_AFTER_MS
   * (`wholeCost`, else the document's own evaluation time), it is the part up to that feature — quick, so the body
   * keeps up with the pointer — and the whole part follows when the drag pauses or ends (`fullTimer`), which also
   * measures it again. (Keyed by the document, not the command: an idle handle's edit is a new command each time.)
   */
  const fullTimer = useRef(0), lifetime = useRef(createPreviewLifetime()), stopCurrent = useRef<(() => void) | undefined>(undefined);
  const retire = useCallback(() => { lifetime.current.retire(); stopCurrent.current?.(); previewRun.current.next = null; window.clearTimeout(fullTimer.current); handleDrag.current = null; lastTyped.current = 0; previewFor.current = null; setPreviewBodies(null); }, [setPreviewBodies, previewFor]);
  const wholeCost = useRef<{ doc: StudioDoc; ms: number } | null>(null);
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
      if (awaitingExtrudeEndFace(active.cmd.id, active.values) || awaitingRevolveAxis(active.cmd.id, active.values)
        || awaitingMirrorPlane(active.cmd.id, active.values) || (active.cmd.id === 'align' && awaitingAlignTarget(active.values))) {
        previewFor.current = null;
        setPreviewBodies(null);
        setActive(a => a === active ? { ...a, preview: 'input', error: undefined } : a);
        return;
      }
      let live = true; const ticket = lifetime.current.capture();
      const fields = shownFields(active.cmd.fields?.(active.ctx, active.values) ?? [], active.values);
      const missing = missingCommandField(fields, active.values);
      if (missing) { setPreviewBodies(null); setActive(a => a === active ? { ...a, preview: 'error', error: { title: 'Enter a value', hint: `${missing.label} is empty.`, detail: '' } } : a); return; }
      for (const field of fields) {
        const rule = commandNumberRule(active.cmd.id, field.key, active.values.op);
        if (!rule || !featureNumberInvalid(active.values[field.key], rule)) continue;
        setPreviewBodies(null);
        setActive(a => a === active ? { ...a, preview: 'error', error: { title: `Enter a valid ${field.label}`, hint: featureNumberRange(rule) + '.', detail: '' } } : a);
        return;
      }
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
        const slow = (wholeCost.current?.doc === ctx.doc ? wholeCost.current.ms : wholeMs?.() ?? 0) > ROLL_AFTER_MS;
        if (!full && slow && handleDrag.current?.dragging && candidate.nodes.length === ctx.doc.nodes.length) {
          // (The last node the drag changed: nodes it left are the same objects, compared by content only if not.)
          let k = -1; for (let i = 0; i < candidate.nodes.length; i++) { const n = candidate.nodes[i], o = ctx.doc.nodes[i]; if (n !== o && JSON.stringify(n) !== JSON.stringify(o)) k = i; }
          if (k >= 0 && k < candidate.nodes.length - 1) { shown = prefixDoc(candidate, k + 1); rolled = true; }
        }
        window.clearTimeout(fullTimer.current);
        const t0 = performance.now(), revision = nextRevision();
        const terminal = candidate.nodes.at(-1);
        const cutFeature = shown === candidate && cmd.id === 'extrude' && values.op === 'cut'
          && candidate.nodes.length > ctx.doc.nodes.length && terminal?.kind === 'difference' ? terminal.id : undefined;
        const reply = await ownedPreview(lifetime.current, ticket, () => engine.preview(shown, revision, cutFeature));
        if (reply.stale) return; const result = reply.result;
        if (!rolled) wholeCost.current = { doc: ctx.doc, ms: performance.now() - t0 };
        if (cmd.id === 'bearing' && ctx.bearingAssembly?.root !== currentBearingDoc()) return;
        if (rolled && live) fullTimer.current = window.setTimeout(() => { if (!live) return; run.next = () => job(true); if (!run.busy) void pump(); }, 220);
        // A queued update can use an intermediate result, unless this command was replaced or refused.
        const current = activeStore.get();
        // A replaced font invalidates every old ghost, including after the new upload finishes.
        if (current?.upload || current?.values.font !== values.font) return;
        if (!live && (!previewRun.current.next || !current || current.cmd !== cmd || current.ctx !== ctx || current.preview === 'error')) return;
        const hd = handleDrag.current, hv = hd ? Number(values[hd.key]) : NaN;
        let bisect = false;
        if (hd && Number.isFinite(hv)) {
          // (Only the whole part decides the bound: the part up to the feature may take what its later features refuse.)
          if (result.ok) {
            if (!rolled) {
              // (A stale success never moves the last good value back from the bound.)
              if (live || hd.bad === null || (hv - hd.lastOk) * hd.wall > 0) hd.lastOk = hv;
              if (hd.bad !== null && (hv - hd.bad) * hd.wall >= 0) { hd.bad = null; hd.wall = 0; }
              bisect = live;
            }
          } else if (hv !== hd.lastOk) {
            // The failing value closest to the last good one is the bound; a stale failure never resets the current value.
            const side = Math.sign(hv - hd.lastOk);
            if (hd.bad === null || side !== hd.wall || Math.abs(hv - hd.lastOk) < Math.abs(hd.bad - hd.lastOk)) { hd.bad = hv; hd.wall = side; }
            if (!live) return;
            const to = bisectValue(hd) ?? hd.lastOk;
            setActive(a => a && a.cmd === cmd ? { ...a, values: patchValues(a.cmd, a.ctx, a.values, { [hd.key]: to }), preview: 'busy' } : a);
            return;
          }
        }
        if (result.ok) {
          let extrudeResult: Active['extrudeResult'];
          let filletScope: Active['filletScope'];
          let chamferScope: Active['chamferScope'];
          if (shown === candidate && (terminal?.kind === 'fillet' || terminal?.kind === 'chamfer') && cmd.id === terminal.kind
            && candidate.nodes.length === ctx.doc.nodes.length + 1 && result.revision === revision) {
            const body = result.bodies.find(body => body.ref?.node === candidate.nodes.length - 1 && body.ref.side === 'solid');
            const targets = terminal.kind === 'chamfer' ? body?.chamferTargets : body?.filletTargets;
            const picked = [...new Set(terminal.edges)];
            if (terminal.kind === 'chamfer' && body && targets === undefined) {
              chamferScope = { picked };
            } else if (targets && picked.every(edge => targets.includes(edge))) {
              const added = targets.filter(edge => !picked.includes(edge));
              if (terminal.kind === 'chamfer') chamferScope = { picked, added };
              else if (typeof terminal.radius === 'number' && !terminal.section) {
                const [start, end] = terminal.radii ?? [];
                if (!terminal.radii) filletScope = { picked, added, radius: terminal.radius };
                else if (terminal.radii.length === 2 && start.atEnd && end.atEnd
                  && typeof start.radius === 'number' && typeof end.radius === 'number')
                  filletScope = { picked, added, pickedRadii: [start.radius, end.radius] };
              }
            }
          }
          if (shown === candidate && cmd.id === 'extrude' && candidate.nodes.length > ctx.doc.nodes.length
            && ((values.op === 'join' && terminal?.kind === 'union') || (values.op === 'cut' && terminal?.kind === 'difference'))) {
            const ref = terminal.kind === 'union' ? terminal.left : terminal.parent;
            const target = ctx.bodies.find(body => {
              const source = refOf(body);
              return ref.node === source.node && ref.side === source.side;
            });
            const outputs = result.bodies.filter(body => body.ref?.node === candidate.nodes.length - 1);
            const pieces = outputs.reduce((total, body) => total + (body.pieces ?? 1), 0);
            if (target) extrudeResult = { target: bodyName(ctx.doc, target), pieces,
              solid: outputs.length > 0 && outputs.every(body => body.family === 'upright') };
          }
          previewFor.current = rolled ? '' : JSON.stringify(values);
          setPreviewBodies(result.bodies);
          setActive(a => {
            if (!a || a.cmd !== cmd || a.ctx !== ctx) return a;
            const ready = !rolled && JSON.stringify(a.values) === JSON.stringify(values);
            return { ...a, preview: ready ? 'ok' : 'busy', error: undefined,
              extrudeResult: ready && a.values === values ? extrudeResult : undefined,
              filletScope: ready && a.values === values ? filletScope : undefined,
              chamferScope: ready && a.values === values ? chamferScope : undefined };
          });
        }
        else if (live && current?.cmd === cmd && current.ctx === ctx && current.values === values) {
          const failedFeature = result.revision === revision ? failedFeatureText(result.error.feature, shown.nodes, ctx.doc.nodes) : undefined;
          const error = shown === candidate && result.revision === revision && terminal?.kind === cmd.id
            ? edgeFinishFailure(result.error, terminal) : result.error;
          setPreviewBodies(null);
          setActive(a => a && { ...a, preview: 'error', error: { ...error, failedFeature } });
        }
        // Still a gap between the last good value and the bound: try the step-snapped middle of it next.
        // (Release does not stop this: it goes on from the value the pointer left, and Enter waits for the preview to settle on the converged value.)
        const mid = bisect && hd?.bad != null ? bisectValue(hd) : null;
        if (mid !== null) setActive(a => a && a.cmd === cmd && a.values === values ? { ...a, values: patchValues(a.cmd, a.ctx, a.values, { [hd!.key]: mid }), preview: 'busy' } : a);
      };
      const run = previewRun.current;
      const pump = async () => { while (run.next) { const j = run.next; run.next = null; run.busy = true; try { await j(); } finally { run.busy = false; } } };
      const typed = Date.now() - lastTyped.current < 50;
      const t = setTimeout(() => { run.next = job; if (!run.busy) void pump(); }, typed ? 140 : 0);
      return () => { live = false; clearTimeout(t); };
    };
    const follow = () => { const a = activeStore.get(); if (a?.values === seen) return; seen = a?.values; stop?.(); stop = evaluate(a); stopCurrent.current = stop; };
    follow();
    const unsubscribe = activeStore.subscribe(follow);
    return () => { unsubscribe(); stop?.(); };
  };

  return { handleDrag, lastTyped, watch, retire };
}
