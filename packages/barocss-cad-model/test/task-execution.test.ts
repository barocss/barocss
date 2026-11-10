import assert from 'node:assert/strict';
import test from 'node:test';
import { askBatch, checkBatch } from '../src/chat/questions';
import type { ChatState } from '../src/chat/tools';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { emptyDoc, rectanglePart, withNode, type StudioDoc } from '../src/engine/doc';
import { evaluatePart } from '../src/engine/evaluate';
import type { Question } from '../src/engine/schema/questions';
import type { Requirement } from '../src/engine/schema/spec';
import { decideEcr, openEcr, userToken } from '../src/team/ecr';
import { taskDrawingCandidate, taskDrawingImpact } from '../src/team/taskDrawing';
import { interfacesRevision, readInterfaces } from '../src/team/interfaces';
import { applyTaskDecision, bindTaskDecision, buildTaskCandidate, taskCandidateImpact, type TaskWorkerContext } from '../src/team/taskExecution';
import { compileTaskPlan, type TaskPlanRequest, type TaskRequest } from '../src/team/taskPlan';
import { answerTaskQuestions, bindTaskQuestions } from '../src/team/taskQuestions';
import { digestOf } from '../src/util/digest';

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const identity = { projectId: 'bench', documentId: 'housing' };
const policyRevision = 'user-proposal-v1';
const at = '2026-11-10T00:00:00.000Z';
const stated = <T,>(value: T, source: string) => ({ value, source, basis: 'stated' as const, said: 'verified' as const });
const height = (id: string, value: number, basis: Requirement['basis'] = 'stated'): Requirement => ({
  id, source: `${id} thickness ${value} mm`, hard: true, basis, said: 'verified',
  check: { query: { fn: 'bbox', axis: 'z' }, op: '==', value, tol: 0.001, unit: 'mm' },
});
const plate = (w: number, d: number, h: number, id: string, target: number): StudioDoc => ({
  ...withNode(rectanglePart(w, d, h), { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [5, 5], radius: 2 }),
  requirements: [height(id, target)],
});
function assembly(): StudioDoc {
  return {
    ...emptyDoc(),
    brief: { version: 1, purpose: stated('housing', 'Make a housing'), process: stated('cnc-milling', 'Mill the plates'), material: stated('al6061', 'Use 6061') },
    interfaces: { ...readInterfaces(undefined), holePatterns: [{ id: 'H1', axis: [0, 0, 1], diameter: 4, positions: [[5, 5, 0]], parts: ['p1', 'p2'] }] },
    instances: [
      { id: 'p1', name: 'Base', position: [0, 0, 0], rotation: [0, 0, 0], doc: plate(20, 10, 5, 'base-height', 6) },
      { id: 'p2', name: 'Lid', position: [0, 0, 20], rotation: [0, 0, 0], doc: plate(12, 8, 3, 'lid-height', 4) },
    ],
  };
}
const task = (id: string, occurrence: string, dependsOn?: readonly string[]): TaskRequest => ({
  id, occurrence, holder: `${id}-worker`, feature: 'n1', capability: 'extrusion-height', units: 'mm', frame: 'part-local-z', dependsOn,
});
const request = (dependent = false): TaskPlanRequest => ({
  identity, policyRevision, maxTasks: 2, throughSequence: 8, tasks: [task('base', 'p1'), task('lid', 'p2', dependent ? ['base'] : [])],
});
function setup(doc = assembly(), input = request()) {
  const plan = compileTaskPlan(doc, input);
  assert.ok(!('error' in plan), 'error' in plan ? plan.error.message : '');
  const context: TaskWorkerContext = {
    activePlan: plan, identity, policyRevision, sequence: 1, worker: 'base-worker',
    leases: new Map(plan.tasks.map(t => [t.occurrence, { part: t.occurrence, holder: t.holder, contract: interfacesRevision(doc), until: 5 }])),
  };
  const state: ChatState = { doc, bodies: [] };
  const submission = (id: string, heightMm: number) => ({
    taskId: id, specRevision: plan.specRevision, inputDigest: plan.tasks.find(t => t.id === id)!.inputDigest, heightMm,
  });
  return { plan, state, context, submission };
}
const refuses = (out: unknown, code: string) => assert.equal((out as { error?: { code: string } })?.error?.code, code, JSON.stringify(out));

