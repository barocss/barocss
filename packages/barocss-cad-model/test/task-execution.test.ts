import assert from 'node:assert/strict';
import test from 'node:test';
import { commandById } from '../src/app/commands';
import { editCommand } from '../src/app/editCommand';
import { askBatch, checkBatch } from '../src/chat/questions';
import { requirementEvidenceOf } from '../src/chat/requirementEvidence';
import { acceptProposal, runTool, type ChatState } from '../src/chat/tools';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { cylinderPart, emptyDoc, featureLabel, rectanglePart, withNode, type StudioDoc } from '../src/engine/doc';
import { evaluatePart } from '../src/engine/evaluate';
import { bindParameter, withParameters } from '../src/engine/parameters';
import type { Question } from '../src/engine/schema/questions';
import type { Requirement } from '../src/engine/schema/spec';
import { decideEcr, openEcr, userToken } from '../src/team/ecr';
import { taskDrawingCandidate, taskDrawingImpact } from '../src/team/taskDrawing';
import { interfacesRevision, readInterfaces } from '../src/team/interfaces';
import { applyTaskDecision, bindTaskDecision, buildTaskCandidate, taskCandidateImpact, taskSubmissionForDimension, type TaskSubmission, type TaskWorkerContext } from '../src/team/taskExecution';
import { inspectLocalHeightPlan } from '../src/team/localHeightPlan';
import { profileOf } from '../src/sketch/loops';
import { compileTaskPlan, taskDimensionEdit, taskTarget, type TaskPlanRequest, type TaskRequest } from '../src/team/taskPlan';
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

test('D627 a protected sibling must pass the native check both before review and at approval', async () => {
  const doc = assembly(), [base, lid] = doc.instances!;
  delete doc.interfaces;
  base.doc = { ...rectanglePart(20, 10, 5), requirements: [height('base-height', 6)] };
  lid.doc = { ...rectanglePart(12, 8, 3), requirements: [height('lid-height', 3)] };
  const input: TaskPlanRequest = { ...request(), maxTasks: 1, tasks: [task('base', 'p1')], protectedOccurrences: ['p2'] };
  const { plan, state, context, submission } = setup(doc, input);
  refuses(compileTaskPlan(doc, { ...input, protectedOccurrences: ['p1'] }), 'BAD_PLAN');
  refuses(compileTaskPlan(doc, { ...input, protectedOccurrences: ['p2', 'p2'] }), 'BAD_PLAN');
  refuses(compileTaskPlan(doc, { ...input, protectedOccurrences: undefined }), 'UNCOVERED_REQUIREMENT');

  const wrongNativeHeight = async (model: StudioDoc) => {
    const result = await evaluate(model);
    if (!result.ok || !model.requirements?.some(req => req.id === 'lid-height')) return result;
    const bodies = result.bodies.map(body => {
      const { min, max } = body.mesh.bounds;
      return { ...body, mesh: { ...body.mesh, bounds: { min, max: [max[0], max[1], max[2] + 1] as typeof max } } };
    });
    return { ...result, bodies };
  };
  const submit = submission('base', 6);
  refuses(await buildTaskCandidate(plan, state, submit, context, wrongNativeHeight), 'TASK_PROTECTED_CHECK');
  const candidate = await buildTaskCandidate(plan, state, submit, context, evaluate);
  assert.ok(!('error' in candidate), JSON.stringify(candidate));
  const decision = bindTaskDecision(candidate, true, userToken(at));
  assert.ok(!('error' in decision));
  refuses(await applyTaskDecision(decision, state, context, wrongNativeHeight), 'TASK_PROTECTED_CHECK');
  assert.equal(digestOf(state.doc), plan.baselineDigest);
});

