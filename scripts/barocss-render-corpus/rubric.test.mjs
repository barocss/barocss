import assert from 'node:assert/strict';
import test from 'node:test';
import { INITIAL } from '../barocss-render-prototype/fixture.mjs';
import { CONTENT_CHECKS, scoreInitialContent } from './rubric.mjs';

test('all ten rows have frozen content checks', () => {
  assert.deepEqual(Object.keys(CONTENT_CHECKS).sort(), Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(2, '0')).sort());
});

test('explicit English labels and light style pass row three, but changed label fails', () => {
  const fixture = structuredClone(INITIAL);
  assert.equal(scoreInitialContent('03', fixture).objectivePass, true);
  fixture.elements.save.props.label = 'Save';
  const result = scoreInitialContent('03', fixture);
  assert.deepEqual(result.checks.find(({ id }) => id === 'exact-button-save-profile'),
    { id: 'exact-button-save-profile', pass: false });
});

test('Korean-copy check includes heading, input label and button label', () => {
  const fixture = structuredClone(INITIAL);
  fixture.elements.heading.props.text = '내 프로필';
  fixture.elements.name.props.label = '이름';
  fixture.elements.save.props.label = '저장';
  assert.equal(scoreInitialContent('02', fixture).objectivePass, true);
  assert.equal(scoreInitialContent('02', fixture).manualPending, true);
  fixture.elements.name.props.label = 'Name';
  assert.equal(scoreInitialContent('02', fixture).objectivePass, false);
});

test('a styled help card cannot hide a wrong form-card tone', () => {
  const fixture = structuredClone(INITIAL);
  fixture.elements.layout.children.push('help-card');
  fixture.elements['help-card'] = { type: 'Card', props: { id: 'help-card', padding: 'spacious', tone: 'dark' }, children: ['help'] };
  fixture.elements.help = { type: 'Text', props: { id: 'help', text: 'Help' }, children: [] };
  assert.equal(scoreInitialContent('04', fixture).checks.find(({ id }) => id === 'dark-tone').pass, false);
  assert.equal(scoreInitialContent('05', fixture).checks.find(({ id }) => id === 'spacious-padding').pass, false);
});

test('local confirmation semantics remain an explicit manual check', () => {
  const fixture = structuredClone(INITIAL);
  fixture.elements.card.children.splice(1, 0, 'help');
  fixture.elements.help = { type: 'Text', props: { id: 'help', text: 'Saving shows a local confirmation.' }, children: [] };
  const scored = scoreInitialContent('10', fixture);
  assert.equal(scored.objectivePass, true);
  assert.equal(scored.manualPending, true);
  assert.equal(scored.checks.find(({ id }) => id === 'manual-local-confirmation-semantics').pass, null);
});
