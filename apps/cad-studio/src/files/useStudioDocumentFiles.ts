import type { RefObject } from 'react';
import { stripHistory } from '@barocss/cad-model/chat/proposals';
import { readDrawing } from '@barocss/cad-model/drawing/types';
import { collectRecoveryBlobs } from '@barocss/cad-model/engine/blobs';
import type { DirectGeometry } from '@barocss/cad-model/engine/direct';
import { placedDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import type { FriendlyError } from '@barocss/cad-model/engine/errors';
import { placementOf } from '@barocss/cad-model/engine/placement';
import type { Problem as RefProblem } from '@barocss/cad-model/engine/references';
import { readRender } from '@barocss/cad-model/engine/render';
import { clearRecovery } from '../app/recovery';
import type { EngineClient } from '../engine/client';
import type { OpenScope } from '../state/openOwnership';
import { currentDocumentSave } from '../state/saveOwnership';
import type { useProject } from '../storage/useProject';
import { placedProposalPreview } from '../viewport/instanceEvaluation';
import { readDocumentFile, verifyDocumentFile, writeDocumentFile } from './documentFile';
import { isImportedFile, openImportedFile } from './importedFile';
import { MAX_TASK_CHECKPOINT_BYTES, readTaskCheckpoint, TASK_CHECKPOINT_EXT, verifyTaskCheckpoint, type CheckpointReview } from './taskCheckpoint';
import { MAX_TASK_CANDIDATE_BYTES, readCandidateReview, TASK_CANDIDATE_EXT, verifyCandidateReview, type CandidateReview } from './taskCandidateReview';
import { useMeshImport } from './useMeshImport';

interface StudioDocumentFileOptions {
  document: {
    doc: StudioDoc;
    docNow: RefObject<StudioDoc>;
    fileName: string;
    fileNameNow: RefObject<string>;
    recoveryDoc: StudioDoc | null;
    project: Pick<ReturnType<typeof useProject>, 'save' | 'view'>;
  };
  ownership: {
    saveAcceptanceScope: object;
    saveDocumentToken: RefObject<object>;
    beginOpenIntent(): OpenScope;
    currentOpenScope(): OpenScope;
    isOpenCurrent(scope: OpenScope): boolean;
    sessionBlocked(action: string): boolean;
    canOpenImport(): boolean;
  };
  worker: {
    engine: EngineClient;
    workerSessionNow: RefObject<number>;
    nextRevision(): number;
    stopImport(): void;
  };
  changes: {
    replaceDoc(doc: StudioDoc): void;
    setDocState(doc: StudioDoc): void;
    setFileName(name: string): void;
    setDirty(dirty: boolean): void;
    setRefProblems(problems: RefProblem[]): void;
    onCheckpointOpened(review: CheckpointReview): void;
    onCandidateOpened(review: CandidateReview): void;
    commit(doc: StudioDoc): boolean;
    commitDirect(direct: DirectGeometry, selection?: string[]): boolean;
  };
  fit(): void;
  onNotice(notice: FriendlyError): void;
}

/** What Open reads, said when it is given another kind of file. */
const OPEN_READS = 'Open reads models (.bcad, .json), worker files (.bcad-run, .bcad-candidate), STEP (.step, .stp), STL, OBJ, IGES (.igs, .iges) and .barocad curve and surface sources. Your part is unchanged.';

/** File actions use the App's current document, dispatch and Worker ownership. */
export function useStudioDocumentFiles({ document, ownership, worker, changes, fit, onNotice: setToast }: StudioDocumentFileOptions) {
  const { doc, docNow, fileName, fileNameNow, recoveryDoc, project } = document;
  const { saveAcceptanceScope, saveDocumentToken, beginOpenIntent, currentOpenScope, isOpenCurrent, sessionBlocked, canOpenImport } = ownership;
  const { engine, workerSessionNow, nextRevision, stopImport } = worker;
  const { replaceDoc, setDocState, setFileName, setDirty, setRefProblems, commit, commitDirect } = changes;

  // (A document with mesh blobs is saved as the container, else as plain JSON: engine/container.ts. Saved, the
  // recovery copy and its blobs go.)
  const writeFile = (d: StudioDoc, name: string) => {
    try { writeDocumentFile(d, name); return true; }
    catch (e) { setToast({ title: 'Could not save', hint: e instanceof Error ? e.message : String(e), detail: '' }); return false; }
  };
  // (A copy still offered keeps its blobs: Restore can still bring it back.)
  const save = () => {
    if (sessionBlocked('saving')) return;
    // (CG6: into the open project — over the file it was read from, its tag expected — else downloaded, as before.)
    if (project.view.store) {
      const savedDoc = doc, owner = { token: saveAcceptanceScope, doc: savedDoc, name: fileNameNow.current };
      void project.save(savedDoc, owner.name, () => {
        if (!currentDocumentSave(owner, saveDocumentToken.current, docNow.current, fileNameNow.current)) return;
        setDirty(false); clearRecovery();
      });
      return;
    }
    if (!writeFile(doc, `${fileName}.bcad`)) return; setDirty(false); clearRecovery(); void collectRecoveryBlobs(recoveryDoc);
  };
  /** A copy to share: without the design history, nor the proposals' prompts and plans (chat/proposals.ts). */
  const saveShared = () => { if (sessionBlocked('saving')) return; writeFile(stripHistory(doc), `${fileName}-shared.bcad`); };

  const captureImportOwner = () => {
    const scope = currentOpenScope(), dispatch = saveDocumentToken.current, session = workerSessionNow.current;
    return { isCurrent: () => isOpenCurrent(scope) && saveDocumentToken.current === dispatch && workerSessionNow.current === session };
  };
  const fitImportedLater = () => {
    const accepted = captureImportOwner();
    setTimeout(() => { if (accepted.isCurrent()) fit(); }, 300);
  };
  const openedImport = (next: StudioDoc, name: string) => {
    if (!canOpenImport()) { sessionBlocked('opening an import'); return false; }
    replaceDoc(next); if (docNow.current !== next) return false;
    setFileName(name); setDirty(true); fitImportedLater(); return true;
  };
  const meshImport = useMeshImport({ doc, engine, captureOwner: captureImportOwner,
    onStop: stopImport,
    nextRevision, onNotice: setToast, onOpened: openedImport, onCommit: commit });
  const { setMeshAsk, setRepairAsk } = meshImport;
  const editRepair = (index: number) => { beginOpenIntent(); setMeshAsk(null); setRepairAsk(null); return meshImport.editRepair(index); };

  // The opened file's stored references checked against their signatures (no prior document: a newer kernel may
  // number faces otherwise, engine/references.ts); what moved is substituted, marked, and said.
  const verifyOpened = async (opened: StudioDoc, scope: OpenScope, dispatch: object) => {
    const current = () => isOpenCurrent(scope) && saveDocumentToken.current === dispatch && docNow.current === opened;
    // (O19: one that does not build because a stored name moved, REFERENCE_MOVED, is checked too — its moved names matched again, or held.)
    const v = await verifyDocumentFile(opened, d => engine.part(d, nextRevision(), 'refs'), current);
    if (!v || !current()) return;
    setRefProblems(v.problems);
    if (!v.changes.length && !v.problems.length) return;
    const cur = docNow.current;
    const next = { ...v.doc, render: cur.render, ...(v.doc.drawing ? { drawing: readDrawing(v.doc.drawing) } : {}) };
    // Apply only to this accepted dispatch, before any later edit or replacement.
    if (cur.print === undefined) delete next.print; else next.print = cur.print;
    if (cur.printPreview === undefined) delete next.printPreview; else next.printPreview = cur.printPreview;
    setDocState(next); setDirty(true);
  };

  const openCheckpoint = async (file: File, current: () => boolean) => {
    const refused = (hint: string) => setToast({ title: 'Could not open the worker checkpoint', hint, detail: '' });
    if (file.size > MAX_TASK_CHECKPOINT_BYTES) { refused('The worker checkpoint exceeds the supported file size.'); return; }
    const bytes = await file.arrayBuffer();
    if (!current()) return;
    const checkpoint = await readTaskCheckpoint(new Uint8Array(bytes), current);
    if (!checkpoint || !current()) return;
    const verified = await verifyTaskCheckpoint(checkpoint, d => engine.part(d, nextRevision(), 'read'), current);
    if (!verified || !current()) return;
    if ('error' in verified) { refused(verified.error); return; }
    if (sessionBlocked('opening a worker checkpoint')) return;
    // Keep the verified document exact. The standard native Open may repair references after adoption.
    replaceDoc(verified.doc);
    if (docNow.current !== verified.doc) return;
    changes.onCheckpointOpened(verified.review);
    setRefProblems([]);
    setFileName(file.name.slice(0, -TASK_CHECKPOINT_EXT.length));
    setDirty(false);
    fitImportedLater();
    const { receipt } = verified;
    setToast({ title: 'Worker checkpoint opened',
      hint: `Task ${receipt.taskId} · Revision ${receipt.revision} · ${verified.checks} required checks passed`,
      detail: `Accepted model SHA-256 ${receipt.accepted.sha256}` });
  };

  const openCandidate = async (file: File, current: () => boolean) => {
    const refused = (hint: string) => setToast({ title: 'Could not review the worker candidate', hint, detail: '' });
    const baseline = docNow.current;
    if (file.size > MAX_TASK_CANDIDATE_BYTES) { refused('The worker candidate exceeds the supported file size.'); return; }
    const text = await file.text();
    if (!current()) return;
    const candidate = readCandidateReview(text, baseline);
    if ('error' in candidate) { refused(candidate.error); return; }
    const verified = await verifyCandidateReview(candidate, d => current() ? engine.part(d, nextRevision(), 'read') : Promise.resolve(null));
    if (!current()) return;
    if ('error' in verified) { refused(verified.error); return; }
    const preview = await placedProposalPreview(baseline, candidate.doc, new Map(), (inst, base, parent) => {
      if (!current()) throw new Error('The worker candidate review moved.');
      return engine.placed(placedDoc(inst, parent), base, placementOf(inst), nextRevision());
    });
    if (!current()) return;
    const { occurrence, feature } = candidate.receipt.scope;
    if (preview?.kind !== 'ready' || preview.bodies.size !== 1 || !preview.bodies.has(occurrence)) {
      refused('Could not preview the exact placed occurrence.'); return;
    }
    if (sessionBlocked('reviewing a worker candidate')) return;
    changes.onCandidateOpened({ taskId: candidate.task.id, candidateDigest: candidate.receipt.candidateDigest, occurrence, feature,
      beforeMm: candidate.beforeMm, candidateMm: candidate.receipt.submission.heightMm, checks: verified.checks, preview });
  };

  const open = async (file: File) => {
    if (sessionBlocked('opening a file')) return;
    const scope = beginOpenIntent(), owner = captureImportOwner();
    setMeshAsk(null); setRepairAsk(null);
    try {
      if (file.name.toLowerCase().endsWith(TASK_CANDIDATE_EXT)) {
        await openCandidate(file, owner.isCurrent);
        return;
      }
      if (file.name.toLowerCase().endsWith(TASK_CHECKPOINT_EXT)) {
        await openCheckpoint(file, owner.isCurrent);
        return;
      }
      if (isImportedFile(file.name)) {
        await openImportedFile(file, { doc, ownership: owner, worker: { engine, nextRevision }, mesh: meshImport, onNotice: setToast,
          changes: { commitDirect, fitLater: fitImportedLater, onOpened: openedImport } });
        return;
      }
      // Any other kind of file is named, with what Open reads; the part unchanged. (A file without an extension is still
      // tried as a model below.)
      if (/\.[^./\\]+$/.test(file.name) && !/\.(bcad|json)$/i.test(file.name)) { setToast({ title: `Can’t open ${file.name}`, hint: OPEN_READS, detail: '' }); return; }
      // Checked and, for an older file, brought up to date (said what was filled in); the file is left as it is.
      const read = await readDocumentFile(file, () => isOpenCurrent(scope));
      if (!read || !isOpenCurrent(scope)) return;
      if ('error' in read) { setToast({ title: 'Could not open this file', hint: `${read.error} Your part is unchanged.`, detail: '' }); return; }
      const parsed = read.doc;
      const acceptedDoc = { ...parsed, ...(parsed.render ? { render: readRender(parsed.render) } : {}), ...(parsed.drawing ? { drawing: readDrawing(parsed.drawing) } : {}) };
      replaceDoc(acceptedDoc); setFileName(file.name.replace(/\.(bcad|json)$/, '')); setDirty(read.notes.length > 0);
      const accepted = currentOpenScope(), dispatch = saveDocumentToken.current;
      if (read.notes.length) setToast({ title: 'Opened an older model', hint: `${read.notes.join('; ')}. Save to keep it in the current form (the file is unchanged until then).`, detail: '' });
      setTimeout(() => { if (isOpenCurrent(accepted)) fit(); }, 300);
      void verifyOpened(acceptedDoc, accepted, dispatch);
    } catch (e) { if (owner.isCurrent()) { meshImport.setStage(null); setToast({ title: 'Could not open this file', hint: String(e instanceof Error ? e.message : e), detail: '' }); } }
  };

  return { open, save, saveShared, meshImport, editRepair };
}