test('D584 two scoped native candidates, one exact user decision and native readback', async () => {
  const doc = assembly();
  doc.instances![0].doc.requirements!.push({ ...height('prefer-shorter', 5), hard: false, basis: 'assumed', said: 'unverified' });
  const { plan, state, context, submission } = setup(doc);
  const original = digestOf(state.doc);
  const base = await buildTaskCandidate(plan, state, submission('base', 6), context, evaluate);
  const lid = await buildTaskCandidate(plan, state, submission('lid', 4), { ...context, worker: 'lid-worker' }, evaluate);
  assert.ok(!('error' in base), JSON.stringify(base));
  assert.ok(!('error' in lid), JSON.stringify(lid));
  assert.equal(base.specRevision, lid.specRevision);
  assert.notEqual(base.candidateDigest, lid.candidateDigest);
  assert.equal(digestOf(state.doc), original);
  assert.deepEqual(base.geometry.sizeMm, [20, 10, 6]);
  assert.deepEqual(lid.geometry.sizeMm, [12, 8, 4]);
  assert.ok(Math.abs(base.geometry.volumeMm3 - (200 - Math.PI * 4) * 6) < 1e-9);
  assert.ok(Math.abs(lid.geometry.volumeMm3 - (96 - Math.PI * 4) * 4) < 1e-9);
  assert.deepEqual(base.checks.map(c => [c.id, c.status, c.measured]), [['base-height', 'pass', 6], ['prefer-shorter', 'fail', 6]]);
  assert.deepEqual(lid.checks.map(c => [c.id, c.status, c.measured]), [['lid-height', 'pass', 4]]);
  assert.equal(base.checks[0].basis, 'stated');
  assert.equal(base.checks[0].sourceStatus, 'verified');
  assert.equal(base.checks[1].sourceStatus, 'unverified');
  assert.deepEqual(base.gates, ['lease', 'validity', 'contract', 'assembly']);
  assert.deepEqual(base.scope, { occurrence: 'p1', feature: 'n1', field: 'height' });
  assert.deepEqual(plan.tasks[0].reads.interfaces, ['pattern:H1']);
  const appearance = { ...state.doc, brief: { ...state.doc.brief!, finish: stated('blue', 'Finish blue') } };
  assert.deepEqual(taskCandidateImpact(base, appearance, context), { localEvidence: 'current', assemblyEvidence: 'stale' });

  refuses(bindTaskDecision(base, true, { by: 'user', at }), 'TASK_DECISION_UNTRUSTED');
  refuses(bindTaskDecision(structuredClone(base), true, userToken(at)), 'TASK_DECISION_UNTRUSTED');
  const token = userToken(at), approval = bindTaskDecision(base, true, token);
  assert.ok(!('error' in approval), JSON.stringify(approval));
  refuses(bindTaskDecision(lid, true, token), 'TASK_DECISION_UNTRUSTED');
  refuses(bindTaskDecision(base, false, userToken(at)), 'TASK_DECISION_UNTRUSTED');
  refuses(await applyTaskDecision(structuredClone(approval), state, context, evaluate), 'TASK_DECISION_UNTRUSTED');
  refuses(await applyTaskDecision(approval, state, { ...context, identity: { ...identity, documentId: 'foreign' } }, evaluate), 'TASK_DOCUMENT_MOVED');
  const replacement = setup(structuredClone(state.doc));
  assert.equal(replacement.plan.specRevision, plan.specRevision);
  refuses(await applyTaskDecision(approval, state, replacement.context, evaluate), 'TASK_SPEC_MOVED');
  const accepted = await applyTaskDecision(approval, state, context, evaluate);
  assert.ok(!('error' in accepted), JSON.stringify(accepted));
  refuses(await applyTaskDecision(approval, state, context, evaluate), 'TASK_DECISION_UNTRUSTED');
  assert.equal(digestOf(state.doc), original);
  assert.deepEqual(accepted.doc.instances![1], state.doc.instances![1]);
  assert.deepEqual(accepted.doc.interfaces, state.doc.interfaces);
  assert.equal(accepted.doc.proposals?.at(-1)?.status, 'accepted');
  assert.equal(accepted.doc.proposals?.at(-1)?.id, base.proposalId);
  assert.deepEqual(accepted.doc.history?.at(-1)?.by, { agent: 'user' });
  const read = await readStudioFile(encodeStudioFile(accepted.doc));
  assert.ok(!('error' in read), JSON.stringify(read));
  assert.equal(digestOf(read.doc), digestOf(accepted.doc));
  const local = await evaluate(read.doc.instances![0].doc);
  assert.ok(local.ok);
  assert.ok(Math.abs(local.bodies[0].volume! - base.geometry.volumeMm3) < 1e-8);

  const rejection = bindTaskDecision(lid, false, userToken(at));
  assert.ok(!('error' in rejection), JSON.stringify(rejection));
  const rejected = await applyTaskDecision(rejection, state, context, evaluate);
  assert.ok(!('error' in rejected));
  assert.equal(rejected.doc, state.doc);
  assert.deepEqual(taskCandidateImpact(lid, state.doc, context), { localEvidence: 'blocked', assemblyEvidence: 'blocked' });
  refuses(bindTaskDecision(lid, true, userToken(at)), 'TASK_DECISION_UNTRUSTED');
});

