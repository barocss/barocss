import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createMarkdownRenderer, disposeMdItInstance} from 'vitepress';
import {createRenderEditorMarkdownAnchors} from './render-editor-markdown-anchors.mjs';

const srcDir = fileURLToPath(new URL('../docs/', import.meta.url));
const {headingIds, assertAnchor} = await createRenderEditorMarkdownAnchors(srcDir);
const renderer = await createMarkdownRenderer(srcDir);
after(() => disposeMdItInstance());

test('rejects the original apostrophe false positive and accepts the rendered body-s ID', () => {
  const source = "## Edit a body's scalar material uniforms\n";
  const bad = 'edit-a-bodys-scalar-material-uniforms';
  const good = 'edit-a-body-s-scalar-material-uniforms';
  const href = `./guides#${bad}`;

  assert.deepEqual(headingIds(source), new Set([good]));
  assert.throws(() => assertAnchor(source, bad, href), {
    name: 'AssertionError', code: 'ERR_ASSERTION', message: `Missing heading ${href}`,
  });
  assert.doesNotThrow(() => assertAnchor(source, good));
});

test('normalizes Unicode heading text and resolves percent-encoded fragments', () => {
  const source = '# Café 東京\n';
  const decomposed = '# Cafe\u0301 東京\n';
  const expected = new Set(['cafe-東京']);

  assert.deepEqual(headingIds(source), expected);
  assert.deepEqual(headingIds(decomposed), expected);
  assert.doesNotThrow(() => assertAnchor(source, 'cafe-東京'));
  assert.doesNotThrow(() => assertAnchor(source, 'cafe-%E6%9D%B1%E4%BA%AC'));
  assert.doesNotThrow(() => assertAnchor(decomposed, 'cafe-%E6%9D%B1%E4%BA%AC'));
  assert.throws(() => assertAnchor(source, 'cafe-%E4%BA%AC%E9%83%BD'), {
    name: 'AssertionError', code: 'ERR_ASSERTION',
  });
});

test('suffixes repeated headings and resets duplicate counters between documents', () => {
  const repeated = '# Repeated heading\n\n## Repeated heading\n\n### Repeated heading\n';
  const single = '## Repeated heading\n';
  const expected = new Set(['repeated-heading', 'repeated-heading-1', 'repeated-heading-2']);

  assert.deepEqual(headingIds(repeated), expected);
  assert.doesNotThrow(() => assertAnchor(repeated, 'repeated-heading-2'));
  assert.deepEqual(headingIds(single), new Set(['repeated-heading']));
  assert.throws(() => assertAnchor(single, 'repeated-heading-1'), {
    name: 'AssertionError', code: 'ERR_ASSERTION',
  });
  assert.deepEqual(headingIds(repeated), expected);
  assert.deepEqual(headingIds(single), new Set(['repeated-heading']));
});

test('uses an explicit custom ID instead of an ID derived from the visible title', () => {
  const source = '## Visible title {#stable-anchor}\n';

  assert.deepEqual(headingIds(source), new Set(['stable-anchor']));
  assert.doesNotThrow(() => assertAnchor(source, 'stable-anchor'));
  for (const fragment of ['visible-title', 'visible-title-stable-anchor']) {
    assert.throws(() => assertAnchor(source, fragment), {
      name: 'AssertionError', code: 'ERR_ASSERTION',
    });
  }
});

test('collects h1 through h6 IDs from inline text, emphasis, code, and links', () => {
  const source = [
    '# One',
    '## Two *emphasis*',
    '### Three **strong**',
    '#### Four `code`',
    '##### Five [link](https://example.com)',
    '###### Six ~~strike~~',
  ].join('\n\n');
  const expected = new Set([
    'one', 'two-emphasis', 'three-strong', 'four-code', 'five-link', 'six-strike',
  ]);

  assert.deepEqual(headingIds(source), expected);
  for (const fragment of expected) assert.doesNotThrow(() => assertAnchor(source, fragment));
});

test('does not treat fenced or indented code as Markdown headings', () => {
  const source = [
    '# Real heading',
    '',
    '~~~md',
    '## Fake tilde heading',
    '~~~',
    '',
    '```md',
    '### Fake backtick heading',
    '```',
    '',
    '    ## Indented fake heading',
  ].join('\n');

  assert.deepEqual(headingIds(source), new Set(['real-heading']));
  for (const fragment of ['fake-tilde-heading', 'fake-backtick-heading', 'indented-fake-heading']) {
    assert.throws(() => assertAnchor(source, fragment), {
      name: 'AssertionError', code: 'ERR_ASSERTION',
    });
  }
});

test('admitted IDs equal the IDs in actual VitePress-rendered heading HTML', () => {
  const source = [
    "# Edit a body's scalar material uniforms",
    '## Café 東京',
    '## Cafe\u0301 東京',
    '## Repeat',
    '### Repeat',
    '#### Inline *formatting* and `code`',
    '##### Explicit title {#manual-anchor}',
    '###### Sixth level',
    '~~~md\n## Not a heading\n~~~',
  ].join('\n\n');
  const html = renderer.render(source, {});
  // Read rendered attributes, never reproduce VitePress's slug algorithm here.
  const renderedIds = new Set([...html.matchAll(/<h[1-6]\b[^>]*\bid="([^"]+)"/g)]
    .map(match => match[1]));

  assert.equal(renderedIds.size, 8);
  assert.deepEqual(headingIds(source), renderedIds);
  for (const fragment of renderedIds) assert.doesNotThrow(() => assertAnchor(source, fragment));
});
