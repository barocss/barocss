// D584: a verified task is a candidate on a frozen input. The host owns decisions and the accepted document.
import { expectedOf, checkSpec } from '../chat/spec';
import { acceptProposal, runTool, type ChatState, type Evaluate } from '../chat/tools';
import type { StudioDoc } from '../engine/doc';
import type { Requirement } from '../engine/schema/spec';
import { digestOf } from '../util/digest';
import { isObj } from '../util/guards';
import { isUserToken, type UserToken } from './ecr';
import { interfacesRevision } from './interfaces';
import { integratePart, type Lease, type PartTrace } from './parts';
import { isTaskPlan, taskPlanImpact, taskScopeMatches, taskTarget, type BoundTask, type TaskPlan, type TaskPlanError, type TaskPlanRequest } from './taskPlan';

type Identity = TaskPlanRequest['identity'];
/** Host-owned inputs at the time a candidate or user decision is processed. */
export interface TaskContext {
  activePlan: TaskPlan;
  identity: Identity;
  policyRevision: string;
  leases: ReadonlyMap<string, Lease>;
  sequence: number;
}
/** The host's assigned worker identity. It is never taken from a submitted operation. */
export interface TaskWorkerContext extends TaskContext { worker: string }
export interface TaskSubmission {
  taskId: string;
  specRevision: string;
  inputDigest: string;
  heightMm: number;
}
export interface TaskCheckReceipt {
  readonly id: string;
  readonly status: 'pass' | 'fail' | 'unknown';
  readonly expected: string;
  readonly measured?: number;
  readonly why?: string;
  readonly hard: boolean;
  readonly basis: Requirement['basis'];
  readonly sourceStatus: Requirement['said'];
}
export interface TaskCandidate {
  readonly taskId: string;
  readonly specRevision: string;
  readonly inputDigest: string;
  readonly candidateDigest: string;
  readonly proposalId: string;
  readonly baselineDigest: string;
  readonly scope: BoundTask['writes'];
  readonly dependencies: readonly { taskId: string; candidateDigest: string }[];
  readonly checks: readonly TaskCheckReceipt[];
  readonly geometry: Readonly<{ sizeMm: readonly [number, number, number]; volumeMm3: number; centroidMm: readonly [number, number, number] }>;
  readonly gates: readonly PartTrace['gates'][number]['gate'][];
}
interface CandidateRecord {
  plan: TaskPlan;
  task: BoundTask;
  proposal: string;
  proposalDoc: StudioDoc;
  modelDigest: string;
  prerequisites: readonly CandidateRecord[];
}
const candidates = new WeakMap<TaskCandidate, CandidateRecord>();
const rejectedCandidates = new WeakSet<CandidateRecord>();
const usedUserTokens = new WeakSet<UserToken>();
const failure = (code: string, message: string): TaskPlanError => ({ error: { code, message } });

/** @internal Check the full native baseline before performing a bound action. */
export function taskBaselineProblem(plan: TaskPlan, doc: StudioDoc, context: Pick<TaskContext, 'activePlan' | 'identity' | 'policyRevision'>): TaskPlanError | null {
  if (!isTaskPlan(plan)) return failure('TASK_PLAN_UNTRUSTED', 'the host did not admit this task plan');
  const { activePlan, identity, policyRevision } = context;
  if (identity.projectId !== plan.identity.projectId || identity.documentId !== plan.identity.documentId)
    return failure('TASK_DOCUMENT_MOVED', 'the task belongs to another project or document');
  if (activePlan !== plan || policyRevision !== plan.policyRevision || digestOf(doc) !== plan.baselineDigest)
    return failure('TASK_SPEC_MOVED', 'the task needs the current specification, policy and native baseline');
  return null;
}

/** @internal Used by the host's candidate and question decisions. */
export function claimTaskUserToken(user: UserToken): boolean {
  if (!isUserToken(user) || usedUserTokens.has(user)) return false;
  usedUserTokens.add(user);
  return true;
}

