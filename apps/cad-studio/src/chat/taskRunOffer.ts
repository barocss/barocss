import { isObj } from '@barocss/cad-model/util/guards';

export const MAX_TASK_RUN_NATIVE_BYTES = 16 * 1024 * 1024;

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
