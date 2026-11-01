import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server.edge';
import { Icon } from '../src/ui/atoms';
import { CAD_ICONS } from '../src/ui/cadIcons';
import { commandIconName } from '../src/ui/commandIcons';
import { commands } from '@barocss/cad-model/app/commands';
const ids = ['sketch3d', 'cylindrical-wrap', 'edit', 'text', 'text-relief'];
test('five U2 command IDs resolve to registered SVGs across supplied glyph fallbacks and made.command aliases', () => {
  for (const id of ids) {
    const name = commandIconName(id, 'unavailable-font'); assert.ok(CAD_ICONS[name], id);
    const direct = renderToStaticMarkup(createElement(Icon, { name })), history = renderToStaticMarkup(createElement(Icon, { name: 'cad-' + id }));
    assert.equal(direct, history); assert.match(direct, /^<svg\b/); assert.match(direct, /viewBox="0 0 24 24"/); assert.doesNotMatch(direct, /<text\b|class="ms|<image\b/);
  }
  for (const id of ['cylindrical-wrap', 'text', 'text-relief']) assert.ok(commands.some(c => c.id === id), id + ' keeps its existing command identity');
});
test('existing command aliases and unrelated icon fallbacks keep their meanings', () => {
  assert.equal(commandIconName('linear-pattern', 'fallback'), 'cad-pattern-linear'); assert.equal(commandIconName('sweep-curve', 'fallback'), 'cad-sweep');
  assert.equal(commandIconName('non-command-ui', 'search'), 'search'); assert.match(renderToStaticMarkup(createElement(Icon, { name: 'search' })), /data-ui-icon="search"/);
});