function leaseProblem(doc: StudioDoc, task: BoundTask, context: TaskContext): TaskPlanError | null {
  if (context.sequence > context.activePlan.throughSequence) return failure('TASK_BUDGET', 'the plan has reached its logical deadline');
  const lease = context.leases.get(task.occurrence);
  if (!lease || lease.holder !== task.holder || lease.part !== task.occurrence)
    return failure('TASK_LEASE_OWNER', `${task.id} needs the lease for ${task.holder} on ${task.occurrence}`);
  if (!Number.isSafeInteger(context.sequence) || context.sequence < 0 || !Number.isSafeInteger(lease.until)
      || context.sequence > lease.until || lease.expiredBy || lease.contract !== interfacesRevision(doc))
    return failure('TASK_LEASE_STALE', `${task.id} needs a current lease on the current interfaces`);
  return null;
}

// The approval history and proposal status are written by the existing proposal consumer.
function candidateModelDigest(doc: StudioDoc): string {
  return digestOf({ ...doc, proposals: undefined, history: undefined });
}

function dependencyProblem(task: BoundTask, records: readonly CandidateRecord[]): TaskPlanError | null {
  const rejected = records.find(record => rejectedCandidates.has(record));
  return rejected ? failure('TASK_DEPENDENCY_UNVERIFIED', `${task.id} depends on rejected candidate ${rejected.task.id}`) : null;
}

function dependencyProofs(plan: TaskPlan, task: BoundTask, prerequisites: readonly TaskCandidate[]) {
  const proofs = [];
  const records = new Set<CandidateRecord>();
  for (const id of task.dependsOn) {
    const receipt = prerequisites.find(p => {
      const record = candidates.get(p);
      return record?.plan === plan && p.taskId === id && !rejectedCandidates.has(record)
        && !dependencyProblem(record.task, record.prerequisites);
    });
    if (!receipt) return failure('TASK_DEPENDENCY_UNVERIFIED', `${task.id} needs a verified candidate for ${id} on this specification`);
    const record = candidates.get(receipt)!;
    records.add(record);
    for (const ancestor of record.prerequisites) records.add(ancestor);
    proofs.push(Object.freeze({ taskId: id, candidateDigest: receipt.candidateDigest }));
  }
  return { proofs: Object.freeze(proofs), records: [...records] };
}

