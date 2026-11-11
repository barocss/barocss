import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, withNode, type StudioDoc } from '../src/engine/doc';
import type { Requirement } from '../src/engine/schema/spec';
import { decideEcr, openEcr, userToken } from '../src/team/ecr';
import { readInterfaces, type HolePattern } from '../src/team/interfaces';
import { compileTaskPlan, isTaskPlan, taskPlanImpact, type TaskPlanRequest } from '../src/team/taskPlan';

const identity = { projectId: 'fixture-project', documentId: 'fixture-assembly' };
const policyRevision = 'policy-1';
const sha256 = /^[a-f0-9]{64}$/;
const stated = <T>(value: T, source: string) => ({ value, source, basis: 'stated' as const, said: 'verified' as const });
const brief = (): NonNullable<StudioDoc['brief']> => ({
  version: 1,
  purpose: stated('housing', 'Make a housing.'),
  process: stated('cnc-milling' as const, 'Mill the plates.'),
  material: stated('al6061', 'Use 6061 aluminum.'),
});
const heightCheck = (id: string, height: number): Requirement => ({
  id, source: `Make ${id} ${height} mm high.`, basis: 'stated', said: 'verified', hard: true,
  check: { query: { fn: 'bbox', axis: 'z' }, op: '==', value: height, tol: 0.01, unit: 'mm' },
});

function plate(id: string, height: number, target: number): StudioDoc {
  const sketch = withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] });
  const solid = withNode(sketch, { kind: 'extrude', sketch: 0, height });
  return { ...solid, brief: brief(), requirements: [heightCheck(id, target)] };
}

function assembly(): StudioDoc {
  return {
    ...emptyDoc(), brief: brief(),
    instances: [
      { id: 'p1', name: 'Base', position: [0, 0, 0], rotation: [0, 0, 0], doc: plate('base-height', 6, 8) },
      { id: 'p2', name: 'Lid', position: [0, 0, 30], rotation: [0, 0, 0], doc: plate('lid-height', 10, 12) },
    ],
  };
}

function request() {
  return {
    identity: { ...identity }, policyRevision, maxTasks: 2, throughSequence: 8,
    tasks: [
      { id: 'base', holder: 'base-worker', occurrence: 'p1', feature: 'n1', capability: 'extrusion-height' as const, units: 'mm' as const, frame: 'part-local-z' as const, dependsOn: [] as string[] },
      { id: 'lid', holder: 'lid-worker', occurrence: 'p2', feature: 'n1', capability: 'extrusion-height' as const, units: 'mm' as const, frame: 'part-local-z' as const, dependsOn: [] as string[] },
    ],
  };
}

function admitted(doc: StudioDoc, input = request()) {
  const plan = compileTaskPlan(doc, input);
  if ('error' in plan) assert.fail(`${plan.error.code}: ${plan.error.message}`);
  assert.ok(isTaskPlan(plan));
  return plan;
}

function replacePart(doc: StudioDoc, id: string, update: (part: StudioDoc) => StudioDoc): StudioDoc {
  return { ...doc, instances: doc.instances!.map(part => part.id === id ? { ...part, doc: update(part.doc) } : part) };
}

function states(plan: ReturnType<typeof admitted>, doc: StudioDoc, target = identity, policy = policyRevision) {
  return Object.fromEntries(taskPlanImpact(plan, doc, target, policy).map(row => [row.id, row.state]));
}

function refuses(doc: StudioDoc, input: TaskPlanRequest, code: string) {
  const plan = compileTaskPlan(doc, input);
  assert.ok('error' in plan, `expected ${code}`);
  assert.equal(plan.error.code, code, plan.error.message);
  assert.equal(isTaskPlan(plan), false);
}

