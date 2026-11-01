import { useEffect, useRef, useState, type RefObject } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluateDoc, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { FriendlyError } from '@barocss/cad-model/engine/errors';
import { bodyName } from '@barocss/cad-model/app/bodies';
import { draftWarning } from '@barocss/cad-model/chat/drafts';
import { sourceBytes, sourceRecord } from '@barocss/cad-model/team/source';
import { quotePackage } from '@barocss/cad-model/mould/quote';
import { withCutNodes } from '@barocss/cad-model/assembly/cuts';
import { write3mf } from '@barocss/cad-model/print/threemf';
import { threeMfModelOf } from '@barocss/cad-model/print/export3mf';
import { looksOnFold } from '@barocss/cad-model/assembly/looks';
import { placedLooksOf } from '../state/useInstanceLooks';
import type { EngineClient } from '../engine/client';
import { downloadBytes, lumpStls, meshToStl } from '../ui/files';
import { createStepPreparation, type StepPreview, type StepMeshes } from './stepExportPreparation';

export interface ModelExportContext {
  doc: StudioDoc;
  evaluated: StudioDoc;
  shown: StudioDoc;
  bodies: BodyResult[];
  fresh: boolean;
  busy: boolean;
  massReady: boolean;
  instancesFresh: boolean;
  instanceBodies: ReadonlyMap<string, { bodies: BodyResult[] }>;
}

export interface ModelExportOptions {
  model: ModelExportContext;
  engine: EngineClient;
  fileName: string;
  /** App's synchronous accepted-document refs, not copies updated by an effect. */
  current: { doc: RefObject<StudioDoc>; evaluated: RefObject<StudioDoc>; shown: RefObject<StudioDoc>; name?: RefObject<string> };
  onNotice(notice: FriendlyError): void;
}

function currentStepOwner(s: { model: ModelExportContext; fileName: string; current: ModelExportOptions['current'] }) {
  const visible = (s.model.shown.instances ?? []).filter(i => !i.hidden);
  const all = [...s.model.bodies, ...visible.flatMap(i => s.model.instanceBodies.get(i.id)?.bodies ?? [])];
  return { doc: s.current.doc.current, shown: s.current.shown.current, evaluated: s.current.evaluated.current, name: s.current.name?.current ?? s.fileName,
    fresh: s.model.fresh && s.model.instancesFresh && !s.model.busy && s.current.doc.current === s.model.doc && s.current.evaluated.current === s.model.evaluated && s.current.shown.current === s.model.shown,
    hasBody: all.some(b => b.role !== 'infill' && !b.band), hasMeshes: all.some(b => b.family === 'faceted' && b.role !== 'infill') };
}
function lastStepMeshes(): StepMeshes {
  try { const stored = localStorage.getItem('studio.stepMeshes'); if (stored === 'planar' || stored === 'tessellated') return stored; } catch { /* private mode */ }
  return 'auto';
}

