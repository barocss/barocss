import { useRef, useState, type RefObject } from 'react';
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

export interface ModelExportContext {
  doc: StudioDoc;
  evaluated: StudioDoc;
  bodies: BodyResult[];
  fresh: boolean;
  busy: boolean;
  massReady: boolean;
  instanceBodies: ReadonlyMap<string, { bodies: BodyResult[] }>;
}

export interface ModelExportOptions {
  model: ModelExportContext;
  engine: EngineClient;
  fileName: string;
  /** App's synchronous accepted-document refs, not copies updated by an effect. */
  current: { doc: RefObject<StudioDoc>; evaluated: RefObject<StudioDoc> };
  onNotice(notice: FriendlyError): void;
}

/** STEP, STL, quote and 3MF actions for the current evaluated model. */
export function useModelExports({ model, engine, fileName, current, onNotice }: ModelExportOptions) {
  const { doc, evaluated, bodies, fresh, busy, massReady, instanceBodies } = model;
  const { doc: docNow, evaluated: evaluatedRef } = current;
  /** Asked how mesh bodies go out when the part has any (R3.5, D48): its answer kept in this browser. */
  const [stepAsk, setStepAsk] = useState(false);
  const [stlAsk, setStlAsk] = useState(false), [stlQuality, setStlQuality] = useState<'automatic' | '8' | '16' | '32'>('automatic'), [stlBusy, setStlBusy] = useState(false);
  const stlGeneration = useRef(0), stlPending = useRef(false), stlCancelButton = useRef<HTMLButtonElement>(null);
  const cancelStlExport = () => { stlGeneration.current++; stlPending.current = false; setStlBusy(false); setStlAsk(false); };
  const askStlExport = () => { stlGeneration.current++; stlPending.current = false; setStlBusy(false); setStlQuality('automatic'); setStlAsk(true); };
  const exportStepFile = async (meshes?: 'auto' | 'tessellated' | 'planar') => {
    // (An infill body is left out of STEP, O60: it asks nothing.)
    if (!meshes && bodies.some(b => b.family === 'faceted' && b.role !== 'infill')) { setStepAsk(true); return; }
    setStepAsk(false);
    if (meshes) { try { localStorage.setItem('studio.stepMeshes', meshes); } catch { /* private mode */ } }
    // (The evaluated model, with the instances placed beside it now.)
    const r = await engine.step({ ...evaluated, instances: doc.instances }, fileName, meshes);
    if ('text' in r) { downloadBytes(new TextEncoder().encode(r.text), `${fileName}.step`, 'model/step'); const w = draftWarning(doc); if (w) onNotice({ title: 'STEP written as a draft', hint: [w, ...(r.omitted ?? [])].join(' '), detail: '' }); else if (r.omitted) onNotice({ title: 'STEP written', hint: r.omitted.join(' '), detail: '' }); }
    else onNotice({ title: 'Could not write STEP', hint: 'Fix the model’s errors first, then export again.', detail: r.error });
  };
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

  const clearStepAsk = () => setStepAsk(false);
  const changeStlQuality = (value: string) => {
    if (value === 'automatic' || value === '8' || value === '16' || value === '32') { stlGeneration.current++; setStlQuality(value); }
  };
  return { stepAsk, stlAsk, stlQuality, stlBusy, stlCancelButton, clearStepAsk, changeStlQuality,
    askStlExport, cancelStlExport, exportStepFile, exportStl, exportQuote, exportThreeMf };
}

export type ModelExportController = ReturnType<typeof useModelExports>;