test('D584 admitted tasks pin detached, immutable requirement evidence', () => {
  const doc = assembly(), input = request();
  const assumed: Requirement = {
    ...heightCheck('prefer-low', 9), hard: false, basis: 'assumed', said: undefined,
    assume: 'Keep the housing compact.', check: { ...heightCheck('prefer-low', 9).check, op: '<=' },
  };
  doc.instances![0].doc.requirements!.push(assumed);
  const plan = admitted(doc, input);
  assert.match(plan.specRevision, sha256);
  assert.match(plan.baselineDigest, sha256);
  assert.notEqual(plan.baselineDigest, plan.specRevision);
  assert.deepEqual(admitted(structuredClone(doc), structuredClone(input)), plan);
  for (const task of plan.tasks) assert.match(task.inputDigest, sha256);
  assert.notEqual(plan.tasks[0].inputDigest, plan.tasks[1].inputDigest);
  assert.deepEqual(plan.tasks[0].checks, [heightCheck('base-height', 8), assumed]);
  assert.deepEqual(plan.tasks[1].checks, [heightCheck('lid-height', 12)]);
  for (const value of [plan, plan.identity, plan.tasks, plan.tasks[0], plan.tasks[0].dependsOn, plan.tasks[0].checks,
    plan.tasks[0].checks[0], plan.tasks[0].checks[0].check, plan.tasks[0].checks[0].check.query, plan.tasks[0].blockers]) {
    assert.ok(Object.isFrozen(value));
  }
  const originalRevision = plan.specRevision;
  input.identity.documentId = 'other';
  doc.instances![0].doc.requirements![0].check.value = 9;
  assert.deepEqual(plan.identity, identity);
  assert.equal(plan.tasks[0].checks[0].check.value, 8);
  assert.equal(plan.specRevision, originalRevision);
  assert.notEqual(admitted(doc, request()).specRevision, originalRevision);
  assert.equal(isTaskPlan(structuredClone(plan)), false);
  assert.deepEqual(states(structuredClone(plan), doc), { base: 'blocked', lid: 'blocked' });
});

test('D584 task admission refuses unit, frame, target and ownership violations', () => {
  const doc = assembly();
  const invalid: [Record<string, unknown>, string][] = [
    [{ units: 'in' }, 'WRONG_UNIT'],
    [{ frame: 'part-local-x' }, 'WRONG_FRAME'],
    [{ frame: 'assembly-z' }, 'WRONG_FRAME'],
    [{ capability: 'hole-radius' }, 'UNSUPPORTED_CAPABILITY'],
    [{ feature: 'n99' }, 'WRONG_TARGET'],
    [{ feature: '1' }, 'WRONG_TARGET'],
    [{ holder: '' }, 'BAD_TASK'],
    [{ holder: 'base-worker', checks: [] }, 'BAD_TASK'],
    [{ id: 'lid' }, 'DUPLICATE_TASK'],
    [{ occurrence: 'p2' }, 'WRITE_CONFLICT'],
    [{ dependsOn: ['missing'] }, 'MISSING_DEPENDENCY'],
    [{ dependsOn: ['base'] }, 'DEPENDENCY_CYCLE'],
  ];
  for (const [change, code] of invalid) {
    const input = request();
    Object.assign(input.tasks[0], change);
    refuses(doc, input, code);
  }
  const cycle = request();
  cycle.tasks[0].dependsOn.push('lid');
  cycle.tasks[1].dependsOn.push('base');
  refuses(doc, cycle, 'DEPENDENCY_CYCLE');
  const conflicting = request();
  conflicting.tasks[1].occurrence = 'p1';
  conflicting.tasks[1].dependsOn.push('base');
  refuses(doc, conflicting, 'WRITE_CONFLICT');
  const wrongOccurrence = request();
  wrongOccurrence.tasks[0].occurrence = 'p99';
  const withoutBase = replacePart(doc, 'p1', part => ({ ...part, requirements: [] }));
  refuses(withoutBase, wrongOccurrence, 'WRONG_TARGET');
  refuses(doc, { ...request(), maxTasks: 1 }, 'TASK_BUDGET');
  refuses(doc, { ...request(), throughSequence: Infinity }, 'TASK_BUDGET');
  refuses(doc, { ...request(), tasks: request().tasks.slice(1) }, 'UNCOVERED_REQUIREMENT');
  refuses({ ...doc, requirements: [heightCheck('assembly-height', 50)] }, request(), 'UNCOVERED_REQUIREMENT');
});

test('D584 a hard unknown blocks its task and dependents even with a source quote', () => {
  const doc = assembly(), input = request();
  input.tasks[1].dependsOn.push('base');
  const original = admitted(doc, input);
  const unknown = replacePart(doc, 'p1', part => ({
    ...part, requirements: [{ ...part.requirements![0], basis: 'ambiguous', assume: 'Height needs a user decision.' }],
  }));
  const unresolved = admitted(unknown, input);
  assert.deepEqual(unresolved.tasks[0].blockers, ['requirement:base-height:ambiguous']);
  assert.deepEqual(states(unresolved, unknown), { base: 'blocked', lid: 'blocked' });
  assert.deepEqual(states(original, unknown), { base: 'blocked', lid: 'blocked' });
  assert.deepEqual(states(admitted(unknown), unknown), { base: 'blocked', lid: 'current' });
  const wrongUnit = replacePart(doc, 'p1', part => ({
    ...part, requirements: [{ ...part.requirements![0], check: { ...part.requirements![0].check, unit: 'in' } }],
  }));
  refuses(wrongUnit, request(), 'UNSUPPORTED_CHECK');
  const missing = replacePart(doc, 'p1', part => ({ ...part, requirements: [] }));
  refuses(missing, request(), 'MISSING_REQUIRED_CHECK');
});

