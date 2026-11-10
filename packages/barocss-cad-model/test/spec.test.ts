import { runCheck, validateSuite } from '../src/chat/spec';
import { checkKeepouts } from '../src/chat/references';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart, type BodyResult } from '../src/engine/evaluate';
import { rectanglePart, withNode, type StudioDoc } from '../src/engine/doc';
import type { Predicate, Query, Requirement } from '../src/engine/schema/spec';
import { runTool, type ChatState, type Evaluate } from '../src/chat/tools';
import { readStudioDoc } from '../src/engine/migrate';

// Requirements as declarative checks (A3.1): kept in the document, run by check_spec.
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function stateOf(doc: StudioDoc): Promise<ChatState> { const r = await evaluate(doc); assert.ok(r.ok); return { doc, bodies: r.bodies }; }
const parse = (content: string) => JSON.parse(content) as Record<string, any>;
const BRIEF = [
  { id: 'R1', source: 'a 40 mm long plate', hard: true, basis: 'stated', check: { op: '==', query: { fn: 'bbox', axis: 'x' }, value: 40, tol: 0.1, unit: 'mm' } },
  { id: 'R2', source: 'no thicker than 6 mm', hard: true, basis: 'stated', check: { op: '<=', query: { fn: 'bbox', axis: 'z' }, value: 6, unit: 'mm' } },
  { id: 'R3', source: 'an 8 mm hole', hard: true, basis: 'stated', check: { op: '==', query: { fn: 'hole_diameter', face: { feature: 2, role: 'side0' } }, value: 8, tol: 0.01, unit: 'mm' } },
  { id: 'R4', source: 'under 20 g', hard: false, basis: 'stated', check: { op: '<=', query: { fn: 'mass' }, value: 20, unit: 'g' } },
  { id: 'R5', source: 'faces 8 apart', hard: false, basis: 'assumed', check: { op: '==', query: { fn: 'distance_between', a: { feature: 1, role: 'top' }, b: { normal: [0, 0, -1] } }, value: 8, tol: 0.01, unit: 'mm' } },
  { id: 'R6', source: 'walls at least 2 mm', hard: true, check: { op: '>=', query: { fn: 'min_wall' }, value: 2, unit: 'mm' } },
  { id: 'R7', source: 'one piece', hard: true, check: { op: '==', query: { fn: 'count_solids' }, value: 1 } },
];

const SUB_DISPLAY = 1 / 4096;
const WIDTH = 40 + SUB_DISPLAY;
const WIDTH_CAP = 40 + SUB_DISPLAY / 2;

const keepoutQuery = { fn: 'keepout', keepout: 'K1' } as const;
function keepoutPart(curved: boolean): StudioDoc {
  return {
    ...rectanglePart(10, 10, 10),
    references: { version: 1, references: [], datums: [], keepouts: [{
      id: 'K1', name: 'Post', clearance: 5,
      frame: { origin: [20, curved ? 5 : 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] },
      shape: curved ? { kind: 'cylinder', radius: 5, height: 10 } : { kind: 'box', size: [5, 10, 10] },
    }] },
  };
}

test('D582: a controlled keep-out interval classifies containment, separation and interior overlap', async () => {
  const state = await stateOf(keepoutPart(false)), { doc } = state;
  const body = state.bodies[0], [face, ...faces] = body.mesh.faces;
  // Preserve the flat mesh positions and inject an already-measured chord depth on one face.
  const withChord = (chordDepth: number): BodyResult[] => [{
    ...body, mesh: { ...body.mesh, faces: [{ ...face, kind: 'curved', freeform: [face.name], chordDepth }, ...faces] },
  }];
  const bodies = withChord(1);
  const [read] = await checkKeepouts(doc, bodies, evaluate);
  assert.deepEqual([read.clearance, read.chordMM], [10, 1]);

  // The measured interval is [9, 11]. Each expectation is literal interval arithmetic.
  const cases: [Omit<Predicate, 'query'>, 'pass' | 'fail' | 'unknown'][] = [
    [{ op: '==', value: 10, tol: 0.25 }, 'unknown'],
    [{ op: '==', value: 10.5, tol: 0.125 }, 'unknown'],
    [{ op: '==', value: 9.5, tol: 0 }, 'unknown'],
    [{ op: '==', value: 10, tol: 1 }, 'pass'],
    [{ op: '==', value: 12, tol: 1 - 12e-9 }, 'unknown'],
    // Forming value + tolerance first rounds up to 9, but meets' subtraction rejects 9.
    [{ op: '==', value: 9 - 9e-9 }, 'fail'],
    [{ op: '==', value: 10, tol: -1 }, 'fail'],
    [{ op: '==', value: 12, tol: 0.125 }, 'fail'],
    [{ op: '==', value: 8, tol: 0.125 }, 'fail'],
    [{ op: 'between', min: 9.75, max: 10.25 }, 'unknown'],
    [{ op: 'between', min: 10.375, max: 10.625 }, 'unknown'],
    [{ op: 'between', min: 9.5, max: 9.5 }, 'unknown'],
    // The existing epsilon leaves exactly one allowed value in this reversed range.
    [{ op: 'between', min: 9.5 + 1e-9, max: 9.5 - 1e-9 }, 'unknown'],
    [{ op: 'between', min: 10.5, max: 9.5 }, 'fail'],
    [{ op: 'between', min: 8, max: 12 }, 'pass'],
    [{ op: 'between', min: 8, max: 9 }, 'unknown'],
    [{ op: 'between', min: 11 + 1e-9, max: 12 }, 'unknown'],
    [{ op: 'between', min: 8, max: 8.5 }, 'fail'],
    [{ op: 'between', min: 12, max: 13 }, 'fail'],
    [{ op: '<=', value: 11 }, 'pass'],
    [{ op: '<=', value: 10 }, 'unknown'],
    [{ op: '<=', value: 8 }, 'fail'],
    [{ op: '>=', value: 9 }, 'pass'],
    [{ op: '>=', value: 10 }, 'unknown'],
    [{ op: '>=', value: 12 }, 'fail'],
  ];
  const differences = [];
  for (const [predicate, expected] of cases) {
    const result = await runCheck(doc, bodies, evaluate, { ...predicate, query: keepoutQuery });
    if (result.status !== expected) differences.push({ predicate, expected, actual: result.status });
  }
  assert.deepEqual(differences, []);

  const exact: Predicate = { op: '==', query: keepoutQuery, value: 10 };
  const [flat] = await checkKeepouts(doc, state.bodies, evaluate);
  assert.equal(flat.chordMM, 0);
  assert.equal((await runCheck(doc, state.bodies, evaluate, exact)).status, 'pass');
  const unbounded = await runCheck(doc, withChord(Infinity), evaluate, exact);
  assert.equal(unbounded.status, 'unknown');
  assert.match(unbounded.why ?? '', /unbounded/);
  const missing = await runCheck(doc, bodies, evaluate, { ...exact, query: { ...keepoutQuery, keepout: 'K9' } });
  assert.equal(missing.status, 'unknown');
  assert.match(missing.why ?? '', /no keep-out K9/);

  const references = doc.references!, [keepout] = references.keepouts;
  const overlapping: StudioDoc = { ...doc, references: { ...references, keepouts: [{
    ...keepout, frame: { ...keepout.frame, origin: [5, 5, 5] }, shape: { kind: 'box', size: [10, 10, 10] },
  }] } };
  const overlap = await runCheck(overlapping, bodies, evaluate, { ...exact, value: -125 });
  assert.equal(overlap.status, 'pass');
  assert.equal(overlap.measured, -125);
  assert.match(overlap.hint ?? '', /exact/);
});

