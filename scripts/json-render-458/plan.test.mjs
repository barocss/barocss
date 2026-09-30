import test from 'node:test';
import assert from 'node:assert/strict';
import { ARMS, MAX_ATTEMPTS, SCENARIOS_ORDER, STAGES, promptFor, requestFor, schedule, supportFor } from './plan.mjs';
import { parseFinal, safeSpec, semanticErrors } from './validate.mjs';
import { specFor } from '../json-render-446/spec.mjs';

test('24 scheduled stages, six isolated sessions, and pre-output expressibility', () => {
  const cells = schedule();
  assert.equal(cells.length, MAX_ATTEMPTS);
  assert.equal(new Set(cells.map((row) => row.id)).size, MAX_ATTEMPTS);
  assert.equal(new Set(cells.map((row) => row.session)).size, 6);
  for (const scenario of SCENARIOS_ORDER) for (const arm of ARMS) {
    const session = cells.filter((row) => row.session === `${scenario}--${arm}`);
    assert.deepEqual(session.map((row) => row.stage), STAGES);
    assert.equal(supportFor(scenario, arm, 'absent').supported, arm === 'utility');
    for (const stage of STAGES) assert.ok(requestFor(scenario, stage).length);
  }
});
test('same semantic request across arms and full same-session history only', () => {
  const cells = schedule();
  for (const scenario of SCENARIOS_ORDER) for (const stage of STAGES) assert.equal(requestFor(scenario, stage), requestFor(scenario, stage));
  const row = cells.find((item) => item.id === 'settings--variable--scalar');
  const prompt = JSON.parse(promptFor(row, ['{"specJson":"first","cannotExpress":false}']));
  assert.equal(prompt.session, 'settings--variable');
  assert.deepEqual(prompt.transcript.map((item) => item.role), ['user', 'assistant', 'user']);
  assert.throws(() => promptFor(row, []), /Incomplete/);
});
test('safe spec boundary rejects code, URLs, unsafe classes, bad variables and wrong binding', () => {
  const bounded = specFor('settings', 'bounded', 'initial');
  bounded.elements.layout.props.variables = {};
  assert.deepEqual(safeSpec(bounded, 'settings', 'variable'), []);
  assert.deepEqual(semanticErrors(bounded, 'settings'), []);
  for (const invalid of ['url(https://example.test/x)', Infinity, -1, 33]) {
    const copy = structuredClone(bounded); copy.elements.layout.props.variables = { paddingPx: invalid };
    assert.ok(safeSpec(copy, 'settings', 'variable').length);
  }
  const wrong = structuredClone(bounded); wrong.elements.email.props.value = { $bindState: '/plan' };
  assert.ok(safeSpec(wrong, 'settings', 'variable').length);
  const altered = structuredClone(bounded); altered.elements.heading.props.text = 'Changed';
  assert.deepEqual(safeSpec(altered, 'settings', 'variable'), []);
  assert.ok(semanticErrors(altered, 'settings').length);
  const utility = specFor('settings', 'utility', 'initial');
  assert.deepEqual(safeSpec(utility, 'settings', 'utility'), []);
  utility.elements.layout.props.className = 'grid-cols-2 bg-[url(https://example.test/x)]';
  assert.ok(safeSpec(utility, 'settings', 'utility').length);
});
test('raw structured output preserves parse and schema errors', () => {
  assert.equal(parseFinal('{broken').status, 'parse');
  assert.equal(parseFinal('{}').status, 'envelope');
  assert.equal(parseFinal('{"specJson":"{broken","cannotExpress":false}').status, 'parse-spec');
  const parsed = parseFinal(JSON.stringify({ specJson: JSON.stringify(specFor('dashboard', 'utility', 'initial')), cannotExpress: false }));
  assert.equal(parsed.status, 'parsed');
  assert.deepEqual(safeSpec(parsed.spec, 'dashboard', 'utility'), []);
});

test('malformed node shapes fail closed without throwing', () => {
  const base = specFor('settings', 'bounded', 'initial');
  for (const mutate of [
    (spec) => { spec.elements.layout = null; },
    (spec) => { spec.elements.layout.props = null; },
    (spec) => { spec.elements.heading = null; },
    (spec) => { spec.elements.heading.props = null; },
    (spec) => { spec.elements.save.on = null; },
  ]) {
    const spec = structuredClone(base);
    mutate(spec);
    assert.doesNotThrow(() => safeSpec(spec, 'settings', 'variable'));
    assert.ok(safeSpec(spec, 'settings', 'variable').length);
  }
});
