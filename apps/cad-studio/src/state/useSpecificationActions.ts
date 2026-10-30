import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { FriendlyError } from '@barocss/cad-model/engine/errors';
import type { BriefKey } from '@barocss/cad-model/engine/schema/brief';
import type { Placement } from '@barocss/cad-model/engine/schema/references';
import { applyBrief, confirmField, readBrief } from '@barocss/cad-model/chat/brief';
import { acceptAssumptions, answerBatch } from '@barocss/cad-model/chat/questions';
import { runDraftTool } from '@barocss/cad-model/chat/drafts';
import { readReferences, runReferenceTool } from '@barocss/cad-model/chat/references';
import { meshInMM, readMeshFile } from '@barocss/cad-model/engine/meshImport';
import type { EngineClient } from '../engine/client';
export function useSpecificationActions({ doc, bodies, commit, engine, revision, setToast, setChat, setChatOutbox }: {
  doc: StudioDoc; bodies: BodyResult[]; commit(next: StudioDoc, reset?: boolean): boolean;
  engine: EngineClient; revision: { current: number }; setToast(notice: FriendlyError): void;
  setChat(open: boolean): void; setChatOutbox(message: { id: number; text: string }): void;
}) {
  /** An assumed (or ambiguous) requirement's value set by the user, and confirmed: stated from now on, with who and when. */
  const setRequirement = (id: string, value: number) => {
    if (!Number.isFinite(value)) return;
    commit({ ...doc, requirements: doc.requirements!.map(q => q.id !== id ? q : { ...q, basis: 'stated' as const, confirmed: { by: 'user', at: new Date().toISOString() }, check: q.check.op === 'between' ? q.check : { ...q.check, value } }) }, false);
  };
  /** The user's answers to the agent's questions, or all its assumptions accepted (A6.2): written as the user's, and
   * sent to the chat as their message. */
  const answerQuestions = (answers: Record<string, string | number | null>) => {
    const r = answerBatch(doc, answers, new Date().toISOString());
    if ('error' in r) { setToast({ title: 'Answer not taken', hint: r.error, detail: '' }); return; }
    if (!commit(applyBrief(r.doc, readBrief(r.doc.brief)), false)) return; setChat(true); setChatOutbox({ id: Date.now(), text: r.message });
  };
  const acceptAll = () => {
    const r = acceptAssumptions(doc, new Date().toISOString()); if (!r.count) return;
    if (!commit(applyBrief(r.doc, readBrief(r.doc.brief)), false)) return; setChat(true); setChatOutbox({ id: Date.now(), text: r.message });
  };
  /** The References card's actions (A6.3): through the same tool code the agent uses; a reference itself is the user's. */
  const refTool = async (name: string, args: Record<string, unknown>) => {
    const out = await runReferenceTool(doc, bodies, name, args, d => engine.part(d, revision.current++, 'read'));
    if ('error' in out) { setToast({ title: 'Reference not changed', hint: out.error.replace(/^\[[A-Z_]+\] /, ''), detail: out.error }); return; }
    if (out.changed) commit(out.doc, false);
  };
  /** A DXF drawing added to the part as a sketch draft (A6.4): its dimensions the user's to confirm. */
  const addDrawingFile = async (file: File) => {
    const out = runDraftTool(doc, 'import_drawing', { dxf: await file.text(), name: file.name.replace(/\.dxf$/i, '') });
    if ('error' in out) { setToast({ title: 'Could not read this drawing', hint: out.error.replace(/^\[[A-Z_]+\] /, ''), detail: out.error }); return; }
    if (!commit(out.doc)) return;
    const c = out.content as { draft: string | null; dims?: { key: string }[]; unit: string; underlay?: Record<string, number>; left_out?: Record<string, number> };
    // (O68: what came in as the underlay, to trace over — never geometry.)
    const list = (r: Record<string, number>) => Object.entries(r).map(([t, n]) => `${n} ${t}`).join(', '), under = c.underlay ? ` Shown as an underlay: ${list(c.underlay)}.` : '';
    setToast(c.draft ? { title: 'Drawing added as a draft', hint: `A sketch in ${c.unit}; ${c.dims!.length} dimensions to confirm in Drafts.${under}${c.left_out ? ` Left out: ${list(c.left_out)}.` : ''}`, detail: '' }
      : { title: 'Drawing added as an underlay', hint: `No closed profile to make a sketch of: the drawing is shown to trace over, in ${c.unit}.${under}${c.left_out ? ` Left out: ${list(c.left_out)}.` : ''}`, detail: '' });
  };
  const addReferenceFile = async (file: File) => {
    const name = file.name.replace(/\.[^.]+$/, '');
    if (/\.(step|stp)$/i.test(file.name)) return refTool('add_reference', { name, step: await file.text() });
    const m = meshInMM(readMeshFile(file.name, new Uint8Array(await file.arrayBuffer())), 'mm');
    return refTool('add_reference', { name, mesh: { positions: m.positions, indices: m.indices } });
  };
  const placeRef = (id: string, at: Placement) => { const set = readReferences(doc.references); commit({ ...doc, references: { ...set, references: set.references.map(r => (r.id === id ? { ...r, at } : r)) } }, false); };
  const removeRef = (id: string) => {
    if (!/^ref\d+$/.test(id)) { void refTool('delete_reference_item', { id }); return; }
    // (The user's: the reference, with the datums taken from it and the keep-outs around it.)
    const set = readReferences(doc.references);
    commit({ ...doc, references: { ...set, references: set.references.filter(r => r.id !== id), datums: set.datums.filter(d => d.of?.reference !== id), keepouts: set.keepouts.filter(k => k.around?.reference !== id) } }, false);
  };
  /** A brief field confirmed by the user as it is (A6.1): stated from now on; a stated process becomes the part's. */
  const confirmBrief = (key: BriefKey) => { const b = readBrief(doc.brief); if (!b) return; const next = confirmField(b, key, new Date().toISOString()); if ('error' in next) return; commit(applyBrief(doc, next), false); };

  return { setRequirement, answerQuestions, acceptAll, refTool, addDrawingFile, addReferenceFile, placeRef, removeRef, confirmBrief };
}