for (const [field, axis, coordinate, title, target] of [
  ['width', 'x', 0, 'Width', 24],
  ['depth', 'y', 1, 'Depth', 14],
] as const) test(`A ${field} task edits only the local ${axis} extent and refuses unsupported inputs`, async () => {
  const current = field === 'width' ? 20 : 10;
  const dimension = field === 'width' ? 'widthMm' : 'depthMm';
  const doc = assembly();
  delete doc.interfaces;
  const [base, lid] = doc.instances!;
  base.doc = { ...rectanglePart(20, 10, 5), requirements: [
    { ...height(field, target), check: { ...height(field, target).check, query: { fn: 'bbox', axis } } },
    height('fixed-height', 5),
  ] };
  lid.doc = { ...rectanglePart(12, 8, 3), requirements: [height('lid-height', 4)] };
  const sketch = base.doc.nodes[0];
  assert.ok(sketch.kind === 'sketch' && sketch.profile === 'rectangle');
  sketch.min = [3, 2];
  sketch.max = [23, 12];
  const inspection = inspectLocalHeightPlan(doc, ['p1', 'p2'], identity);
  assert.ok(!('error' in inspection));
  assert.deepEqual(inspection.issues, []);
  assert.deepEqual(inspection.plan.tasks.map(task => [task.feature, task.writes.field]), [['n0', field], ['n1', 'height']]);
  assert.deepEqual(inspection.targets[0], { id: 'p1', requirementId: field, [`current${title}Mm`]: current, [dimension]: target, toleranceMm: 0.001 });
  const request = { ...inspection.request, policyRevision };
  const [planarTask, otherTask] = request.tasks;
  for (const [change, code] of [
    [{ frame: axis === 'x' ? 'part-local-y' : 'part-local-x' }, 'WRONG_FRAME'],
    [{ feature: 'n1' }, 'WRONG_TARGET'],
  ] as const) {
    refuses(compileTaskPlan(doc, { ...request, tasks: [{ ...planarTask, ...change }, otherTask] }), code);
  }
  const { plan, state, context } = setup(doc, request);
  const task = plan.tasks[0];
  assert.equal(task.frame, `part-local-${axis}`);
  const pin = { taskId: task.id, specRevision: plan.specRevision, inputDigest: task.inputDigest };
  const workerContext = { ...context, worker: task.holder };
  const neverEvaluate = async () => { throw new Error('Invalid planar task reached the evaluator'); };
  refuses(await buildTaskCandidate(plan, state, { ...pin, heightMm: target }, workerContext, neverEvaluate), 'TASK_SUBMISSION_MISMATCH');
  const wrongDimension = taskSubmissionForDimension(pin, field === 'depth' ? 'width' : 'depth', target);
  refuses(await buildTaskCandidate(plan, state, wrongDimension, workerContext, neverEvaluate), 'TASK_SUBMISSION_MISMATCH');
  const mixedDimensions = { ...pin, widthMm: target, depthMm: target } as unknown as Parameters<typeof buildTaskCandidate>[2];
  refuses(await buildTaskCandidate(plan, state, mixedDimensions, workerContext, neverEvaluate), 'TASK_SUBMISSION_MISMATCH');
  const hidden = Object.defineProperty({ ...pin }, dimension, { value: target, enumerable: false }) as Parameters<typeof buildTaskCandidate>[2];
  refuses(await buildTaskCandidate(plan, state, hidden, workerContext, neverEvaluate), 'TASK_SUBMISSION_MISMATCH');
  refuses(await buildTaskCandidate(plan, state, taskSubmissionForDimension(pin, field, current), workerContext, neverEvaluate), 'TASK_VALUE');
  const candidate = await buildTaskCandidate(plan, state, taskSubmissionForDimension(pin, field, target), workerContext, evaluate);
  assert.ok(!('error' in candidate), JSON.stringify(candidate));
  assert.deepEqual(candidate.geometry, field === 'width'
    ? { sizeMm: [24, 10, 5], volumeMm3: 1200, centroidMm: [15, 7, 2.5] }
    : { sizeMm: [20, 14, 5], volumeMm3: 1400, centroidMm: [13, 9, 2.5] });
  const decision = bindTaskDecision(candidate, true, userToken(at));
  assert.ok(!('error' in decision));
  const accepted = await applyTaskDecision(decision, state, workerContext, evaluate);
  assert.ok(!('error' in accepted), JSON.stringify(accepted));
  assert.deepEqual(accepted.doc.instances![0].doc.nodes, [{ ...sketch, max: field === 'width' ? [27, 12] : [23, 16] }, base.doc.nodes[1]]);
  assert.deepEqual(accepted.doc.instances![1], lid);
  assert.deepEqual(sketch.max, [23, 12]);

  const shifted = structuredClone(doc), shiftedSketch = shifted.instances![0].doc.nodes[0];
  assert.ok(shiftedSketch.kind === 'sketch' && shiftedSketch.profile === 'rectangle');
  shiftedSketch.min[coordinate] = 1e9;
  shiftedSketch.max[coordinate] = 1e9 + current;
  shifted.instances![0].doc.requirements![0].check.value = 1e-10;
  const unrepresentable = inspectLocalHeightPlan(shifted, ['p1', 'p2'], identity);
  assert.ok(!('error' in unrepresentable));
  assert.equal(unrepresentable.issues[0]?.code, 'TASK_VALUE');
  shiftedSketch.min[coordinate] = 1e8;
  shiftedSketch.max[coordinate] = 1e8 + current;
  shifted.instances![0].doc.requirements![0].check.value = 1.1;
  shifted.instances![0].doc.requirements![0].check.tol = 0;
  const outsideTolerance = inspectLocalHeightPlan(shifted, ['p1', 'p2'], identity);
  assert.ok(!('error' in outsideTolerance));
  assert.equal(outsideTolerance.issues[0]?.code, 'TASK_REQUIRED_CHECK');
  const construction = structuredClone(doc), constructionSketch = construction.instances![0].doc.nodes[0];
  assert.ok(constructionSketch.kind === 'sketch');
  constructionSketch.construction = [];
  const unsupported = inspectLocalHeightPlan(construction, ['p1', 'p2'], identity);
  assert.ok(!('error' in unsupported));
  assert.equal(unsupported.issues[0]?.code, 'UNSUPPORTED_PROFILE');
  const withHole = structuredClone(doc);
  withHole.instances![0].doc = withNode(withHole.instances![0].doc,
    { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [8, 7], radius: 1 });
  refuses(inspectLocalHeightPlan(withHole, ['p1', 'p2'], identity), 'UNSUPPORTED_PROFILE');
});

test('D777 automatic depth planning preserves in-tolerance width and height', () => {
  const doc = assembly();
  delete doc.interfaces;
  const [base, lid] = doc.instances!;
  base.doc = { ...rectanglePart(20, 10, 5), requirements: [
    { ...height('depth', 14), check: { ...height('depth', 14).check, query: { fn: 'bbox', axis: 'y' } } },
    { ...height('width', 20.0005), check: { ...height('width', 20.0005).check, query: { fn: 'bbox', axis: 'x' } } },
    height('fixed-height', 5.0005),
  ] };
  lid.doc = { ...rectanglePart(12, 8, 3), requirements: [height('lid-height', 3)] };
  const inspection = inspectLocalHeightPlan(doc, ['p1'], identity);
  assert.ok(!('error' in inspection), JSON.stringify(inspection));
  assert.deepEqual(inspection.issues, []);
  assert.deepEqual(inspection.targets, [{ id: 'p1', requirementId: 'depth', currentDepthMm: 10, depthMm: 14, toleranceMm: 0.001 }]);
  assert.deepEqual(inspection.plan.protectedOccurrences, ['p2']);

  base.doc.requirements![1].check.value = 21;
  base.doc.requirements![2].check.value = 6;
  refuses(inspectLocalHeightPlan(doc, ['p1'], identity), 'CONFLICTING_REQUIREMENT');
});

