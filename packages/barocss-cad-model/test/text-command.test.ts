import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { commandById, type Ctx, type Field, type Values } from '../src/app/commands';
import { editCommand } from '../src/app/editCommand';
import { textCommand } from '../src/app/textCommand';
import { checkValues } from '../src/chat/toolKit';
import { emptyDoc, withNode, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { fontFromBytes, isFontSourceError, type FontSource } from '../src/engine/font/source';

type TextNode = Extract<ModelNode, { kind: 'text' }>;
const fontFile = resolve(import.meta.dirname, '../../../apps/cad-studio/test/fixtures/fonts/abeezee/ABeeZee-Regular.ttf');
function context(doc: StudioDoc = emptyDoc()): Ctx { return { doc, bodies: [], selection: { faces: [], edges: [], bodies: [] } }; }
async function preparedFont(filename = 'ABeeZee-Regular.ttf'): Promise<FontSource> {
  return fontFromBytes(new Uint8Array(readFileSync(fontFile)), { filename, source: 'Original supplied font source', license: 'OFL-1.1\nOriginal supplied notice' });
}
function values(font: FontSource, text = ' A O '): Values {
  return { ...textCommand.defaults!(context()), text, font: JSON.stringify(font) };
}
function authoredNode(font: FontSource): TextNode {
  return { kind: 'text', text: ' A O ', font, size: 10.125, height: 2.0625, tolerance: 0.01, tracking: -0,
    plane: { origin: [1, 2, 3], normal: [0, 1, 0], xAxis: [1, 0, 0] },
    suppressed: true, rematched: { previous: 'authored' }, sigs: {}, held: 'Original hold', bought: false };
}
function textNode(doc: StudioDoc, index = 0): TextNode {
  const node = doc.nodes[index]; assert.equal(node?.kind, 'text'); return node as TextNode;
}
function noFilename(): null { return null; }

test('Text is registered with required serializable text and file values and explicit numeric defaults', () => {
  const ctx = context(), fields = textCommand.fields!(ctx), defaults = textCommand.defaults!(ctx);
  assert.equal(commandById('text'), textCommand);
  assert.deepEqual(defaults, { text: '', font: '', size: 10, height: 2, tolerance: 0.01, tracking: 0 });
  assert.equal(fields.find(field => field.key === 'text')?.kind, 'text');
  assert.equal(fields.find(field => field.key === 'font')?.kind, 'file');
  assert.match(checkValues(fields, defaults)!, /Text.*required/);
  assert.match(checkValues(fields, { ...defaults, text: 'A' })!, /Font file.*required/);
  assert.equal(textCommand.available(ctx).ok, true);
});
test('Text build preserves the original string and complete font descriptor on one new recipe node', async () => {
  const font = await preparedFont(' Original ABeeZee.ttf '), ctx = context(), before = structuredClone(ctx.doc), given = values(font);
  const built = textCommand.build!(ctx, given), node = textNode(built);
  assert.equal(built.nodes.length, 1); assert.equal(node.id, 'n0'); assert.equal(node.text, ' A O ');
  assert.deepEqual(node.font, font); assert.notEqual(node.font, font);
  assert.equal(node.size, 10); assert.equal(node.height, 2); assert.equal(node.tolerance, 0.01); assert.equal(node.tracking, 0);
  assert.ok(!('made' in node)); assert.ok(!('parent' in node)); assert.ok(!('plane' in node));
  assert.deepEqual(ctx.doc, before);
  const file = textCommand.fields!(ctx).find(field => field.kind === 'file');
  assert.ok(file?.kind === 'file'); assert.equal(file.filename(given.font), font.filename);
  assert.equal(file.filename('{bad'), null); assert.equal(file.filename(''), null);
});
test('Text edit retains authored ID, extras, plane, raw text, metadata, and unchanged binary64 values', async () => {
  const font = await preparedFont(), doc = withNode(emptyDoc(), authoredNode(font)), ctx = context(doc), before = structuredClone(doc), node = textNode(doc);
  const edit = editCommand(0, doc.nodes); assert.ok(edit?.build && edit.defaults);
  const defaults = edit.defaults(ctx), unchanged = edit.build(ctx, defaults), same = textNode(unchanged);
  assert.deepEqual(unchanged, doc); assert.equal(same.plane, node.plane); assert.ok(Object.is(same.tracking, -0));
  const built = edit.build(ctx, { ...defaults, text: 'O  A', height: '3.25' }), changed = textNode(built);
  assert.equal(built.nodes.length, 1); assert.equal(changed.id, node.id); assert.equal(changed.text, 'O  A'); assert.equal(changed.height, 3.25);
  assert.equal(changed.size, node.size); assert.equal(changed.tolerance, node.tolerance); assert.ok(Object.is(changed.tracking, -0));
  assert.equal(changed.plane, node.plane); assert.equal(changed.suppressed, node.suppressed); assert.equal(changed.held, node.held); assert.equal(changed.bought, node.bought);
  assert.deepEqual(changed.rematched, node.rematched); assert.deepEqual(changed.sigs, node.sigs); assert.deepEqual(changed.font, font);
  assert.deepEqual(doc, before);
});
test('Text edit can replace a prepared font without changing other authored fields', async () => {
  const first = await preparedFont(), replacement = await preparedFont('Replacement original.ttf');
  const doc = withNode(emptyDoc(), authoredNode(first)), ctx = context(doc), before = textNode(doc), edit = editCommand(0, doc.nodes)!;
  const built = edit.build!(ctx, { ...edit.defaults!(ctx), font: JSON.stringify(replacement) }), node = textNode(built);
  assert.deepEqual(node, { ...before, font: replacement }); assert.deepEqual(textNode(doc).font, first);
  assert.notEqual(node.font, replacement);
});
test('Text edit preserves later authored nodes, outputs, and the next serial ID', async () => {
  const font = await preparedFont(), first = withNode(emptyDoc(), authoredNode(font)), doc = withNode(first, authoredNode(font)), ctx = context(doc);
  const edit = editCommand(0, doc.nodes)!, built = edit.build!(ctx, { ...edit.defaults!(ctx), text: 'O' });
  assert.equal(built.nodes.length, doc.nodes.length); assert.equal(built.nodes[1], doc.nodes[1]);
  assert.equal(built.outputs, doc.outputs); assert.equal(built.nextId, doc.nextId); assert.equal(textNode(built).id, textNode(doc).id);
});
test('bound text dimensions remain Dim references and are not offered as numeric edit fields', async () => {
  const font = await preparedFont(), base = { ...emptyDoc(), parameters: { em: 10, depth: 2, gap: 0.25 } };
  const source: TextNode = { ...authoredNode(font), size: { parameter: 'em' }, height: { parameter: 'depth' }, tracking: { parameter: 'gap' } };
  const doc = withNode(base, source), ctx = context(doc), before = structuredClone(doc), edit = editCommand(0, doc.nodes)!;
  const fields = edit.fields!(ctx), defaults = edit.defaults!(ctx);
  for (const key of ['size', 'height', 'tracking']) { assert.ok(!fields.some(field => field.key === key)); assert.ok(!(key in defaults)); }
  const built = edit.build!(ctx, { ...defaults, text: 'B', tolerance: '0.005' }), node = textNode(built), old = textNode(doc);
  assert.equal(node.size, old.size); assert.equal(node.height, old.height); assert.equal(node.tracking, old.tracking);
  assert.deepEqual(node.size, { parameter: 'em' }); assert.equal(node.text, 'B'); assert.equal(node.tolerance, 0.005);
  assert.throws(() => edit.build!(ctx, { ...defaults, size: 10 }), /Parameters panel/);
  assert.deepEqual(doc, before);
});
test('Text edit leaves omitted default tracking absent', async () => {
  const font = await preparedFont(), source = authoredNode(font);
  delete source.tracking;
  const doc = withNode(emptyDoc(), source), ctx = context(doc);
  const edit = editCommand(0, doc.nodes)!, node = textNode(edit.build!(ctx, edit.defaults!(ctx)));
  assert.ok(!Object.hasOwn(node, 'tracking'));
});
test('checkValues checks string type, required values, and bounds for both text and file fields', () => {
  const fields: Field[] = [{ key: 'text', label: 'Text', kind: 'text', maxLength: 3 }, { key: 'font', label: 'Font file', kind: 'file', accept: '.ttf', maxLength: 4, filename: noFilename }];
  assert.equal(checkValues(fields, { text: 'abc', font: 'font' }), null);
  assert.match(checkValues(fields, { text: 1, font: 'font' })!, /must be text/);
  assert.match(checkValues(fields, { text: '   ', font: 'font' })!, /required/);
  assert.match(checkValues(fields, { text: 'abcd', font: 'font' })!, /at most 3/);
  assert.match(checkValues(fields, { text: 'abc', font: 1 })!, /must be text/);
  assert.match(checkValues(fields, { text: 'abc', font: '' })!, /required/);
  assert.match(checkValues(fields, { text: 'abc', font: '     ' })!, /required/);
  assert.match(checkValues(fields, { text: 'abc', font: 'fonts' })!, /at most 4/);
});
test('Text build refuses malformed, missing, and unloaded font descriptors without echoing JSON', async () => {
  const font = await preparedFont(), ctx = context(), valid = values(font), before = structuredClone(ctx.doc);
  for (const bad of ['', '{', 'null', '[]', '"filename.ttf"', JSON.stringify({ ...font, unknown: true }), JSON.stringify({ ...font, blob: 'wrong' })]) {
    assert.throws(() => textCommand.build!(ctx, { ...valid, font: bad }));
  }
  assert.throws(() => textCommand.build!(ctx, { ...valid, font: undefined } as unknown as Values));
  const unloaded = JSON.stringify({ ...font, blob: '0'.repeat(64) });
  assert.throws(() => textCommand.build!(ctx, { ...valid, font: unloaded }), error => isFontSourceError(error) && error.code === 'FONT_SOURCE_MISSING');
  const file = textCommand.fields!(ctx).find(field => field.kind === 'file'); assert.ok(file?.kind === 'file');
  assert.equal(file.filename(unloaded), null);
  assert.throws(() => textCommand.build!(ctx, { ...valid, font: '{"private":"do-not-display"' }), error => error instanceof Error && !error.message.includes('do-not-display'));
  assert.deepEqual(ctx.doc, before);
});
test('Text build keeps canonical validation for printable content and finite positive dimensions', async () => {
  const font = await preparedFont(), ctx = context(), valid = values(font);
  for (const text of ['', '   ', '\n', '\ud800', 'A'.repeat(257)]) assert.throws(() => textCommand.build!(ctx, { ...valid, text }));
  const patches: Values[] = [{ size: 0 }, { height: -1 }, { height: '' }, { tolerance: 0 }, { tolerance: 2 }, { tracking: Infinity }];
  for (const patch of patches) assert.throws(() => textCommand.build!(ctx, { ...valid, ...patch }));
});
test('Text edit refuses a different authored ID at the captured index', async () => {
  const font = await preparedFont(), doc = withNode(emptyDoc(), authoredNode(font)), edit = editCommand(0, doc.nodes)!;
  const changed = { ...doc, nodes: [{ ...textNode(doc), id: 'n99' }] }, ctx = context(changed);
  assert.equal(edit.available(ctx).ok, false);
  assert.throws(() => edit.build!(ctx, {}), /changed.*Select it again/);
});

test('prepared font values share the collector UTF-8 bound even with CJK metadata and padding', async () => {
  const font = { ...await preparedFont(), license: '가'.repeat(60000) }, json = JSON.stringify(font);
  const compact = values(font, 'A');
  assert.equal(textNode(textCommand.build!(context(), compact)).font.license, font.license);
  const padded = ' '.repeat(512 * 1024 - json.length) + json;
  assert.equal(padded.length, 512 * 1024);
  assert.ok(new TextEncoder().encode(padded).byteLength > 512 * 1024);
  assert.throws(() => textCommand.build!(context(), { ...compact, font: padded }), /prepared TrueType/);
});
