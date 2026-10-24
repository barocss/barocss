import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { resolveShopRows, resolveShopTree, provenanceOfTree, authoredShopDocument, flattenShopView, restoreAuthoredShopRows } from '../src/engine/shopRows';
import { evaluatePart } from '../src/engine/evaluate';
import { evaluationKey, contentKey } from '../src/engine/evalMemo';
import { WireSender, WireReceiver } from '../src/engine/wireDoc';

test('shop rows inherit by id, retain row references and local settings, and never change authored input', () => {
  const inherited = { id: 'shared', kind: 'block' as const, size: [100, 80, 20] as [number, number, number], source: 'shop A' };
  const local = { ...inherited, size: [120, 90, 30] as [number, number, number], source: 'shop B' };
  const parent: StudioDoc = { ...emptyDoc(), machining: { version: 1, stock: [inherited], allowance: 9 }, frames: { version: 1, kerf: 7, beadOwnership: { version: 1, policy: 'equal-length' } } };
  const child: StudioDoc = { ...emptyDoc(), machining: { version: 1, stock: [local], allowance: 2 } };
  const before = JSON.stringify({ parent, child });
  const view = resolveShopRows(child, parent);
  assert.equal(view.doc.machining?.stock?.[0], local);
  assert.equal(view.doc.machining?.allowance, 2);
  assert.equal(view.doc.frames, undefined);
  assert.deepEqual(view.provenance, [{ kind: 'machining-stock', id: 'shared', origin: 'override', fileSourceStatus: 'not-recorded' }]);
  assert.equal(resolveShopRows(child, parent), view);
  assert.equal(JSON.stringify({ parent, child }), before);
  const plain = emptyDoc(), inheritedView = resolveShopRows(plain, parent);
  assert.equal(inheritedView.doc.machining?.stock?.[0], inherited);
  assert.equal(inheritedView.doc.machining?.allowance, undefined);
  assert.equal(plain.machining, undefined);
});

test('parent section changes reach child wire evaluation and cache keys without authored copies', () => {
  const child = emptyDoc();
  const parent: StudioDoc = { ...emptyDoc(), frames: { version: 1, sections: [{ id: 'tube', source: 'shop', section: { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 } }] }, instances: [{ id: 'part', name: 'part', doc: child, position: [0, 0, 0], rotation: [0, 0, 0] }] };
  const first = resolveShopTree(parent);
  const secondParent: StudioDoc = { ...parent, frames: { version: 1, sections: [{ ...parent.frames!.sections![0], section: { kind: 'rect-tube', width: 50, height: 40, wall: 3, outerRadius: 0 } }] } };
  const second = resolveShopTree(secondParent);
  assert.notEqual(evaluationKey(first), evaluationKey(second));
  assert.notEqual(contentKey(first.instances![0].doc), contentKey(second.instances![0].doc));
  const sender = new WireSender(), receiver = new WireReceiver();
  const wire = receiver.unpack(sender.pack(parent));
  assert.deepEqual(wire.instances![0].doc.frames?.sections, parent.frames?.sections);
  assert.equal(child.frames, undefined);
});


test('derived trees are idempotent and retain inherited origins and authored targets', () => {
  const child = emptyDoc(), parent: StudioDoc = { ...emptyDoc(), machining: { version: 1, stock: [{ id: 's', kind: 'bar', diameter: 30, source: 'shop' }] }, instances: [{ id: 'p', name: 'P', doc: child, position: [0, 0, 0], rotation: [0, 0, 0] }] };
  const resolved = resolveShopTree(parent);
  assert.equal(resolveShopTree(resolved), resolved);
  assert.equal(authoredShopDocument(resolved), parent);
  assert.equal(authoredShopDocument(resolved.instances![0].doc), child);
  assert.deepEqual(provenanceOfTree(resolved)[1].rows, [{ kind: 'machining-stock', id: 's', origin: 'inherited', fileSourceStatus: 'not-recorded' }]);
});

test('flatten view inlines each part section without confusing equal row ids', () => {
  const row = (width: number) => ({ id: 's', source: 'shop', section: { kind: 'rect-tube' as const, width, height: 40, wall: 3, outerRadius: 0 } });
  const child: StudioDoc = { ...emptyDoc(), frames: { version: 1, sections: [row(50)] }, nodes: [{ kind: 'frame-member', section: { kind: 'library', id: 's' }, start: [0, 0, 0], end: [100, 0, 0] }] };
  const parent: StudioDoc = { ...emptyDoc(), frames: { version: 1, sections: [row(40)] }, instances: [{ id: 'p', name: 'P', doc: child, position: [0, 0, 0], rotation: [0, 0, 0] }] };
  const flat = flattenShopView(resolveShopTree(parent));
  const node = flat.instances![0].doc.nodes[0];
  assert.equal(node.kind === 'frame-member' && node.section.kind === 'rect-tube' ? node.section.width : null, 50);
  assert.deepEqual(child.nodes[0], { kind: 'frame-member', section: { kind: 'library', id: 's' }, start: [0, 0, 0], end: [100, 0, 0] });
});


