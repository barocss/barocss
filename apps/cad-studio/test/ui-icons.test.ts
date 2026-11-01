import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server.edge';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { Icon } from '../src/ui/atoms';
import { UI_ICONS } from '../src/ui/uiIcons';
import { CAD_ICONS, CadIcon } from '../src/ui/cadIcons';
import { commandIconName } from '../src/ui/commandIcons';
import { iconFor } from '../src/ui/featureIcon';
import { commands } from '@barocss/cad-model/app/commands';
import type { ModelNode } from '@barocss/cad-model/engine/doc';

const render = (name: string, small = false) => renderToStaticMarkup(createElement(Icon, { name, small, className: 'accent' }));
test('every generic UI glyph is a bundled decorative SVG at the existing sizes, without font text', () => {
  for (const name of Object.keys(UI_ICONS)) for (const small of [false, true]) {
    const html = render(name, small);
    assert.match(html, /^<svg\b/, name);
    assert.match(html, /viewBox="0 0 24 24"/);
    assert.match(html, new RegExp(`width="${small ? 16 : 19}"`));
    assert.match(html, /aria-hidden="true"/); assert.match(html, /focusable="false"/);
    assert.match(html, /class="[^"]*accent/); assert.match(html, /data-ui-icon=/);
    assert.doesNotMatch(html, /<text\b|<image\b|<span\b|<use\b|Material|font-family/);
  }
});
test('unknown names, including inherited object keys, produce only an explicit blank diagnostic', () => {
  for (const name of ['not-a-glyph', 'cad-not-a-glyph', '__proto__', 'constructor', 'toString']) {
    const html = render(name);
    assert.match(html, /data-ui-icon-missing=/); assert.doesNotMatch(html, /<svg\b/);
    assert.equal(html.replace(/<[^>]*>/g, ''), '', name);
  }
});
test('all CAD glyphs keep the same renderer, SVG and small-size behavior', () => {
  assert.equal(Object.keys(CAD_ICONS).length, 100);
  for (const name of Object.keys(CAD_ICONS)) for (const small of [false, true]) {
    assert.equal(renderToStaticMarkup(createElement(Icon, { name, small })), renderToStaticMarkup(createElement(CadIcon, { name, small })), name);
  }
});
test('real command, history and feature fallback routes always resolve to a supported semantic glyph', () => {
  const supported = (name: string) => assert.doesNotMatch(render(name), /data-ui-icon-missing/, name);
  for (const command of commands) supported(commandIconName(command.id, command.icon));
  for (const kind of ['import', 'text', 'text-relief', 'cylindrical-wrap', 'sketch', 'extrude', 'fillet', 'full-round', 'unrecognized']) supported(iconFor({ kind } as ModelNode));
});
test('all source Icon literals and dynamic route outputs are inventoried; Material font CSS is absent', async () => {
  const studio = process.cwd(), repo = resolve(studio, '../..');
  const ts = createRequire(join(studio, 'package.json'))('typescript') as typeof import('typescript');
  const names = new Set<string>(), dynamic: string[] = [];
  const roots = [join(studio, 'src'), join(repo, 'packages/barocss-cad-model/src/app')];
  for (const root of roots) for (const file of await readdir(root, { recursive: true })) {
    if (!/\.tsx?$/.test(file)) continue;
    const path = join(root, file), text = await readFile(path, 'utf8');
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const strings = (node: import('typescript').Node) => {
      if (ts.isStringLiteralLike(node)) names.add(node.text);
      else if (ts.isConditionalExpression(node)) { strings(node.whenTrue); strings(node.whenFalse); }
      else ts.forEachChild(node, strings);
    };
    const visit = (node: import('typescript').Node) => {
      if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(source) === 'Icon') {
        const name = node.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(source) === 'name');
        if (name && ts.isJsxAttribute(name) && name.initializer) {
          strings(name.initializer);
          if (ts.isJsxExpression(name.initializer) && name.initializer.expression && !ts.isStringLiteralLike(name.initializer.expression)) {
            const expression = name.initializer.expression;
            const known = ts.isConditionalExpression(expression) || ts.isPropertyAccessExpression(expression) && expression.name.text === 'icon'
              || ts.isCallExpression(expression) && ['commandIconName', 'iconFor'].includes(expression.expression.getText(source));
            assert.ok(known, `${path}: inventory new dynamic Icon route ${expression.getText(source)}`);
            dynamic.push(expression.getText(source));
          }
        }
      }
      if (ts.isPropertyAssignment(node) && node.name.getText(source) === 'icon') strings(node.initializer);
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  // featureIcon's two non-command output names are object-map/fallback values, not icon properties.
  names.add(iconFor({ kind: 'import' } as ModelNode)); names.add(iconFor({ kind: 'unrecognized' } as unknown as ModelNode));
  for (const name of names) if (!name.startsWith('cad-')) assert.ok(Object.hasOwn(UI_ICONS, name), name);
  assert.ok(dynamic.length >= 30, 'all existing dynamic routes were scanned');
  const html = await readFile(join(studio, 'index.html'), 'utf8');
  const css = await readFile(join(studio, 'src/styles.css'), 'utf8');
  assert.doesNotMatch(html, /Material[+ ]Symbols|material-symbols/i);
  assert.doesNotMatch(css, /Material Symbols|\.ms\s*[{.]/);
  assert.match(html, /IBM\+Plex\+Sans/); assert.match(html, /IBM\+Plex\+Mono/);
});
