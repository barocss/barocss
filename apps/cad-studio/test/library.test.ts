import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, type ModelNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { checkFits, insertLibraryPart, libraries, libraryById, libraryInstance, regenerateLibraryNode, registerLibrary, snapByInterfaces, unregisterLibrary } from '@barocss/cad-model/library/libraries';
import { readStudioDoc } from '@barocss/cad-model/engine/migrate';
import { solveDoc } from '@barocss/cad-model/chat/assembly';
import { BASE } from '@barocss/cad-model/assembly/mates';

// LIB2–LIB3 (D62–D63): the built-in T-slot 20 series; its fits; library parts inserted as features kept with the
// document; regenerated from the library; snapped onto each other by interfaces with real mates.
type LibraryNode = Extract<ModelNode, { kind: 'library' }>;
const bodiesOf = (doc: StudioDoc) => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : `${r.error.title} ${r.error.hint}`); return r.ok ? r.bodies : []; };

test('the built-in T-slot 20 series: loaded; every part builds valid in each variant; its declared fits — a nut in a 20×20 and a 20×40 slot, a cap on the end, a bracket on a face — touch without overlapping', () => {
  assert.ok(libraries().some(e => e.library.manifest.id === 'tslot-20' && e.source === 'built-in'));
  const lib = libraryById('tslot-20')!;
  assert.deepEqual([...lib.parts.keys()], ['profile', 'slot-nut-m5', 'end-cap', 'angle-bracket']);
  for (const [part, variant, slots] of [['profile', '2020', 4], ['profile', '2020', 1], ['profile', '2040', 6], ['slot-nut-m5'], ['end-cap'], ['angle-bracket']] as [string, string?, number?][]) {
    const doc = insertLibraryPart(emptyDoc(), 'tslot-20', part, { ...(variant ? { variant } : {}), ...(variant === '2020' && slots === 1 ? { params: { openSlots: 1 } } : {}) });
    const [b] = bodiesOf(doc);
    assert.ok(b.volumeMM3! > 0, part);
    const node = doc.nodes[0] as LibraryNode;
    if (part === 'profile') assert.equal(node.interfaces.filter(i => i.role === 't-slot').length, slots, `${variant} slots`);
    assert.ok(node.warnings.some(w => /is an estimate/.test(w)), 'estimates said');
  }
  for (const r of checkFits(lib)) { assert.equal(r.ok, true, `${r.id}: overlap ${r.overlapMM3}, contact ${r.contact}`); assert.equal(r.overlapMM3, 0); assert.equal(r.contact, true); }
});

test('LIB3: a library part kept with the document — saved and reopened without the library it evaluates the same; with it, a newer version regenerates it (values given kept, the rest the library\'s); estimates on the body', () => {
  const doc = insertLibraryPart(emptyDoc(), 'tslot-20', 'profile', { variant: '2020', params: { L: 250 } });
  const node = doc.nodes[0] as LibraryNode, before = bodiesOf(doc)[0];
  assert.deepEqual([node.library.library, node.library.version, node.library.part, node.library.variant, node.library.params], ['tslot-20', '0.1.0', 'profile', '2020', { L: 250 }]);
  assert.equal(node.name, 'T-slot profile 20 20×20');
  assert.ok(before.notes!.some(n => /^From tslot-20 0\.1\.0: profile \(2020\)$/.test(n.text)) && before.notes!.some(n => n.warning && /wo = 6\.2 mm is an estimate/.test(n.text)) && before.notes!.some(n => /not for structural calculation/.test(n.text)));
  // Saved and opened again where the library is not there (its id unknown here): the same body, nothing regenerated.
  const saved = JSON.stringify(doc).replaceAll('"library":"tslot-20"', '"library":"not-installed"');
  const read = readStudioDoc(saved);
  assert.ok('doc' in read, JSON.stringify(read));
  const reopened = (read as { doc: StudioDoc }).doc;
  assert.equal((reopened.nodes[0] as LibraryNode).library.library, 'not-installed');
  const after = bodiesOf(reopened)[0];
  assert.ok(Math.abs(after.volumeMM3! - before.volumeMM3!) < 1e-9 && after.mesh.faces.length === before.mesh.faces.length);
  assert.equal(regenerateLibraryNode(reopened.nodes[0] as LibraryNode), null, 'no library: kept as it is');
  // A newer version of the library: the slot opening 6.0 instead of 6.2 — regenerated, L still 250.
  const v2 = JSON.parse(JSON.stringify(libraryById('tslot-20')!.manifest));
  v2.id = 'tslot-20-test'; v2.libraryVersion = '0.2.0'; v2.parts[0].parameters.wo.value = 6.0;
  registerLibrary(v2, 'user');
  try {
    const mine = insertLibraryPart(emptyDoc(), 'tslot-20', 'profile', { variant: '2020', params: { L: 250 } }), n0 = mine.nodes[0] as LibraryNode;
    const moved = { ...n0, library: { ...n0.library, library: 'tslot-20-test' } } as LibraryNode;
    const re = regenerateLibraryNode(moved)!;
    assert.equal(re.library.version, '0.2.0'); assert.deepEqual(re.library.params, { L: 250 }); assert.equal(re.library.values.wo, 6.0); assert.equal(re.prefix, n0.prefix);
    // (Each slot's section: the opening 2ho × tl, the 45° taper (2hu + 2ho)/2 × (hu − ho), the channel 2ho × (ds − dt);
    // ho 3.1 → 3.0 takes 43.58 → 42.85 mm², four slots over 250 mm.)
    const slotArea = (ho: number) => { const hu = 5.5, tl = 1.8, ds = 6.1, dt = tl + hu - ho; return 2 * ho * tl + (hu + ho) * (hu - ho) + 2 * ho * (ds - dt); };
    const v = bodiesOf({ ...mine, nodes: [re] })[0].volumeMM3!;
    assert.ok(Math.abs(v - before.volumeMM3! - 4 * (slotArea(3.1) - slotArea(3.0)) * 250) < 1e-6, String(v - before.volumeMM3!));
    // Its face names hold (same prefix, same recipe): a mate on them would survive.
    assert.ok(re.interfaces.find(i => i.id === 'slot-t1')!.faces!.plane === n0.interfaces.find(i => i.id === 'slot-t1')!.faces!.plane);
  } finally { unregisterLibrary('tslot-20-test'); }
});

