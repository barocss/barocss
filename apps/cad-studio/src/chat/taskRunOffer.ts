import type { TaskNativeFinding } from '@barocss/cad-model/team/taskExecution';
import { digestOf } from '@barocss/cad-model/util/digest';
import { isObj } from '@barocss/cad-model/util/guards';
import type { BoundTask } from '@barocss/cad-model/team/taskPlan';

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

export interface TaskRunStopRequest extends TaskRunBaselineRequest {
  revision: number;
}

export interface TaskRunReplanPin {
  attemptId: string;
  occurrence: string;
  feature: string;
  field: BoundTask['writes']['field'];
}

export interface TaskRunReplanSelection extends TaskRunBaselineRequest {
  revision: number;
  taskId: string;
  pin: TaskRunReplanPin;
}

export interface TaskRunReplacementProvenance {
  previous: TaskRunReplanSelection;
  acceptedSHA256: string;
  inputDigest: string;
}

export interface TaskRunRebuildRequest extends TaskRunBaselineRequest {
  revision: number;
  taskId: string;
  attemptId: string;
}

export interface TaskRunReviewRequest extends TaskRunBaselineRequest, TaskRunCandidatePin {
  taskId: string;
}

export interface TaskRunDecisionRequest extends TaskRunReviewRequest {
  reviewRevision: number;
  controlRevision: number;
  receiptDigest: string;
}

export type TaskRunDecision = 'approve' | 'reject';

export const taskRunDecisionId = (request: TaskRunDecisionRequest, decision: TaskRunDecision) => 'studio:' + decision + ':' + digestOf(request);

const TASK_PHASES = ['ready', 'running', 'validating', 'awaiting-decision', 'committing', 'completed', 'failed', 'cancelled', 'stale'] as const;
export type TaskRunTaskPhase = typeof TASK_PHASES[number];
const taskPhases = new Set<unknown>(TASK_PHASES);

export interface TaskRunCheckpointPin {
  taskId: string;
  operationId: string;
  acceptedSHA256: string;
}

export type TaskRunCheckpointRequest = TaskRunLocator & TaskRunCheckpointPin;

export interface TaskRunNativeFailure extends TaskNativeFinding {
  attemptId: string;
  baselineDigest: string;
  occurrence: string;
  feature: string;
}

export interface TaskRunFindingSelection extends TaskRunBaselineRequest {
  taskId: string;
  attemptId: string;
}

