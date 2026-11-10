import { isObj } from '@barocss/cad-model/util/guards';

export const MAX_TASK_RUN_NATIVE_BYTES = 16 * 1024 * 1024;

export const isLocalTaskRunHost = (host: string) => host === '127.0.0.1' || host === 'localhost' || host === '[::1]';

export interface TaskRunTarget {
  id: string;
  requirementId: string;
  currentHeightMm: number;
  heightMm: number;
  toleranceMm: number;
}

export interface TaskRunOffer {
  revision: string;
  occurrences: [string, string];
  targets: [TaskRunTarget, TaskRunTarget];
}

export interface TaskRunCandidatePin {
  attemptId: string;
  candidateDigest: string;
}

export interface TaskRunLocator {
  runKey: string;
  runId: string;
}

export interface TaskRunReviewRequest extends TaskRunLocator, TaskRunCandidatePin {
  taskId: string;
  baselineDigest: string;
}

const TASK_PHASES = ['ready', 'running', 'validating', 'awaiting-decision', 'committing', 'completed', 'failed', 'cancelled', 'stale'] as const;
export type TaskRunTaskPhase = typeof TASK_PHASES[number];
const taskPhases = new Set<unknown>(TASK_PHASES);

export interface TaskRunStatus extends TaskRunLocator {
  phase: 'active' | 'paused' | 'stopped';
  revision: number;
  baselineDigest: string;
  tasks: { id: string; phase: TaskRunTaskPhase; reason?: string; review?: TaskRunCandidatePin }[];
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

export function isTaskRunStatus(value: unknown): value is TaskRunStatus {
  if (!isObj(value) || !isTaskRunLocator(value) || !hash(value.baselineDigest)
    || typeof value.revision !== 'number' || !Number.isSafeInteger(value.revision) || value.revision < 0
    || (value.phase !== 'active' && value.phase !== 'paused' && value.phase !== 'stopped')
    || !Array.isArray(value.tasks) || value.tasks.length !== 2) return false;
  return value.tasks.every(task => isObj(task) && label(task.id) && taskPhases.has(task.phase)
    && (task.reason === undefined || typeof task.reason === 'string')
    && (task.review === undefined || (value.phase === 'active' && task.phase === 'awaiting-decision'
      && isObj(task.review) && label(task.review.attemptId) && hash(task.review.candidateDigest))))
    && value.tasks[0].id !== value.tasks[1].id;
}

export function retiresTaskRunReview(status: TaskRunStatus, request: TaskRunReviewRequest, reviewedRevision: number): boolean {
  if (status.runKey !== request.runKey || status.runId !== request.runId || status.revision < reviewedRevision) return false;
  const pin = status.tasks.find(task => task.id === request.taskId)?.review;
  return status.baselineDigest !== request.baselineDigest
    || pin?.attemptId !== request.attemptId || pin.candidateDigest !== request.candidateDigest;
}

export interface TaskRunChatOutput {
  summary: string;
  taskRun?: { offer: TaskRunOffer; sourceKey: string };
}

const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 128 && value === value.trim();
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
function readTarget(value: unknown, occurrence: string): TaskRunTarget | null {
  if (!isObj(value) || value.id !== occurrence || typeof value.requirementId !== 'string' || !value.requirementId
    || !number(value.currentHeightMm) || value.currentHeightMm <= 0 || !number(value.heightMm) || value.heightMm <= 0
    || !number(value.toleranceMm) || value.toleranceMm < 0) return null;
  const { requirementId, currentHeightMm, heightMm, toleranceMm } = value;
  return { id: occurrence, requirementId, currentHeightMm, heightMm, toleranceMm };
}

/** Copy only the small typed payload needed for review and export. */
export function readTaskRunOffer(value: unknown): TaskRunOffer | null {
  if (!isObj(value) || typeof value.revision !== 'string' || !/^[a-f0-9]{64}$/.test(value.revision)
    || !Array.isArray(value.occurrences) || value.occurrences.length !== 2
    || !Array.isArray(value.targets) || value.targets.length !== 2) return null;
  const [a, b] = value.occurrences;
  if (!id(a) || !id(b) || a === b) return null;
  const first = readTarget(value.targets[0], a), second = readTarget(value.targets[1], b);
  return first && second ? { revision: value.revision, occurrences: [a, b], targets: [first, second] } : null;
}
