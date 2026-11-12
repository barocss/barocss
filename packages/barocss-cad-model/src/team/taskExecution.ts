// D584: a verified task is a candidate on a frozen input. The host owns decisions and the accepted document.
import { isCurrentRequirement, requirementEvidenceOf } from '../chat/requirementEvidence';
import { expectedOf, checkSpec } from '../chat/spec';
import { acceptProposal, runTool, type ChatState, type Evaluate } from '../chat/tools';
import type { StudioDoc } from '../engine/doc';
import type { EvalResult } from '../engine/evaluate';
import type { Requirement } from '../engine/schema/spec';
import { digestOf } from '../util/digest';
import { isObj } from '../util/guards';
import { isUserToken, type UserToken } from './ecr';
import { interfacesRevision } from './interfaces';
import { integratePart, type Lease, type PartCode, type PartTrace } from './parts';
import { isPositiveTaskValue, isTaskPlan, readRectangleFootprint, taskDimensionEdit, taskPlanImpact, taskScopeMatches, taskTarget, type BoundTask, type TaskPlan, type TaskPlanError, type TaskPlanRequest, type TaskValue, type RectangleFootprint } from './taskPlan';

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
type TaskSubmissionPin = { taskId: string; specRevision: string; inputDigest: string };
export type TaskSubmission = TaskSubmissionPin & (
  { heightMm: number; widthMm?: never; depthMm?: never; diameterMm?: never; footprintMm?: never } |
  { widthMm: number; heightMm?: never; depthMm?: never; diameterMm?: never; footprintMm?: never } |
  { depthMm: number; heightMm?: never; widthMm?: never; diameterMm?: never; footprintMm?: never } |
  { diameterMm: number; heightMm?: never; widthMm?: never; depthMm?: never; footprintMm?: never } |
  { footprintMm: RectangleFootprint; heightMm?: never; widthMm?: never; depthMm?: never; diameterMm?: never }
);

export function taskSubmissionForDimension(pin: TaskSubmissionPin, field: BoundTask['writes']['field'], valueMm: TaskValue): TaskSubmission {
  if (field === 'footprint') {
    const footprintMm = readRectangleFootprint(valueMm);
    if (!footprintMm) throw new Error('Expected a width and depth in mm for this footprint.');
    return { ...pin, footprintMm };
  }
  if (typeof valueMm !== 'number') throw new Error('Expected a single dimension in mm.');
  if (field === 'diameter') return { ...pin, diameterMm: valueMm };
  if (field === 'width') return { ...pin, widthMm: valueMm };
  if (field === 'depth') return { ...pin, depthMm: valueMm };
  return { ...pin, heightMm: valueMm };
}

export function readTaskSubmission(value: unknown): TaskSubmission | undefined {
  if (!isObj(value) || Object.keys(value).length !== 4 || Reflect.ownKeys(value).length !== 4
    || Object.values(Object.getOwnPropertyDescriptors(value)).some(field => !Object.hasOwn(field, 'value'))
    || !['taskId', 'specRevision', 'inputDigest'].every(key => Object.hasOwn(value, key))
    || typeof value.taskId !== 'string' || typeof value.specRevision !== 'string' || typeof value.inputDigest !== 'string') return;
  const { taskId, specRevision, inputDigest } = value;
  if (Object.hasOwn(value, 'heightMm') && typeof value.heightMm === 'number') return { taskId, specRevision, inputDigest, heightMm: value.heightMm };
  if (Object.hasOwn(value, 'widthMm') && typeof value.widthMm === 'number') return { taskId, specRevision, inputDigest, widthMm: value.widthMm };
  if (Object.hasOwn(value, 'depthMm') && typeof value.depthMm === 'number') return { taskId, specRevision, inputDigest, depthMm: value.depthMm };
  if (Object.hasOwn(value, 'diameterMm') && typeof value.diameterMm === 'number') return { taskId, specRevision, inputDigest, diameterMm: value.diameterMm };
  if (Object.hasOwn(value, 'footprintMm')) {
    const footprintMm = readRectangleFootprint(value.footprintMm);
    if (footprintMm) return { taskId, specRevision, inputDigest, footprintMm };
  }
}