test('D584 a local edit invalidates its readers and preserves disjoint tasks', () => {
  const doc = assembly(), input = request();
  const disjoint = admitted(doc, input);
  input.tasks[1].dependsOn.push('base');
  const dependent = admitted(doc, input);
  const edited = replacePart(doc, 'p1', part => ({
    ...part, nodes: part.nodes.map(node => node.kind === 'extrude' ? { ...node, height: 7 } : node),
  }));
  assert.deepEqual(states(disjoint, doc), { base: 'current', lid: 'current' });
  assert.deepEqual(states(disjoint, edited), { base: 'stale', lid: 'current' });
  assert.deepEqual(states(dependent, edited), { base: 'stale', lid: 'stale' });
});

test('D584 only an approved shared hole change invalidates related task inputs', () => {
  const doc = assembly();
  doc.interfaces = {
    ...readInterfaces(undefined),
    holePatterns: [{ id: 'H1', positions: [[10, 10, 0]], axis: [0, 0, 1], diameter: 4, parts: ['p1', 'p2'] }],
  };
  const plan = admitted(doc);
  const changed = { ...doc.interfaces, holePatterns: [{ ...doc.interfaces.holePatterns[0], diameter: 5 }] };
  const opened = openEcr(doc, 'designer', changed);
  assert.deepEqual(opened.ecr.impact.parts, ['p1', 'p2']);
  assert.deepEqual(states(plan, opened.doc), { base: 'current', lid: 'current' });
  const approval = userToken('2026-11-10T00:00:00Z');
  const rejected = decideEcr(opened.doc, opened.ecr.id, false, approval, new Map());
  assert.deepEqual(states(plan, rejected.doc), { base: 'current', lid: 'current' });
  const approved = decideEcr(opened.doc, opened.ecr.id, true, approval, new Map());
  assert.deepEqual(states(plan, approved.doc), { base: 'stale', lid: 'stale' });
});

test('D584 appearance alone preserves height inputs, and identity or policy cannot be reused', () => {
  const doc = assembly(), plan = admitted(doc);
  const appearance = replacePart(doc, 'p1', part => ({
    ...part, bodies: { b1: { color: '#42556a', name: 'Painted base' } },
  }));
  appearance.brief = { ...appearance.brief!, notes: stated('Blue finish', 'Paint it blue.') };
  assert.deepEqual(states(plan, appearance), { base: 'current', lid: 'current' });
  for (const target of [{ ...identity, documentId: 'other' }, { ...identity, projectId: 'other' }]) {
    assert.deepEqual(states(plan, doc, target), { base: 'blocked', lid: 'blocked' });
  }
  assert.deepEqual(states(plan, doc, identity, 'policy-2'), { base: 'blocked', lid: 'blocked' });
});

test('D584 refuses interface geometry the native gate cannot verify', () => {
  const doc = assembly();
  const pattern: HolePattern = { id: 'H1', axis: [0, 0, 1], diameter: 4, positions: [[5, 5, 0]], parts: ['p1', 'p2'] };
  const invalid: HolePattern[] = [
    { ...pattern, axis: [0, 0, 0] }, { ...pattern, positions: [] },
    { ...pattern, parts: ['p1', 'absent'] }, { ...pattern, diameter: -4 },
  ];
  for (const holePattern of invalid) {
    doc.interfaces = { ...readInterfaces(undefined), holePatterns: [holePattern] };
    refuses(doc, request(), 'BAD_INTERFACE');
  }
  doc.interfaces = { ...readInterfaces(undefined), keepouts: ['exclusion-1'] };
  refuses(doc, request(), 'UNSUPPORTED_INTERFACE');
});