test('D582: native cylinder bounds reach the grouped requirement report and policy', async () => {
  const original = await stateOf(keepoutPart(true));
  const [read] = await checkKeepouts(original.doc, original.bodies, evaluate);
  assert.ok(read.clearance !== null && Math.abs(read.clearance - 5) < 1e-10, JSON.stringify(read));
  assert.ok(Math.abs(read.chordMM - 5 * (1 - Math.cos(Math.PI / 32))) < 1e-4, JSON.stringify(read));
  const requirements: Requirement[] = [
    { id: 'EQUAL', source: 'Clearance 5 ± 0.005 mm', hard: true, check: { op: '==', query: keepoutQuery, value: 5, tol: 0.005 } },
    { id: 'RANGE', source: 'Clearance in the offset band', hard: true, check: { op: 'between', query: keepoutQuery, min: 5.01, max: 5.015 } },
    { id: 'FLOOR', source: 'Clearance above 4.9 mm', hard: true, check: { op: '>=', query: keepoutQuery, value: 4.9 } },
  ];
  const setup = await runTool(original, 'requirements', { action: 'set', requirements }, evaluate);
  assert.equal(setup.isError, false, setup.content);
  const before = JSON.stringify(setup.state.doc);
  const checked = await runTool(setup.state, 'requirements', { action: 'check' }, evaluate);
  assert.equal(checked.isError, false, checked.content);
  assert.equal(checked.changed, false);
  assert.equal(checked.state.doc, setup.state.doc);
  assert.equal(checked.state.bodies, setup.state.bodies);
  assert.equal(JSON.stringify(checked.state.doc), before);
  const report = parse(checked.content);
  assert.deepEqual(report.summary, { pass: 1, fail: 0, unknown: 2, hard_failing: 0 }, checked.content);
  assert.deepEqual(report.unknowns.map((row: { req_id: string }) => row.req_id), ['EQUAL', 'RANGE']);
  for (const row of report.unknowns) assert.match(row.why, /chord tolerance \(0\.0241 mm\)/);
  assert.deepEqual(checked.state.policy?.passedHard, ['FLOOR']);
  assert.equal(checked.state.policy?.best?.hardFulfilled, false);
});

test('D578: native bbox verdicts agree at the origin and after translations on all axes', async () => {
  const dimensions = [WIDTH, 20 + SUB_DISPLAY, 8 + SUB_DISPLAY] as const;
  const doc = rectanglePart(...dimensions);
  for (const shift of [0, 2 * SUB_DISPLAY, -2 * SUB_DISPLAY]) {
    const placed = shift === 0 ? doc : withNode(doc, {
      kind: 'translate', parent: { node: 1, side: 'solid' }, offset: [shift, shift, shift],
    });
    const state = await stateOf(placed);
    for (const [i, axis] of (['x', 'y', 'z'] as const).entries()) {
      const length = dimensions[i];
      const below = length - SUB_DISPLAY / 2;
      const above = length + SUB_DISPLAY / 2;
      const query: Query = { fn: 'bbox', axis };
      const cases: [Predicate, 'pass' | 'fail'][] = [
        [{ query, op: '<=', value: below }, 'fail'],
        [{ query, op: '<=', value: below, tol: SUB_DISPLAY }, 'pass'],
        [{ query, op: '>=', value: above }, 'fail'],
        [{ query, op: '>=', value: above, tol: SUB_DISPLAY }, 'pass'],
        [{ query, op: '==', value: length, tol: 1e-6 }, 'pass'],
        [{ query, op: '==', value: below, tol: 1e-6 }, 'fail'],
        [{ query, op: 'between', min: below, max: above }, 'pass'],
        [{ query, op: 'between', min: below - SUB_DISPLAY, max: below }, 'fail'],
      ];
      for (const [predicate, status] of cases) {
        const result = await runCheck(placed, state.bodies, evaluate, predicate);
        assert.equal(result.status, status, JSON.stringify({ shift, predicate, result }));
      }
    }
    const summary = await runTool(state, 'get_part_summary', { response_format: 'concise' }, evaluate);
    assert.deepEqual(parse(summary.content).facts.bbox, {
      min: [0, 0, 0], max: shift > 0 ? [40.001, 20.001, 8.001] : [40, 20, 8],
    });
  }
});

