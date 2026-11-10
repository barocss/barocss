import type { TaskRunCheckpointRequest } from '../chat/taskRunOffer';
import { modelHash } from '@barocss/cad-model/chat/spec';
import { isCurrentRequirement, type RequirementEvidence } from '@barocss/cad-model/chat/requirementEvidence';
import type { PartInstance } from '@barocss/cad-model/engine/doc';
import type { Evaluate } from '@barocss/cad-model/chat/toolKit';
import { encodeStudioFile, readStudioWorkingCopy } from '@barocss/cad-model/engine/container';
import { verifyProtectedTaskChecks } from '@barocss/cad-model/team/taskExecution';
import { compileTaskPlan, taskDimensionEdit, type BoundTask, taskTarget, type TaskPlanRequest } from '@barocss/cad-model/team/taskPlan';
import { digestOf, requirementEvidenceRevision, sha256Hex } from '@barocss/cad-model/util/digest';
import { isObj } from '@barocss/cad-model/util/guards';
import { canonical } from '@barocss/cad-model/util/revision';
import { approvedRequirementComparison, compareApprovedRequirements } from '@barocss/cad-model/versions/approvedRequirements';

export interface NativeRef { sha256: string; modelDigest: string }
export interface TaskCheckpoint {
  runId: string;
  revision: number;
  taskId: string;
  operationId: string;
  plan: TaskPlanRequest;
  specRevision: string;
  candidateDigest: string;
  proposalId: string;
  scope: BoundTask['writes'];
  from: NativeRef;
  accepted: NativeRef;
}
export interface CheckpointReview {
  localRun?: TaskRunCheckpointRequest;
  taskId: string;
  revision: number;
  proposalId: string;
  occurrence: {
    feature: string;
    kind: 'sketch' | 'extrude';
    definition?: PartInstance['part'];
    pattern?: PartInstance['pattern'];
    approvalAt: string;
  };
  before: RequirementEvidence;
  approved: RequirementEvidence;
}

export const TASK_CHECKPOINT_EXT = '.bcad-run';
export const MAX_TASK_CHECKPOINT_BYTES = 64 * 1024 * 1024;
const MAGIC = 'BCADRUN1', PREFIX = 16, MAX_HEADER = 128 * 1024;
const sha = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 160;
const nativeRef = (value: unknown): value is NativeRef => isObj(value) && Object.keys(value).length === 2 && sha(value.sha256) && sha(value.modelDigest);
const refusal = (error: string) => ({ error });
const active = () => true;

function isCheckpoint(value: unknown): value is TaskCheckpoint {
  if (!isObj(value) || Object.keys(value).length !== 11 || !isObj(value.scope) || Object.keys(value.scope).length !== 3 || !isObj(value.plan)) return false;
  const { scope } = value;
  return id(value.runId) && typeof value.revision === 'number' && Number.isSafeInteger(value.revision) && value.revision > 0 &&
    id(value.taskId) && id(value.operationId) && sha(value.specRevision) && sha(value.candidateDigest) && id(value.proposalId) &&
    id(scope.occurrence) && !scope.occurrence.includes('/') && id(scope.feature) && (scope.field === 'height' || scope.field === 'width') &&
    nativeRef(value.from) && nativeRef(value.accepted) && value.from.sha256 !== value.accepted.sha256;
}

/** Store the two original native files without re-encoding them. */
export function encodeTaskCheckpoint(receipt: TaskCheckpoint, before: Uint8Array, accepted: Uint8Array): Uint8Array {
  const encoder = new TextEncoder(), header = encoder.encode(JSON.stringify({ receipt, digest: digestOf(receipt) }));
  const size = PREFIX + header.length + before.length + accepted.length;
  if (header.length > MAX_HEADER || size > MAX_TASK_CHECKPOINT_BYTES) throw new Error('The worker checkpoint exceeds the supported file size.');
  const bytes = new Uint8Array(size), view = new DataView(bytes.buffer);
  bytes.set(encoder.encode(MAGIC));
  view.setUint32(8, header.length, true);
  view.setUint32(12, before.length, true);
  bytes.set(header, PREFIX);
  bytes.set(before, PREFIX + header.length);
  bytes.set(accepted, PREFIX + header.length + before.length);
  return bytes;
}