test('D779 admits one rectangle footprint and edits both extents before native publication', async () => {
  const doc = assembly(), [base, lid] = doc.instances!;
  delete doc.interfaces;
  const width = height('width', 24), depth = height('depth', 14);
  width.check.query = { fn: 'bbox', axis: 'x' };
  depth.check.query = { fn: 'bbox', axis: 'y' };
  depth.check.tol = 0.002;
  base.doc = { ...rectanglePart(20, 10, 5), requirements: [width, depth, height('fixed-height', 5.0005)] };
  lid.doc = { ...rectanglePart(12, 8, 3), requirements: [height('lid-height', 3)] };
  const sketch = base.doc.nodes[0];
  assert.ok(sketch.kind === 'sketch' && sketch.profile === 'rectangle');
  sketch.min = [3, -3];
  sketch.max = [23, 7];
  sketch.sideTags = { outer: ['e1', 'e2', 'e3', 'e4'] };
  const inspected = inspectLocalHeightPlan(doc, ['p1'], identity);
  assert.ok(!('error' in inspected), JSON.stringify(inspected));
  assert.deepEqual(inspected.issues, []);
  const wanted = { widthMm: 24, depthMm: 14 };
  assert.deepEqual(inspected.targets, [{ id: 'p1', currentFootprintMm: { widthMm: 20, depthMm: 10 }, footprintMm: wanted,
    widthRequirementId: 'width', depthRequirementId: 'depth', widthToleranceMm: 0.001, depthToleranceMm: 0.002 }]);
  const unstated = structuredClone(doc);
  delete unstated.instances![0].doc.requirements![0].basis;
  refuses(compileTaskPlan(unstated, inspected.request), 'BAD_REQUIREMENT');
  const { plan, state, context } = setup(doc, { ...inspected.request, policyRevision });
  const [bound] = plan.tasks;
  assert.deepEqual([bound.capability, bound.frame, bound.writes], ['rectangle-footprint', 'part-local-xy',
    { occurrence: 'p1', feature: 'n0', field: 'footprint' }]);
  const worker = { ...context, worker: bound.holder };
  const pin = { taskId: bound.id, specRevision: plan.specRevision, inputDigest: bound.inputDigest };
  const neverEvaluate = async () => { throw new Error('An invalid footprint reached the evaluator'); };
  for (const malformed of [
    { ...pin, widthMm: 24 }, { ...pin, widthMm: 24, depthMm: 14 },
    { ...pin, footprintMm: { widthMm: 24 } }, { ...pin, footprintMm: { ...wanted, heightMm: 5 } },
    { ...pin, footprintMm: { widthMm: 24, depthMm: Infinity } },
  ]) refuses(await buildTaskCandidate(plan, state, malformed as TaskSubmission, worker, neverEvaluate), 'TASK_SUBMISSION_MISMATCH');
  refuses(await buildTaskCandidate(plan, state, { ...pin, footprintMm: { widthMm: 14, depthMm: 24 } }, worker, neverEvaluate), 'TASK_REQUIRED_CHECK');
  refuses(await buildTaskCandidate(plan, state, { ...pin, footprintMm: { widthMm: 24, depthMm: 10 } }, worker, neverEvaluate), 'TASK_VALUE');
  const submission = taskSubmissionForDimension(pin, 'footprint', wanted);
  const changedNativePlane = async (local: StudioDoc) => {
    const native = await evaluate(local), key = 'n1.side[e2]';
    if (!native.ok || !native.faceTable) return native;
    const face = native.faceTable[key];
    if (face?.kind !== 'plane') return native;
    return { ...native, faceTable: { ...native.faceTable, [key]: { ...face, point: [face.point[0] + 0.5, face.point[1], face.point[2]] as typeof face.point } } };
  };
  refuses(await buildTaskCandidate(plan, state, submission, worker, changedNativePlane), 'TASK_ORACLE_MISMATCH');
  const candidate = await buildTaskCandidate(plan, state, submission, worker, evaluate);
  assert.ok(!('error' in candidate), JSON.stringify(candidate));
  assert.deepEqual(candidate.geometry, { sizeMm: [24, 14, 5], volumeMm3: 1680, centroidMm: [15, 4, 2.5] });
  const approval = bindTaskDecision(candidate, true, userToken(at));
  assert.ok(!('error' in approval));
  const result = await applyTaskDecision(approval, state, worker, evaluate);
  assert.ok(!('error' in result), JSON.stringify(result));
  assert.deepEqual(result.doc.instances![0].doc.nodes, [{ ...sketch, max: [27, 11] }, base.doc.nodes[1]]);
  assert.deepEqual(result.doc.instances![1], lid);
  assert.ok(!('error' in compileTaskPlan(result.doc, inspected.request)));
  assert.equal(digestOf(state.doc), plan.baselineDigest);

  for (const axis of [0, 1] as const) {
    const shifted = structuredClone(doc), part = shifted.instances![0].doc, shiftedSketch = part.nodes[0];
    assert.ok(shiftedSketch.kind === 'sketch' && shiftedSketch.profile === 'rectangle');
    shiftedSketch.min[axis] = 1e8;
    shiftedSketch.max[axis] = 1e8 + [20, 10][axis];
    part.requirements![axis].check.value = 1.1;
    part.requirements![axis].check.tol = 0;
    const precision = inspectLocalHeightPlan(shifted, ['p1'], identity);
    assert.ok(!('error' in precision));
    assert.equal(precision.issues[0]?.code, 'TASK_REQUIRED_CHECK');
  }
  const huge = structuredClone(doc);
  huge.instances![0].doc.requirements!.slice(0, 2).forEach(req => { req.check.value = 1e155; });
  const overflow = inspectLocalHeightPlan(huge, ['p1'], identity);
  assert.ok(!('error' in overflow));
  assert.equal(overflow.issues[0]?.code, 'TASK_VALUE');
});

