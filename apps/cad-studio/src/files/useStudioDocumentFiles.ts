import { useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { stripHistory } from '@barocss/cad-model/chat/proposals';
import { readDrawing } from '@barocss/cad-model/drawing/types';
import { collectRecoveryBlobs } from '@barocss/cad-model/engine/blobs';
import type { DirectGeometry } from '@barocss/cad-model/engine/direct';
import { placedDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import type { FriendlyError } from '@barocss/cad-model/engine/errors';
import { placementOf } from '@barocss/cad-model/engine/placement';
import type { Problem as RefProblem } from '@barocss/cad-model/engine/references';
import { digestOf } from '@barocss/cad-model/util/digest';
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
import { candidateReviewOnBaseline, decodeCandidateReview, matchesCurrentCandidateReview, MAX_TASK_CANDIDATE_BYTES, TASK_CANDIDATE_EXT, verifyCandidateReview, type CandidateReview, type CandidateReviewReceipt } from './taskCandidateReview';
import { useMeshImport } from './useMeshImport';
import { downloadBytes } from '../ui/files';
import type { RequirementEvidence } from '@barocss/cad-model/chat/requirementEvidence';
import { planWorkingApprovalRepair, readWorkingApprovalChecks } from './workingApprovalChecks';
import { localTaskCheckpointBytes, localTaskRunJSON } from '../chat/localTaskRun';
import { isLocalTaskRunHost, isTaskRunStatus, sameTaskRunCheckpoint, retiresTaskRunReview, type TaskRunLaunch, type TaskRunOffer,
  type TaskRunCheckpointRequest, type TaskRunReviewRequest, type TaskRunStatus } from '../chat/taskRunOffer';

interface StudioDocumentFileOptions {
  document: {
    doc: StudioDoc;
    docNow: RefObject<StudioDoc>;
    fileName: string;
    fileNameNow: RefObject<string>;
    recoveryDoc: StudioDoc | null;
    project: Pick<ReturnType<typeof useProject>, 'save' | 'view' | 'readTaskSource' | 'taskSourceKey'>;
  };
  ownership: {
    saveAcceptanceScope: object;
    saveDocumentToken: RefObject<object>;
    beginOpenIntent(): OpenScope;
    currentOpenScope(): OpenScope;
    isOpenCurrent(scope: OpenScope): boolean;
    sessionBlocked(action: string): boolean;
    canOpenImport(): boolean;
    canReviewLocalCandidate(occurrence?: string): boolean;
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
    onLocalCandidateReviewIntent(): void;
    onTaskRunStatus(status: TaskRunStatus): void;
    commit(doc: StudioDoc): boolean;
    commitDirect(direct: DirectGeometry, selection?: string[]): boolean;
  };
  fit(): void;
  onNotice: Dispatch<SetStateAction<FriendlyError | null>>;
}

/** What Open reads, said when it is given another kind of file. */
const OPEN_READS = 'Open reads models (.bcad, .json), worker files (.bcad-run, .bcad-candidate), STEP (.step, .stp), STL, OBJ, IGES (.igs, .iges) and .barocad curve and surface sources. Your part is unchanged.';
const CANDIDATE_REVIEW_REFUSED = 'Could not review the worker candidate';

/** File actions use the App's current document, dispatch and Worker ownership. */
export function useStudioDocumentFiles({ document, ownership, worker, changes, fit, onNotice: setToast }: StudioDocumentFileOptions) {
  const { doc, docNow, fileName, fileNameNow, recoveryDoc, project } = document;
  const { saveAcceptanceScope, saveDocumentToken, beginOpenIntent, currentOpenScope, isOpenCurrent, sessionBlocked, canOpenImport } = ownership;
  const { engine, workerSessionNow, nextRevision, stopImport } = worker;
  const { replaceDoc, setDocState, setFileName, setDirty, setRefProblems, commit, commitDirect } = changes;
  const candidateIntent = useRef<{ local?: { request: TaskRunReviewRequest; status?: TaskRunStatus } }>(null);
  const checkpointIntent = useRef<{ request: TaskRunCheckpointRequest; status?: TaskRunStatus }>(null);
  const cancelLocalCandidateReview = () => {
    if (candidateIntent.current?.local) candidateIntent.current = null;
  };

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

  const withTaskRunHandoff = async <T>(offer: TaskRunOffer, sourceKey: string, action: string,
    use: (handoff: Uint8Array, file: string) => T) => {
    if (sessionBlocked(action)) return;
    const scope = currentOpenScope(), sourceDoc = docNow.current, token = saveDocumentToken.current, name = fileNameNow.current;
    const current = () => isOpenCurrent(scope) && saveDocumentToken.current === token && docNow.current === sourceDoc && fileNameNow.current === name;
    try {
      if (digestOf(sourceDoc) !== offer.revision)
        throw new Error('The working model differs from the reviewed plan. Save and inspect it again.');
      const source = await project.readTaskSource(sourceKey);
      if (!current() || !source.current()) return;
      const { encodeTaskRunHandoff, TASK_RUN_HANDOFF_EXT } = await import('./taskRunHandoff');
      const handoff = await encodeTaskRunHandoff(offer, source.bytes);
      if (!current() || !source.current()) return;
      await source.verify();
      if (current() && source.current()) return use(handoff, name + TASK_RUN_HANDOFF_EXT);
    } catch (error) {
      if (current()) throw error;
    }
  };

  const exportTaskRun = async (offer: TaskRunOffer, sourceKey: string) => {
    try {
      await withTaskRunHandoff(offer, sourceKey, 'exporting a task run',
        (handoff, file) => downloadBytes(handoff, file, 'application/octet-stream'));
    } catch (error) {
      setToast({ title: 'Could not export task run', hint: error instanceof Error ? error.message : String(error), detail: '' });
    }
  };

  const startTaskRun = async (offer: TaskRunOffer, sourceKey: string): Promise<TaskRunLaunch | undefined> => {
    if (!isLocalTaskRunHost(window.location.hostname)) throw new Error('Open Studio on this computer to start a local task run.');
    return withTaskRunHandoff(offer, sourceKey, 'starting a task run', async handoff => {
      const value = await localTaskRunJSON('start', new Blob([handoff as BlobPart]));
      const { directory, reused } = value;
      if (typeof directory !== 'string' || typeof reused !== 'boolean' || !isTaskRunStatus(value))
        throw new Error('The local task run service returned an invalid result.');
      return { ...value, directory, reused };
    });
  };

  const refreshTaskRun = async (run: TaskRunStatus): Promise<TaskRunStatus> => {
    const value = await localTaskRunJSON('status', JSON.stringify({ runKey: run.runKey, runId: run.runId }));
    if (!isTaskRunStatus(value) || value.runKey !== run.runKey || value.runId !== run.runId || value.revision < run.revision)
      throw new Error('The local task run service returned a different or older run status.');
    const { runKey, runId, phase, revision, baselineDigest, checkpoint, approvals, tasks } = value;
    return { runKey, runId, phase, revision, baselineDigest, checkpoint, approvals, tasks };
  };

  const observeTaskRunStatus = (status: TaskRunStatus) => {
    const { runKey, runId, revision } = status;
    const local = candidateIntent.current?.local;
    if (local && local.request.runKey === runKey && local.request.runId === runId && (!local.status || local.status.revision <= revision))
      local.status = status;
    const checkpoint = checkpointIntent.current;
    if (checkpoint && checkpoint.request.runKey === runKey && checkpoint.request.runId === runId
      && (!checkpoint.status || checkpoint.status.revision <= revision)) checkpoint.status = status;
    changes.onTaskRunStatus(status);
  };

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

  const verifyCheckpoint = async (bytes: Uint8Array, current: () => boolean, request?: TaskRunCheckpointRequest) => {
    const checkpoint = await readTaskCheckpoint(bytes, current);
    if (!checkpoint || !current()) return;
    if (request && !('error' in checkpoint)) {
      const { receipt } = checkpoint;
      if (receipt.runId !== request.runId || !sameTaskRunCheckpoint(request, {
        taskId: receipt.taskId, operationId: receipt.operationId, acceptedSHA256: receipt.accepted.sha256,
      })) throw new Error('The local run returned a different approved checkpoint.');
    }
    const verified = await verifyTaskCheckpoint(checkpoint, d => engine.part(d, nextRevision(), 'read'), current);
    if (!verified || !current()) return;
    if ('error' in verified) throw new Error(verified.error);
    return verified;
  };

  const adoptCheckpoint = (verified: NonNullable<Awaited<ReturnType<typeof verifyCheckpoint>>>, name: string) => {
    if (sessionBlocked('opening a worker checkpoint')) return;
    // Keep the verified document exact. The standard native Open may repair references after adoption.
    replaceDoc(verified.doc);
    if (docNow.current !== verified.doc) return;
    changes.onCheckpointOpened(verified.review);
    setRefProblems([]);
    setFileName(name);
    setDirty(false);
    fitImportedLater();
    const { receipt } = verified;
    setToast({ title: 'Worker checkpoint opened',
      hint: `Task ${receipt.taskId} · Revision ${receipt.revision} · ${verified.checks} required checks passed`,
      detail: `Accepted model SHA-256 ${receipt.accepted.sha256}` });
  };

  const openCheckpoint = async (file: File, current: () => boolean) => {
    try {
      if (file.size > MAX_TASK_CHECKPOINT_BYTES) throw new Error('The worker checkpoint exceeds the supported file size.');
      const bytes = await file.arrayBuffer();
      if (!current()) return;
      const verified = await verifyCheckpoint(new Uint8Array(bytes), current);
      if (verified && current()) adoptCheckpoint(verified, file.name.slice(0, -TASK_CHECKPOINT_EXT.length));
    } catch (error) {
      if (current()) setToast({ title: 'Could not open the worker checkpoint', hint: error instanceof Error ? error.message : String(error), detail: '' });
    }
  };

  const readTaskRunApproval = async (request: TaskRunCheckpointRequest, current: () => boolean) => {
    const bytes = await localTaskCheckpointBytes(request, current, 'history');
    if (!bytes || !current()) return;
    return (await verifyCheckpoint(bytes, current, request))?.review;
  };

  const checkWorkingApproval = async (review: CheckpointReview, selected: () => boolean) => {
    const owner = captureImportOwner(), snapshot = docNow.current;
    const current = () => selected() && owner.isCurrent() && snapshot === docNow.current;
    try {
      const result = await readWorkingApprovalChecks(snapshot, review,
        doc => current() ? engine.part(doc, nextRevision(), 'read') : Promise.resolve(null));
      if (current()) return result;
    } catch (error) {
      if (current()) throw error;
    }
  };

  const prepareWorkingRepair = async (review: CheckpointReview, report: RequirementEvidence, version: object, selected: () => boolean) => {
    if (version !== saveDocumentToken.current || !selected()) return;
    const owner = captureImportOwner(), sourceKey = project.taskSourceKey();
    if (!sourceKey) throw new Error('Save the working model in the project before preparing a repair.');
    const offer = planWorkingApprovalRepair(docNow.current, review, report);
    return withTaskRunHandoff(offer, sourceKey, 'preparing a repair',
      () => selected() && owner.isCurrent() ? { offer, sourceKey } : undefined);
  };

  const openTaskRunCheckpoint = async (run: TaskRunStatus) => {
    if (!run.checkpoint) throw new Error('Refresh the run to select an approved checkpoint.');
    const requireView = () => {
      if (!ownership.canReviewLocalCandidate()) throw new Error('Return to the current model view to open the checkpoint.');
    };
    if (sessionBlocked('opening a worker checkpoint')) return;
    requireView();
    beginOpenIntent();
    const owner = captureImportOwner(), request: TaskRunCheckpointRequest = {
      runKey: run.runKey, runId: run.runId, taskId: run.checkpoint.taskId,
      operationId: run.checkpoint.operationId, acceptedSHA256: run.checkpoint.acceptedSHA256,
    };
    const intent = { request, status: undefined as TaskRunStatus | undefined };
    checkpointIntent.current = intent;
    const current = () => owner.isCurrent() && checkpointIntent.current === intent;
    try {
      const bytes = await localTaskCheckpointBytes(request, current);
      if (!bytes || !current()) return;
      const verified = await verifyCheckpoint(bytes, current, request);
      if (!verified || !current()) return;
      const { receipt } = verified;
      const latest = await refreshTaskRun(run);
      if (!current()) return;
      if (latest.revision < receipt.revision || !sameTaskRunCheckpoint(request, latest.checkpoint)
        || latest.baselineDigest !== receipt.accepted.modelDigest
        || (intent.status && intent.status.revision >= receipt.revision && !sameTaskRunCheckpoint(request, intent.status.checkpoint)))
        throw new Error('The approved checkpoint changed during Open. Refresh the local run status.');
      requireView();
      adoptCheckpoint({ ...verified, review: { ...verified.review, localRun: request } }, 'worker-' + request.taskId);
    } catch (error) {
      if (current()) throw error;
    } finally {
      if (checkpointIntent.current === intent) checkpointIntent.current = null;
    }
  };

  const prepareCandidate = async (receipt: CandidateReviewReceipt, baseline: StudioDoc, current: () => boolean): Promise<CandidateReview | undefined> => {
    const candidate = candidateReviewOnBaseline(receipt, baseline);
    if ('error' in candidate) throw new Error(candidate.error);
    const verified = await verifyCandidateReview(candidate, d => current() ? engine.part(d, nextRevision(), 'read') : Promise.resolve(null));
    if (!current()) return;
    if ('error' in verified) throw new Error(verified.error);
    const preview = await placedProposalPreview(baseline, candidate.doc, new Map(), (inst, base, parent) => {
      if (!current()) throw new Error('The worker candidate review moved.');
      return engine.placed(placedDoc(inst, parent), base, placementOf(inst), nextRevision());
    });
    if (!current()) return;
    const { occurrence, feature, field } = candidate.receipt.scope;
    if (preview?.kind !== 'ready' || preview.bodies.size !== 1 || !preview.bodies.has(occurrence))
      throw new Error('Could not preview the exact placed occurrence.');
    return { taskId: candidate.task.id, attemptId: candidate.receipt.attemptId, candidateDigest: candidate.receipt.candidateDigest,
      occurrence, feature, field, beforeMm: candidate.beforeMm, candidateMm: candidate.candidateMm, checks: verified.checks, preview };
  };

  const showCandidateReview = (review: CandidateReview) => {
    if (sessionBlocked('reviewing a worker candidate')) return;
    changes.onCandidateOpened(review);
    setToast(current => current?.title === CANDIDATE_REVIEW_REFUSED ? null : current);
  };

  const openCandidate = async (file: File, owner: () => boolean) => {
    const baseline = docNow.current, intent = {};
    candidateIntent.current = intent;
    const current = () => owner() && candidateIntent.current === intent;
    try {
      if (file.size > MAX_TASK_CANDIDATE_BYTES) throw new Error('The worker candidate exceeds the supported file size.');
      const text = await file.text();
      if (!current()) return;
      const receipt = decodeCandidateReview(text);
      if ('error' in receipt) throw new Error(receipt.error);
      const review = await prepareCandidate(receipt, baseline, current);
      if (review && current()) showCandidateReview(review);
    } catch (error) {
      if (current()) setToast({ title: CANDIDATE_REVIEW_REFUSED, hint: error instanceof Error ? error.message : String(error), detail: '' });
    }
  };

  const reviewTaskRun = async (selection: Omit<TaskRunReviewRequest, 'baselineDigest'>) => {
    if (!isLocalTaskRunHost(window.location.hostname)) throw new Error('Open Studio on this computer to review a local task run.');
    if (sessionBlocked('reviewing a worker candidate')) return;
    const requireView = (occurrence?: string) => {
      if (!ownership.canReviewLocalCandidate(occurrence)) throw new Error('Return to the current model view to review the candidate.');
    };
    requireView();
    const baseline = docNow.current, owner = captureImportOwner();
    const request: TaskRunReviewRequest = { ...selection, baselineDigest: digestOf(baseline) };
    const intent = { local: { request, status: undefined as TaskRunStatus | undefined } };
    candidateIntent.current = intent;
    const current = () => owner.isCurrent() && candidateIntent.current === intent && docNow.current === baseline;
    changes.onLocalCandidateReviewIntent();
    const read = async () => {
      const value = await localTaskRunJSON('review', JSON.stringify(request));
      if (typeof value?.review !== 'string') throw new Error('The local candidate service returned an invalid result.');
      const receipt = decodeCandidateReview(value.review);
      if ('error' in receipt || receipt.runId !== request.runId || receipt.submission.taskId !== request.taskId
        || receipt.attemptId !== request.attemptId || receipt.candidateDigest !== request.candidateDigest
        || receipt.baseline.modelDigest !== request.baselineDigest)
        throw new Error('The local run returned a different worker candidate.');
      return receipt;
    };
    try {
      const receipt = await read();
      if (!current()) return;
      const review = await prepareCandidate(receipt, baseline, current);
      if (!review || !current()) return;
      // A terminal operator can retire the attempt while Studio evaluates the geometry.
      const latest = await read();
      if (!current()) return;
      if (!matchesCurrentCandidateReview(receipt, latest)) throw new Error('The worker candidate changed during review.');
      requireView(review.occurrence);
      const status = intent.local.status;
      if (status && retiresTaskRunReview(status, request, latest.revision))
        throw new Error('The worker candidate changed during review.');
      showCandidateReview({ ...review, localRun: { request, revision: latest.revision } });
    } catch (error) {
      if (current()) throw error;
    }
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

  return { open, save, saveShared, exportTaskRun, startTaskRun, refreshTaskRun, observeTaskRunStatus, openTaskRunCheckpoint, readTaskRunApproval, checkWorkingApproval, prepareWorkingRepair, reviewTaskRun, cancelLocalCandidateReview, meshImport, editRepair };
}