test('D646 and D648 admit a hard diameter equality in mm or in for the stable through-hole wall', () => {
  const boreCheck: Requirement = {
    ...heightCheck('bore', 6),
    check: { op: '==', query: { fn: 'hole_diameter', face: { feature: 'n17', role: 'side0', on: 'b17' } }, value: 6, tol: 0.01, unit: 'mm' },
  };
  const doc = replacePart(replacePart(assembly(), 'p1', part => ({
    ...withNode(part, { kind: 'hole', id: 'n17', parent: { node: 1, side: 'solid' }, center: [12, 9], radius: 2, face: 'n1.top' }),
    requirements: [boreCheck, heightCheck('fixed-height', 6)],
  })), 'p2', part => ({ ...part, requirements: [] }));
  const input: TaskPlanRequest = { ...request(), maxTasks: 1, tasks: [{ ...request().tasks[0], feature: 'n17', capability: 'hole-diameter' }] };
  const plan = compileTaskPlan(doc, input);
  assert.ok(!('error' in plan), JSON.stringify(plan));
  assert.deepEqual(plan.tasks[0].writes, { occurrence: 'p1', feature: 'n17', field: 'diameter' });
  assert.equal(plan.tasks[0].reads.holeFace, 'n17.side0');
  assert.equal(plan.tasks[0].frame, 'part-local-z');
  const changeRequirement = (requirement: Requirement) => replacePart(doc, 'p1', part => ({ ...part, requirements: [requirement] }));
  const { check } = boreCheck;
  for (const face of ['n1.side0', 'n17.top', { feature: 2, role: 'side0' }, { feature: 'n17', role: 'side' },
    { feature: 'n17', role: 'side0', on: 'b1' }, { feature: 'n17', role: 'side0', all: true }]) {
    refuses(changeRequirement({ ...boreCheck, check: { ...check, query: { fn: 'hole_diameter', face } } }), input, 'UNSUPPORTED_CHECK');
  }
  const named = compileTaskPlan(changeRequirement({ ...boreCheck, check: { ...check, query: { fn: 'hole_diameter', face: 'n17.side0' } } }), input);
  assert.ok(!('error' in named));
  const inchBore: Requirement = { ...boreCheck, source: 'Make the bore 0.25 ± 0.001 in.',
    check: { ...check, unit: 'in', value: 0.25, tol: 0.001 } };
  const inchPlan = compileTaskPlan(changeRequirement(inchBore), input);
  assert.ok(!('error' in inchPlan), JSON.stringify(inchPlan));
  assert.equal(inchPlan.tasks[0].units, 'mm');
  assert.deepEqual(inchPlan.tasks[0].checks, [inchBore]);
  for (const unit of [undefined, 'inch', 'MM', 'mm/in'])
    refuses(changeRequirement({ ...boreCheck, check: { ...check, unit } }), input, 'UNSUPPORTED_CHECK');
  refuses(changeRequirement({ ...boreCheck, check: { ...check, query: { fn: 'radius', face: 'n17.side0' }, unit: 'in' } }), input, 'UNSUPPORTED_CHECK');
  refuses(changeRequirement({ ...boreCheck, check: { ...check, op: '>=' } }), input, 'UNSUPPORTED_CHECK');
  refuses(changeRequirement({ ...boreCheck, check: { ...check, tol: -1 } }), input, 'BAD_REQUIREMENT');
  for (const invalid of [{ value: 1e308 }, { tol: 1e308 }, { value: 5e306, tol: 5e306 }])
    refuses(changeRequirement({ ...inchBore, check: { ...inchBore.check, ...invalid } }), input, 'BAD_REQUIREMENT');
  refuses(changeRequirement({ ...inchBore, check: { ...inchBore.check, value: 0 } }), input, 'UNSUPPORTED_CHECK');
  refuses(changeRequirement({ ...boreCheck, hard: false }), input, 'MISSING_REQUIRED_CHECK');
  refuses({ ...doc, interfaces: { ...readInterfaces(undefined), holePatterns: [
    { id: 'H1', axis: [0, 0, 1], diameter: 4, positions: [[12, 9, 0]], parts: ['p1', 'p2'] },
  ] } }, input, 'SHARED_HOLE_PATTERN');
  const changeHole = (edit: object) => replacePart(doc, 'p1', part => ({
    ...part, nodes: part.nodes.map(node => node.kind === 'hole' ? { ...node, ...edit } : node),
  }));
  for (const edit of [{ depth: 3 }, { pattern: { count: 2, step: [7, 0] } }, { countersink: 10 }, { thread: 'M6×1' },
    { axis: 'x' }, { face: 'n1.side0' }, { radius: { parameter: 'r' } }]) {
    refuses(changeHole(edit), input, 'UNSUPPORTED_PROFILE');
  }
});
