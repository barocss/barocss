import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { validateSpec, classesFor, Renderer } from '../dist/index.js';
import { INITIAL } from '../../../scripts/barocss-render-prototype/fixture.mjs';

const contract = { textBindings: ['/draft/name', '/draft/topic'], actions: ['review', 'edit', 'confirm'] };
function configured() {
  const spec = structuredClone(INITIAL);
  spec.elements.name.props.value.$bindState = '/draft/name';
  spec.elements.topic = { type: 'Input', props: { id: 'topic', label: 'Topic', value: { $bindState: '/draft/topic' } }, children: [] };
  spec.elements.save.on.press.action = 'review';
  for (const action of ['edit', 'confirm']) spec.elements[action] = {
    type: 'Button', props: { id: action, label: action }, children: [], on: { press: { action } },
  };
  spec.elements.card.children.push('topic', 'edit', 'confirm');
  return spec;
}
const components = Object.fromEntries(['Layout', 'Card', 'Text', 'Input', 'Button'].map((name) => [name, () => null]));
function render(spec = configured(), actions = { review() {}, edit() {}, confirm() {} }) {
  return Renderer({ spec, contract, components, state: {}, setState() {}, actions });
}

test('legacy specs and CSS mappings retain their default contract', () => {
  assert.equal(validateSpec(INITIAL).ok, true);
  assert.equal(validateSpec(configured()).ok, false);
  assert.equal(classesFor(INITIAL.elements.layout), 'grid grid-cols-1 md:grid-cols-2 gap-2.5');
  assert.equal(classesFor(INITIAL.elements.card), 'rounded-xl p-3.5 bg-white text-slate-900');
  assert.doesNotThrow(() => Renderer({ spec: INITIAL, components, state: {}, setState() {}, actions: { save() {} } }));
});

test('only host-declared configured paths and action names pass', () => {
  assert.equal(validateSpec(configured(), contract).ok, true);
  const foreign = vm.runInNewContext(`JSON.parse(${JSON.stringify(JSON.stringify(contract))})`);
  assert.equal(validateSpec(configured(), foreign).ok, true);
  for (const mutate of [
    (s) => { s.elements.name.props.value.$bindState = '/draft/other'; },
    (s) => { s.elements.save.on.press.action = 'save'; },
    (s) => { s.elements.save.on.press.parameters = { ignored: true }; },
    (s) => { s.elements.name.props.value.expression = 'draft.name'; },
  ]) {
    const spec = configured(); mutate(spec);
    assert.equal(validateSpec(spec, contract).ok, false);
    assert.throws(() => render(spec), /^Error: Invalid spec:/);
  }
});

for (const invalid of [null, [], new Date(0), {}, { ...contract, extra: true },
  { ...contract, textBindings: 'name' }, { ...contract, actions: ['review', 'review'] },
  { ...contract, textBindings: ['/draft/name', '/draft/name'] },
  { ...contract, actions: new Array(1) }, { ...contract, actions: Array(33).fill('review') },
  { ...contract, textBindings: Array(33).fill('/name') },
]) test(`malformed host declaration rejected: ${JSON.stringify(invalid)}`, () => {
  const result = validateSpec(INITIAL, invalid);
  assert.equal(result.ok, false);
  assert(result.errors[0].path.startsWith('contract'));
});

for (const path of ['', '/', 'name', '//name', '/draft/', '/draft//name', '/draft/0', '/draft/~0name',
  '/draft/~1name', '/draft/%6eame', '/draft.name', '/draft/name[0]', '/draft/name space',
  '/draft/__proto__', '/constructor/name', '/draft/prototype/name', '/'+ 'x'.repeat(33),
]) test(`unsupported or unsafe text pointer rejected: ${path}`, () => {
  assert.equal(validateSpec(INITIAL, { textBindings: [path], actions: ['save'] }).ok, false);
});
for (const name of ['', 'Review', 'review.now', '__proto__', 'prototype', 'constructor', 'review/', 'x'.repeat(33)])
  test(`unsupported or unsafe action declaration rejected: ${name}`, () => {
    assert.equal(validateSpec(INITIAL, { textBindings: ['/name'], actions: [name] }).ok, false);
  });

test('contract arrays are required own declarations, including sparse entries', () => {
  const inherited = Object.create({ textBindings: ['/name'], actions: ['save'] });
  assert.equal(validateSpec(INITIAL, inherited).ok, false);
  const sparse = ['/name', , '/topic'];
  assert.equal(validateSpec(INITIAL, { ...contract, textBindings: sparse }).ok, false);
  const symbolField = { ...contract, [Symbol('extra')]: true };
  assert.equal(validateSpec(INITIAL, symbolField).ok, false);
});

test('configured screens keep graph, prop, style and text guards', () => {
  for (const mutate of [
    (s) => { s.elements.card.children.push('layout'); },
    (s) => { s.elements.card.children.push('absent'); },
    (s) => { s.elements.card.children.push('name'); },
    (s) => { s.elements.card.children.pop(); },
    (s) => { s.elements.card.props.padding = 'custom'; },
    (s) => { s.elements.card.props.className = 'p-0'; },
    (s) => { s.elements.heading.props.text = 'x'.repeat(301); },
    (s) => { s.elements.name.type = 'Script'; },
  ]) {
    const spec = configured(); mutate(spec);
    assert.equal(validateSpec(spec, contract).ok, false);
  }
});

test('all used handlers must be own registered functions before render', () => {
  for (const actions of [null, {}, { review: 'review', edit() {}, confirm() {} },
    Object.create({ review() {}, edit() {}, confirm() {} }),
    { review() {}, edit() {} },
  ]) assert.throws(() => render(configured(), actions), /Missing registered action:/);
  let getterCalls = 0;
  const actions = { edit() {}, confirm() {} };
  Object.defineProperty(actions, 'review', { get() { getterCalls++; return () => {}; } });
  assert.throws(() => render(configured(), actions), /Missing registered action: review/);
  assert.equal(getterCalls, 0);
});

test('dispatch captures each validated handler and ignores later registry replacement', () => {
  const calls = [];
  const actions = Object.fromEntries(contract.actions.map((name) => [name, () => calls.push(name)]));
  const tree = render(configured(), actions);
  const buttons = [];
  function visit(element) {
    if (element.props.node.type === 'Button') buttons.push(element);
    for (const child of element.props.children ?? []) visit(child);
  }
  visit(tree);
  actions.review = () => calls.push('unexpected');
  for (const button of buttons) button.props.onAction();
  assert.deepEqual(calls, ['review', 'edit', 'confirm']);
});