test('D584 execution fails closed on scope, leases, specification and unverified dependencies', async () => {
  const { plan, state, context, submission } = setup(assembly(), request(true));
  const held = async () => { throw new Error('preflight must refuse before native evaluation'); };
  const base = submission('base', 6);
  refuses(await buildTaskCandidate(structuredClone(plan), state, base, context, held), 'TASK_PLAN_UNTRUSTED');
  refuses(await buildTaskCandidate(plan, state, { ...base, specRevision: 'foreign' }, context, held), 'TASK_SUBMISSION_MISMATCH');
  refuses(await buildTaskCandidate(plan, state, { ...base, heightMm: Infinity }, context, held), 'TASK_VALUE');
  const escape = { ...base, occurrence: 'p2', feature: 'n2' };
  refuses(await buildTaskCandidate(plan, state, escape, context, held), 'TASK_SUBMISSION_MISMATCH');
  refuses(await buildTaskCandidate(plan, state, base, { ...context, sequence: 6 }, held), 'TASK_LEASE_STALE');
  refuses(await buildTaskCandidate(plan, state, base, { ...context, sequence: 9 }, held), 'TASK_BUDGET');
  refuses(await buildTaskCandidate(plan, state, base, { ...context, leases: new Map() }, held), 'TASK_LEASE_OWNER');
  refuses(await buildTaskCandidate(plan, state, base, { ...context, worker: 'lid-worker' }, held), 'TASK_WORKER_SCOPE');
  const expired = new Map(context.leases);
  expired.set('p1', { ...expired.get('p1')!, expiredBy: 'ECR1' });
  refuses(await buildTaskCandidate(plan, state, base, { ...context, leases: expired }, held), 'TASK_LEASE_STALE');
  const lidContext = { ...context, worker: 'lid-worker' };
  refuses(await buildTaskCandidate(plan, state, submission('lid', 4), lidContext, held), 'TASK_DEPENDENCY_UNVERIFIED');
  const candidate = await buildTaskCandidate(plan, state, base, context, evaluate);
  assert.ok(!('error' in candidate), JSON.stringify(candidate));
  refuses(await buildTaskCandidate(plan, state, submission('lid', 4), lidContext, held, [structuredClone(candidate)]), 'TASK_DEPENDENCY_UNVERIFIED');
  const dependent = await buildTaskCandidate(plan, state, submission('lid', 4), lidContext, evaluate, [candidate]);
  assert.ok(!('error' in dependent), JSON.stringify(dependent));
  assert.deepEqual(dependent.dependencies, [{ taskId: 'base', candidateDigest: candidate.candidateDigest }]);
  refuses(await buildTaskCandidate(plan, state, submission('base', 7), context, evaluate), 'TASK_REQUIRED_CHECK');
  const approval = bindTaskDecision(dependent, true, userToken(at));
  assert.ok(!('error' in approval));
  const rejection = bindTaskDecision(candidate, false, userToken(at));
  assert.ok(!('error' in rejection));
  assert.ok(!('error' in await applyTaskDecision(rejection, state, context, evaluate)));
  refuses(await buildTaskCandidate(plan, state, submission('lid', 4), lidContext, held, [candidate]), 'TASK_DEPENDENCY_UNVERIFIED');
  refuses(await applyTaskDecision(approval, state, context, held), 'TASK_DEPENDENCY_UNVERIFIED');
  assert.deepEqual(taskCandidateImpact(dependent, state.doc, context), { localEvidence: 'blocked', assemblyEvidence: 'blocked' });
});