test('D578: injected bounds preserve zero and reject nonfinite measurements', async () => {
  const { doc, bodies: [body] } = await stateOf(rectanglePart(40, 20, 8));
  const withBounds = (maxX: number): BodyResult => ({
    ...body, mesh: { ...body.mesh, bounds: { min: [5, -2, 0], max: [maxX, -2, 8] } },
  });
  const width: Predicate = { op: '==', query: { fn: 'bbox', axis: 'x' }, value: SUB_DISPLAY, tol: 1e-6 };
  const height: Predicate = { op: '==', query: { fn: 'bbox', axis: 'y' }, value: 0 };
  const thin = withBounds(5 + SUB_DISPLAY);
  assert.equal((await runCheck(doc, [thin], evaluate, width)).status, 'pass');
  const zero = await runCheck(doc, [thin], evaluate, height);
  assert.deepEqual([zero.status, zero.measured], ['pass', 0]);

  for (const bad of [NaN, Infinity, -Infinity]) {
    const invalid = { ...withBounds(bad), key: 'invalid' };
    const whole = await runCheck(doc, [thin, invalid], evaluate, width);
    assert.equal(whole.status, 'unknown', String(bad));
    assert.ok(whole.why, String(bad));
    const filtered = await runCheck(doc, [thin, invalid], evaluate, {
      ...width, query: { fn: 'bbox', axis: 'x', body: thin.key },
    });
    assert.equal(filtered.status, 'pass', String(bad));
  }
});

test('D578: raw volume and material mass preserve body scope and compact facts', async () => {
  const plate = rectanglePart(WIDTH, 20, 8);
  const sketch = withNode(plate, { kind: 'sketch', profile: 'rectangle', min: [50, 0], max: [60, 5] });
  const twoSolids = withNode(sketch, { kind: 'extrude', sketch: 2, height: 2 });
  const doc = { ...twoSolids, bodies: { b1: { material: 'steel' }, b3: { material: 'al6061' } } };
  const state = await stateOf(doc);
  assert.deepEqual(state.bodies.map(b => b.key).sort(), ['b1', 'b3']);

  // Box volume is width × depth × height. Convert mm³ to cm³ before applying each density.
  const plateVolume = WIDTH * 20 * 8;
  const blockVolume = 10 * 5 * 2;
  const steelMass = plateVolume / 1000 * 7.85;
  const aluminiumMass = blockVolume / 1000 * 2.7;
  const cases: [Query, number][] = [
    [{ fn: 'volume', body: 'b1' }, plateVolume],
    [{ fn: 'volume' }, plateVolume + blockVolume],
    [{ fn: 'mass', body: 'b1' }, steelMass],
    [{ fn: 'mass' }, steelMass + aluminiumMass],
  ];
  for (const [query, raw] of cases) {
    for (const [offset, status] of [[-0.00002, 'fail'], [0.00002, 'pass']] as const) {
      const result = await runCheck(doc, state.bodies, evaluate, { query, op: '<=', value: raw + offset });
      assert.equal(result.status, status, JSON.stringify({ query, offset, result }));
    }
  }

  const summary = await runTool(state, 'get_part_summary', { response_format: 'concise' }, evaluate);
  const { facts } = parse(summary.content);
  assert.deepEqual(Object.keys(facts).sort(), [
    'bbox', 'built', 'centroid', 'edges', 'faces', 'mass', 'mass_assumed', 'materials', 'solids', 'vertices', 'volume',
  ]);
  assert.deepEqual([facts.volume, facts.mass, facts.mass_assumed], [6500.039, 50.51, false]);

  const assumedDoc = { ...doc, bodies: { b1: doc.bodies.b1 } };
  const mass: Predicate = { query: { fn: 'mass' }, op: '>=', value: 0 };
  const assumed = await runCheck(assumedDoc, state.bodies, evaluate, mass);
  assert.equal(assumed.status, 'unknown');
  assert.match(assumed.why ?? '', /material of b3 is not set/);
  const filtered = await runCheck(assumedDoc, state.bodies, evaluate, {
    ...mass, query: { fn: 'mass', body: 'b1' }, value: steelMass - 0.00002,
  });
  assert.equal(filtered.status, 'pass');

  for (const volume of [NaN, Infinity, -Infinity, undefined]) {
    const poisoned = state.bodies.map(b => b.key === 'b3' ? { ...b, volume: volume as number } : b);
    for (const fn of ['volume', 'mass'] as const) {
      const unknown = await runCheck(doc, poisoned, evaluate, { op: '>=', query: { fn }, value: 0 });
      assert.equal(unknown.status, 'unknown', `${fn}: ${volume}`);
      assert.ok(unknown.why, `${fn}: ${volume}`);
    }
  }

  const pending = state.bodies.map(b => b.key === 'b3' ? { ...b, volume: null, mass: null, massRef: 1 } : b);
  const noVolume = state.bodies.map(b => b.key === 'b3' ? { ...b, volume: null, mass: null } : b);
  for (const [fn, raw] of [['volume', plateVolume], ['mass', steelMass]] as const) {
    const exact: Predicate = { op: '==', query: { fn }, value: raw, tol: 1e-6 };
    const unavailable = await runCheck(doc, pending, evaluate, exact);
    assert.equal(unavailable.status, 'unknown', fn);
    assert.ok(unavailable.why, fn);
    assert.equal((await runCheck(doc, pending, evaluate, { ...exact, query: { fn, body: 'b1' } })).status, 'pass', fn);
    assert.equal((await runCheck(doc, noVolume, evaluate, { ...exact, query: { fn, body: 'b3' }, value: 0 })).status, 'pass', fn);
  }
});

