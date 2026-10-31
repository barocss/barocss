import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server.edge';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, placedBase, rectanglePart, type PartInstance, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { lookKey } from '@barocss/cad-model/app/bodies';
import { heldLooks, setInstanceLook } from '@barocss/cad-model/assembly/looks';
import { InstancePanel } from '../src/ui/InstancePanel';
import { InstanceLooksControls, sourceText } from '../src/ui/InstanceLooks';
import { bodyLooksOf, faceColorsOfMesh, lookKeyOf, renderLookOf, renderLooksOf } from '../src/viewport/instanceLook';
import { instanceLookRows } from '../src/state/useInstanceLooks';

// Roadmap 10 ① (#2233): the placed parts' looks on screen and in the Instance panel. The colour mapping the two viewers share is
// pure and tested here; the rows the panel lists come from where each placed body comes from; each field says whose it is.
const PIN = rectanglePart(10, 10, 20), KEY = lookKey(PIN.nodes, (() => { const r = evaluatePart(PIN, 1); assert.ok(r.ok); return r.bodies[0]; })());
const defined: StudioDoc = { ...PIN, bodies: { [KEY]: { color: '#112233', material: 'steel', faces: { 'n1.top': '#aa0000' } } } };
const placed = (doc: StudioDoc, id = 'p1'): PartInstance => ({ id, name: 'Pin', doc, position: [10, 0, 0], rotation: [0, 0, 0] });
const bodiesOf = (i: PartInstance) => { const r = evaluatePart(placedBase(i), 1); assert.ok(r.ok); return r.bodies; };
const near = (a: readonly number[], b: readonly number[]) => a.forEach((v, k) => assert.ok(Math.abs(v - b[k]) < 1e-9, `${a} vs ${b}`));

test('renderLookOf maps hex colours to 0..1 RGB, face names to colours, and drops a look that changes nothing', () => {
  const look = renderLookOf({ color: '#ff8000', faces: { 'n1.top': '#0000ff' }, hidden: true })!;
  near(look.color!, [1, 128 / 255, 0]); near(look.faces!.get('n1.top')!, [0, 0, 1]); assert.equal(look.hidden, true);
  assert.equal(renderLookOf({}), null); assert.equal(renderLookOf({ hidden: false }), null); assert.equal(renderLookOf({ faces: {} }), null);
  assert.deepEqual(Object.keys(renderLookOf({ color: '#000000' })!), ['color']);
});

test('renderLooksOf keys the looks by body key (bodies with none have no entry); bodyLooksOf lines them up with the bodies', () => {
  const bodies = [{ key: 'b1' }, { key: 'b3' }, { key: 'b5' }], looks = renderLooksOf([{ color: '#112233' }, {}, { hidden: true }], bodies)!;
  assert.deepEqual([...looks.keys()], ['b1', 'b5']);
  const per = bodyLooksOf(bodies, looks);
  assert.deepEqual(per.map(l => !!l), [true, false, true]); assert.equal(per[2]!.hidden, true);
  assert.equal(renderLooksOf([{}, {}], bodies), undefined); assert.deepEqual(bodyLooksOf(bodies, undefined), [undefined, undefined, undefined]);
});

test('faceColorsOfMesh finds a face colour by face name for each face index; lookKeyOf tells equal looks apart from changed ones', () => {
  const mesh = { faces: [{ index: 0, name: 'n1.top' }, { index: 1, name: 'n1.bottom' }, { index: 2, name: 'n1.top' }] } as never;
  const look = renderLookOf({ faces: { 'n1.top': '#00ff00' } })!, colours = faceColorsOfMesh(look, mesh)!;
  assert.deepEqual([...colours.keys()], [0, 2]); near(colours.get(2)!, [0, 1, 0]);
  assert.equal(faceColorsOfMesh(renderLookOf({ color: '#ffffff' })!, mesh), null); assert.equal(faceColorsOfMesh(undefined, mesh), null);
  assert.equal(faceColorsOfMesh(renderLookOf({ faces: { zz: '#00ff00' } })!, mesh), null);
  assert.equal(lookKeyOf(renderLookOf({ color: '#112233' })!), lookKeyOf(renderLookOf({ color: '#112233' })!));
  assert.notEqual(lookKeyOf(renderLookOf({ color: '#112233' })!), lookKeyOf(renderLookOf({ color: '#112234' })!));
  assert.notEqual(lookKeyOf(renderLookOf({ color: '#112233' })!), lookKeyOf(renderLookOf({ color: '#112233', hidden: true })!));
  assert.equal(lookKeyOf(undefined), '');
});

test('the rows of a placed part: one per body, named, its look as this occurrence has it, a key once', () => {
  const doc = setInstanceLook({ ...emptyDoc(), instances: [placed(defined)] }, { part: 'p1', body: KEY, patch: { color: '#00ff00' } }).doc, inst = doc.instances![0];
  const rows = instanceLookRows(inst, { bodies: bodiesOf(inst) }, doc);
  assert.deepEqual(rows.map(r => [r.key, r.look.color, r.look.from.color, r.look.material, r.look.from.material]), [[KEY, '#00ff00', 'occurrence', 'steel', 'definition']]);
  assert.ok(rows[0].name.length > 0);
  assert.deepEqual(instanceLookRows(inst, undefined, doc), []);
});

