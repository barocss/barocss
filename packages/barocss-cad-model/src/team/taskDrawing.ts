import type { StudioDoc } from '../engine/doc';
import { digestOf } from '../util/digest';
import { drawingResult } from './freshness';
import { taskBaselineProblem, type TaskContext } from './taskExecution';
import { isTaskPlan, taskPlanImpact, taskScopeMatches, taskTarget, type TaskPlan, type TaskPlanError } from './taskPlan';

type DrawingContext = Pick<TaskContext, 'activePlan' | 'identity' | 'policyRevision'>;

export interface TaskDrawingCandidate {
  readonly taskId: string;
  readonly specRevision: string;
  readonly inputDigest: string;
  readonly result: Readonly<Pick<ReturnType<typeof drawingResult>, 'id' | 'status' | 'verdict' | 'number' | 'why'>>;
  readonly resultDigest: string;
}
const drawings = new WeakMap<TaskDrawingCandidate, { plan: TaskPlan; drawingDigest: string }>();

/** Run the existing drawing check for one admitted occurrence on its frozen input. */
export function taskDrawingCandidate(
  plan: TaskPlan, doc: StudioDoc, context: DrawingContext, taskId: string, run: string,
): TaskDrawingCandidate | TaskPlanError {
  const baseline = taskBaselineProblem(plan, doc, context);
  if (baseline) return baseline;
  const task = plan.tasks.find(t => t.id === taskId);
  const impact = taskPlanImpact(plan, doc, context.identity, context.policyRevision).find(t => t.id === taskId);
  if (!task || impact?.state !== 'current') return { error: { code: 'TASK_DRAWING_BLOCKED', message: impact?.reason ?? 'The drawing requires an admitted task.' } };
  const target = taskTarget(doc, task);
  if ('error' in target) return target;
  const local = target.instance.doc;
  const report = drawingResult(local, run);
  const { id, status, verdict, number, why } = report;
  const candidate = Object.freeze({
    taskId, specRevision: plan.specRevision, inputDigest: task.inputDigest,
    result: Object.freeze({ id, status, verdict, number, why }), resultDigest: digestOf(report),
  });
  drawings.set(candidate, { plan, drawingDigest: digestOf(local.drawing ?? null) });
  return candidate;
}

/** A part drawing follows the task's local inputs, its prerequisites and its authored sheet. */
export function taskDrawingImpact(candidate: TaskDrawingCandidate, doc: StudioDoc, context: DrawingContext): 'current' | 'stale' | 'blocked' {
  const record = drawings.get(candidate);
  if (!record || !isTaskPlan(context.activePlan)) return 'blocked';
  const { plan, drawingDigest } = record;
  const impacts = taskPlanImpact(plan, doc, context.identity, context.policyRevision);
  const impact = impacts.find(t => t.id === candidate.taskId)?.state ?? 'blocked';
  if (impact !== 'current') return impact;
  const task = plan.tasks.find(t => t.id === candidate.taskId)!;
  if (!taskScopeMatches(plan, task.id, context.activePlan)) return 'stale';
  const target = taskTarget(doc, task);
  if ('error' in target) return 'blocked';
  return digestOf(target.instance.doc.drawing ?? null) === drawingDigest ? 'current' : 'stale';
}