test('D578: the chat hard gate rejects a sub-display resize and honors because', async () => {
  const state = await stateOf(rectanglePart(40, 20, 8));
  const requirements = [{
    id: 'WIDTH', source: 'limit the width', hard: true,
    check: { op: '<=', query: { fn: 'bbox', axis: 'x' }, value: WIDTH_CAP, unit: 'mm' },
  }];
  const setup = await runTool(state, 'set_requirements', { requirements }, evaluate);
  assert.equal(setup.isError, false, setup.content);
  const checked = await runTool(setup.state, 'check_spec', {}, evaluate);
  assert.deepEqual(parse(checked.content).summary, { pass: 1, fail: 0, unknown: 0, hard_failing: 0 });
  assert.deepEqual(checked.state.policy?.passedHard, ['WIDTH']);

  const scale = { command: 'scale', bodies: ['b1'], values: { factor: WIDTH / 40, px: 0, py: 0, pz: 0 } };
  const refused = await runTool(checked.state, 'run_command', scale, evaluate);
  assert.equal(refused.isError, true, refused.content);
  assert.equal(refused.changed, false);
  assert.equal(refused.state.doc, checked.state.doc);
  assert.equal(refused.state.bodies, checked.state.bodies);
  assert.match(parse(refused.content).error, /breaks hard requirement that passed: WIDTH/);

  const allowed = await runTool(checked.state, 'run_command', { ...scale, because: 'check the next size' }, evaluate);
  assert.equal(allowed.isError, false, allowed.content);
  assert.equal(allowed.changed, true);
  assert.deepEqual(parse(allowed.content).facts.bbox, { min: [0, 0, 0], max: [40, 20, 8] });
  const rechecked = await runTool(allowed.state, 'check_spec', {}, evaluate);
  const report = parse(rechecked.content);
  assert.deepEqual(report.summary, { pass: 0, fail: 1, unknown: 0, hard_failing: 1 });
  assert.deepEqual(rechecked.state.policy?.passedHard, []);
  assert.deepEqual(report.failures, [{
    req_id: 'WIDTH', check: 'bbox', measured: 40.0002, expected: `<= ${WIDTH_CAP} mm`, delta: 0.0001,
    hint: 'the overall x size; hard: "limit the width"',
  }]);
});

const boxCap: Requirement = {
  id: 'H', source: 'Volume at most 600 mm³', hard: true, check: { query: { fn: 'volume' }, op: '<=', value: 600 },
};
const boxPreferences: Requirement[] = (['x', 'y'] as const).map(axis => ({
  id: `S${axis}`, source: `${axis} length of 20 mm`, hard: false, check: { query: { fn: 'bbox', axis }, op: '==', value: 20 },
}));

function squareBox(width: number, requirements: Requirement[]): StudioDoc {
  const doc = rectanglePart(width, width, 5);
  const [sketch, solid] = doc.nodes;
  assert.ok(sketch.kind === 'sketch' && sketch.profile === 'rectangle');
  const W = { parameter: 'W' };
  return { ...doc, parameters: { W: width }, nodes: [{ ...sketch, max: [W, W] }, solid], requirements };
}

async function checkBox(state: ChatState) {
  const checked = await runTool(state, 'requirements', { action: 'check' }, evaluate);
  assert.equal(checked.isError, false, checked.content);
  return { state: checked.state, report: parse(checked.content) };
}

function editWidth(state: ChatState, W: number, because?: string) {
  return runTool(state, 'features', { action: 'parameters', set: { W }, ...(because ? { because } : {}) }, evaluate);
}

function assertBoxVolume(state: ChatState, expected: number) {
  const volume = state.bodies[0].volume;
  assert.ok(volume !== null && Math.abs(volume - expected) <= 1e-9, `Expected ${expected} mm³, got ${volume}`);
}

for (const [first, second] of [[10, 20], [20, 10]]) {
  test(`D579: grouped history restores the hard-fulfilled box after checking ${first} then ${second}`, async () => {
    const start = await stateOf(squareBox(first, [boxCap, ...boxPreferences]));
    const a = await checkBox(start);
    const change = await editWidth(a.state, second, 'test the alternate box');
    assert.equal(change.isError, false, change.content);
    const b = await checkBox(change.state);
    const [valid, invalid] = first === 10 ? [a, b] : [b, a];
    assert.deepEqual(valid.report.summary, { pass: 1, fail: 2, unknown: 0, hard_failing: 0 });
    assert.deepEqual(invalid.report.summary, { pass: 2, fail: 1, unknown: 0, hard_failing: 1 });
    assertBoxVolume(valid.state, 500);
    assertBoxVolume(invalid.state, 2000);

    const intermediate = await editWidth(b.state, 12, 'test recovery from another hard failure');
    assert.equal(intermediate.isError, false, intermediate.content);
    const restored = await runTool(intermediate.state, 'history', { action: 'best' }, evaluate);
    assert.equal(restored.isError, false, restored.content);
    assert.equal(restored.changed, true);
    assert.equal(restored.state.doc.parameters.W, 10, `check order ${first}, ${second}`);
    assertBoxVolume(restored.state, 500);
    assert.deepEqual(restored.state.doc.requirements, start.doc.requirements);
    assert.deepEqual(b.report.policy.best, {
      model_hash: valid.report.model_hash, pass: 1, this_is_best: second === 10, hard_fulfilled: true,
    });

    const confirmed = await checkBox(restored.state);
    const refusal = await editWidth(confirmed.state, 20);
    assert.equal(refusal.isError, true, refusal.content);
    assert.equal(refusal.changed, false);
    assert.equal(refusal.state, confirmed.state);
    assert.match(parse(refusal.content).error, /breaks hard requirement that passed: H/);
    const overridden = await editWidth(confirmed.state, 20, 'compare the wider box');
    assert.equal(overridden.isError, false, overridden.content);
    assertBoxVolume(overridden.state, 2000);
    assert.equal(overridden.state.policy?.calls, confirmed.report.policy.tool_calls + 1);
  });
}