export function taskSubmissionValue(submission: TaskSubmission, field: BoundTask['writes']['field']): TaskValue | undefined {
  return submission[`${field}Mm`];
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
export interface TaskNativeFinding {
  gate: PartTrace['gates'][number]['gate'];
  verdict: 'fail' | 'undecided';
  code: PartCode;
  message: string;
}

type TaskCandidateError = { error: TaskPlanError['error'] & { nativeFinding?: TaskNativeFinding } };

function nativeGateError(trace: PartTrace): TaskCandidateError {
  for (const { gate, verdict, findings } of trace.gates) {
    if (verdict !== 'fail' && verdict !== 'undecided') continue;
    const finding = findings.find(item => item.code !== 'NOT_REACHED');
    if (finding && finding.code !== 'NOT_REACHED') {
      const { code, message } = finding;
      return { error: { code: 'TASK_NATIVE_GATE', message, nativeFinding: { gate, verdict, code, message } } };
    }
  }
  return failure('TASK_NATIVE_GATE', 'the native candidate did not pass its gates');
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

type TaskShape = Exclude<ReturnType<typeof taskTarget>, TaskPlanError>['shape'];

function verifyHoleFace(result: Extract<EvalResult, { ok: true }>, shape: TaskShape, height: number, task: BoundTask): TaskPlanError | undefined {
  const name = task.reads.holeFace;
  if (!name) return;
  const bore = shape.hole, face = result.faceTable?.[name];
  const matches = result.bodies.flatMap(body => body.mesh.faces.filter(f => f.name.split('+').includes(name) || f.id === name));
  const close = (actual: number, want: number, scale: number) => Number.isFinite(actual)
    && Math.abs(actual - want) <= task.verification.relativeTolerance * Math.max(1, scale);
  if (!bore || face?.kind !== 'cylinder' || face.outer || !face.span || matches.length !== 1 || matches[0].exact?.kind !== 'cylinder'
    || !close(face.radius, bore.radius, bore.radius) || !close(matches[0].exact.r, bore.radius, bore.radius)
    || !close(face.point[0], bore.x, bore.radius) || !close(face.point[1], bore.y, bore.radius)
    || !close(face.axis[0], 0, 1) || !close(face.axis[1], 0, 1) || !close(Math.abs(face.axis[2]), 1, 1))
    return failure('TASK_HOLE_FACE', `Native face ${name} must resolve to one inner cylinder on the authored hole axis and radius.`);
  const z = face.span.map(t => face.point[2] + face.axis[2] * t);
  if (!close(Math.min(...z), 0, height) || !close(Math.max(...z), height, height))
    return failure('TASK_HOLE_FACE', `Native face ${name} must span the full extrusion height.`);
}

function cylinderBoundaryMatches(result: Extract<EvalResult, { ok: true }>, feature: string,
  circle: NonNullable<TaskShape['circle']>, height: number, close: (actual: number, want: number, scale?: number) => boolean): boolean {
  const side = result.faceTable?.[circle.wall], bottom = result.faceTable?.[feature + '.bottom'],
    top = result.faceTable?.[feature + '.top'];
  if (side?.kind !== 'cylinder' || !side.outer || !side.span || bottom?.kind !== 'plane' || top?.kind !== 'plane')
    return false;
  const z = side.span.map(value => side.point[2] + side.axis[2] * value);
  return z[0] < z[1] && close(side.radius, circle.radius)
    && circle.center.every((value, i) => close(side.point[i], value, circle.radius))
    && [0, 0, 1].every((value, i) => close(side.axis[i], value))
    && close(z[0], 0) && close(z[1], height)
    && close(bottom.point[2], 0) && close(top.point[2], height)
    && [0, 0, -1].every((value, i) => close(bottom.normal[i], value))
    && [0, 0, 1].every((value, i) => close(top.normal[i], value));
}

function footprintBoundaryMatches(result: Extract<EvalResult, { ok: true }>, local: StudioDoc, shape: TaskShape,
  height: number, close: (actual: number, want: number, scale?: number) => boolean): boolean {
  const [sketch, extrude] = local.nodes;
  if (sketch?.kind !== 'sketch' || sketch.profile !== 'rectangle' || extrude?.kind !== 'extrude') return false;
  const sides = sketch.sideTags?.outer?.map(tag => `side[${tag}]`) ?? ['side0', 'side1', 'side2', 'side3'];
  const { minX, minY, width, depth } = shape;
  const faces = [
    [sides[0], 1, minY, -1, depth], [sides[1], 0, minX + width, 1, width],
    [sides[2], 1, minY + depth, 1, depth], [sides[3], 0, minX, -1, width],
    ['bottom', 2, 0, -1, height], ['top', 2, height, 1, height],
  ] as const;
  return faces.every(([role, axis, at, sign, scale]) => {
    const face = result.faceTable?.[extrude.id + '.' + role];
    return face?.kind === 'plane' && close(face.point[axis], at, scale)
      && face.normal.every((value, i) => close(value, i === axis ? sign : 0));
  });
}

/** Recheck a local task's native geometry and requirements without granting a lease or decision. */
export async function verifyTaskGeometry(local: StudioDoc, shape: TaskShape,
  height: number, task: BoundTask, evaluate: Evaluate): Promise<Pick<TaskCandidate, 'geometry' | 'checks'> | TaskPlanError> {
  const result = await evaluate(local);
  if (!result?.ok || result.bodies.length !== 1) return failure('TASK_NATIVE_GATE', 'the owned occurrence did not evaluate to one body');
  const holeFace = verifyHoleFace(result, shape, height, task);
  if (holeFace) return holeFace;
  const [body] = result.bodies;
  const size = [shape.width, shape.depth, height] as const;
  const { circle, hole } = shape;
  const grossArea = circle ? Math.PI * circle.radius ** 2 : shape.width * shape.depth;
  const holeArea = hole ? Math.PI * hole.radius ** 2 : 0;
  const area = grossArea - holeArea, volume = area * height;
  const paired = task.writes.field === 'footprint';
  const centre = [shape.minX + shape.width / 2, shape.minY + shape.depth / 2, height / 2] as const;
  const centroid = paired ? centre : circle ? [...circle.center, height / 2] as const : [
    (centre[0] * grossArea - (hole?.x ?? 0) * holeArea) / area,
    (centre[1] * grossArea - (hole?.y ?? 0) * holeArea) / area,
    height / 2,
  ] as const;
  const close = (actual: number, want: number, scale = Math.abs(want)) => Number.isFinite(actual) && Number.isFinite(want)
    && Math.abs(actual - want) <= task.verification.relativeTolerance * Math.max(1, scale);
  const { min, max } = body.mesh.bounds;
  const simpleSolid = body.family === 'upright' && body.massMethod === 'closed-form' && (body.pieces ?? 1) === 1 && body.innerShells === 0;
  const boundsMatch = paired ? simpleSolid && footprintBoundaryMatches(result, local, shape, height, close)
    : circle ? simpleSolid && cylinderBoundaryMatches(result, task.feature, circle, height, close)
    : [shape.minX, shape.minY, 0].every((v, i) => close(min[i], v)) && size.every((v, i) => close(max[i] - min[i], v));
  if (body.volume === null || (circle && body.volume <= 0) || !close(body.volume, volume) || !body.centroid
      || !boundsMatch || !centroid.every((v, i) => close(body.centroid![i], v, paired ? size[i] : i < 2 ? circle?.radius : undefined)))
    return failure('TASK_ORACLE_MISMATCH', circle ? 'native cylinder boundary or mass properties differ from the independent cylinder calculation'
      : 'native volume, bounds or centroid differs from the independent prism calculation');

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
  return { checks: Object.freeze(checks), geometry: Object.freeze({ sizeMm: Object.freeze(size), volumeMm3: volume, centroidMm: Object.freeze(centroid) }) };
}

/** Read protected siblings through the native requirement checker on the candidate document. */
export async function verifyProtectedTaskChecks(doc: StudioDoc, protectedOccurrences: readonly string[] | undefined,
  evaluate: Evaluate): Promise<TaskPlanError | undefined> {
  for (const part of protectedOccurrences ?? []) {
    const report = await requirementEvidenceOf(doc, part, evaluate);
    if ('error' in report) return failure('TASK_PROTECTED_CHECK', report.error);
    const hard = report.evidence.filter(row => row.requirement?.hard);
    if (!hard.length || hard.some(row => !isCurrentRequirement(row, part, report.revision) || row.result.verdict !== 'pass'))
      return failure('TASK_PROTECTED_CHECK', `The protected requirements of ${part} did not pass native verification.`);
  }
}

/** Evaluate one admitted dimensional edit on a private copy, then prepare its existing grouped proposal. */
export async function buildTaskCandidate(
  plan: TaskPlan, state: ChatState, submission: TaskSubmission, context: TaskWorkerContext, evaluate: Evaluate,
  prerequisites: readonly TaskCandidate[] = [],
): Promise<TaskCandidate | TaskCandidateError> {
  const baseline = taskBaselineProblem(plan, state.doc, context);
  if (baseline) return baseline;
  const submitted = readTaskSubmission(submission);
  if (!submitted) return failure('TASK_SUBMISSION_MISMATCH', 'the submission must contain only the admitted task fields');
  const task = plan.tasks.find(t => t.id === submitted.taskId);
  if (!task || submitted.specRevision !== plan.specRevision || submitted.inputDigest !== task.inputDigest)
    return failure('TASK_SUBMISSION_MISMATCH', 'the submitted operation does not match its admitted task and specification');
  if (context.worker !== task.holder) return failure('TASK_WORKER_SCOPE', `${context.worker} does not own ${task.id}`);
  const value = taskSubmissionValue(submitted, task.writes.field);
  if (value === undefined) return failure('TASK_SUBMISSION_MISMATCH', 'the submitted dimension does not match the task scope');
  if (!isPositiveTaskValue(value)) return failure('TASK_VALUE', 'the dimension must be a positive finite value in mm');
  if (task.blockers.length) return failure('TASK_REQUIRED_UNKNOWN', task.blockers.join(', '));
  const lease = leaseProblem(state.doc, task, context);
  if (lease) return lease;
  const dependencies = dependencyProofs(plan, task, prerequisites);
  if ('error' in dependencies) return dependencies;

  const doc = structuredClone(state.doc), own: ChatState = { doc, bodies: structuredClone(state.bodies) };
  const target = taskTarget(doc, task);
  if ('error' in target) return target;
  const edit = taskDimensionEdit(doc, task, target, value);
  if ('error' in edit) return edit;
  if (task.writes.field === 'diameter') {
    const before = await evaluate(target.instance.doc);
    if (!before?.ok || before.bodies.length !== 1) return failure('TASK_NATIVE_GATE', 'the baseline occurrence did not evaluate to one body');
    const holeFace = verifyHoleFace(before, target.shape, target.height, task);
    if (holeFace) return holeFace;
  }
  const { args, doc: expected, local, shape, height } = edit;
  const patch = { id: task.id, by: task.holder, part: task.occurrence, contract: interfacesRevision(doc), ops: [{ tool: 'edit_feature', args }] };
  const staged = await integratePart(own, patch, context.leases, evaluate, context.sequence, { requireCompleteAssembly: true });
  if (staged.trace.decision !== 'applied') return nativeGateError(staged.trace);
  const candidate = staged.state.doc;
  if (digestOf(candidate) !== digestOf(expected))
    return failure('TASK_SCOPE_CHANGED', 'the candidate changed something outside the owned dimension');

  const verified = await verifyTaskGeometry(local, shape, height, task, evaluate);
  if ('error' in verified) return verified;
  if (plan.protectedOccurrences) {
    const protection = await verifyProtectedTaskChecks(candidate, plan.protectedOccurrences, evaluate);
    if (protection) return protection;
  }

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
    dependencies: dependencies.proofs, ...verified,
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
  if (candidateModelDigest(accepted.state.doc) !== record.modelDigest)
    return failure('TASK_CANDIDATE_MOVED', 'the proposal replay differs from the verified candidate');
  if (plan.protectedOccurrences) {
    const protection = await verifyProtectedTaskChecks(accepted.state.doc, plan.protectedOccurrences, evaluate);
    if (protection) return protection;
  }
  const changed = current() ?? dependencyProblem(task, record.prerequisites);
  if (changed) return changed;
  return { doc: accepted.state.doc, decision };
}
