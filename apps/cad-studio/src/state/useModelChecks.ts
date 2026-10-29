import { useEffect, useRef, useState } from 'react';
import { emptyDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { FriendlyError } from '@barocss/cad-model/engine/errors';
import type { Outcome } from '@barocss/cad-model/engine/schema/spec';
import type { KeepoutResult } from '@barocss/cad-model/engine/schema/references';
import { checkKeepouts, readReferences, referenceLocal, withKeepout } from '@barocss/cad-model/chat/references';
import { checkSpec } from '@barocss/cad-model/chat/spec';
import type { Active } from '../app/commandState';
import type { SketchState } from '../viewport/Viewport';
import type { EngineClient } from '../engine/client';
interface ModelCheckOptions {
  model: { doc: StudioDoc; evaluated: StudioDoc; bodies: BodyResult[]; fresh: boolean; busy: boolean; active: Active | null; sketch: SketchState | null; previewBodies: BodyResult[] | null };
  worker: { engine: EngineClient; nextRevision(): number };
  onNotice(notice: FriendlyError): void;
}
/** Reference display, keep-outs and requirements keep their independent existing cleanup guards. */
export function useModelChecks({ model, worker, onNotice: setToast }: ModelCheckOptions) {
  const { doc, evaluated, bodies, fresh, busy, active, sketch, previewBodies } = model;
  const { engine, nextRevision } = worker;
  const [refLocal, setRefLocal] = useState<ReadonlyMap<string, BodyResult[]>>(new Map());
  const [keepoutBodies, setKeepoutBodies] = useState<BodyResult[]>([]);
  const [keepoutVerdicts, setKeepoutVerdicts] = useState<KeepoutResult[] | null>(null);
  // The references read (each on its own, in its own coordinates) and the keep-outs' solids made, when they change.
  useEffect(() => {
    const set = readReferences(doc.references); let live = true;
    const read = (d: StudioDoc) => engine.part(d, nextRevision(), 'read');
    void (async () => {
      const local = new Map<string, BodyResult[]>();
      for (const r of set.references) { try { local.set(r.id, await referenceLocal(r, read)); } catch { local.set(r.id, []); } }
      const solids: BodyResult[] = [];
      for (const k of set.keepouts) { const p = withKeepout(emptyDoc(), k), e = await read(p.doc); if (e?.ok) solids.push(...e.bodies.map(b => ({ ...b, key: k.id }))); }
      if (live) { setRefLocal(local); setKeepoutBodies(solids); }
    })();
    return () => { live = false; };
  }, [doc.references, engine]);
  // The keep-outs checked against the part as it stands.
  useEffect(() => {
    const set = readReferences(doc.references);
    if (!set.keepouts.length || !fresh || busy) { if (!set.keepouts.length) setKeepoutVerdicts(null); return; }
    let live = true;
    const t = setTimeout(() => { void checkKeepouts({ ...evaluated, references: doc.references }, bodies, d => engine.part(d, nextRevision(), 'check')).then(v => { if (live) setKeepoutVerdicts(v); }).catch(() => { if (live) setKeepoutVerdicts(null); }); }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [doc.references, bodies, evaluated, fresh, busy, engine]);
  // The requirements checked against the part as it stands (chat/spec.ts), whenever either changes.
  // (After evaluation settles: debounced, a stale run dropped, none while a command previews or a sketch is open.
  // A person's edit is never refused for breaking a requirement — a hard one that passed and now fails is said.)
  const [spec, setSpec] = useState<{ summary: { pass: number; fail: number; unknown: number }; outcomes: Record<string, Outcome>; of: readonly unknown[] } | null>(null);
  const [specRunning, setSpecRunning] = useState(false);
  const specPassed = useRef<Set<string>>(new Set());
  useEffect(() => {
    // (R1d: cleared only when there is something to clear — a set to the same null rendered the App again after each
    // preview result.)
    if (!doc.requirements?.length) { if (spec !== null) setSpec(null); specPassed.current = new Set(); return; }
    if (busy || !fresh || active || sketch || previewBodies) return;
    let live = true;
    const t = setTimeout(() => {
      setSpecRunning(true);
      // (The evaluated model follows model edits only: the requirements are the document's own.)
      void checkSpec({ ...evaluated, requirements: doc.requirements, ...(doc.references ? { references: doc.references } : {}) }, bodies, d => engine.part(d, nextRevision(), 'check')).then(r => {
        if (!live) return;
        const broke = (doc.requirements ?? []).filter(q => q.hard && specPassed.current.has(q.id) && r.outcomes.get(q.id)?.status === 'fail').map(q => q.id);
        specPassed.current = new Set([...r.outcomes].filter(([, o]) => o.status === 'pass').map(([id]) => id));
        setSpec({ summary: r.summary, outcomes: Object.fromEntries(r.outcomes), of: evaluated.nodes });
        if (broke.length) setToast({ title: `${broke.join(', ')} now fail${broke.length === 1 ? 's' : ''}`, hint: `A hard requirement that held no longer does: ${broke.map(id => { const o = r.outcomes.get(id); return `${id} measures ${String(o?.measured)}`; }).join('; ')}. Your change is kept; undo it or change the part.`, detail: '' });
      }).finally(() => { if (live) setSpecRunning(false); });
    }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [doc.requirements, doc.references, bodies, evaluated, fresh, busy, active, sketch, previewBodies]);
  return { refLocal, keepoutBodies, keepoutVerdicts, spec, specRunning };
}
