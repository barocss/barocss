import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { INITIAL, editedSpec } from './fixture.mjs';
import { validateSpec, classesFor } from '../../packages/barocss-render/src/contract.mjs';

const changed = (edit) => { const spec = structuredClone(INITIAL); edit(spec); return spec; };
test('authored initial and edited screens pass the closed contract', () => {
  assert.equal(validateSpec(INITIAL).ok, true);
  assert.equal(validateSpec(editedSpec()).ok, true);
  assert.equal(classesFor(editedSpec().elements.card), 'rounded-xl p-5.5 bg-slate-900 text-white');
});
test('JSON object from another realm is accepted without accepting class instances', () => {
  const foreign = vm.runInNewContext(`JSON.parse(${JSON.stringify(JSON.stringify(INITIAL))})`);
  assert.equal(validateSpec(foreign).ok, true);
  assert.equal(validateSpec(new Date()).ok, false);
});
for (const [name, edit, expected] of [
  ['unregistered component', (s) => { s.elements.heading.type = 'Script'; }, 'elements.heading.type'],
  ['unknown prop', (s) => { s.elements.card.props.className = 'fixed'; }, 'elements.card.props.className'],
  ['free HTML', (s) => { s.elements.heading.props.html = '<img src=x>'; }, 'elements.heading.props.html'],
  ['invalid style', (s) => { s.elements.card.props.padding = 'url(https://example.test)'; }, 'elements.card.props.padding'],
  ['invalid action', (s) => { s.elements.save.on.press.action = 'fetch'; }, 'elements.save.on'],
  ['missing child', (s) => { s.elements.card.children.push('absent'); }, 'elements.card.children.3'],
  ['inherited child name', (s) => { s.elements.card.children.push('constructor'); }, 'elements.card.children.3'],
  ['inherited type name', (s) => { s.elements.help = { type: 'toString', props: { id: 'help' }, children: [] }; s.elements.card.children.push('help'); }, 'elements.help.type'],
  ['cycle', (s) => { s.elements.card.children.push('layout'); }, 'elements.card.children.3'],
  ['disconnected node', (s) => { s.elements.card.children = ['heading', 'name']; }, 'elements.save'],
  ['unknown root field', (s) => { s.javascript = 'alert(1)'; }, 'javascript'],
]) test(`${name} reports its JSON location`, () => {
  const checked = validateSpec(changed(edit));
  assert.equal(checked.ok, false);
  assert(checked.errors.some((error) => error.path === expected), JSON.stringify(checked.errors));
});