/** Evaluate one admitted dimensional edit on a private copy, then prepare its existing grouped proposal. */
export async function buildTaskCandidate(
  plan: TaskPlan, state: ChatState, submission: TaskSubmission, context: TaskWorkerContext, evaluate: Evaluate,
  prerequisites: readonly TaskCandidate[] = [],
): Promise<TaskCandidate | TaskPlanError> {
  const baseline = taskBaselineProblem(plan, state.doc, context);
  if (baseline) return baseline;
  if (!isObj(submission)) return failure('TASK_SUBMISSION_MISMATCH', 'the submitted operation must name an admitted task');
  const fields = Object.keys(submission).sort().join(',');
  if (fields !== 'heightMm,inputDigest,specRevision,taskId' || Reflect.ownKeys(submission).length !== 4
    || Object.values(Object.getOwnPropertyDescriptors(submission)).some(field => !Object.hasOwn(field, 'value')))
    return failure('TASK_SUBMISSION_MISMATCH', 'the submission must contain only the admitted task fields');
  const task = plan.tasks.find(t => t.id === submission.taskId);
  if (!task || submission.specRevision !== plan.specRevision || submission.inputDigest !== task.inputDigest)
    return failure('TASK_SUBMISSION_MISMATCH', 'the submitted operation does not match its admitted task and specification');
  if (context.worker !== task.holder) return failure('TASK_WORKER_SCOPE', `${context.worker} does not own ${task.id}`);
  const height = submission.heightMm;
  if (!Number.isFinite(height) || height <= 0) return failure('TASK_VALUE', 'the extrusion height must be a positive finite value in mm');
  if (task.blockers.length) return failure('TASK_REQUIRED_UNKNOWN', task.blockers.join(', '));
  const lease = leaseProblem(state.doc, task, context);
  if (lease) return lease;
  const dependencies = dependencyProofs(plan, task, prerequisites);
  if ('error' in dependencies) return dependencies;

  const doc = structuredClone(state.doc), own: ChatState = { doc, bodies: structuredClone(state.bodies) };
  const target = taskTarget(doc, task);
  if ('error' in target) return target;
  const { instance, index, shape } = target, feature = instance.doc.nodes[index];
  if (feature.kind !== 'extrude' || height === feature.height) return failure('TASK_VALUE', 'the task must change its admitted extrusion height');
  const args = { index, values: { h: height } };
  const patch = { id: task.id, by: task.holder, part: task.occurrence, contract: interfacesRevision(doc), ops: [{ tool: 'edit_feature', args }] };
  const staged = await integratePart(own, patch, context.leases, evaluate, context.sequence, { requireCompleteAssembly: true });
  if (staged.trace.decision !== 'applied') return failure('TASK_NATIVE_GATE', staged.trace.gates.flatMap(g => g.findings).find(f => f.code !== 'NOT_REACHED')?.message ?? 'the native candidate did not pass its gates');
  const candidate = staged.state.doc;
  const local = { ...instance.doc, nodes: instance.doc.nodes.map((node, at) => at === index ? { ...node, height } : node) };
  const expected = { ...doc, instances: doc.instances!.map(i => i.id === instance.id ? { ...i, doc: local } : i) };
  if (digestOf(candidate) !== digestOf(expected))
    return failure('TASK_SCOPE_CHANGED', 'the candidate changed something outside the owned extrusion height');

  const result = await evaluate(local);
  if (!result?.ok || result.bodies.length !== 1) return failure('TASK_NATIVE_GATE', 'the owned occurrence did not evaluate to one body');
  const [body] = result.bodies;
  const { min, max } = body.mesh.bounds;
  const size = [shape.width, shape.depth, height] as const;
  const grossArea = shape.width * shape.depth;
  const holeArea = shape.hole ? Math.PI * shape.hole.radius ** 2 : 0;
  const area = grossArea - holeArea, volume = area * height;
  const centroid = [
    ((shape.minX + shape.width / 2) * grossArea - (shape.hole?.x ?? 0) * holeArea) / area,
    ((shape.minY + shape.depth / 2) * grossArea - (shape.hole?.y ?? 0) * holeArea) / area,
    height / 2,
  ] as const;
  const close = (actual: number, want: number) => Number.isFinite(actual)
    && Math.abs(actual - want) <= task.verification.relativeTolerance * Math.max(1, Math.abs(want));
  if (body.volume === null || !close(body.volume, volume) || !body.centroid
      || ![shape.minX, shape.minY, 0].every((v, i) => close(min[i], v))
      || !size.every((v, i) => close(max[i] - min[i], v))
      || !centroid.every((v, i) => close(body.centroid![i], v)))
    return failure('TASK_ORACLE_MISMATCH', 'native volume, bounds or centroid differs from the independent prism calculation');

  const { outcomes } = await checkSpec(local, result.bodies, evaluate);
  const checks = task.checks.map(req => {
    const value = outcomes.get(req.id);
    return Object.freeze({
      id: req.id, status: value?.status ?? 'unknown', hard: req.hard, basis: req.basis, sourceStatus: req.said, expected: expectedOf(req.check),
      ...(typeof value?.measured === 'number' ? { measured: value.measured } : {}),
      ...(value?.why ? { why: value.why } : {}),
    });
  });
  if (checks.some(c => c.hard && c.status !== 'pass'))
    return failure('TASK_REQUIRED_CHECK', checks.filter(c => c.hard && c.status !== 'pass').map(c => `${c.id}: ${c.status}`).join(', '));

  const proposal = await runTool(own, 'proposals', {
    action: 'propose', title: `Task ${task.id}`,
    ops: [{ tool: 'features', args: { action: 'edit', part: task.occurrence, ...args } }],
  }, evaluate);
  if (proposal.isError) return failure('TASK_PROPOSAL_REFUSED', proposal.summary);
  const id = proposal.state.doc.proposals?.at(-1)?.id;
  if (!id) return failure('TASK_PROPOSAL_REFUSED', 'the existing proposal tool did not make a proposal');
  const changed = taskBaselineProblem(plan, state.doc, context) ?? leaseProblem(state.doc, task, context) ?? dependencyProblem(task, dependencies.records);
  if (changed) return changed;
  const receipt: TaskCandidate = Object.freeze({
    taskId: task.id, specRevision: plan.specRevision, inputDigest: task.inputDigest,
    candidateDigest: digestOf(candidate), proposalId: id, baselineDigest: plan.baselineDigest, scope: task.writes,
    dependencies: dependencies.proofs, checks: Object.freeze(checks),
    geometry: Object.freeze({ sizeMm: Object.freeze(size), volumeMm3: volume, centroidMm: Object.freeze(centroid) }),
    gates: Object.freeze(staged.trace.gates.map(g => g.gate)),
  });
  candidates.set(receipt, { plan, task, proposal: id, proposalDoc: proposal.state.doc, modelDigest: candidateModelDigest(candidate), prerequisites: dependencies.records });
  return receipt;
}