test('D780 Box footprint approval preserves the editable command and exact checkpoint reconstruction', async () => {
  const doc = assembly(), [base, lid] = doc.instances!;
  delete doc.interfaces;
  const values = { w: '20', d: 10, h: 5, x: 0.13, y: -3, z: 0, up: '+z' };
  const box = commandById('box')!.build!({ doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } }, values);
  const width = height('width', 1), depth = height('depth', 14);
  width.check.query = { fn: 'bbox', axis: 'x' };
  depth.check.query = { fn: 'bbox', axis: 'y' };
  base.doc = { ...box, requirements: [width, depth] };
  lid.doc = { ...rectanglePart(12, 8, 3), requirements: [height('lid-height', 3)] };
  const planInputs = inspectLocalHeightPlan(doc, ['p1'], identity);
  assert.ok(!('error' in planInputs), JSON.stringify(planInputs));
  assert.deepEqual(planInputs.issues, []);
  const { plan, state, context } = setup(doc, { ...planInputs.request, policyRevision });
  const [bound] = plan.tasks;
  const submitted = taskSubmissionForDimension({
    taskId: bound.id, specRevision: plan.specRevision, inputDigest: bound.inputDigest,
  }, 'footprint', { widthMm: 1, depthMm: 14 });
  const worker = { ...context, worker: bound.holder };
  const candidate = await buildTaskCandidate(plan, state, submitted, worker, evaluate);
  assert.ok(!('error' in candidate), JSON.stringify(candidate));
  assert.ok(Math.abs(candidate.geometry.volumeMm3 - 70) < 1e-8);
  const approval = bindTaskDecision(candidate, true, userToken(at));
  assert.ok(!('error' in approval));
  const result = await applyTaskDecision(approval, state, worker, evaluate);
  assert.ok(!('error' in result), JSON.stringify(result));
  const accepted = result.doc.instances![0].doc;
  const [oldSketch, oldExtrusion] = box.nodes;
  assert.deepEqual(accepted.nodes, [{ ...oldSketch, max: [0.13 + 1, 11] },
    { ...oldExtrusion, made: { command: 'box', values: { ...values, w: 1, d: 14 } } }]);
  assert.deepEqual(result.doc.instances![1], lid);
  assert.equal(digestOf(state.doc), plan.baselineDigest);
  const reopened = await readStudioFile(encodeStudioFile(result.doc));
  assert.ok(!('error' in reopened));
  const nodes = reopened.doc.instances![0].doc.nodes;
  assert.equal(featureLabel(nodes[1], 1, nodes), 'Box 1×14×5');
  const command = editCommand(1, nodes);
  assert.equal(command?.label, 'Edit Box');
  assert.deepEqual(command?.defaults?.({ doc: accepted, bodies: [], selection: { faces: [], edges: [], bodies: [] } }), { ...values, w: 1, d: 14 });

  const target = taskTarget(doc, bound), next = taskTarget(reopened.doc, bound);
  assert.ok(!('error' in target) && !('error' in next));
  const original = taskDimensionEdit(doc, bound, target, { widthMm: 1, depthMm: 14 });
  const replay = taskDimensionEdit(doc, bound, target, next.value);
  assert.ok(!('error' in original) && !('error' in replay));
  assert.deepEqual(replay.op, original.op);
  assert.deepEqual(replay.local.nodes, accepted.nodes);
  assert.ok('retainBoxCommand' in replay.op.args && replay.op.args.retainBoxCommand === true);

  const localState = { doc: base.doc, bodies: [] };
  const legacy = await runTool(localState, 'propose', {
    title: 'Legacy sketch edit',
    ops: [{ tool: 'edit_feature', args: { index: 0, feature: accepted.nodes[0] } }],
  }, evaluate);
  assert.equal(legacy.isError, false, legacy.summary);
  const legacyResult = await acceptProposal(legacy.state, legacy.state.doc.proposals!.at(-1)!.id, evaluate);
  assert.ok(!('error' in legacyResult), JSON.stringify(legacyResult));
  assert.deepEqual(legacyResult.state.doc.nodes, [accepted.nodes[0], oldExtrusion]);

  const acceptedSketch = accepted.nodes[0];
  assert.ok(acceptedSketch.kind === 'sketch' && acceptedSketch.profile === 'rectangle');
  const { max, ...rest } = acceptedSketch;
  const marked = { ...replay.op, args: { ...replay.op.args, feature: { max, ...rest } } };
  const retained = await runTool(localState, 'propose', {
    title: 'Retained Box footprint', ops: [marked],
  }, evaluate);
  assert.equal(retained.isError, false, retained.summary);
  const omitted = await acceptProposal(retained.state, retained.state.doc.proposals!.at(-1)!.id, evaluate, { leaveOut: ['n1'] });
  assert.ok(!('error' in omitted), JSON.stringify(omitted));
  assert.deepEqual(omitted.leftOut, ['n1']);
  assert.deepEqual(omitted.state.doc.nodes, base.doc.nodes);

  const withHole = withNode(base.doc, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [8, 2], radius: 1 });
  const batch = await runTool({ doc: withHole, bodies: [] }, 'propose', {
    title: 'Remove the hole and edit the Box',
    ops: [{ tool: 'delete_feature', args: { index: 2 } }, marked],
  }, evaluate);
  assert.equal(batch.isError, false, batch.summary);
  const removedHole = await acceptProposal(batch.state, batch.state.doc.proposals!.at(-1)!.id, evaluate, { leaveOut: ['n1'] });
  assert.ok(!('error' in removedHole), JSON.stringify(removedHole));
  assert.deepEqual(removedHole.state.doc.nodes, base.doc.nodes);

  const small = structuredClone(doc);
  small.instances![0].doc.requirements![0].check.value = 0.5;
  const refused = inspectLocalHeightPlan(small, ['p1'], identity);
  assert.ok(!('error' in refused));
  assert.equal(refused.issues[0]?.code, 'TASK_VALUE');

  const stale = structuredClone(doc), extrusion = stale.instances![0].doc.nodes[1];
  assert.ok(extrusion.kind === 'extrude' && extrusion.made);
  extrusion.made.values.d = 19;
  refuses(compileTaskPlan(stale, planInputs.request), 'UNSUPPORTED_PROFILE');
});

