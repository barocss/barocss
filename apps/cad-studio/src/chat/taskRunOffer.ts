import { isObj } from '@barocss/cad-model/util/guards';

export const MAX_TASK_RUN_NATIVE_BYTES = 16 * 1024 * 1024;

export const isLocalTaskRunHost = (host: string) => host === '127.0.0.1' || host === 'localhost' || host === '[::1]';

export type { LocalTaskTarget as TaskRunTarget } from '@barocss/cad-model/team/localHeightPlan';
import { isLocalTaskCount, type LocalTaskTarget as TaskRunTarget } from '@barocss/cad-model/team/localHeightPlan';

export interface TaskRunOffer {
  revision: string;
  occurrences: string[];
  targets: TaskRunTarget[];
}

export interface TaskRunCandidatePin {
  attemptId: string;
  candidateDigest: string;
}

export interface TaskRunLocator {
  runKey: string;
  runId: string;
}

export interface TaskRunBaselineRequest extends TaskRunLocator {
  baselineDigest: string;
}

export interface TaskRunRebuildRequest extends TaskRunBaselineRequest {
  revision: number;
  taskId: string;
  attemptId: string;
}

export interface TaskRunReviewRequest extends TaskRunBaselineRequest, TaskRunCandidatePin {
  taskId: string;
}

const TASK_PHASES = ['ready', 'running', 'validating', 'awaiting-decision', 'committing', 'completed', 'failed', 'cancelled', 'stale'] as const;
export type TaskRunTaskPhase = typeof TASK_PHASES[number];
const taskPhases = new Set<unknown>(TASK_PHASES);

export interface TaskRunCheckpointPin {
  taskId: string;
  operationId: string;
  acceptedSHA256: string;
}

export type TaskRunCheckpointRequest = TaskRunLocator & TaskRunCheckpointPin;

export interface TaskRunStatus extends TaskRunLocator {
  phase: 'active' | 'paused' | 'stopped';
  revision: number;
  baselineDigest: string;
  checkpoint?: TaskRunCheckpointPin;
  approvals?: TaskRunCheckpointPin[];
  tasks: { id: string; phase: TaskRunTaskPhase; reason?: string; review?: TaskRunCandidatePin; rebuild?: string }[];
}

export interface TaskRunLaunch extends TaskRunStatus {
  directory: string;
  reused: boolean;
}

const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const label = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 160;

export function isTaskRunLocator(value: unknown): value is TaskRunLocator {
  return isObj(value) && hash(value.runKey) && label(value.runId);
}

export function isTaskRunBaselineRequest(value: unknown): value is TaskRunBaselineRequest {
  return isObj(value) && Object.keys(value).length === 3 && isTaskRunLocator(value) && hash(value.baselineDigest);
}

export function isTaskRunRebuildRequest(value: unknown): value is TaskRunRebuildRequest {
  return isObj(value) && Object.keys(value).length === 6 && isTaskRunLocator(value)
    && hash(value.baselineDigest) && label(value.taskId) && label(value.attemptId)
    && typeof value.revision === 'number' && Number.isSafeInteger(value.revision) && value.revision >= 0;
}

export function isTaskRunCheckpointPin(value: unknown): value is TaskRunCheckpointPin {
  return isObj(value) && Object.keys(value).length === 3 && label(value.taskId) && label(value.operationId) && hash(value.acceptedSHA256);
}

export function sameTaskRunCheckpoint(a: TaskRunCheckpointPin, b: TaskRunCheckpointPin | undefined): boolean {
  return a.taskId === b?.taskId && a.operationId === b.operationId && a.acceptedSHA256 === b.acceptedSHA256;
}