/** Local evidence may be reusable after an unrelated edit. Assembly evidence and approval still pin the whole input. */
export function taskCandidateImpact(
  candidate: TaskCandidate, doc: StudioDoc, context: Pick<TaskContext, 'activePlan' | 'identity' | 'policyRevision'>,
): { localEvidence: 'current' | 'stale' | 'blocked'; assemblyEvidence: 'current' | 'stale' | 'blocked' } {
  const record = candidates.get(candidate);
  if (!record || !isTaskPlan(context.activePlan) || rejectedCandidates.has(record) || dependencyProblem(record.task, record.prerequisites))
    return { localEvidence: 'blocked', assemblyEvidence: 'blocked' };
  let localEvidence = taskPlanImpact(record.plan, doc, context.identity, context.policyRevision)
    .find(impact => impact.id === candidate.taskId)?.state ?? 'blocked';
  if (localEvidence === 'current' && !taskScopeMatches(record.plan, candidate.taskId, context.activePlan)) localEvidence = 'stale';
  const baseline = taskBaselineProblem(record.plan, doc, context);
  return { localEvidence, assemblyEvidence: localEvidence === 'blocked' ? 'blocked' : baseline ? 'stale' : localEvidence };
}

export interface TaskDecision {
  readonly taskId: string;
  readonly specRevision: string;
  readonly candidateDigest: string;
  readonly approved: boolean;
  readonly at: string;
}
const decisions = new WeakMap<TaskDecision, CandidateRecord>();
const decidedCandidates = new WeakSet<TaskCandidate>();

/** Bind one trusted user decision to the exact candidate that the host presented. */
export function bindTaskDecision(candidate: TaskCandidate, approved: boolean, user: UserToken): TaskDecision | TaskPlanError {
  const record = candidates.get(candidate);
  if (!record || decidedCandidates.has(candidate) || typeof approved !== 'boolean' || !claimTaskUserToken(user))
    return failure('TASK_DECISION_UNTRUSTED', 'the exact candidate needs a fresh decision from the user channel');
  const decision = Object.freeze({ taskId: candidate.taskId, specRevision: candidate.specRevision, candidateDigest: candidate.candidateDigest, approved, at: user.at });
  decidedCandidates.add(candidate);
  decisions.set(decision, record);
  return decision;
}

/** Replay the bound user decision through the existing proposal path on a copy. The host owns publication. */
export async function applyTaskDecision(
  decision: TaskDecision, state: ChatState, context: TaskContext, evaluate: Evaluate,
): Promise<{ doc: StudioDoc; decision: TaskDecision } | TaskPlanError> {
  const record = decisions.get(decision);
  if (!record) return failure('TASK_DECISION_UNTRUSTED', 'the decision is fabricated or already used');
  const { plan, task } = record;
  const current = () => taskBaselineProblem(plan, state.doc, context) ?? leaseProblem(state.doc, task, context);
  const baseline = current();
  if (baseline) return baseline;
  decisions.delete(decision);
  if (!decision.approved) {
    rejectedCandidates.add(record);
    return { doc: state.doc, decision };
  }
  const prerequisite = dependencyProblem(task, record.prerequisites);
  if (prerequisite) return prerequisite;
  const accepted = await acceptProposal({ doc: structuredClone(record.proposalDoc), bodies: structuredClone(state.bodies) }, record.proposal, evaluate, { by: { agent: 'user' } });
  if ('error' in accepted) return failure('TASK_PROPOSAL_REFUSED', accepted.error);
  const changed = current() ?? dependencyProblem(task, record.prerequisites);
  if (changed) return changed;
  if (candidateModelDigest(accepted.state.doc) !== record.modelDigest)
    return failure('TASK_CANDIDATE_MOVED', 'the proposal replay differs from the verified candidate');
  return { doc: accepted.state.doc, decision };
}