for (const axis of ['width', 'depth'] as const) test(`D781 retains the Box after a scalar ${axis} approval and keeps legacy replay`, async () => {
  const doc = assembly(), [base, lid] = doc.instances!;
  delete doc.interfaces;
  const values = { w: '20', d: '10', h: 5, x: 0.13, y: 0.13, z: 0, up: '+z' };
  const box = commandById('box')!.build!({ doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } }, values);
  const requirement = height(axis, 1);
  requirement.check.query = { fn: 'bbox', axis: axis === 'width' ? 'x' : 'y' };
  base.doc = { ...box, requirements: [requirement] };
  lid.doc = { ...rectanglePart(12, 8, 3), requirements: [height('lid-height', 3)] };

  const expectedValues = { ...values, [axis === 'width' ? 'w' : 'd']: 1 };
  const [sketch, extrusion] = box.nodes;
  assert.ok(sketch.kind === 'sketch' && sketch.profile === 'rectangle' && extrusion.kind === 'extrude' && extrusion.made);
  const max = [...sketch.max];
  max[axis === 'width' ? 0 : 1] = 0.13 + 1;
  const expectedSketch = { ...sketch, max };
  const expectedExtrusion = { ...extrusion, made: { ...extrusion.made, values: expectedValues } };
  const current = inspectLocalHeightPlan(doc, ['p1'], identity);
  const legacy = inspectLocalHeightPlan(doc, ['p1'], identity, { retainScalarBoxes: false });
  assert.ok(!('error' in current) && !('error' in legacy));
  assert.deepEqual([current.issues, legacy.issues], [[], []]);
  assert.equal(current.targets[0].retainBoxCommand, true);
  assert.equal(legacy.targets[0].retainBoxCommand, undefined);
  assert.notEqual(current.plan.tasks[0].inputDigest, legacy.plan.tasks[0].inputDigest);

  for (const inspected of [current, legacy]) {
    const retained: boolean = inspected === current;
    const { plan, state, context } = setup(doc, { ...inspected.request, policyRevision });
    const [task] = plan.tasks;
    assert.equal(task.retainBoxCommand, retained ? true : undefined);
    const worker = { ...context, worker: task.holder };
    const submission = taskSubmissionForDimension({ taskId: task.id, specRevision: plan.specRevision, inputDigest: task.inputDigest }, axis, 1);
    const candidate = await buildTaskCandidate(plan, state, submission, worker, evaluate);
    assert.ok(!('error' in candidate), JSON.stringify(candidate));
    assert.ok(Math.abs(candidate.geometry.volumeMm3 - (axis === 'width' ? 50 : 100)) < 1e-8);
    const decision = bindTaskDecision(candidate, true, userToken(at));
    assert.ok(!('error' in decision));
    const result = await applyTaskDecision(decision, state, worker, evaluate);
    assert.ok(!('error' in result), JSON.stringify(result));
    const accepted = result.doc.instances![0].doc;
    assert.deepEqual(accepted.nodes, [expectedSketch, retained ? expectedExtrusion : extrusion]);
    assert.deepEqual(result.doc.instances![1], lid);
    const before = taskTarget(doc, task), after = taskTarget(result.doc, task);
    assert.ok(!('error' in before) && !('error' in after));
    const reconstructed = taskDimensionEdit(doc, task, before, after.value);
    assert.ok(!('error' in reconstructed));
    assert.equal('retainBoxCommand' in reconstructed.op.args, retained);
    assert.deepEqual(reconstructed.local.nodes, accepted.nodes);
    assert.equal(digestOf(state.doc), plan.baselineDigest);
    if (retained) assert.equal(editCommand(1, accepted.nodes)?.label, 'Edit Box');
    else {
      const revised = structuredClone(result.doc);
      revised.instances![0].doc.requirements![0].check.value = 2;
      const repaired = inspectLocalHeightPlan(revised, ['p1'], identity);
      assert.ok(!('error' in repaired), JSON.stringify(repaired));
      assert.deepEqual(repaired.issues, []);
      assert.equal(repaired.targets[0].retainBoxCommand, undefined);
    }
  }

  const small = structuredClone(doc);
  small.instances![0].doc.requirements![0].check.value = 0.5;
  const refused = inspectLocalHeightPlan(small, ['p1'], identity);
  assert.ok(!('error' in refused));
  assert.equal(refused.issues[0]?.code, 'TASK_VALUE');
  assert.match(refused.issues[0]?.message ?? '', /Box command/);
});

test('D782 a height task changes the named value and preserves the raw extrusion binding', async () => {
  const doc = assembly(), [base, lid] = doc.instances!;
  delete doc.interfaces;
  doc.parameters.Thickness = 42;
  base.doc = bindParameter({
    ...rectanglePart(20, 10, 5), parameters: { Thickness: 5, Spare: 9 }, requirements: [height('base-height', 6)],
  }, { feature: 'n1', value: 'h', parameter: 'Thickness' });
  lid.doc = { ...rectanglePart(12, 8, 3), parameters: { Thickness: 11 }, requirements: [height('lid-height', 3)] };
  const inspection = inspectLocalHeightPlan(doc, ['p1'], identity);
  assert.ok(!('error' in inspection), JSON.stringify(inspection));
  assert.deepEqual(inspection.issues, []);
  assert.deepEqual(inspection.targets, [{ id: 'p1', requirementId: 'base-height', toleranceMm: 0.001, currentHeightMm: 5, heightMm: 6 }]);
  const { plan, state, context } = setup(doc, { ...inspection.request, policyRevision });
  const [task] = plan.tasks, worker = { ...context, worker: task.holder };
  assert.equal(task.reads.heightParameter, 'Thickness');
  const pin = { taskId: task.id, specRevision: plan.specRevision, inputDigest: task.inputDigest };
  const candidate = await buildTaskCandidate(plan, state, { ...pin, heightMm: 6 }, worker, evaluate);
  assert.ok(!('error' in candidate), JSON.stringify(candidate));
  assert.equal(candidate.geometry.volumeMm3, 1200);
  const decision = bindTaskDecision(candidate, true, userToken(at));
  assert.ok(!('error' in decision));
  const accepted = await applyTaskDecision(decision, state, worker, evaluate);
  assert.ok(!('error' in accepted), JSON.stringify(accepted));
  const expected = withParameters(base.doc, { Thickness: 6 });
  assert.deepEqual(accepted.doc.instances, [{ ...base, doc: expected }, lid]);
  assert.deepEqual(accepted.doc.parameters, { Thickness: 42 });
  assert.deepEqual(accepted.doc.proposals?.at(-1)?.ops, [{ tool: 'set_parameters', args: { part: 'p1', set: { Thickness: 6 } } }]);
  assert.equal(digestOf(doc), plan.baselineDigest);
  const before = taskTarget(doc, task), after = taskTarget(accepted.doc, task);
  assert.ok(!('error' in before) && !('error' in after));
  const replay = taskDimensionEdit(doc, task, before, after.value);
  assert.ok(!('error' in replay));
  assert.deepEqual(replay.local, expected);
  const reopened = await readStudioFile(encodeStudioFile(accepted.doc));
  assert.ok(!('error' in reopened));
  assert.deepEqual(reopened.doc.instances![0].doc.nodes, base.doc.nodes);
  assert.deepEqual(reopened.doc.instances![0].doc.parameters, { Thickness: 6, Spare: 9 });
});