/** Read and bind both native states, the durable candidate and the recorded local approval. */
export async function readTaskCheckpoint(bytes: Uint8Array, current: () => boolean = active) {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  if (bytes.length <= PREFIX || bytes.length > MAX_TASK_CHECKPOINT_BYTES ||
      new TextDecoder().decode(bytes.subarray(0, 8)) !== MAGIC) return refusal('The worker checkpoint header is invalid.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const header = view.getUint32(8, true), beforeLength = view.getUint32(12, true);
  const nativeStart = PREFIX + header, acceptedStart = nativeStart + beforeLength;
  if (!header || header > MAX_HEADER || !beforeLength || acceptedStart >= bytes.length)
    return refusal('The worker checkpoint is incomplete.');
  let receipt: TaskCheckpoint;
  try {
    const value: unknown = JSON.parse(decoder.decode(bytes.subarray(PREFIX, nativeStart)));
    if (!isObj(value) || Object.keys(value).length !== 2 || !isCheckpoint(value.receipt) || digestOf(value.receipt) !== value.digest)
      return refusal('The worker checkpoint receipt checksum or fields differ.');
    receipt = value.receipt;
  } catch { return refusal('The worker checkpoint receipt is invalid.'); }
  // Preserve plain Uint8Array semantics for packed files, even when the CLI caller supplied a Buffer.
  const native = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const beforeBytes = native.subarray(nativeStart, acceptedStart), acceptedBytes = native.subarray(acceptedStart);
  if (sha256Hex(beforeBytes) !== receipt.from.sha256 || sha256Hex(acceptedBytes) !== receipt.accepted.sha256)
    return refusal('The native files do not match the worker checkpoint.');
  const before = await readStudioWorkingCopy(beforeBytes);
  if (!current()) return null;
  const accepted = await readStudioWorkingCopy(acceptedBytes);
  if (!current()) return null;
  if ('error' in before || 'error' in accepted || digestOf(before.doc) !== receipt.from.modelDigest ||
      digestOf(accepted.doc) !== receipt.accepted.modelDigest) return refusal('The native document digests do not match the worker checkpoint.');
  if (sha256Hex(encodeStudioFile(accepted.doc)) !== receipt.accepted.sha256)
    return refusal('Saving the accepted model would change its recorded native bytes.');
  const plan = compileTaskPlan(before.doc, receipt.plan);
  const task = 'error' in plan ? undefined : plan.tasks.find(item => item.id === receipt.taskId);
  if ('error' in plan || plan.specRevision !== receipt.specRevision)
    return refusal('The original specification cannot be verified with this task plan.');
  if (!task || task.blockers.length || canonical(task.writes) !== canonical(receipt.scope))
    return refusal('The saved task plan does not match the checkpoint scope.');
  const comparison = approvedRequirementComparison(before.doc, accepted.doc);
  const part = receipt.scope.occurrence;
  if (!comparison || comparison.proposal !== receipt.proposalId || !comparison.scopes.some(scope => scope.id === part))
    return refusal('The saved approval does not match the worker checkpoint.');
  const proposal = accepted.doc.proposals!.find(item => item.id === receipt.proposalId)!;
  const previous = taskTarget(before.doc, task), next = taskTarget(accepted.doc, task);
  if ('error' in previous || 'error' in next) return refusal('The worker checkpoint target is outside the supported task scope.');
  const edit = taskDimensionEdit(before.doc, task, previous, next.value);
  if ('error' in edit) return refusal(edit.error.message);
  const expected = edit.doc, operation = [{ tool: 'edit_feature', args: { part, ...edit.args } }];
  if (proposal.title !== 'Task ' + receipt.taskId || proposal.decided?.model_hash !== modelHash(accepted.doc) ||
      canonical(proposal.ops) !== canonical(operation) || digestOf(expected) !== receipt.candidateDigest ||
      requirementEvidenceRevision(expected) !== comparison.revisions.after)
    return refusal('The candidate or approval does not match the recorded task.');
  return { doc: accepted.doc, receipt, comparison };
}

/** Recheck the accepted scope before the UI can adopt the document. */
export async function verifyTaskCheckpoint(checkpoint: NonNullable<Awaited<ReturnType<typeof readTaskCheckpoint>>>,
  evaluate: Evaluate, current: () => boolean) {
  if ('error' in checkpoint) return checkpoint;
  const { comparison, receipt } = checkpoint, part = receipt.scope.occurrence;
  const result = await compareApprovedRequirements(comparison, part, async doc => current() ? evaluate(doc) : null);
  if (!current()) return null;
  if ('error' in result) return result;
  const approved = result.after, rows = approved?.evidence.filter(row => row.requirement?.hard) ?? [];
  if (!approved || !rows.length || rows.some(row => !isCurrentRequirement(row, part, comparison.revisions.after) || row.result.verdict !== 'pass'))
    return refusal('The accepted task requirements did not pass the current native checks.');
  if (receipt.plan.protectedOccurrences) {
    const protection = await verifyProtectedTaskChecks(checkpoint.doc, receipt.plan.protectedOccurrences,
      doc => current() ? evaluate(doc) : Promise.resolve(null));
    if (!current()) return null;
    if (protection) return refusal(protection.error.message);
  }
  const { taskId, revision, proposalId, scope } = receipt;
  const instance = checkpoint.doc.instances?.find(instance => instance.id === part);
  const approvalAt = checkpoint.doc.proposals?.find(proposal => proposal.id === proposalId)?.decided?.at;
  if (!instance || !approvalAt) return refusal('The approved occurrence or decision is missing.');
  const occurrence: CheckpointReview['occurrence'] = { feature: scope.feature,
    kind: scope.field === 'width' ? 'sketch' : 'extrude', definition: instance.part, pattern: instance.pattern, approvalAt };
  const review: CheckpointReview = { taskId, revision, proposalId, occurrence, before: result.before, approved };
  return { ...checkpoint, checks: rows.length, review };
}
