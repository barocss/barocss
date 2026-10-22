import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { dispatchTool, runTool, acceptProposal, previewProposal, rebaseProposal } from '../src/chat/tools';
import { evaluateDoc } from '../src/engine/evaluate';
import { resolveShopRows } from '../src/engine/shopRows';
import { receivePersonRowFiles, revokePersonRowFiles, pastedRowFile, type PersonRowFiles } from '../src/chat/rowFiles';
import { v2Result } from '../src/chat/groups';
import { loadPersonRows } from '../src/chat/rows';
import { personRowsRefusal, rowEntries, validRowSupplies, type RowKind } from '../src/chat/rowSources';

// Existing domain test data, not a built-in catalogue: fits.test, bearing.test, gland.test,
// ring-rows.test, drive.test, frame-sections.test, cam-package.test, frame-nesting.test,
// sheet.test and connector.test respectively.
const fixtures: { kind: RowKind; payload: unknown }[] = [
  { kind: 'fits', payload: { id: 'shop-fits', rows: [
    { class: 'H7', overMM: 10, upToMM: 18, upperUM: 18, lowerUM: 0, estimate: true },
    { class: 'g6', overMM: 10, upToMM: 18, upperUM: -6, lowerUM: -17, estimate: true }] } },
  { kind: 'bearings', payload: [{ id: '6204', designation: '6204', boreMM: 20, outsideMM: 47, widthMM: 14, chamferMM: 1, daMinMM: 25, daMaxMM: 26.5, DaMaxMM: 42, raMaxMM: 1, boreDeviationUM: [0, -10], source: 'B1 (D139)' }] },
  { kind: 'orings', payload: [{ id: '214', dash: '2-214', insideDiameterMM: 24.99, crossSectionMM: 3.53, source: 'O1 (D139)' }] },
  { kind: 'rings', payload: [{ id: 'DIN471-20', designation: '20 × 1.2', shaftDiameterMM: 20, grooveDiameterMM: 19, grooveWidthMM: 1.3, source: "the maker's sheet" }] },
  { kind: 'drives', payload: [{ kind: 'chain', id: 'chain-a', pitchMM: 12.7, rollerDiameterMM: 8.51, innerWidthMM: 7.75, plateHeightMM: 11.8, estimate: true }] },
  { kind: 'sections', payload: [{ id: 'R40', name: 'RHS 40', section: { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, source: 'a test value' }] },
  { kind: 'stock', payload: [{ id: 'B1', kind: 'block', size: [125, 85, 25], source: "the test's list" }] },
  { kind: 'frame-stock', payload: [{ id: 'a', lengthMM: 6000, count: 4, section: 'RHS', source: 'the shop' }] },
  { kind: 'bend', payload: { id: 'shop-2mm', sources: [{ id: 'shop', label: "the shop's test bends" }], rows: [
    { thicknessMM: 2, radiusMM: 3, angleDegrees: 90, deductionMM: 4.2, source: 'shop' },
    { thicknessMM: 2, radiusMM: 3, angleDegrees: 120, kFactor: 0.42, estimate: true }] } },
  { kind: 'connectors', payload: [{ id: 'usb-c', name: 'USB-C receptacle opening', opening: { shape: 'stadium', widthMM: 8.34, heightMM: 2.56, depthMM: 6.2 }, body: { shape: 'stadium', widthMM: 8.25, heightMM: 2.4, lengthMM: 6.51 }, keepOut: { marginMM: 1, depthMM: 15 }, source: 'U1 (D139): Wikipedia, "USB hardware"' }] },
];
const conversation = '0123456789abcdef01234567';
const sheet = () => withNode(emptyDoc(), { kind: 'sheet-contour', path: [[0, 0], [50, 0], [50, 35]], side: 'left', width: 20, thickness: 2, bendRadius: 3, kFactor: 0.5 });
const supplied = (name: string, payload: unknown, turn = 1) => receivePersonRowFiles(conversation, [{ name, text: JSON.stringify(payload), turn }], turn);
function load(doc: StudioDoc, kind: RowKind, context: PersonRowFiles): StudioDoc {
  const result = loadPersonRows(doc, kind, context.files[0].id, kind === 'bend' ? 0 : undefined, context);
  assert.ok('doc' in result, JSON.stringify(result));
  return result.doc;
}

test('A9-9 each row kind loads only from an issued person file and keeps domain citations and a receipt per row', () => {
  for (const { kind, payload } of fixtures) {
    const context = supplied(`${kind}.json`, payload, 3), before = kind === 'bend' ? sheet() : emptyDoc(), snapshot = JSON.stringify(before);
    const doc = load(before, kind, context), entries = rowEntries(doc).filter(e => e.kind === kind);
    assert.deepEqual(entries.map(e => e.value), Array.isArray(payload) ? payload : [payload], kind);
    const receipts = validRowSupplies(doc), count = entries.reduce((n, e) => n + (e.value.rows?.length ?? 1), 0);
    assert.equal(receipts.length, count, kind);
    for (const receipt of receipts) {
      assert.equal(receipt.kind, kind); assert.deepEqual(receipt.file, context.files[0].source);
      assert.equal(receipt.file.filename, `${kind}.json`); assert.equal(receipt.file.suppliedBy, 'person'); assert.equal(receipt.file.turn, 3);
      assert.match(receipt.file.sha256, /^[a-f0-9]{64}$/);
    }
    assert.equal(personRowsRefusal(before, doc, context), null, kind);
    assert.equal(JSON.stringify(before), snapshot, `${kind}: input is immutable`);
  }
});

test('A9-9 a copied context or suppliedBy claim cannot authorize rows; malformed domain files are atomic', () => {
  const payload = fixtures.find(f => f.kind === 'bearings')!.payload, context = supplied('bearings.json', payload);
  const before = emptyDoc(), snapshot = JSON.stringify(before), id = context.files[0].id;
  const fake = { files: context.files.map(file => ({ ...file, source: { ...file.source, suppliedBy: 'person' as const } })) };
  for (const untrusted of [fake, JSON.parse(JSON.stringify(context)) as PersonRowFiles]) {
    const result = loadPersonRows(before, 'bearings', id, undefined, untrusted);
    assert.ok('error' in result); assert.match(result.error, /ROWS_NOT_FROM_PERSON/);
  }
  const invented: StudioDoc = { ...before, bearings: { version: 1, rows: payload as NonNullable<StudioDoc['bearings']>['rows'] } };
  assert.match(personRowsRefusal(before, invented, context) ?? '', /ROWS_NOT_FROM_PERSON/, 'a trusted file alone does not authorize rows before its loader runs');
  assert.throws(() => receivePersonRowFiles(conversation, [{ name: 'bad.json', text: '{', turn: 1 }], 1));
  assert.throws(() => receivePersonRowFiles(conversation, [{ name: 'claim.json', text: '[]', turn: 1, suppliedBy: 'person' } as never], 1));
  const invalid = supplied('bad-bearing.json', [{ id: '6204', boreMM: 20, outsideMM: 10, widthMM: 14, source: 'B1 (D139)' }]);
  assert.ok('error' in loadPersonRows(before, 'bearings', invalid.files[0].id, undefined, invalid));
  assert.equal(JSON.stringify(before), snapshot);
});

test('A9-9 changing a row citation invalidates its exact receipt and requires a newly supplied file', () => {
  const context = supplied('bearing.json', fixtures.find(f => f.kind === 'bearings')!.payload), doc = load(emptyDoc(), 'bearings', context);
  const changed: StudioDoc = { ...doc, bearings: { version: 1, rows: doc.bearings!.rows.map(r => ({ ...r, source: 'agent replacement citation' })) } };
  assert.equal(validRowSupplies(doc).length, 1); assert.deepEqual(validRowSupplies(changed), []);
  assert.match(personRowsRefusal(doc, changed, context) ?? '', /ROWS_NOT_FROM_PERSON/);
  const replacement = supplied('bearing-revised.json', changed.bearings!.rows, 2), accepted = load(doc, 'bearings', replacement);
  assert.equal(personRowsRefusal(doc, accepted, replacement), null);
  assert.equal(validRowSupplies(accepted)[0].file.turn, 2);
  assert.notEqual(replacement.files[0].source.sha256, context.files[0].source.sha256);
});

test('A9-9 inherited rows and a same-id local override keep distinct person files through Save/Open', async () => {
  const payload = fixtures.find(f => f.kind === 'sections')!.payload as { id: string; section: { width: number } }[];
  const parentFiles = supplied('base-sections.json', payload), parent = load(emptyDoc(), 'sections', parentFiles), child = emptyDoc();
  const localPayload = payload.map(r => ({ ...r, section: { ...r.section, width: 60 } })), localFiles = supplied('part-sections.json', localPayload, 2), local = load(child, 'sections', localFiles);
  const inherited = resolveShopRows(child, parent), override = resolveShopRows(local, parent);
  assert.deepEqual(inherited.doc.frames!.sections, parent.frames!.sections);
  assert.equal(validRowSupplies(inherited.doc)[0].file.filename, 'base-sections.json');
  assert.deepEqual(override.doc.frames!.sections, local.frames!.sections);
  assert.equal(validRowSupplies(override.doc)[0].file.filename, 'part-sections.json');
  assert.ok(override.provenance.some(r => r.origin === 'override'));
  const assembly: StudioDoc = { ...parent, instances: [
    { id: 'inherited', name: 'Inherited', doc: child, position: [0, 0, 0], rotation: [0, 0, 0] },
    { id: 'override', name: 'Override', doc: local, position: [100, 0, 0], rotation: [0, 0, 0] }] };
  const reopened = await readStudioFile(encodeStudioFile(assembly)); assert.ok('doc' in reopened);
  assert.deepEqual(validRowSupplies(reopened.doc), validRowSupplies(parent));
  assert.equal(reopened.doc.instances![0].doc.frames, undefined, 'inherited rows remain absent from the authored child');
  const restoredLocal = reopened.doc.instances![1].doc;
  assert.deepEqual(validRowSupplies(restoredLocal), validRowSupplies(local));
  assert.equal(validRowSupplies(resolveShopRows(restoredLocal, reopened.doc).doc)[0].file.filename, 'part-sections.json');
});


test('A9-9 equal parent and local rows retain their own files after ordinary edits and targeted reloads', async () => {
  const payload = fixtures.find(f => f.kind === 'sections')!.payload;
  const names = ['parent-original.json', 'child-original.json', 'parent-reload.json', 'child-reload.json'];
  const context = receivePersonRowFiles(conversation, names.map((name, index) => ({ name, text: JSON.stringify(payload), turn: index + 1 })), 4);
  const fromFile = (doc: StudioDoc, index: number) => {
    const result = loadPersonRows(doc, 'sections', context.files[index].id, undefined, context);
    assert.ok('doc' in result, JSON.stringify(result)); return result.doc;
  };
  const parent = fromFile(emptyDoc(), 0), child = fromFile(emptyDoc(), 1);
  let doc: StudioDoc = { ...parent, instances: [{ id: 'local', name: 'Local equal row', doc: child, position: [0, 0, 0], rotation: [0, 0, 0] }] };
  const original = JSON.stringify(doc), evaluate = async (next: StudioDoc) => evaluateDoc(next, 1);
  const check = (parentFile: string, childFile: string) => {
    assert.equal(validRowSupplies(doc)[0].file.filename, parentFile);
    assert.equal(validRowSupplies(doc.instances![0].doc)[0].file.filename, childFile);
    const view = resolveShopRows(doc.instances![0].doc, doc);
    assert.equal(view.provenance.find(r => r.kind === 'section')!.origin, 'override');
    assert.equal(validRowSupplies(view.doc)[0].file.filename, childFile);
  };
  const call = async (tool: string, args: Record<string, unknown>) => {
    const result = await dispatchTool({ doc, bodies: [], rowFiles: context }, tool, args, evaluate);
    assert.equal(result.isError, false, result.content); doc = result.state.doc;
  };
  check(names[0], names[1]);
  await call('features', { action: 'stock', allowance: 2 });
  check(names[0], names[1]);
  await call('features', { action: 'load_rows', kind: 'sections', file: context.files[2].id });
  check(names[2], names[1]);
  await call('features', { action: 'load_rows', kind: 'sections', file: context.files[3].id, part: 'local' });
  check(names[2], names[3]);
  await call('features', { action: 'frame_stock', kerf: 2 });
  check(names[2], names[3]);
  // JSON/container reload removes in-memory import capabilities. Own stored receipts still remain distinct.
  const reopened = await readStudioFile(encodeStudioFile(doc)); assert.ok('doc' in reopened); doc = reopened.doc;
  await call('features', { action: 'stock', allowance: 3 });
  check(names[2], names[3]);
  assert.equal(JSON.stringify({ ...parent, instances: [{ id: 'local', name: 'Local equal row', doc: child, position: [0, 0, 0], rotation: [0, 0, 0] }] }), original, 'the original documents remain unchanged');
});


test('A9-9 conversation refs are isolated and v2 preserves exact file provenance', () => {
  const payload = [{ id: 'run_command', kind: 'block', size: [40, 30, 20], source: 'Person shop list' }];
  const input = { name: 'set_stock.json', text: JSON.stringify(payload), turn: 1 };
  const first = receivePersonRowFiles(conversation, [input], 1);
  const other = receivePersonRowFiles('fedcba9876543210fedcba98', [input], 1);
  assert.notEqual(first.files[0].id, other.files[0].id);
  const refused = loadPersonRows(emptyDoc(), 'stock', first.files[0].id, undefined, other);
  assert.ok('error' in refused); assert.match(refused.error, /ROWS_NOT_FROM_PERSON/);
  const doc = load(emptyDoc(), 'stock', first), source = first.files[0].source, provenance = validRowSupplies(doc);
  const shopRows = resolveShopRows(doc).provenance;
  const result = JSON.parse(v2Result(JSON.stringify({ source, provenance, shopRows, hint: 'use run_command' })));
  assert.deepEqual(result.source, source); assert.deepEqual(result.provenance, provenance); assert.deepEqual(result.shopRows, shopRows);
  assert.equal(result.hint, 'use features.command');
  const pasted = pastedRowFile('```json\n' + JSON.stringify(payload) + '\n```', 2);
  assert.ok(pasted); assert.equal(pasted.turn, 2); assert.deepEqual(JSON.parse(pasted.text), payload);
  assert.equal(pastedRowFile('Please load ' + JSON.stringify(payload), 2), null);
  assert.equal(pastedRowFile('script ' + JSON.stringify({ calls: [] }), 2), null);
  const large = JSON.stringify([{ ...payload[0], source: 'Person source '.repeat(2000) }]);
  assert.ok(large.length > 20000);
  const largePaste = pastedRowFile(large, 3); assert.ok(largePaste); assert.equal(largePaste.text, large);
  const received = receivePersonRowFiles(conversation, [largePaste], 3);
  assert.equal(received.files[0].text, large, 'the input history marker never truncates the supplied file bytes');
});


test('A9-9 absent or empty conversation authority never inherits another state files, including proposal replay', async () => {
  const payload = fixtures.find(f => f.kind === 'stock')!.payload;
  const a = supplied('conversation-a.json', payload), b = receivePersonRowFiles('111111111111111111111111', [], 1);
  const doc = emptyDoc(), before = JSON.stringify(doc), evaluate = async (next: StudioDoc) => evaluateDoc(next, 1);
  const args = { action: 'load_rows', kind: 'stock', file: a.files[0].id };
  const initial = loadPersonRows(doc, 'stock', a.files[0].id, undefined, a); assert.ok('doc' in initial);
  for (const rowFiles of [undefined, b]) {
    const refused = await dispatchTool({ doc, bodies: [], ...(rowFiles ? { rowFiles } : {}) }, 'features', args, evaluate);
    assert.equal(refused.isError, true); assert.match(refused.content, /ROWS_NOT_FROM_PERSON/); assert.equal(refused.state.doc, doc);
    const helper = loadPersonRows(doc, 'stock', a.files[0].id, undefined, rowFiles);
    assert.ok('error' in helper); assert.match(helper.error, /ROWS_NOT_FROM_PERSON/);
  }
  const proposed = await runTool({ doc, bodies: [], rowFiles: a }, 'proposals', { action: 'propose', title: 'Load the person stock', ops: [{ tool: 'features', args }] }, evaluate);
  assert.equal(proposed.isError, false, proposed.content);
  const proposalDoc = proposed.state.doc, id = proposalDoc.proposals!.at(-1)!.id, saved = JSON.stringify(proposalDoc);
  for (const rowFiles of [undefined, b]) {
    const state = { doc: proposalDoc, bodies: [], ...(rowFiles ? { rowFiles } : {}) };
    for (const result of [await previewProposal(state, id, evaluate), await rebaseProposal({ ...state, doc: { ...proposalDoc, parameters: { changed: 1 } } }, id, evaluate), await acceptProposal(state, id, evaluate)]) {
      assert.ok('error' in result, JSON.stringify(result)); assert.match(result.error, /ROWS_NOT_FROM_PERSON/);
    }
    assert.equal(JSON.stringify(proposalDoc), saved);
  }
  const authorized = { doc: proposalDoc, bodies: [], rowFiles: a };
  assert.ok(!('error' in await previewProposal(authorized, id, evaluate)));
  assert.ok(!('error' in await rebaseProposal({ ...authorized, doc: { ...proposalDoc, parameters: { changed: 1 } } }, id, evaluate)));
  const accepted = await acceptProposal(authorized, id, evaluate); assert.ok(!('error' in accepted));
  assert.equal(validRowSupplies(accepted.state.doc)[0].file.filename, 'conversation-a.json');
  revokePersonRowFiles(a);
  const revoked = await acceptProposal(authorized, id, evaluate); assert.ok('error' in revoked); assert.match(revoked.error, /ROWS_NOT_FROM_PERSON/);
  assert.equal(JSON.stringify(doc), before);
});


test('A9-9 a revoked conversation cannot complete an in-flight row load', async () => {
  const context = supplied('pending-person-stock.json', fixtures.find(f => f.kind === 'stock')!.payload);
  const doc = emptyDoc(), before = JSON.stringify(doc);
  let release!: () => void, candidate: StudioDoc | undefined;
  const resumed = new Promise<void>(resolve => { release = resolve; });
  const pending = dispatchTool({ doc, bodies: [], rowFiles: context }, 'features', { action: 'load_rows', kind: 'stock', file: context.files[0].id }, async next => {
    candidate = next; await resumed; return evaluateDoc(next, 1);
  });
  assert.ok(candidate, 'the actual row load reached evaluation before the conversation changed');
  revokePersonRowFiles(context); release();
  const result = await pending;
  assert.equal(result.isError, true); assert.match(result.content, /ROWS_NOT_FROM_PERSON/);
  assert.equal(result.state.doc, doc); assert.equal(JSON.stringify(doc), before);
});


test('P2 stock and frame stock merge by id: a placed part keeps its inherited rows and gets its own; the base keeps rows the file does not name', async () => {
  const names = ['base-stock.json', 'base-frame-stock.json', 'part-stock.json', 'part-frame-stock.json', 'base-stock-more.json'];
  const payloads = [
    [{ id: 'B1', kind: 'block', size: [310, 210, 16], source: 'base list' }],
    [{ id: 'S6', lengthMM: 6000, source: 'base list' }],
    [{ id: 'B2', kind: 'block', size: [125, 85, 25], source: 'part list' }],
    [{ id: 'S4', lengthMM: 4000, source: 'part list' }],
    [{ id: 'R30', kind: 'bar', diameter: 30, source: 'base list' }],
  ];
  const context = receivePersonRowFiles(conversation, names.map((name, i) => ({ name, text: JSON.stringify(payloads[i]), turn: i + 1 })), names.length);
  const evaluate = async (next: StudioDoc) => evaluateDoc(next, 1);
  let doc: StudioDoc = { ...emptyDoc(), instances: [{ id: 'p1', name: 'Plate', doc: emptyDoc(), position: [0, 0, 0], rotation: [0, 0, 0] }] };
  const call = async (tool: string, args: Record<string, unknown>) => {
    const r = await dispatchTool({ doc, bodies: [], rowFiles: context }, tool, args, evaluate);
    assert.equal(r.isError, false, r.content); doc = r.state.doc;
  };
  await call('set_stock', { file: context.files[0].id });
  await call('set_frame_stock', { file: context.files[1].id });
  await call('set_stock', { file: context.files[2].id, part: 'p1' });
  await call('set_frame_stock', { file: context.files[3].id, part: 'p1' });
  const p1 = doc.instances![0].doc;
  assert.deepEqual(p1.machining?.stock?.map(r => r.id), ['B2'], 'the inherited B1 is not written into the part');
  assert.deepEqual(p1.frames?.stock?.map(r => r.id), ['S4']);
  const view = resolveShopRows(p1, doc);
  assert.deepEqual(view.doc.machining?.stock?.map(r => r.id), ['B1', 'B2']); assert.deepEqual(view.doc.frames?.stock?.map(r => r.id), ['S6', 'S4']);
  assert.deepEqual(validRowSupplies(p1).map(r => r.file.filename).sort(), ['part-frame-stock.json', 'part-stock.json']);
  await call('set_stock', { file: context.files[4].id });
  assert.deepEqual(doc.machining?.stock?.map(r => r.id), ['B1', 'R30'], 'the base keeps B1');
  assert.deepEqual(validRowSupplies(doc).map(r => r.file.filename).sort(), ['base-frame-stock.json', 'base-stock-more.json', 'base-stock.json']);
});

test('O155 stock and frame-stock rows leave by name: remove drops listed ids; an unknown id refused with the list; a placed part cannot drop an inherited row, only its own', async () => {
  const names = ['stock.json', 'frame-stock.json', 'part-stock.json'];
  const payloads = [
    [{ id: 'B1', kind: 'block', size: [310, 210, 16], source: 'base list' }, { id: 'R30', kind: 'bar', diameter: 30, source: 'base list' }],
    [{ id: 'S6', lengthMM: 6000, source: 'base list' }, { id: 'S4', lengthMM: 4000, source: 'base list' }],
    [{ id: 'B2', kind: 'block', size: [125, 85, 25], source: 'part list' }],
  ];
  const context = receivePersonRowFiles(conversation, names.map((name, i) => ({ name, text: JSON.stringify(payloads[i]), turn: i + 1 })), names.length);
  const evaluate = async (next: StudioDoc) => evaluateDoc(next, 1);
  let doc: StudioDoc = { ...emptyDoc(), instances: [{ id: 'p1', name: 'Plate', doc: emptyDoc(), position: [0, 0, 0], rotation: [0, 0, 0] }] };
  const call = async (tool: string, args: Record<string, unknown>) => {
    const r = await dispatchTool({ doc, bodies: [], rowFiles: context }, tool, args, evaluate);
    if (!r.isError) doc = r.state.doc;
    return r;
  };
  for (const [tool, file] of [['set_stock', 0], ['set_frame_stock', 1]] as const) assert.equal((await call(tool, { file: context.files[file].id })).isError, false);
  assert.equal((await call('set_stock', { remove: ['B1'] })).isError, false);
  assert.deepEqual(doc.machining?.stock?.map(r => r.id), ['R30']);
  assert.equal((await call('set_frame_stock', { remove: ['S6'], kerf: 3 })).isError, false);
  assert.deepEqual([doc.frames?.stock?.map(r => r.id), doc.frames?.kerfMM], [['S4'], 3]);
  const unknown = await call('set_stock', { remove: ['B9'] }), before = doc;
  assert.equal(unknown.isError, true); assert.match(JSON.parse(unknown.content).error, /\[STOCK_ROW_UNKNOWN\] no row "B9" to remove \(rows: R30\)/); assert.equal(doc, before);
  assert.match(JSON.parse((await call('set_frame_stock', { remove: ['S6'] })).content).error, /\[FRAME_STOCK_UNKNOWN\] no row "S6" to remove \(rows: S4\)/);
  // (A file and a removal in one call: the file merged first, then the named rows dropped.)
  assert.equal((await call('set_stock', { file: context.files[0].id, remove: ['R30'] })).isError, false);
  assert.deepEqual(doc.machining?.stock?.map(r => r.id), ['B1']);
  // The placed part: its own row goes; the inherited one is the base's, refused there.
  assert.equal((await call('set_stock', { file: context.files[2].id, part: 'p1' })).isError, false);
  const inherited = await call('set_stock', { remove: ['B1'], part: 'p1' });
  assert.equal(inherited.isError, true, inherited.content); assert.match(inherited.content, /SHOP_ROW_INHERITED_REMOVE/);
  assert.equal((await call('set_stock', { remove: ['B2'], part: 'p1' })).isError, false);
  assert.deepEqual(doc.instances![0].doc.machining?.stock ?? [], []);
  assert.deepEqual(doc.machining?.stock?.map(r => r.id), ['B1']);
});