test('D579: a hard unknown prevents fulfillment and a soft unknown does not', async () => {
  const massCheck: Requirement = {
    id: 'M', source: 'Mass at most 10 g', hard: true, check: { query: { fn: 'mass' }, op: '<=', value: 10 },
  };
  for (const hard of [true, false]) {
    const doc = squareBox(10, [{ ...massCheck, hard }, boxPreferences[0]]);
    const unknown = await stateOf(doc);
    let checked = await checkBox(unknown);
    assert.deepEqual(checked.report.summary, { pass: 0, fail: 1, unknown: 1, hard_failing: 0 });
    assert.equal(checked.report.policy.best.hard_fulfilled, !hard);
    for (let i = 0; i < 2; i++) checked = await checkBox(checked.state);
    assert.equal(checked.report.policy.tool_calls, 3);
    assert.deepEqual(checked.report.policy.rounds_without_progress, { Sx: 2 });
    assert.match(checked.report.policy.hint, hard ? /hard requirements unmet or unknown/ : /hard requirements fulfilled/);
  }

  const softUnknown = await checkBox(await stateOf(squareBox(10, [boxCap, { ...massCheck, hard: false }])));
  assert.deepEqual(softUnknown.report.summary, { pass: 1, fail: 0, unknown: 1, hard_failing: 0 });
  assert.equal(softUnknown.report.policy.best.hard_fulfilled, true);

  const doc = squareBox(20, [{ ...massCheck, check: { ...massCheck.check, value: 100 } }, ...boxPreferences]);
  const unknown = await checkBox(await stateOf(doc));
  const smaller = await editWidth(unknown.state, 10);
  assert.equal(smaller.isError, false, smaller.content);
  const material = await runTool(smaller.state, 'features', { action: 'material', bodies: ['b1'], material: 'steel' }, evaluate);
  assert.equal(material.isError, false, material.content);
  const known = await checkBox(material.state);
  assert.equal(unknown.report.summary.pass, 2);
  assert.equal(known.report.summary.pass, 1);
  assert.equal(known.report.policy.best.model_hash, known.report.model_hash);
  assert.equal(known.report.policy.best.hard_fulfilled, true);
});

test('D579: equal fulfillment keeps pass count, normalized miss, and first tie ordering', async () => {
  const preferences: Requirement[] = [
    { id: 'MIN', source: 'At least 20 mm wide', hard: false, check: { query: { fn: 'bbox', axis: 'x' }, op: '>=', value: 20 } },
    ...(['x', 'y'] as const).map((axis): Requirement => ({
      id: axis, source: `${axis} at most 19 mm`, hard: false, check: { query: { fn: 'bbox', axis }, op: '<=', value: 19 },
    })),
  ];
  const first = await checkBox(await stateOf(squareBox(19.5, preferences)));
  const closerEdit = await editWidth(first.state, 19.25);
  assert.equal(closerEdit.isError, false, closerEdit.content);
  const closer = await checkBox(closerEdit.state);
  assert.equal(closer.report.summary.pass, 0);
  assert.equal(closer.report.policy.best.model_hash, closer.report.model_hash);
  assert.notEqual(closer.report.model_hash, first.report.model_hash);

  const tiedEdit = await runTool(closer.state, 'features', { action: 'parameters', add: { UNUSED: 1 } }, evaluate);
  assert.equal(tiedEdit.isError, false, tiedEdit.content);
  const tied = await checkBox(tiedEdit.state);
  assert.notEqual(tied.report.model_hash, closer.report.model_hash);
  assert.equal(tied.report.policy.best.model_hash, closer.report.model_hash);
  assert.equal(tied.report.policy.best.this_is_best, false);

  const furtherEdit = await editWidth(tied.state, 30);
  assert.equal(furtherEdit.isError, false, furtherEdit.content);
  const further = await checkBox(furtherEdit.state);
  assert.equal(further.report.summary.pass, 1);
  assert.equal(further.report.policy.best.model_hash, further.report.model_hash);
  assert.equal(further.report.policy.best.hard_fulfilled, true);
});

test('D579: changing the requirement scope starts a new ranking and refuses stale recovery', async () => {
  const old = await checkBox(await stateOf(squareBox(10, [boxCap, ...boxPreferences])));
  const edit = await editWidth(old.state, 20, 'compare the wider box');
  assert.equal(edit.isError, false, edit.content);
  let checked = await checkBox(edit.state);
  for (let i = 0; i < 2; i++) checked = await checkBox(checked.state);
  assert.deepEqual(checked.report.policy.rounds_without_progress, { H: 2 });
  const replacement = { ...boxCap, source: 'Volume at most 400 mm³', check: { ...boxCap.check, value: 400 } };
  const updated = await runTool(checked.state, 'requirements', { action: 'set', requirements: [replacement], replace: true }, evaluate);
  assert.equal(updated.isError, false, updated.content);
  const refused = await runTool(updated.state, 'history', { action: 'best' }, evaluate);
  assert.equal(refused.isError, true, refused.content);
  assert.equal(refused.state, updated.state);
  assert.equal(refused.state.doc.parameters.W, 20);
  assert.equal(refused.state.doc.requirements?.[0].check.value, 400);

  const fresh = await checkBox(refused.state);
  assert.equal(fresh.report.policy.tool_calls, checked.report.policy.tool_calls + 2);
  assert.deepEqual(fresh.report.policy.rounds_without_progress, { H: 0 });
  assert.equal(fresh.report.policy.best.model_hash, fresh.report.model_hash);
  assert.equal(fresh.report.policy.best.hard_fulfilled, false);
  assert.equal(fresh.report.policy.hint, undefined);
  const smaller = await editWidth(fresh.state, 8);
  assert.equal(smaller.isError, false, smaller.content);
  const improved = await checkBox(smaller.state);
  assert.equal(improved.report.policy.best.model_hash, improved.report.model_hash);
  assert.equal(improved.report.policy.best.hard_fulfilled, true);
  assert.equal(improved.report.policy.rounds_without_progress, undefined);
});

