import type { Evaluate } from '@barocss/cad-model/chat/toolKit';
import { encodeStudioFile } from '@barocss/cad-model/engine/container';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { readTaskSubmission, taskSubmissionValue, verifyProtectedTaskChecks, verifyTaskGeometry, type TaskCandidate, type TaskSubmission } from '@barocss/cad-model/team/taskExecution';
import { compileTaskPlan, taskDimensionEdit, taskTarget, type TaskPlanRequest } from '@barocss/cad-model/team/taskPlan';
import { digestOf, sha256Hex } from '@barocss/cad-model/util/digest';
import { isObj } from '@barocss/cad-model/util/guards';
import { canonical } from '@barocss/cad-model/util/revision';
import type { PlacedProposalPreview } from '../viewport/instanceEvaluation';
import type { TaskRunApproveRequest, TaskRunReviewRequest } from '../chat/taskRunOffer';
import type { NativeRef } from './taskCheckpoint';

export interface CandidateReviewReceipt {
  runId: string;
  revision: number;
  attemptId: string;
  plan: TaskPlanRequest;
  baseline: NativeRef;
  submission: TaskSubmission;
  scope: TaskCandidate['scope'];
  candidateDigest: string;
}
export interface CandidateReview {
  localRun?: { request: TaskRunReviewRequest; revision: number; approval: TaskRunApproveRequest };
  taskId: string;
  attemptId: string;
  candidateDigest: string;
  occurrence: string;
  feature: string;
  field: TaskCandidate['scope']['field'];
  beforeMm: number;
  candidateMm: number;
  checks: TaskCandidate['checks'];
  preview: Extract<PlacedProposalPreview, { kind: 'ready' }>;
}

export const TASK_CANDIDATE_EXT = '.bcad-candidate';
export const MAX_TASK_CANDIDATE_BYTES = 128 * 1024;
const FORMAT = 'barocss-task-candidate-review';
const sha = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const id = (value: unknown) => typeof value === 'string' && value.length > 0 && value.length <= 160;
const refusal = (error: string) => ({ error });

function isReceipt(value: unknown): value is CandidateReviewReceipt {
  if (!isObj(value) || Object.keys(value).length !== 8 || !isObj(value.plan) || !isObj(value.baseline) ||
      !isObj(value.scope) || !isObj(value.submission)) return false;
  const { baseline, scope } = value, submission = readTaskSubmission(value.submission);
  if (!submission || (scope.field !== 'height' && scope.field !== 'width')) return false;
  const dimension = taskSubmissionValue(submission, scope.field);
  return id(value.runId) && id(value.attemptId) && typeof value.revision === 'number' &&
    Number.isSafeInteger(value.revision) && value.revision > 0 && sha(value.candidateDigest) &&
    Object.keys(baseline).length === 2 && sha(baseline.sha256) && sha(baseline.modelDigest) &&
    Object.keys(scope).length === 3 && id(scope.occurrence) && id(scope.feature) &&
    Object.keys(submission).length === 4 && id(submission.taskId) && sha(submission.specRevision) &&
    sha(submission.inputDigest) && dimension !== undefined && Number.isFinite(dimension) && dimension > 0;
}

export function encodeCandidateReview(receipt: CandidateReviewReceipt): string {
  const json = JSON.stringify({ format: FORMAT, version: 1, receipt, digest: digestOf(receipt) }) + '\n';
  if (new TextEncoder().encode(json).length > MAX_TASK_CANDIDATE_BYTES) throw new Error('The worker candidate exceeds the supported file size.');
  return json;
}

/** Read one bounded offline receipt. It carries no task authority. */
export function decodeCandidateReview(text: string): CandidateReviewReceipt | { error: string } {
  try {
    if (new TextEncoder().encode(text).length > MAX_TASK_CANDIDATE_BYTES) return refusal('The worker candidate exceeds the supported file size.');
    const value: unknown = JSON.parse(text);
    if (!isObj(value) || Object.keys(value).length !== 4 || value.format !== FORMAT || value.version !== 1 ||
        !isReceipt(value.receipt) || digestOf(value.receipt) !== value.digest)
      return refusal('The worker candidate receipt checksum or fields differ.');
    return value.receipt;
  } catch { return refusal('The worker candidate receipt is invalid.'); }
}

/** Match an offline review to the exact working baseline. */
export function readCandidateReview(text: string, baseline: StudioDoc) {
  const receipt = decodeCandidateReview(text);
  return 'error' in receipt ? receipt : candidateReviewOnBaseline(receipt, baseline);
}

export function matchesCurrentCandidateReview(review: CandidateReviewReceipt, current: CandidateReviewReceipt) {
  return review.revision <= current.revision && canonical({ ...review, revision: current.revision }) === canonical(current);
}

export function candidateReviewOnBaseline(receipt: CandidateReviewReceipt, baseline: StudioDoc) {
  if (digestOf(baseline) !== receipt.baseline.modelDigest || sha256Hex(encodeStudioFile(baseline)) !== receipt.baseline.sha256)
    return refusal('Open the exact native baseline of this worker candidate first.');
  const plan = compileTaskPlan(baseline, receipt.plan), { submission, scope } = receipt;
  if ('error' in plan || plan.specRevision !== submission.specRevision)
    return refusal('The worker candidate specification differs.');
  const task = plan.tasks.find(item => item.id === submission.taskId);
  if (!task || task.blockers.length || task.dependsOn.length || task.inputDigest !== submission.inputDigest ||
      canonical(task.writes) !== canonical(scope)) return refusal('The worker candidate task or occurrence differs.');
  const target = taskTarget(baseline, task);
  if ('error' in target) return refusal(target.error.message);
  const value = taskSubmissionValue(submission, task.writes.field);
  if (value === undefined) return refusal('The worker candidate dimension differs.');
  const edit = taskDimensionEdit(baseline, task, target, value);
  if ('error' in edit) return refusal(edit.error.message);
  if (digestOf(edit.doc) !== receipt.candidateDigest) return refusal('The reconstructed worker candidate digest differs.');
  return { receipt, task, ...edit, beforeMm: target.value, candidateMm: value };
}

export async function verifyCandidateReview(candidate: Exclude<ReturnType<typeof readCandidateReview>, { error: string }>, evaluate: Evaluate) {
  const { local, shape, height, task } = candidate;
  const verified = await verifyTaskGeometry(local, shape, height, task, evaluate);
  if ('error' in verified) return refusal(verified.error.message);
  const protectedOccurrences = candidate.receipt.plan.protectedOccurrences;
  if (protectedOccurrences) {
    const protection = await verifyProtectedTaskChecks(candidate.doc, protectedOccurrences, evaluate);
    if (protection) return refusal(protection.error.message);
  }
  return verified;
}