test('D782 refuses a missing, nonpositive, shared or configuration-owned height parameter', () => {
  const doc = assembly(), [base] = doc.instances!;
  delete doc.interfaces;
  base.doc = bindParameter({
    ...rectanglePart(20, 10, 5), parameters: { Thickness: 5 }, requirements: [height('base-height', 6)],
  }, { feature: 'n1', value: 'h', parameter: 'Thickness' });
  for (const change of [
    (part: StudioDoc) => { delete part.parameters.Thickness; },
    (part: StudioDoc) => { part.parameters.Thickness = 0; },
    (part: StudioDoc) => { Object.assign(part.nodes[0], { max: [{ parameter: 'Thickness' }, 10] }); },
    (part: StudioDoc) => { part.configurations = { Thin: { Thickness: 2 } }; },
    (part: StudioDoc) => { Object.assign(part.nodes[1], { from: { parameter: 'Thickness' } }); },
    (part: StudioDoc) => { Object.assign(part, plate(20, 10, 5, 'base-height', 6), { parameters: { Thickness: 5 } }); Object.assign(part.nodes[1], { height: { parameter: 'Thickness' } }); },
  ]) {
    const altered = structuredClone(doc);
    change(altered.instances![0].doc);
    refuses(compileTaskPlan(altered, request()), 'UNSUPPORTED_PROFILE');
  }
});