test('D579: reordering the same authored requirements keeps the rank and current order', async () => {
  const checked = await checkBox(await stateOf(squareBox(10, [boxCap, ...boxPreferences])));
  const edit = await editWidth(checked.state, 20, 'compare the wider box');
  assert.equal(edit.isError, false, edit.content);
  const requirements = [...edit.state.doc.requirements!].reverse();
  const reordered = await checkBox({ ...edit.state, doc: { ...edit.state.doc, requirements } });
  assert.equal(reordered.report.policy.best.model_hash, checked.report.model_hash);
  const restored = await runTool(reordered.state, 'history', { action: 'best' }, evaluate);
  assert.equal(restored.isError, false, restored.content);
  assert.deepEqual(restored.state.doc.requirements, requirements);
  assertBoxVolume(restored.state, 500);
});

test('D579: a material-only change with the same public hash does not hide a valid snapshot', async () => {
  const requirement: Requirement = {
    id: 'M', source: 'Mass at most 10 g', hard: true, check: { query: { fn: 'mass' }, op: '<=', value: 10 },
  };
  const doc: StudioDoc = {
    ...squareBox(10, [requirement]),
    brief: { version: 1, material: { value: 'al6061', basis: 'stated', source: 'Use 6061 aluminium' } },
  };
  const checked = await checkBox(await stateOf(doc));
  assert.equal(checked.report.policy.best.hard_fulfilled, true);
  const changed = await runTool(checked.state, 'requirements', {
    action: 'brief', fields: { material: { value: 'Custom alloy', basis: 'stated', source: 'Use the custom alloy' } },
  }, evaluate);
  assert.equal(changed.isError, false, changed.content);
  const unknown = await checkBox(changed.state);
  assert.equal(unknown.report.summary.unknown, 1);
  assert.equal(unknown.report.model_hash, checked.report.model_hash);
  assert.equal(unknown.report.policy.best.this_is_best, false);
  const restored = await runTool(unknown.state, 'history', { action: 'best' }, evaluate);
  assert.equal(restored.isError, false, restored.content);
  assert.deepEqual(restored.state.doc.brief, doc.brief);
  assert.equal((await checkBox(restored.state)).report.summary.pass, 1);
});

test('D579: a duplicate ID cannot turn an earlier hard failure into fulfillment', async () => {
  const duplicate = { ...boxPreferences[0], id: boxCap.id };
  const checked = await checkBox(await stateOf(squareBox(20, [boxCap, duplicate])));
  assert.equal(checked.report.summary.hard_failing, 1);
  assert.equal(checked.report.summary.pass, 1);
  assert.equal(checked.report.policy.best.hard_fulfilled, false);
});

test('D579: best recovery keeps the existing autonomy and proposal guards', async () => {
  const checked = await checkBox(await stateOf(squareBox(20, [boxCap, ...boxPreferences])));
  const edit = await editWidth(checked.state, 10);
  assert.equal(edit.isError, false, edit.content);
  const state = { ...edit.state, turnBase: edit.state.doc };
  const originalLevel = process.env.CAD_AUTONOMY;
  try {
    for (const [level, reason] of [['1', /At autonomy L1/], ['2', /leaves hard requirement H failing/]] as const) {
      process.env.CAD_AUTONOMY = level;
      const restored = await runTool(state, 'history', { action: 'best' }, evaluate);
      assert.equal(restored.isError, true, restored.content);
      assert.equal(restored.state, state);
      assert.match(parse(restored.content).error, reason);
    }
  } finally {
    if (originalLevel === undefined) delete process.env.CAD_AUTONOMY;
    else process.env.CAD_AUTONOMY = originalLevel;
  }
});

test('D579: unsuccessful best-snapshot evaluation keeps recovery retryable', async () => {
  const checked = await checkBox(await stateOf(squareBox(10, [boxCap, ...boxPreferences])));
  const edit = await editWidth(checked.state, 12, 'test snapshot recovery');
  assert.equal(edit.isError, false, edit.content);
  const failed: Evaluate = async () => ({
    ok: false, revision: 1, wallTime: 0, error: { title: 'Fixture refusal', hint: 'Retry', detail: 'Fixture refusal' },
  });
  for (const [evaluator, error] of [[async () => null, /superseded/], [failed, /Fixture refusal/]] as const) {
    const result = await runTool(edit.state, 'history', { action: 'best' }, evaluator);
    assert.equal(result.isError, true, result.content);
    assert.equal(result.changed, false);
    assert.equal(result.state, edit.state);
    assert.match(parse(result.content).error, error);
  }
  const retried = await runTool(edit.state, 'history', { action: 'best' }, evaluate);
  assert.equal(retried.isError, false, retried.content);
  assertBoxVolume(retried.state, 500);
});

test('D578: a refused sub-display mass increase reports its pre-rounding value', async () => {
  const doc = { ...rectanglePart(40, 1, 1), bodies: { b1: { material: 'al6061' } } };
  const before = await stateOf(doc);
  const setup = await runTool(before, 'set_requirements', { requirements: [{
    id: 'MASS', source: 'cap the mass', hard: true,
    check: { op: '<=', query: { fn: 'mass' }, value: 0.1080003, unit: 'g' },
  }] }, evaluate);
  assert.equal(setup.isError, false, setup.content);
  const checked = await runTool(setup.state, 'check_spec', {}, evaluate);
  assert.deepEqual(checked.state.policy?.passedHard, ['MASS']);
  const scale = { command: 'scale', bodies: ['b1'], values: { factor: WIDTH / 40, px: 0, py: 0, pz: 0 } };
  const refused = await runTool(checked.state, 'run_command', scale, evaluate);
  assert.equal(refused.isError, true, refused.content);
  assert.equal(refused.state.doc, checked.state.doc);
  assert.match(parse(refused.content).error, /MASS.*measured 0\.108\d+ g before display rounding/);
  const allowed = await runTool(checked.state, 'run_command', { ...scale, because: 'check the next mass' }, evaluate);
  assert.equal(allowed.isError, false, allowed.content);
  const report = parse((await runTool(allowed.state, 'check_spec', {}, evaluate)).content);
  assert.deepEqual(report.summary, { pass: 0, fail: 1, unknown: 0, hard_failing: 1 });
  assert.deepEqual([report.failures[0].measured, report.failures[0].delta], [0.108, 0]);
  assert.match(report.failures[0].hint, /measured 0\.108\d+ g before display rounding/);
});

