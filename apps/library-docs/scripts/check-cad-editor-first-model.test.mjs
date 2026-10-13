import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hasCadEditorFirstModelRoute } from './check-cad-editor-first-model.mjs';

const fixtures = [
  ['original singleton', "p === 'cad-editor' ? ['first-model'] : []", true],
  ['expanded lessons', "p === 'cad-editor' ? ['learning-path', 'first-model', 'round-post', 'mounting-plate', 'l-bracket'] : []", true],
  ['reordered lessons', "p === 'cad-editor' ? ['round-post', 'first-model', 'learning-path'] : []", true],
  ['whitespace and double quotes', 'p === "cad-editor" ? [ "first-model", "round-post", ] : [ ]', true],
  ['missing route', "p === 'cad-editor' ? ['learning-path', 'round-post'] : []", false],
  ['route elsewhere only', "const route = 'first-model'; p === 'cad-editor' ? ['round-post'] : []", false],
  ['wrong package', "p === 'render-editor' ? ['first-model'] : []", false],
  ['empty array', "p === 'cad-editor' ? [] : []", false],
  ['unclosed array', "p === 'cad-editor' ? ['first-model' : []", false],
  ['nonliteral entry', "p === 'cad-editor' ? ['first-model', dynamicRoute] : []", false],
  ['sparse array', "p === 'cad-editor' ? ['first-model', , 'round-post'] : []", false],
  ['substring collision', "p === 'cad-editor' ? ['first-model-extra'] : []", false],
  ['route only in alternative', "p === 'cad-editor' ? ['round-post'] : ['first-model']", false],
  ['mismatched quotes', `p === 'cad-editor' ? ['first-model"] : []`, false],
];
for (const [name, source, expected] of fixtures) {
  test(name, () => assert.equal(hasCadEditorFirstModelRoute(source), expected));
}
test('actual adopted navigation includes the required first-model route', () => {
  const source = readFileSync(new URL('../docs/.vitepress/config.mts', import.meta.url), 'utf8');
  assert.equal(hasCadEditorFirstModelRoute(source), true);
});