test('D584 does not certify an assembly when a visible peer fails to evaluate', async () => {
  const { plan, state, context, submission } = setup();
  const peerUnavailable = (doc: StudioDoc) => doc.requirements?.some(r => r.id === 'lid-height')
    ? Promise.resolve(null) : evaluate(doc);
  const out = await buildTaskCandidate(plan, state, submission('base', 6), context, peerUnavailable);
  refuses(out, 'TASK_NATIVE_GATE');
  assert.match((out as { error: { message: string } }).error.message, /p2/);
});

test('D584 questions apply once to the exact admitted document and cannot clear a skipped hard unknown', async () => {
  const doc = assembly(), instance = doc.instances![0];
  const provisional = { ...instance.doc, requirements: [height('base-height', 6, 'assumed')] };
  const questions: Question[] = [{ id: 'H', text: 'What is the base thickness?', kind: 'number', unit: 'mm', blocks: { requirement: 'base-height' } }];
  assert.equal(checkBatch(provisional, questions), null);
  const asked = askBatch(provisional, questions);
  instance.doc = asked.doc;
  const { plan, state, context, submission } = setup(doc);
  assert.ok(plan.tasks[0].blockers.length);
  refuses(await buildTaskCandidate(plan, state, submission('base', 6), context, evaluate), 'TASK_REQUIRED_UNKNOWN');
  const binding = bindTaskQuestions(plan, doc, context, 'base', asked.batch.n);
  assert.ok(!('error' in binding), JSON.stringify(binding));
  const duplicate = bindTaskQuestions(plan, doc, context, 'base', asked.batch.n);
  assert.ok(!('error' in duplicate));
  refuses(answerTaskQuestions(binding, doc, context, { H: 6 }, { by: 'user', at }), 'TASK_DECISION_UNTRUSTED');
  refuses(answerTaskQuestions(binding, doc, { ...context, identity: { ...identity, documentId: 'other' } }, { H: 6 }, userToken(at)), 'TASK_DOCUMENT_MOVED');
  refuses(answerTaskQuestions(binding, doc, context, { wrong: 6 }, userToken(at)), 'TASK_QUESTION_MOVED');
  const changed = { ...doc, brief: { ...doc.brief!, notes: stated('changed', 'Changed after the question') } };
  refuses(answerTaskQuestions(binding, changed, context, { H: 6 }, userToken(at)), 'TASK_SPEC_MOVED');
  const malformed = JSON.parse('null');
  refuses(answerTaskQuestions(binding, doc, context, malformed, userToken(at)), 'TASK_QUESTION_MOVED');
  refuses(answerTaskQuestions(binding, doc, context, { H: '6 in' }, userToken(at)), 'TASK_QUESTION_VALUE');
  const skipped = answerTaskQuestions(binding, doc, context, { H: null }, userToken(at));
  assert.ok(!('error' in skipped), JSON.stringify(skipped));
  assert.equal(skipped.trace.specRevision, plan.specRevision);
  assert.ok(setup(skipped.doc).plan.tasks[0].blockers.length);
  refuses(answerTaskQuestions(binding, doc, context, { H: 6 }, userToken(at)), 'TASK_QUESTION_MOVED');

  refuses(answerTaskQuestions(duplicate, doc, context, { H: 6 }, userToken(at)), 'TASK_QUESTION_MOVED');

  const current = setup(doc), reopened = bindTaskQuestions(current.plan, doc, current.context, 'base', asked.batch.n);
  assert.ok(!('error' in reopened), JSON.stringify(reopened));
  const answered = answerTaskQuestions(reopened, doc, current.context, { H: 6 }, userToken(at));
  assert.ok(!('error' in answered), JSON.stringify(answered));
  const revised = setup(answered.doc);
  assert.notEqual(revised.plan.specRevision, current.plan.specRevision);
  assert.deepEqual(revised.plan.tasks[0].blockers, []);
  refuses(await buildTaskCandidate(current.plan, revised.state, current.submission('base', 6), revised.context, evaluate), 'TASK_SPEC_MOVED');
});