for (const source of ['positional', 'tagged', 'remembered', 'named'] as const) test(`a ${source} circular extrusion height task preserves the authored profile and protected sibling`, async () => {
  const doc = assembly(), [base, lid] = doc.instances!;
  delete doc.interfaces;
  const named = source === 'named', tagged = source === 'tagged' || named;
  const radius = 4.23, heightMm = 6;
  const center: [number, number] = [3.07, -7.13];
  const cylinder = source === 'remembered' ? commandById('cylinder')!.build!(
    { doc: emptyDoc(), selection: { bodies: [], edges: [], faces: [] }, bodies: [] },
    { r: radius, h: 5, x: center[0], y: center[1], z: 0 },
  ) : cylinderPart(radius, 5);
  base.doc = { ...cylinder, requirements: [height('base-height', heightMm)] };
  lid.doc = { ...rectanglePart(12, 8, 3), requirements: [height('lid-height', 3)] };
  const sketch = base.doc.nodes[0];
  assert.ok(sketch.kind === 'sketch' && sketch.profile === 'circle');
  sketch.center = center;
  if (tagged) {
    const drawn = profileOf([{ kind: 'circle', c: center, r: radius, ids: ['e7'] }]);
    assert.ok(!('error' in drawn) && drawn.node.kind === 'sketch' && drawn.node.profile === 'circle' && drawn.node.sideTags);
    sketch.sideTags = drawn.node.sideTags;
  }
  if (named) {
    base.doc = bindParameter({ ...base.doc, parameters: { Thickness: 5, Spare: 9 } },
      { feature: 'n1', value: 'h', parameter: 'Thickness' });
    doc.parameters.Thickness = 42;
    lid.doc.parameters.Thickness = 11;
  }
  const inspected = inspectLocalHeightPlan(doc, ['p1'], identity);
  assert.ok(!('error' in inspected), JSON.stringify(inspected));
  assert.deepEqual(inspected.targets, [
    { id: 'p1', requirementId: 'base-height', currentHeightMm: 5, heightMm, toleranceMm: 0.001 },
  ]);
  assert.deepEqual(inspected.plan.protectedOccurrences, ['p2']);
  assert.deepEqual(inspected.plan.tasks[0].writes, { occurrence: 'p1', feature: 'n1', field: 'height' });
  const { plan, state, context, submission } = setup(doc, { ...inspected.request, policyRevision });
  const bound = plan.tasks[0];
  const worker = { ...context, worker: bound.holder };
  const submitted = submission(bound.id, heightMm);
  const candidate = await buildTaskCandidate(plan, state, submitted, worker, evaluate);
  assert.ok(!('error' in candidate), JSON.stringify(candidate));
  assert.deepEqual(candidate.geometry.sizeMm, [2 * radius, 2 * radius, heightMm]);
  assert.ok(Math.abs(candidate.geometry.volumeMm3 - Math.PI * radius ** 2 * heightMm) < 1e-8);
  assert.deepEqual(candidate.geometry.centroidMm, [3.07, -7.13, heightMm / 2]);
  assert.equal(bound.verification.oracle, 'circular-cylinder');
  assert.equal(bound.reads.heightParameter, named ? 'Thickness' : undefined);
  const sideName = tagged ? `n1.side[${sketch.sideTags!.outer[0]}]` : 'n1.side0';
  const alteredNativeRadius = async (local: StudioDoc) => {
    const native = await evaluate(local);
    if (!native.ok || !native.faceTable) return native;
    const side = native.faceTable[sideName];
    if (side?.kind !== 'cylinder') return native;
    return { ...native, faceTable: { ...native.faceTable, [sideName]: { ...side, radius: side.radius + 0.1 } } };
  };
  refuses(await buildTaskCandidate(plan, state, submitted, worker, alteredNativeRadius), 'TASK_ORACLE_MISMATCH');
  const approval = bindTaskDecision(candidate, true, userToken(at));
  assert.ok(!('error' in approval));
  const result = await applyTaskDecision(approval, state, worker, evaluate);
  assert.ok(!('error' in result), JSON.stringify(result));
  const extrusion = base.doc.nodes[1];
  assert.ok(extrusion.kind === 'extrude');
  const expected = { ...extrusion, height: named ? extrusion.height : heightMm };
  if (source === 'remembered') {
    assert.equal(extrusion.made?.command, 'cylinder');
    expected.made = { ...extrusion.made, values: { ...extrusion.made.values, h: heightMm } };
  }
  const { nodes } = result.doc.instances![0].doc;
  assert.deepEqual(nodes, [sketch, expected]);
  if (source === 'remembered') assert.equal(featureLabel(nodes[1], 1, nodes), 'Cylinder Ø8.46×6');
  if (named) {
    assert.deepEqual(result.doc.instances![0].doc.parameters, { Thickness: 6, Spare: 9 });
    assert.deepEqual(result.doc.parameters, { Thickness: 42 });
    assert.deepEqual(result.doc.proposals?.at(-1)?.ops, [{ tool: 'set_parameters', args: { part: 'p1', set: { Thickness: 6 } } }]);
    const configured = structuredClone(doc);
    configured.instances![0].doc.configurations = { Thin: { Thickness: 4 } };
    refuses(compileTaskPlan(configured, inspected.request), 'UNSUPPORTED_PROFILE');
    const shared = structuredClone(doc);
    Object.assign(shared.instances![0].doc.nodes[0], { radius: { parameter: 'Thickness' } });
    refuses(compileTaskPlan(shared, inspected.request), 'UNSUPPORTED_PROFILE');
  }
  assert.deepEqual(result.doc.instances![1], lid);
  refuses(await applyTaskDecision(approval, state, worker, alteredNativeRadius), 'TASK_DECISION_UNTRUSTED');
  assert.equal(digestOf(state.doc), plan.baselineDigest);

  const fixedWidth = height('fixed-width', 2 * radius);
  fixedWidth.check.query = { fn: 'bbox', axis: 'x' };
  const widthCheck = structuredClone(doc);
  widthCheck.instances![0].doc.requirements!.push(fixedWidth);
  refuses(compileTaskPlan(widthCheck, inspected.request), 'UNSUPPORTED_CHECK');

  for (const invalid of [
    { ...sketch, radius: { parameter: 'r' } },
    { ...sketch, center: [1e20, -7.13] },
    { ...sketch, construction: [] },
    { ...sketch, sideTags: { outer: ['e7', 'e8'] } },
  ]) {
    const changed = structuredClone(doc);
    changed.instances![0].doc.nodes[0] = invalid as typeof sketch;
    changed.instances![0].doc.parameters.r = radius;
    refuses(compileTaskPlan(changed, inspected.request), 'UNSUPPORTED_PROFILE');
  }
});

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