test('requirements: kept in the document, run as checks; failures in full, passes as counts, assumed mass unknown', async () => {
  let s = await stateOf(rectanglePart(40, 20, 8));
  s = (await runTool(s, 'run_command', { command: 'hole', faces: ['n1.top'], values: { d: 8, x: 20, y: 10 } }, evaluate)).state;
  let r = await runTool(s, 'set_requirements', { requirements: BRIEF }, evaluate);
  assert.ok(!r.isError, r.content); assert.ok(r.changed); s = r.state;
  assert.equal(s.doc.requirements!.length, 7);
  const rep = parse((await runTool(s, 'check_spec', {}, evaluate)).content);
  assert.deepEqual(rep.summary, { pass: 5, fail: 1, unknown: 1, hard_failing: 1 });
  assert.equal(rep.model_hash.length, 8);
  const [f] = rep.failures;
  assert.deepEqual([f.req_id, f.check, f.measured, f.expected, f.delta], ['R2', 'bbox', 8, '<= 6 mm', 2]);
  assert.match(f.hint, /hard: "no thicker than 6 mm"/);
  assert.equal(rep.unknowns[0].req_id, 'R4'); assert.match(rep.unknowns[0].why, /material of b\d+ is not set/);
  // A malformed one is refused, saying what is missing.
  r = await runTool(s, 'set_requirements', { requirements: [{ id: 'R9', source: 'x', hard: true, check: { op: '<=', query: { fn: 'bbox' }, value: 1 } }] }, evaluate);
  assert.ok(r.isError); assert.match(parse(r.content).error, /bbox takes an axis/);
  r = await runTool(s, 'set_requirements', { requirements: [{ id: 'R9', source: 'x', hard: true, check: { op: 'eval', query: { fn: 'bbox', axis: 'x' }, value: 1 } }] }, evaluate);
  assert.ok(r.isError);
});

// The A3 conformance cases (conformance/a3): a document with its requirements, and the report.
const a3 = join(resolve(import.meta.dirname, '..'), 'conformance', 'a3');
for (const file of readdirSync(a3).filter(f => f.endsWith('.json'))) {
  const c = JSON.parse(readFileSync(join(a3, file), 'utf8'));
  test(`conformance ${c.id}: ${c.about}`, async () => {
    const read = readStudioDoc(JSON.stringify(c.input.file)); assert.ok('doc' in read);
    const rep = parse((await runTool(await stateOf(read.doc), 'check_spec', {}, evaluate)).content);
    assert.deepEqual(rep.summary, c.expect.summary);
    assert.deepEqual(rep.failures.map((f: Record<string, unknown>) => ({ req_id: f.req_id, check: f.check, measured: f.measured, expected: f.expected, delta: f.delta })), c.expect.failures);
    assert.deepEqual(rep.unknowns.map((u: { req_id: string }) => u.req_id), c.expect.unknowns);
  });
}

test('mutation check: a check that cannot fail is vacuous, a declared invariant is not, one with too few usable mutants is unverified', async () => {
  let s = await stateOf(rectanglePart(40, 20, 8));
  s = (await runTool(s, 'run_command', { command: 'hole', faces: ['n1.top'], values: { d: 8, x: 20, y: 10 } }, evaluate)).state;
  s = (await runTool(s, 'set_requirements', { requirements: [
    { id: 'L', source: '40 long', hard: true, check: { op: '==', query: { fn: 'bbox', axis: 'x' }, value: 40, tol: 0.1 } },
    { id: 'H', source: 'an 8 mm hole', hard: true, check: { op: '==', query: { fn: 'hole_diameter', face: { feature: 2, role: 'side0' } }, value: 8, tol: 0.01 } },
    { id: 'Z', source: 'under 100 tall', hard: false, check: { op: '<=', query: { fn: 'bbox', axis: 'z' }, value: 100 } },
    { id: 'ONE', source: 'one piece', hard: true, invariant: true, invariant_reason: 'one piece whatever its sizes', check: { op: '==', query: { fn: 'count_solids' }, value: 1 } },
  ] }, evaluate)).state;
  const rep = parse((await runTool(s, 'check_spec', { validate: true }, evaluate)).content);
  assert.equal(rep.summary.pass, 4);
  assert.ok(rep.mutants.built >= 4 && rep.mutants.tried <= 8, JSON.stringify(rep.mutants));
  assert.deepEqual(rep.vacuous.map((v: { req_id: string }) => v.req_id), ['Z']);
  assert.deepEqual(rep.invariant, [{ req_id: 'ONE', reason: 'one piece whatever its sizes' }]);
  assert.deepEqual(rep.unverified, []);
  // No mutant builds: every passing check is unverified, never vacuous.
  const onlyModel = async (d: StudioDoc) => d === s.doc ? evaluate(d) : null;
  const rep2 = parse((await runTool(s, 'check_spec', { validate: true }, onlyModel)).content);
  assert.equal(rep2.mutants.built, 0); assert.deepEqual(rep2.vacuous, []);
  assert.deepEqual(rep2.unverified.map((v: { req_id: string }) => v.req_id).sort(), ['H', 'L', 'Z']);
  for (const result of [rep, rep2]) {
    assert.ok(Number.isFinite(result.mutants.duration) && result.mutants.duration >= 0);
    assert.ok(!('ms' in result.mutants));
  }
});