/** STEP, STL, quote and 3MF actions for the current evaluated model. */
export function useModelExports({ model, engine, fileName, current, onNotice }: ModelExportOptions) {
  const { doc, evaluated, bodies, fresh, busy, massReady, instanceBodies } = model;
  const { doc: docNow, evaluated: evaluatedRef } = current;
  /** Asked how mesh bodies go out when the part has any (R3.5, D48): its answer kept in this browser. */
  const [stepPreview, setStepPreview] = useState<StepPreview | null>(null);
  const stepLatest = useRef({ model, engine, fileName, current, onNotice }); stepLatest.current = { model, engine, fileName, current, onNotice };
  const stepControl = useRef<ReturnType<typeof createStepPreparation> | null>(null);
  if (!stepControl.current) stepControl.current = createStepPreparation({
    current: () => currentStepOwner(stepLatest.current),
    step: (d, name, meshes) => stepLatest.current.engine.step(d, name, meshes), changed: setStepPreview,
    notice: hint => stepLatest.current.onNotice({ title: 'STEP not prepared', hint, detail: '' }),
    download: (bytes, name, captured) => { downloadBytes(bytes, name, 'model/step'); const warning = draftWarning(captured); if (warning) stepLatest.current.onNotice({ title: 'STEP written as a draft', hint: warning, detail: '' }); },
  });
  const clearStepAsk = stepControl.current.cancel;
  useEffect(() => { stepControl.current?.reconcile(); }, [doc, evaluated, model.shown, fileName, fresh, busy, instanceBodies, model.instancesFresh]);
  useEffect(() => () => stepControl.current?.dispose(), []);
  const [stlAsk, setStlAsk] = useState(false), [stlQuality, setStlQuality] = useState<'automatic' | '8' | '16' | '32'>('automatic'), [stlBusy, setStlBusy] = useState(false);
  const stlGeneration = useRef(0), stlPending = useRef(false), stlCancelButton = useRef<HTMLButtonElement>(null);
  const cancelStlExport = () => { stlGeneration.current++; stlPending.current = false; setStlBusy(false); setStlAsk(false); };
  const askStlExport = () => { stlGeneration.current++; stlPending.current = false; setStlBusy(false); setStlQuality('automatic'); setStlAsk(true); };
  const exportStepFile = async (choice?: StepMeshes) => {
    const meshes = choice ?? lastStepMeshes();
    try { localStorage.setItem('studio.stepMeshes', meshes); } catch { /* private mode */ }
    await stepControl.current!.prepare(meshes);
  };
  const downloadStep = stepControl.current.download;
  const exportStl = async () => {
    if (stlPending.current) return;
    if (!fresh) { setStlAsk(false); onNotice({ title: 'Not written yet', hint: busy ? 'The part is still evaluating: export once it is up to date.' : 'The part did not evaluate: fix it first.', detail: '' }); return; }
    const captured = { doc, evaluated, bodies: [...bodies], quality: stlQuality, name: fileName }, explicit = captured.quality !== 'automatic';
    const refuse = (hint: string, detail = '') => { setStlAsk(false); onNotice({ title: 'Could not write STL', hint, detail }); };
    if (!captured.bodies.length) { refuse('There are no root bodies to export.'); return; }
    if (explicit && captured.doc.instances?.some(i => !i.hidden)) { refuse('This STL quality cannot export a document with visible placed instances. Export the placed part from its own document.'); return; }
    if (explicit) for (const body of captured.bodies) {
      if (body.lumpTouch?.length) { refuse(`${bodyName(captured.doc, body)} needs a separate STL for each touching piece. That output uses the on-screen mesh; use Automatic.`); return; }
      if (body.family === 'faceted') { refuse(`${bodyName(captured.doc, body)} is a mesh body. The selected STL quality needs a BRep body; use Automatic.`); return; }
    }
    const generation = ++stlGeneration.current;
    stlPending.current = true; setStlBusy(true); stlCancelButton.current?.focus();
    const current = () => {
      if (stlGeneration.current !== generation) return false;
      if (docNow.current !== captured.doc || evaluatedRef.current !== captured.evaluated) { refuse('The design changed while the STL files were being prepared. Export the current design again.'); return false; }
      return true;
    };
    try {
      const fallback: string[] = [], prepared: { name: string; bytes: Uint8Array }[] = [];
      let split = 0;
      for (const body of captured.bodies) {
        // Automatic keeps the existing display-mesh split for touching pieces.
        const lumps = !explicit && body.lumpTouch?.length ? lumpStls(body.mesh, body.key) : null;
        if (lumps) { split++; for (const f of lumps) prepared.push({ name: `${captured.name}-${body.key}-lump${f.lump + 1}.stl`, bytes: f.bytes }); continue; }
        const kernel = captured.quality === 'automatic'
          ? await engine.stl(captured.evaluated, body.key)
          : await engine.stl(captured.evaluated, body.key, { segmentsPerQuarter: Number(captured.quality) });
        if (!current()) return;
        if (kernel && 'error' in kernel) { refuse(`STL export stopped for ${bodyName(captured.doc, body)}.`, kernel.error); return; }
        if (!kernel && explicit) { refuse(`The kernel could not write ${bodyName(captured.doc, body)} at the selected STL quality. No files were downloaded.`); return; }
        if (!kernel) fallback.push(bodyName(captured.doc, body));
        prepared.push({ name: `${captured.name}-${body.key}.stl`, bytes: kernel ?? meshToStl(body.mesh, body.key) });
      }
      // Prepare the sidecar before any download: a failed body or stale request writes no files.
      const names = prepared.map(f => f.name), sidecar = sourceBytes(sourceRecord(captured.doc, names));
      if (!current()) return;
      for (const file of prepared) downloadBytes(file.bytes, file.name, 'model/stl');
      downloadBytes(sidecar, `${captured.name}.source.json`, 'application/json');
      setStlAsk(false);
      onNotice({ title: `STL written: ${prepared.length} file${prepared.length === 1 ? '' : 's'}`, hint: `${draftWarning(captured.doc) ? `${draftWarning(captured.doc)} ` : ''}Triangles in millimetres, one file per body; no colours, names or exact curves.${fallback.length ? ` ${fallback.join(', ')} ${fallback.length === 1 ? 'was' : 'were'} written from the on-screen mesh (the kernel’s tessellation refused ${fallback.length === 1 ? 'it' : 'them'}).` : ''}${split ? ' A body whose pieces only touch along an edge or a point is written as one STL a piece; 3MF keeps them in one file as separate objects.' : ''}`, detail: '' });
    } catch (error) {
      if (current()) refuse('STL export could not finish.', error instanceof Error ? error.message : String(error));
    } finally {
      if (stlGeneration.current === generation) { stlPending.current = false; setStlBusy(false); }
    }
  };

  /** The quote package (IM6, O82): the part as STEP, its moulding report and the request, one zip; what is open said. */
  const exportQuote = async () => {
    if (!fresh) { onNotice({ title: 'Not written yet', hint: busy ? 'The part is still evaluating: export once it is up to date.' : 'The part did not evaluate: fix it first.', detail: '' }); return; }
    if (!massReady) { onNotice({ title: 'Not written yet', hint: 'The part\'s masses are still being worked out: export in a moment.', detail: '' }); return; }
    const q = await quotePackage(doc, bodies, async d => evaluateDoc(d, 0), { name: fileName });
    if ('error' in q) { onNotice({ title: 'No quote package', hint: q.error, detail: '' }); return; }
    downloadBytes(q.zip, `${fileName}-quote.zip`, 'application/zip');
    onNotice({ title: q.manifest.complete ? 'Quote package written' : `Quote package written: ${q.manifest.open.length} open`, hint: q.manifest.complete ? 'STEP, the moulding report and the request — no price: the moulder quotes it.' : q.manifest.open.join(' · '), detail: '' });
  };

  /** 3MF (AM5, D76): every shown body and instance, its material and colours, turned the way it prints when chosen. */
  const exportThreeMf = async () => {
    if (!fresh) { onNotice({ title: 'Not written yet', hint: busy ? 'The part is still evaluating: export once it is up to date.' : 'The part did not evaluate: fix it first.', detail: '' }); return; }
    const parts = [{ doc, bodies }, ...(doc.instances ?? []).filter(i => !i.hidden && instanceBodies.has(i.id)).map(i => {
      // (Roadmap 10 ①: each body in the definition's colours and material, this occurrence's own over them.)
      const bodies = instanceBodies.get(i.id)!.bodies;
      // (Roadmap 10 ⑤: a cut part's bodies name their features in the cut part's nodes.)
      return { doc: withCutNodes(i.doc, i, doc), bodies, name: i.name, looks: looksOnFold(i, placedLooksOf(i, doc, bodies).targets) };
    })];
    const model = threeMfModelOf(doc, parts, fileName);
    const r = typeof model === 'string' ? { error: model } : await write3mf(model);
    if ('error' in r) { onNotice({ title: 'Could not write 3MF', hint: r.error, detail: '' }); return; }
    downloadBytes(r.bytes, `${fileName}.3mf`, 'model/3mf');
    const s = r.stats, open = s.openEdges + s.repeatedEdges;
    onNotice({ title: `3MF written: ${s.objects} bod${s.objects === 1 ? 'y' : 'ies'}, ${s.triangles.toLocaleString()} triangles`, hint: `${draftWarning(doc) ? `${draftWarning(doc)} ` : ''}${doc.print ? 'Turned the way it prints and set on the bed. ' : 'As modelled (choose a print direction to have it turned for printing). '}The on-screen mesh, in millimetres, with materials and colours.${open ? ` ${open} edges are not closed: the slicer may repair it.` : ''}`, detail: '' });
  };

  const changeStlQuality = (value: string) => {
    if (value === 'automatic' || value === '8' || value === '16' || value === '32') { stlGeneration.current++; setStlQuality(value); }
  };
  return { stepAsk: !!stepPreview, stepPreview, downloadStep, stlAsk, stlQuality, stlBusy, stlCancelButton, clearStepAsk, changeStlQuality,
    askStlExport, cancelStlExport, exportStepFile, exportStl, exportQuote, exportThreeMf };
}

export type ModelExportController = ReturnType<typeof useModelExports>;