test('D646 checks the existing native bore, edits its diameter once and reopens the approved native document', async () => {
  const doc = assembly();
  delete doc.interfaces;
  const [base, lid] = doc.instances!;
  const diameter: Requirement = { ...height('bore', 6), source: 'Make the existing bore Ø6 mm through.',
    check: { query: { fn: 'hole_diameter', face: { feature: 'n2', role: 'side0' } }, op: '==', value: 6, tol: 0.001, unit: 'mm' } };
  base.doc = { ...withNode(rectanglePart(40, 30, 6), {
    kind: 'hole', parent: { node: 1, side: 'solid' }, center: [12, 9], radius: 2, face: 'n1.top',
  }), requirements: [diameter, height('fixed-height', 6)] };
  lid.doc = { ...rectanglePart(12, 8, 3), requirements: [height('lid-height', 3)] };
  const inspection = inspectLocalHeightPlan(doc, ['p1'], identity);
  assert.ok(!('error' in inspection), JSON.stringify(inspection));
  assert.deepEqual(inspection.issues, []);
  assert.deepEqual(inspection.targets, [{ id: 'p1', requirementId: 'bore', currentDiameterMm: 4, diameterMm: 6, toleranceMm: 0.001 }]);
  assert.deepEqual(inspection.plan.protectedOccurrences, ['p2']);
  const { plan, state, context } = setup(doc, { ...inspection.request, policyRevision });
  const bound = plan.tasks[0], worker = { ...context, worker: bound.holder };
  const pin = { taskId: bound.id, specRevision: plan.specRevision, inputDigest: bound.inputDigest };
  const submission = taskSubmissionForDimension(pin, bound.writes.field, 6);
  assert.deepEqual(submission, { ...pin, diameterMm: 6 });
  const refuseBeforeNative = async () => { throw new Error('Invalid diameter reached the evaluator'); };
  for (const invalid of [{ ...pin, heightMm: 6 }, { ...pin, diameterMm: 6, widthMm: 6 }]) {
    refuses(await buildTaskCandidate(plan, state, invalid as unknown as TaskSubmission, worker, refuseBeforeNative), 'TASK_SUBMISSION_MISMATCH');
  }
  for (const diameterMm of [4, 18, 20, NaN]) {
    refuses(await buildTaskCandidate(plan, state, { ...pin, diameterMm }, worker, refuseBeforeNative), 'TASK_VALUE');
  }
  refuses(await buildTaskCandidate(plan, state, { ...pin, diameterMm: 3 }, worker, refuseBeforeNative), 'TASK_REQUIRED_CHECK');

  const changedFace = (onRadius: number, mode: 'outer' | 'short') => async (model: StudioDoc) => {
    const result = await evaluate(model);
    const node = model.nodes[2];
    if (!result.ok || node?.kind !== 'hole' || node.radius !== onRadius || !model.requirements?.some(req => req.id === 'bore')) return result;
    const face = result.faceTable?.['n2.side0'];
    assert.ok(face?.kind === 'cylinder');
    return { ...result, faceTable: { ...result.faceTable, 'n2.side0': mode === 'outer' ? { ...face, outer: true }
      : { ...face, span: [0, 3] as [number, number] } } };
  };
  refuses(await buildTaskCandidate(plan, state, submission, worker, changedFace(2, 'outer')), 'TASK_HOLE_FACE');
  refuses(await buildTaskCandidate(plan, state, submission, worker, changedFace(3, 'short')), 'TASK_HOLE_FACE');
  const candidate = await buildTaskCandidate(plan, state, submission, worker, evaluate);
  assert.ok(!('error' in candidate), JSON.stringify(candidate));
  assert.equal(digestOf(state.doc), plan.baselineDigest);
  assert.deepEqual(candidate.scope, { occurrence: 'p1', feature: 'n2', field: 'diameter' });
  assert.deepEqual(candidate.gates, ['lease', 'validity', 'contract', 'assembly']);
  assert.deepEqual(candidate.checks.map(check => [check.id, check.status, check.measured]), [['bore', 'pass', 6], ['fixed-height', 'pass', 6]]);
  const decision = bindTaskDecision(candidate, true, userToken(at));
  assert.ok(!('error' in decision));
  const approved = await applyTaskDecision(decision, state, worker, evaluate);
  assert.ok(!('error' in approved), JSON.stringify(approved));
  const read = await readStudioFile(encodeStudioFile(approved.doc));
  assert.ok(!('error' in read), JSON.stringify(read));
  assert.equal(digestOf(read.doc), digestOf(approved.doc));
  assert.deepEqual(read.doc.instances![0].doc.nodes, base.doc.nodes.map(node => node.kind === 'hole' ? { ...node, radius: 3 } : node));
  assert.deepEqual(read.doc.instances![1], lid);

  const reopened = await evaluate(read.doc.instances![0].doc);
  assert.ok(reopened.ok);
  const [body] = reopened.bodies, bore = reopened.faceTable?.['n2.side0'];
  assert.ok(bore?.kind === 'cylinder' && !bore.outer && bore.span);
  assert.ok(Math.abs(2 * bore.radius - 6) < 1e-8);
  assert.deepEqual(bore.point.slice(0, 2), [12, 9]);
  assert.ok(Math.abs(bore.span[1] - bore.span[0] - 6) < 1e-8);
  const removed = Math.PI * 3 ** 2 * 6, solid = 40 * 30 * 6, expected = solid - removed;
  assert.ok(body.volume !== null && Math.abs(body.volume - expected) < 1e-8);
  const centroid = [(20 * solid - 12 * removed) / expected, (15 * solid - 9 * removed) / expected, 3];
  assert.ok(body.centroid?.every((value, index) => Math.abs(value - centroid[index]) < 1e-8));
});

test('D648 keeps the inch requirement while the native bore task consumes millimetres', async () => {
  const doc = assembly();
  delete doc.interfaces;
  const [base, lid] = doc.instances!;
  const bore: Requirement = { ...height('bore', 0.25), source: 'Make the existing bore 0.25 ± 0.001 in through.',
    check: { query: { fn: 'hole_diameter', face: { feature: 'n2', role: 'side0' } }, op: '==', value: 0.25, tol: 0.001, unit: 'in' } };
  base.doc.requirements = [bore];
  lid.doc.requirements = [];
  const inspection = inspectLocalHeightPlan(doc, ['p1'], identity);
  assert.ok(!('error' in inspection), JSON.stringify(inspection));
  assert.deepEqual(inspection.issues, []);
  const [target] = inspection.targets;
  assert.equal(target.currentDiameterMm, 4);
  assert.equal(target.diameterMm, 6.35);
  assert.ok(Math.abs(target.toleranceMm - 0.0254) < 1e-15);
  const { plan, state, context } = setup(doc, { ...inspection.request, policyRevision });
  const [bound] = plan.tasks, worker = { ...context, worker: bound.holder };
  const pin = { taskId: bound.id, specRevision: plan.specRevision, inputDigest: bound.inputDigest };
  const refuseBeforeNative = async () => { throw new Error('Invalid diameter reached the evaluator'); };
  for (const diameterMm of [0.25, 3.175, 6.3245, 6.3755])
    refuses(await buildTaskCandidate(plan, state, { ...pin, diameterMm }, worker, refuseBeforeNative), 'TASK_REQUIRED_CHECK');
  const current = taskTarget(doc, bound);
  assert.ok(!('error' in current));
  for (const diameterMm of [6.3246, 6.3754]) {
    const edit = taskDimensionEdit(doc, bound, current, diameterMm);
    assert.ok(!('error' in edit), JSON.stringify(edit));
    assert.deepEqual(edit.op, { tool: 'edit_feature', args: { index: 2, values: { dia: diameterMm } } });
  }

  const baseline = await requirementEvidenceOf(doc, 'p1', evaluate);
  assert.ok(!('error' in baseline));
  const [row] = baseline.evidence;
  assert.deepEqual(row.requirement, bore);
  assert.deepEqual([row.result.verdict, row.result.number, row.result.value],
    ['fail', 0.1575, { measured: 0.1575, delta: -0.0925, entities: ['n2.side0'] }]);
  const candidate = await buildTaskCandidate(plan, state, { ...pin, diameterMm: 6.35 }, worker, evaluate);
  assert.ok(!('error' in candidate), JSON.stringify(candidate));
  assert.deepEqual(candidate.checks.map(c => [c.id, c.status, c.expected, c.measured]), [['bore', 'pass', '0.25 ± 0.001 in', 0.25]]);
});