export interface TaskRunStatus extends TaskRunLocator {
  phase: 'active' | 'paused' | 'stopped';
  revision: number;
  baselineDigest: string;
  checkpoint?: TaskRunCheckpointPin;
  replacement?: TaskRunReplacementProvenance;
  approvals?: TaskRunCheckpointPin[];
  tasks: { id: string; phase: TaskRunTaskPhase; reason?: string; nativeFailure?: TaskRunNativeFailure; review?: TaskRunCandidatePin; rebuild?: string; replan?: TaskRunReplanPin }[];
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

export function isTaskRunStopRequest(value: unknown): value is TaskRunStopRequest {
  return isObj(value) && Object.keys(value).length === 4 && isTaskRunLocator(value) && hash(value.baselineDigest)
    && typeof value.revision === 'number' && Number.isSafeInteger(value.revision) && value.revision >= 0;
}

export function isTaskRunDecisionRequest(value: unknown): value is TaskRunDecisionRequest {
  return isObj(value) && Object.keys(value).length === 9 && isTaskRunLocator(value)
    && hash(value.baselineDigest) && label(value.taskId) && label(value.attemptId)
    && hash(value.candidateDigest) && hash(value.receiptDigest)
    && typeof value.reviewRevision === 'number' && Number.isSafeInteger(value.reviewRevision) && value.reviewRevision > 0
    && typeof value.controlRevision === 'number' && Number.isSafeInteger(value.controlRevision) && value.controlRevision >= 0;
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

function isTaskRunReplanPin(value: unknown): value is TaskRunReplanPin {
  return isObj(value) && Object.keys(value).length === 4 && label(value.attemptId) && label(value.occurrence)
    && label(value.feature) && (value.field === 'height' || value.field === 'width' || value.field === 'diameter');
}

export function isTaskRunReplanSelection(value: unknown): value is TaskRunReplanSelection {
  return isObj(value) && Object.keys(value).length === 6 && isTaskRunLocator(value)
    && hash(value.baselineDigest) && label(value.taskId) && isTaskRunReplanPin(value.pin)
    && typeof value.revision === 'number' && Number.isSafeInteger(value.revision) && value.revision >= 0;
}

export function isTaskRunReplacementProvenance(value: unknown): value is TaskRunReplacementProvenance {
  return isObj(value) && Object.keys(value).length === 3 && isTaskRunReplanSelection(value.previous)
    && hash(value.acceptedSHA256) && hash(value.inputDigest);
}

export function matchesTaskRunReplan(status: TaskRunStatus, selection: TaskRunReplanSelection): boolean {
  if (status.runKey !== selection.runKey || status.runId !== selection.runId || status.revision !== selection.revision ||
      status.baselineDigest !== selection.baselineDigest) return false;
  const pin = status.tasks.find(task => task.id === selection.taskId)?.replan;
  return !!pin && pin.attemptId === selection.pin.attemptId && pin.occurrence === selection.pin.occurrence
    && pin.feature === selection.pin.feature && pin.field === selection.pin.field;
}

export function isTaskRunFindingSelection(value: unknown): value is TaskRunFindingSelection {
  return isObj(value) && Object.keys(value).length === 5 && isTaskRunLocator(value)
    && hash(value.baselineDigest) && label(value.taskId) && label(value.attemptId);
}

export function isTaskRunNativeFailure(value: unknown): value is TaskRunNativeFailure {
  return isObj(value) && Object.keys(value).length === 8 && label(value.attemptId) && hash(value.baselineDigest)
    && label(value.occurrence) && label(value.feature)
    && (value.gate === 'lease' || value.gate === 'validity' || value.gate === 'contract' || value.gate === 'assembly')
    && (value.verdict === 'fail' || value.verdict === 'undecided')
    && typeof value.code === 'string' && /^[A-Z_]{1,64}$/.test(value.code) && value.code !== 'NOT_REACHED'
    && typeof value.message === 'string' && value.message.length > 0 && value.message.length <= 1024;
}

export function isTaskRunStatus(value: unknown): value is TaskRunStatus {
  if (!isObj(value) || !isTaskRunLocator(value) || !hash(value.baselineDigest)
    || typeof value.revision !== 'number' || !Number.isSafeInteger(value.revision) || value.revision < 0
    || (value.phase !== 'active' && value.phase !== 'paused' && value.phase !== 'stopped')
    || !Array.isArray(value.tasks) || !isLocalTaskCount(value.tasks.length)) return false;
  const { checkpoint, approvals, tasks, replacement } = value;
  return Array.from(tasks).every(task => isObj(task) && label(task.id) && taskPhases.has(task.phase)
    && (task.reason === undefined || typeof task.reason === 'string')
    && (task.nativeFailure === undefined || (value.phase !== 'stopped' && task.phase === 'failed' && task.reason === 'TASK_NATIVE_GATE'
      && isTaskRunNativeFailure(task.nativeFailure) && task.nativeFailure.baselineDigest === value.baselineDigest))
    && (task.replan === undefined || (value.phase === 'active' && task.phase === 'stale' && isTaskRunReplanPin(task.replan)))
    && (task.rebuild === undefined || (value.phase === 'active' && task.phase === 'stale' && label(task.rebuild)))
    && (task.review === undefined || (value.phase === 'active' && task.phase === 'awaiting-decision'
      && isObj(task.review) && label(task.review.attemptId) && hash(task.review.candidateDigest))))
    && (replacement === undefined || (isTaskRunReplacementProvenance(replacement)
      && replacement.previous.runId !== value.runId && tasks.length === 1 && tasks[0].id === replacement.previous.pin.occurrence))
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
  replaces?: TaskRunReplanSelection;
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
  const { requirementId, currentHeightMm, heightMm, currentWidthMm, widthMm, currentDiameterMm, diameterMm, toleranceMm } = value;
  const shared = { id: occurrence, requirementId, toleranceMm };
  const hasHeight = currentHeightMm !== undefined || heightMm !== undefined;
  const hasWidth = currentWidthMm !== undefined || widthMm !== undefined;
  const hasDiameter = currentDiameterMm !== undefined || diameterMm !== undefined;
  if (!hasWidth && !hasDiameter
    && number(currentHeightMm) && currentHeightMm > 0 && number(heightMm) && heightMm > 0)
    return { ...shared, currentHeightMm, heightMm };
  if (!hasHeight && !hasDiameter
    && number(currentWidthMm) && currentWidthMm > 0 && number(widthMm) && widthMm > 0)
    return { ...shared, currentWidthMm, widthMm };
  if (!hasHeight && !hasWidth
    && number(currentDiameterMm) && currentDiameterMm > 0 && number(diameterMm) && diameterMm > 0)
    return { ...shared, currentDiameterMm, diameterMm };
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
