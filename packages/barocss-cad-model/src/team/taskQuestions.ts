import { answerBatch, checkBatch, readQuestions } from '../chat/questions';
import type { StudioDoc } from '../engine/doc';
import { isObj } from '../util/guards';
import type { UserToken } from './ecr';
import { claimTaskUserToken, taskBaselineProblem, type TaskContext } from './taskExecution';
import { taskTarget, type BoundTask, type TaskPlan, type TaskPlanError } from './taskPlan';

export interface TaskQuestionBinding {
  readonly taskId: string;
  readonly specRevision: string;
  readonly batch: number;
  readonly questions: readonly string[];
}
const bindings = new WeakMap<TaskQuestionBinding, { plan: TaskPlan; task: BoundTask }>();
const byPlan = new WeakMap<TaskPlan, Map<string, TaskQuestionBinding>>();
const failure = (code: string, message: string): TaskPlanError => ({ error: { code, message } });

/** Bind a displayed question batch to the current task, document and specification. */
export function bindTaskQuestions(
  plan: TaskPlan, doc: StudioDoc, context: Pick<TaskContext, 'activePlan' | 'identity' | 'policyRevision'>, taskId: string, batch: number,
): TaskQuestionBinding | TaskPlanError {
  const baseline = taskBaselineProblem(plan, doc, context);
  if (baseline) return baseline;
  const task = plan.tasks.find(t => t.id === taskId);
  if (!task) return failure('TASK_QUESTION_MOVED', 'there is no admitted task for this question');
  const target = taskTarget(doc, task);
  if ('error' in target) return target;
  const local = target.instance.doc, log = readQuestions(local.questions);
  if (log.batches.some(b => !isObj(b) || !Number.isSafeInteger(b.n)))
    return failure('TASK_QUESTION_MOVED', 'the stored question log has invalid batch identities');
  const open = log.batches.filter(b => b.status === 'open');
  if (open.length !== 1 || open[0].n !== batch || log.batches.filter(b => b.n === batch).length !== 1)
    return failure('TASK_QUESTION_MOVED', 'this task has a different or closed question batch');
  const invalid = checkBatch({ ...local, questions: { ...log, batches: log.batches.filter(b => b !== open[0]) } }, open[0].questions);
  if (invalid) return failure('TASK_QUESTION_MOVED', invalid.message);
  const ids = open[0].questions.map(q => q.id);
  const previous = byPlan.get(plan) ?? new Map<string, TaskQuestionBinding>();
  const existing = previous.get(taskId);
  if (existing) return bindings.has(existing) ? existing : failure('TASK_QUESTION_MOVED', 'the task question has already been answered');
  const binding = Object.freeze({ taskId, specRevision: plan.specRevision, batch, questions: Object.freeze(ids) });
  bindings.set(binding, { plan, task });
  previous.set(taskId, binding);
  byPlan.set(plan, previous);
  return binding;
}

/** Apply one trusted answer to the recorded batch. A skipped answer remains unresolved. */
export function answerTaskQuestions(
  binding: TaskQuestionBinding, doc: StudioDoc, context: Pick<TaskContext, 'activePlan' | 'identity' | 'policyRevision'>,
  answers: Record<string, string | number | null>, user: UserToken,
): { doc: StudioDoc; trace: TaskQuestionBinding; message: string } | TaskPlanError {
  const record = bindings.get(binding);
  if (!record) return failure('TASK_QUESTION_MOVED', 'this question binding is fabricated or already answered');
  const baseline = taskBaselineProblem(record.plan, doc, context);
  if (baseline) return baseline;
  const target = taskTarget(doc, record.task);
  if ('error' in target) return target;
  const local = target.instance.doc;
  const open = readQuestions(local.questions).batches.find(b => b.n === binding.batch && b.status === 'open');
  if (!open || !isObj(answers) || Reflect.ownKeys(answers).length !== binding.questions.length
      || !binding.questions.every(id => Object.getOwnPropertyDescriptor(answers, id)?.enumerable
        && Object.hasOwn(Object.getOwnPropertyDescriptor(answers, id)!, 'value')))
    return failure('TASK_QUESTION_MOVED', 'the answers do not name the exact displayed question batch');
  for (const q of open.questions) {
    const answer = answers[q.id];
    if (answer === null) continue;
    if ('dimension' in q.blocks) return failure('TASK_QUESTION_VALUE', 'this task cannot answer a draft dimension');
    if ('requirement' in q.blocks) {
      const id = q.blocks.requirement;
      const requirement = record.task.checks.find(r => r.id === id);
      if (!requirement || requirement.check.op === 'between' || q.unit !== 'mm' || typeof answer !== 'number' || !Number.isFinite(answer) || answer <= 0)
        return failure('TASK_QUESTION_VALUE', `${q.id} needs a positive numeric answer in mm for one admitted dimension`);
    } else if (typeof answer !== 'string' && (typeof answer !== 'number' || !Number.isFinite(answer))) {
      return failure('TASK_QUESTION_VALUE', `${q.id} needs a text or finite numeric answer`);
    }
  }
  if (!claimTaskUserToken(user)) return failure('TASK_DECISION_UNTRUSTED', 'the exact question needs a fresh answer from the user channel');
  const result = answerBatch(local, answers, user.at);
  if ('error' in result) return failure('TASK_QUESTION_VALUE', result.error);
  bindings.delete(binding);
  return {
    doc: { ...doc, instances: doc.instances!.map(i => i.id === record.task.occurrence ? { ...i, doc: result.doc } : i) },
    trace: binding,
    message: result.message,
  };
}