test('policy: the best snapshot, rounds without progress and a restart hint; a change breaking a passed hard requirement is refused unless it says why', async () => {
  let s = await stateOf(rectanglePart(40, 20, 8));
  s = (await runTool(s, 'set_requirements', { requirements: [
    { id: 'L', source: '40 long', hard: true, check: { op: '==', query: { fn: 'bbox', axis: 'x' }, value: 40, tol: 0.1 } },
    { id: 'T', source: 'at most 6 thick', hard: true, check: { op: '<=', query: { fn: 'bbox', axis: 'z' }, value: 6 } },
  ] }, evaluate)).state;
  let rep: Record<string, any> = {};
  for (let k = 0; k < 3; k++) { const r = await runTool(s, 'check_spec', {}, evaluate); s = r.state; rep = parse(r.content); }
  assert.deepEqual(rep.policy.rounds_without_progress, { T: 2 });
  assert.match(rep.policy.hint, /no progress on T for 2 rounds: start again from the brief/);
  assert.equal(rep.policy.best.this_is_best, true); assert.ok(rep.policy.tool_calls >= 4);
  // Scaling the plate breaks L (passed, hard): refused; with a reason, made.
  const scale = { command: 'scale', bodies: ['b1'], values: { factor: 1.5 } };
  let r = await runTool(s, 'run_command', scale, evaluate);
  assert.ok(r.isError, r.content); assert.match(parse(r.content).error, /breaks hard requirement that passed: L \("40 long": measured 60/);
  r = await runTool(s, 'run_command', { ...scale, because: 'trying a bigger plate' }, evaluate);
  assert.ok(!r.isError, r.content); s = r.state;
  // The best snapshot is the one before: restore_best puts it back.
  s = (await runTool(s, 'check_spec', {}, evaluate)).state;
  r = await runTool(s, 'restore_best', {}, evaluate);
  assert.ok(!r.isError, r.content);
  assert.equal(parse(r.content).facts.bbox.max[0], 40);
});

test('gear queries (R6a.4b, D56): centre distance, backlash, contact ratio and clearance of two gears as placed; a crossing measured as minus its depth; not gears, unknown', async () => {
  const { commands } = await import('../src/app/commands');
  const gear = commands.find(c => c.id === 'gear')!, mesh = commands.find(c => c.id === 'gear-mesh')!;
  const ctx0 = { doc: { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [], outputs: {}, nextId: 0 } as StudioDoc, bodies: [], selection: { faces: [], edges: [], bodies: [] } };
  const one = gear.build!(ctx0, { ...gear.defaults!(ctx0), m: 2, teeth: 20, b: 10, bore: 8, x: 0, y: 0, z: 0 }), r1 = await evaluate(one); assert.ok(r1.ok);
  const doc = mesh.build!({ doc: one, bodies: r1.ok ? r1.bodies : [], selection: { faces: [], edges: [], bodies: [0] } }, { teeth: 40, dir: 0, bore: 8 });
  let s = await stateOf({ ...doc, nodes: [{ ...doc.nodes[0], thicknessReduction: 0.1 } as typeof doc.nodes[number], { ...doc.nodes[1], thicknessReduction: 0.1 } as typeof doc.nodes[number]] });
  const q = (fn: string) => ({ fn, a: 'n0', b: 'n1' });
  const reqs = [
    { id: 'G1', source: 'shafts 60 mm apart', hard: true, check: { op: '==', query: q('gear_center_distance'), value: 60, tol: 1e-6, unit: 'mm' } },
    { id: 'G2', source: 'backlash 0.1–0.3 mm', hard: true, check: { op: 'between', query: q('gear_backlash'), min: 0.1, max: 0.3, unit: 'mm' } },
    { id: 'G3', source: 'contact ratio at least 1.4', hard: true, check: { op: '>=', query: q('gear_contact_ratio'), value: 1.4 } },
    { id: 'G4', source: 'teeth never touch', hard: true, check: { op: '>=', query: q('gear_clearance'), value: 0.05, unit: 'mm' } },
    { id: 'G5', source: 'a gear pair', hard: false, check: { op: '>=', query: { fn: 'gear_backlash', a: 'n0', b: 'n9' }, value: 0 } },
  ];
  let r = await runTool(s, 'set_requirements', { requirements: reqs }, evaluate); assert.ok(!r.isError, r.content); s = r.state;
  let rep = parse((await runTool(s, 'check_spec', {}, evaluate)).content);
  // (Each tooth 0.1 mm thinner: backlash 0.2 mm on the pitch circle; the least clearance the normal one, j·cos 20° / 2.)
  assert.deepEqual(rep.summary, { pass: 4, fail: 0, unknown: 1, hard_failing: 0 }, JSON.stringify(rep));
  assert.match(rep.unknowns[0].why, /n9 is not a spur gear or rack body/);
  // Half a pitch out: the teeth cross, the clearance negative (minus the depth).
  s = { ...s, doc: { ...s.doc, nodes: [s.doc.nodes[0], { ...s.doc.nodes[1], mesh: { gear: 0, phase: 4.5 } } as typeof s.doc.nodes[number]] } };
  const re = await evaluate(s.doc); assert.ok(re.ok); s = { ...s, bodies: re.ok ? re.bodies : [] };
  rep = parse((await runTool(s, 'check_spec', {}, evaluate)).content);
  const f = rep.failures.find((x: { req_id: string }) => x.req_id === 'G4');
  assert.ok(f && f.measured < -1, JSON.stringify(rep.failures)); assert.match(f.hint, /the teeth cross/);
  // Malformed: a and b are feature ids.
  r = await runTool(s, 'set_requirements', { requirements: [{ id: 'G9', source: 'x', hard: true, check: { op: '>=', query: { fn: 'gear_backlash', a: 'n0' }, value: 0 } }] }, evaluate);
  assert.ok(r.isError); assert.match(parse(r.content).error, /gear_backlash takes two spur gears' feature ids/);
});


test('validation timing: seconds keep the original rounded millisecond interval and two clock reads', async t => {
  const s = await stateOf(rectanglePart(40, 20, 8));
  let calls = 0;
  const clock = t.mock.method(performance, 'now', () => ++calls === 1 ? 0 : 250.4);
  try {
    const result = await validateSuite(s.doc, s.bodies, async () => null, new Map());
    assert.equal(result.mutants.duration, 0.250);
    assert.ok(!('ms' in result.mutants));
    assert.equal(calls, 2);
    assert.equal(result.mutants.built, 0);
  } finally { clock.mock.restore(); }
});