export function isTaskRunStatus(value: unknown): value is TaskRunStatus {
  if (!isObj(value) || !isTaskRunLocator(value) || !hash(value.baselineDigest)
    || typeof value.revision !== 'number' || !Number.isSafeInteger(value.revision) || value.revision < 0
    || (value.phase !== 'active' && value.phase !== 'paused' && value.phase !== 'stopped')
    || !Array.isArray(value.tasks) || !isLocalTaskCount(value.tasks.length)) return false;
  const { checkpoint, approvals, tasks } = value;
  return Array.from(tasks).every(task => isObj(task) && label(task.id) && taskPhases.has(task.phase)
    && (task.reason === undefined || typeof task.reason === 'string')
    && (task.rebuild === undefined || (value.phase === 'active' && task.phase === 'stale' && label(task.rebuild)))
    && (task.review === undefined || (value.phase === 'active' && task.phase === 'awaiting-decision'
      && isObj(task.review) && label(task.review.attemptId) && hash(task.review.candidateDigest))))
    && new Set(tasks.map(task => task.id)).size === tasks.length
    && (checkpoint === undefined || (isTaskRunCheckpointPin(checkpoint)
      && tasks.some(task => task.id === checkpoint.taskId && task.phase === 'completed')))
    && (approvals === undefined || (Array.isArray(approvals) && approvals.length > 0 && approvals.length <= tasks.length
      && Array.from(approvals).every(pin => isTaskRunCheckpointPin(pin)
        && tasks.some(task => task.id === pin.taskId && task.phase === 'completed'))
      && new Set(approvals.map(pin => pin.operationId)).size === approvals.length
      && new Set(approvals.map(pin => pin.taskId)).size === approvals.length
      && (checkpoint === undefined || sameTaskRunCheckpoint(checkpoint, approvals.at(-1)))));

}

export function retiresTaskRunReview(status: TaskRunStatus, request: TaskRunReviewRequest, reviewedRevision: number): boolean {
  if (status.runKey !== request.runKey || status.runId !== request.runId || status.revision < reviewedRevision) return false;
  const pin = status.tasks.find(task => task.id === request.taskId)?.review;
  return status.baselineDigest !== request.baselineDigest
    || pin?.attemptId !== request.attemptId || pin.candidateDigest !== request.candidateDigest;
}

export interface SavedTaskRunPlan {
  offer: TaskRunOffer;
  sourceKey: string;
}

export interface TaskRunChatOutput {
  summary: string;
  taskRun?: SavedTaskRunPlan;
}

const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 128 && value === value.trim();
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
function readTarget(value: unknown, occurrence: string): TaskRunTarget | null {
  if (!isObj(value) || value.id !== occurrence || typeof value.requirementId !== 'string' || !value.requirementId
    || !number(value.toleranceMm) || value.toleranceMm < 0) return null;
  const { requirementId, currentHeightMm, heightMm, currentWidthMm, widthMm, toleranceMm } = value;
  const shared = { id: occurrence, requirementId, toleranceMm };
  if (currentWidthMm === undefined && widthMm === undefined
    && number(currentHeightMm) && currentHeightMm > 0 && number(heightMm) && heightMm > 0)
    return { id: shared.id, requirementId, currentHeightMm, heightMm, toleranceMm };
  if (currentHeightMm === undefined && heightMm === undefined
    && number(currentWidthMm) && currentWidthMm > 0 && number(widthMm) && widthMm > 0)
    return { ...shared, currentWidthMm, widthMm };
  return null;
}

/** Copy only the small typed payload needed for review and export. */
export function readTaskRunOffer(value: unknown): TaskRunOffer | null {
  if (!isObj(value) || typeof value.revision !== 'string' || !/^[a-f0-9]{64}$/.test(value.revision)
    || !Array.isArray(value.occurrences) || !isLocalTaskCount(value.occurrences.length)
    || !Array.isArray(value.targets) || value.targets.length !== value.occurrences.length) return null;
  const occurrences = Array.from(value.occurrences);
  if (!occurrences.every(id) || new Set(occurrences).size !== occurrences.length) return null;
  const rawTargets = value.targets;
  const targets = occurrences.map((occurrence, index) => readTarget(rawTargets[index], occurrence));
  return targets.every(target => target !== null) ? { revision: value.revision, occurrences, targets } : null;
}