test('mutations persist local row edits only and refuse removal of inherited rows', () => {
  const child = emptyDoc(), parent: StudioDoc = { ...emptyDoc(), machining: { version: 1, stock: [{ id: 's', kind: 'bar', diameter: 30, source: 'shop' }] } };
  const view = resolveShopRows(child, parent).doc;
  const unrelated = restoreAuthoredShopRows({ ...view, process: 'cnc-turning' }, view);
  assert.ok('doc' in unrelated);
  if ('doc' in unrelated) { assert.equal(unrelated.doc.machining, undefined); assert.equal(unrelated.doc.process, 'cnc-turning'); }
  const override = { ...parent.machining!.stock![0], source: 'local' };
  const edited = restoreAuthoredShopRows({ ...view, machining: { version: 1, stock: [override], allowance: 2 } }, view);
  assert.ok('doc' in edited);
  if ('doc' in edited) { assert.equal(edited.doc.machining?.stock?.[0], override); assert.equal(edited.doc.machining?.allowance, 2); }
  const removed = restoreAuthoredShopRows({ ...view, machining: { version: 1, stock: [] } }, view);
  assert.ok('error' in removed && removed.error.includes('[SHOP_ROW_INHERITED_REMOVE]'));
});

test('empty inherited context preserves legacy document and instance identity', () => {
  const child = emptyDoc();
  const parent: StudioDoc = { ...emptyDoc(), instances: [{ id: 'p', name: 'P', doc: child, position: [0, 0, 0], rotation: [0, 0, 0] }] };
  assert.equal(resolveShopRows(child, parent).doc, child);
  assert.equal(resolveShopTree(parent), parent);
  assert.equal(resolveShopTree(parent).instances, parent.instances);
  assert.equal(resolveShopTree(parent).instances![0].doc, child);
});

test('nested flatten refuses a referenced distinct bearing row but accepts unused local rows', () => {
  const row = { id: '6204', designation: '6204', boreMM: 20, outsideMM: 47, widthMM: 14, chamferMM: 1, daMinMM: 25, daMaxMM: 26.5, DaMaxMM: 42, raMaxMM: 1, boreDeviationUM: [0, -10] as [number, number], source: 'shop' };
  const child: StudioDoc = { ...emptyDoc(), bearings: { version: 1, rows: [row] } };
  const parent: StudioDoc = { ...emptyDoc(), instances: [{ id: 'p', name: 'P', doc: child, position: [0, 0, 0], rotation: [0, 0, 0] }] };
  assert.doesNotThrow(() => flattenShopView(resolveShopTree(parent)));
  const referenced = { ...parent, instances: [{ ...parent.instances![0], doc: { ...child, nodes: [{ kind: 'bearing' as const, row: '6204', shaft: 0, step: 0, against: 'start' as const }] } }] };
  assert.throws(() => flattenShopView(resolveShopTree(referenced)), /\[SHOP_ROWS_FLATTEN_SCOPE\]/);
});


test('wire and evaluation results retain inherited and override origins across parent changes', () => {
  const inherited = { id: '6204', designation: '6204', boreMM: 20, outsideMM: 47, widthMM: 14, chamferMM: 1, daMinMM: 25, daMaxMM: 26.5, DaMaxMM: 42, raMaxMM: 1, boreDeviationUM: [0, -10] as [number, number], source: 'shop' };
  const child: StudioDoc = { ...emptyDoc(), bearings: { version: 1, rows: [{ ...inherited, id: 'own' }] } };
  const parent: StudioDoc = { ...emptyDoc(), bearings: { version: 1, rows: [inherited, { ...inherited, id: 'own', source: 'parent' }] }, instances: [{ id: 'p', name: 'P', doc: child, position: [0, 0, 0], rotation: [0, 0, 0] }] };
  const sender = new WireSender(), receiver = new WireReceiver();
  const first = receiver.unpack(sender.pack(parent));
  assert.deepEqual(provenanceOfTree(first), provenanceOfTree(parent));
  assert.deepEqual(provenanceOfTree(first.instances![0].doc), [{ part: 'base', rows: [{ kind: 'bearing', id: '6204', origin: 'inherited', fileSourceStatus: 'not-recorded' }, { kind: 'bearing', id: 'own', origin: 'override', fileSourceStatus: 'not-recorded' }] }]);
  const result = evaluatePart(first.instances![0].doc, 1);
  assert.ok(result.ok);
  if (result.ok) assert.deepEqual(result.shopRows, provenanceOfTree(first.instances![0].doc));
  const changed: StudioDoc = { ...parent, bearings: { version: 1, rows: [{ ...inherited, widthMM: 15 }] } };
  const second = receiver.unpack(sender.pack(changed));
  assert.equal(second.instances![0].doc.bearings?.rows.find(r => r.id === '6204')?.widthMM, 15);
  assert.deepEqual(provenanceOfTree(second), provenanceOfTree(changed));
  assert.notEqual(evaluationKey(first), evaluationKey(second));
  assert.equal('shopRows' in first, false);
});


test('a full local override retains context origins without changing rows or confusing a later parent', () => {
  const row = (source: string) => ({ id: 's', kind: 'block' as const, size: [40, 30, 20] as [number, number, number], source });
  const local = row('local'), child: StudioDoc = { ...emptyDoc(), machining: { version: 1, stock: [local] } };
  const parent: StudioDoc = { ...emptyDoc(), machining: { version: 1, stock: [row('parent')] } };
  const view = resolveShopRows(child, parent);
  assert.equal(view.doc.machining?.stock?.[0], local);
  assert.equal(provenanceOfTree(view.doc)[0].rows[0].origin, 'override');
  assert.equal(resolveShopRows(view.doc, parent), view);
  const plain = emptyDoc(), inherited = resolveShopRows(plain, parent);
  const changedParent: StudioDoc = { ...parent, machining: { version: 1, stock: [row('changed')] } };
  const changed = resolveShopRows(inherited.doc, changedParent);
  assert.equal(changed.provenance[0].origin, 'inherited');
  assert.equal(changed.doc.machining?.stock?.[0].source, 'changed');
  assert.equal(plain.machining, undefined);
});