test('a sub-assembly occurrence lists its nested parts\' bodies by path', () => {
  const doc = JSON.parse(readFileSync(join(process.cwd(), 'test/fixtures/nested-mate.bcad'), 'utf8')) as StudioDoc, sub = doc.instances!.find(i => i.id === 'sub1')!;
  const rows = instanceLookRows(sub, { bodies: bodiesOf(sub) }, doc);
  assert.equal(rows.length, 2); assert.ok(rows.every(r => /^p[12]\/b\d+$/.test(r.key)), rows.map(r => r.key).join());
});

const html = (props: Partial<Parameters<typeof InstanceLooksControls>[0]> = {}) => renderToStaticMarkup(createElement(InstanceLooksControls, { rows: [], onSet() {}, onReset() {}, ...props }));
const row = (from: { color?: 'definition' | 'occurrence'; material?: 'definition' | 'occurrence' }, extra = {}) => ({ key: KEY, name: 'Box', look: { color: '#112233', material: 'steel', from, ...extra } });

test('the default view is a Colour row and a Material row with no provenance text; an overridden field shows only a marker and a Reset', () => {
  const shown = html({ rows: [row({ color: 'occurrence', material: 'definition' })] });
  assert.match(shown, /APPEARANCE \(THIS OCCURRENCE\)/); assert.match(shown, /aria-label="Appearance \(this occurrence\)"/);
  assert.match(shown, /aria-label="Material"/); assert.match(shown, /aria-label="Colour #d9534f"/); assert.match(shown, /<option value="steel" selected/);
  // No provenance text, no Visible, no face colours in the default view.
  assert.doesNotMatch(shown, /from the definition|this occurrence<|Visible|Face /);
  // The colour is the occurrence's: a marker and a Reset; the material is inherited: nothing.
  assert.equal((shown.match(/data-overridden="true"/g) ?? []).length, 1);
  assert.match(shown, /aria-label="colour: this occurrence; Reset"/); assert.match(shown, /aria-label="Reset colour to the definition"/);
  assert.doesNotMatch(shown, /Reset material/);
  assert.equal(html({ rows: [row({})] }).includes('data-overridden'), false, 'nothing overridden: no marker');
  // The select stays inside the panel (it shrinks and truncates rather than push past its right edge).
  assert.match(shown, /<select aria-label="Material" class="[^"]*min-w-0 truncate"/);
  // Details is a disclosure, closed by default.
  assert.match(shown, /aria-expanded="false"/); assert.match(shown, /Details/);
  assert.equal(sourceText('occurrence'), 'this occurrence'); assert.equal(sourceText(undefined), 'from the definition');
  // Several bodies: each named, its controls labelled by it.
  const several = html({ rows: [row({}), { ...row({}), key: 'p2/b1', name: 'Block B' }] });
  assert.match(several, /Block B/); assert.match(several, /aria-label="Block B Material"/);
});

test('Details holds Visible, face colours with their source and the per-field source text, and the held problems', () => {
  const faced = html({ detailsOpen: true, rows: [row({ color: 'occurrence' }, { faces: { 'n1.top': '#aa0000' }, from: { color: 'occurrence', faces: { 'n1.top': 'occurrence' } } })], held: ['The look set on Pin (p1) for body b3 is held: this revision of Pin has no body b3.'] });
  assert.match(faced, /aria-expanded="true"/); assert.match(faced, /Details · 1 held/);
  assert.match(faced, /aria-label="Visible"/); assert.match(faced, /Face n1\.top/); assert.match(faced, /aria-label="Reset face n1\.top to the definition"/);
  assert.match(faced, /Colour: this occurrence · Material: from the definition · Visible: from the definition/);
  assert.match(faced, /role="alert">The look set on Pin \(p1\) for body b3 is held/);
  const driven = html({ readOnly: true, rows: [row({ color: 'occurrence' })] });
  assert.match(driven, /Placed by its pattern: set the look on the seed/); assert.doesNotMatch(driven, /Reset colour/); assert.match(driven, /disabled/);
  assert.equal(html(), '');
});

test('the held list is the model\'s: a vanished body\'s override named in plain words', () => {
  const two = (() => { const a = rectanglePart(10, 10, 20); return { ...a, nodes: [...a.nodes, { kind: 'sketch', profile: 'rectangle', min: [30, 0], max: [40, 10] }, { kind: 'extrude', sketch: 2, height: 5 }] } as StudioDoc; })();
  const doc = setInstanceLook({ ...emptyDoc(), instances: [placed(two)] }, { part: 'p1', body: 'b3', patch: { color: '#00ff00' } }).doc;
  const next: StudioDoc = { ...doc, instances: doc.instances!.map(i => ({ ...i, doc: { ...two, nodes: two.nodes.slice(0, 2) } })) };
  const held = heldLooks(next);
  assert.equal(held.length, 1); assert.match(html({ detailsOpen: true, held: held.map(h => h.problem) }), /body b3 is held: this revision of Pin has no body b3/);
});

test('InstancePanel places the appearance section after the joints and before the placement boxes', () => {
  const inst = placed(defined), shown = renderToStaticMarkup(createElement(InstancePanel, { inst, bodies: undefined, onChange() {}, onDuplicate() {}, onRemove() {}, looks: createElement('div', { id: 'looks-here' }) }));
  assert.ok(shown.indexOf('looks-here') > 0 && shown.indexOf('looks-here') < shown.indexOf('POSITION'));
});