test('LIB2: a slot nut snapped into a profile\'s slot by their interfaces — placed exactly (its top under the lips, 30 mm along), held by a real coincident mate the solver keeps; the profile moved, the nut follows; refusals', () => {
  let doc: StudioDoc = emptyDoc();
  ({ doc } = libraryInstance(doc, 'tslot-20', 'profile', { variant: '2020', params: { L: 120 }, name: 'Rail' }));
  ({ doc } = libraryInstance(doc, 'tslot-20', 'slot-nut-m5', { name: 'Nut', position: [50, 50, 50] }));
  const r = snapByInterfaces(doc, { part: 'p1', interface: 'slot-t1' }, { part: 'p2', interface: 'seat' }, [30, 0, 0]);
  assert.ok(!('error' in r), JSON.stringify(r));
  const snapped = (r as { doc: StudioDoc }).doc, mates = (r as { mates: { kind: string; a: { face: string }; b: { face: string } }[] }).mates;
  assert.deepEqual(mates.map(m => [m.kind, m.a.face, m.b.face]), [['coincident', 'lib1_t1x.side1', 'lib1_n.side5']]);
  const nut = snapped.instances!.find(i => i.id === 'p2')!;
  // (The nut's top centre at the lip underside, 10 − 1.8 = 8.2 up, 30 along the rail: its own origin, half its 10 mm
  // length back, at 25; upright.)
  assert.deepEqual(nut.position.map(v => +v.toFixed(9)), [0, 8.2, 25]); assert.deepEqual(nut.rotation.map(v => +v.toFixed(9) + 0), [0, 0, 0]);
  const solved = solveDoc(snapped);
  assert.equal(solved.problems.length, 0); assert.deepEqual(solved.doc.instances!.find(i => i.id === 'p2')!.position.map(v => +v.toFixed(9)), [0, 8.2, 25]);
  // The rail moved up 100: solved again, the nut keeps to its lips.
  const lifted = { ...snapped, instances: snapped.instances!.map(i => i.id === 'p1' ? { ...i, position: [0, 100, 0] as [number, number, number] } : i) };
  assert.ok(Math.abs(solveDoc(lifted).doc.instances!.find(i => i.id === 'p2')!.position[1] - 108.2) < 1e-9);
  // Refusals: roles that do not mate, the base part moved, an unknown interface.
  assert.match((snapByInterfaces(doc, { part: 'p1', interface: 'end1' }, { part: 'p2', interface: 'seat' }) as { error: string }).error, /profile-end and slot-nut do not mate/);
  assert.match((snapByInterfaces(doc, { part: 'p2', interface: 'seat' }, { part: BASE, interface: 'x' }) as { error: string }).error, /base part stays/);
  assert.match((snapByInterfaces(doc, { part: 'p1', interface: 'slot-zz' }, { part: 'p2', interface: 'seat' }) as { error: string }).error, /no interface slot-zz/);
});