test('D584 refuses a stored question targeting an already stated requirement', () => {
  const doc = assembly(), instance = doc.instances![0];
  const questions: Question[] = [{ id: 'H', text: 'What is the base thickness?', kind: 'number', unit: 'mm', blocks: { requirement: 'base-height' } }];
  const asked = askBatch(instance.doc, questions);
  instance.doc = asked.doc;
  const { plan, context } = setup(doc);
  refuses(bindTaskQuestions(plan, doc, context, 'base', asked.batch.n), 'TASK_QUESTION_MOVED');
});

test('D584 approved shared interface changes stale drawing candidates and local native evidence', async () => {
  const { plan, state, context, submission } = setup();
  const draw = taskDrawingCandidate(plan, state.doc, context, 'base', 'D584-BASE');
  assert.ok(!('error' in draw), JSON.stringify(draw));
  assert.equal(draw.result.status, 'ok', JSON.stringify(draw.result));
  assert.equal(taskDrawingImpact(draw, state.doc, context), 'current');
  assert.equal(taskDrawingImpact(structuredClone(draw), state.doc, context), 'blocked');
  const candidate = await buildTaskCandidate(plan, state, submission('base', 6), context, evaluate);
  assert.ok(!('error' in candidate), JSON.stringify(candidate));
  const appearance = { ...state.doc, brief: { ...state.doc.brief!, notes: stated('blue', 'Blue finish') } };
  assert.equal(taskDrawingImpact(draw, appearance, context), 'current');

  const original = state.doc.interfaces!;
  const changed = { ...original, holePatterns: [{ ...original.holePatterns[0], diameter: 5 }] };
  const ecr = openEcr(state.doc, 'designer', changed);
  assert.equal(taskDrawingImpact(draw, ecr.doc, context), 'current');
  const revised = decideEcr(ecr.doc, ecr.ecr.id, true, userToken(at), new Map()).doc;
  assert.equal(taskDrawingImpact(draw, revised, context), 'stale');
  assert.deepEqual(taskCandidateImpact(candidate, revised, context), { localEvidence: 'stale', assemblyEvidence: 'stale' });
  const current = setup(revised);
  refuses(await buildTaskCandidate(current.plan, current.state, current.submission('base', 6), current.context, evaluate), 'TASK_NATIVE_GATE');
});

test('D584 dependency rejection during replay prevents the approved document from returning', async () => {
  const { plan, state, context, submission } = setup(assembly(), request(true));
  const base = await buildTaskCandidate(plan, state, submission('base', 6), context, evaluate);
  assert.ok(!('error' in base), JSON.stringify(base));
  const lid = await buildTaskCandidate(plan, state, submission('lid', 4), { ...context, worker: 'lid-worker' }, evaluate, [base]);
  assert.ok(!('error' in lid), JSON.stringify(lid));
  const approveLid = bindTaskDecision(lid, true, userToken(at)), rejectBase = bindTaskDecision(base, false, userToken(at));
  assert.ok(!('error' in approveLid) && !('error' in rejectBase));
  let entered!: () => void, resume!: () => void;
  const firstEvaluation = new Promise<void>(resolve => { entered = resolve; });
  const wait = new Promise<void>(resolve => { resume = resolve; });
  const attempt = applyTaskDecision(approveLid, state, context, async doc => { entered(); await wait; return evaluate(doc); });
  try {
    await Promise.race([firstEvaluation, attempt.then(() => assert.fail('The candidate returned before native replay.'))]);
    const rejected = await applyTaskDecision(rejectBase, state, context, evaluate);
    assert.ok(!('error' in rejected));
    assert.equal(rejected.doc, state.doc);
  } finally {
    resume();
  }
  refuses(await attempt, 'TASK_DEPENDENCY_UNVERIFIED');
});
