import assert from 'node:assert/strict';
import { sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const width = 30, radius = 1.5, k = 0.44, bore = 2.75;
const offset = 60;
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
function pointNear(actual, expected, tolerance = 1e-9) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, axis) => near(value, expected[axis], tolerance));
}
function truth(thickness, kFactor = k) {
  const s = radius + thickness;
  const horizontal = width * thickness * (40 - s), vertical = width * thickness * (30 - s);
  const bend = width * Math.PI * (s ** 2 - radius ** 2) / 4, hole = Math.PI * bore ** 2 * thickness;
  const bendCenter = s - 4 * (s ** 3 - radius ** 3) / (3 * Math.PI * (s ** 2 - radius ** 2));
  const volume = horizontal + vertical + bend - 2 * hole;
  const centroid = [
    (horizontal * (40 + s) / 2 + vertical * thickness / 2 + bend * bendCenter - hole * (25 + thickness / 2)) / volume,
    15,
    (horizontal * thickness / 2 + vertical * (30 + s) / 2 + bend * bendCenter - hole * (20 + thickness / 2)) / volume,
  ];
  const allowance = Math.PI / 2 * (radius + kFactor * thickness), length = 70 - 2 * s + allowance;
  return { s, volume, centroid, allowance, length, area: width * length - 2 * Math.PI * bore ** 2 };
}
async function checkPair(f, label, doc, copyThickness, copyTable = null) {
  const native = await f.inspect(label, doc, { multiple: true });
  assert.deepEqual(native.map(body => body.id), ['n6', 'n14']);
  const { fresh, massReady, bodies } = await f.bodies();
  assert.ok(fresh && massReady);
  assert.deepEqual(bodies.map(body => body.key), ['b6', 'b14']);
  const results = [];
  for (const [index, body] of native.entries()) {
    const thickness = index ? copyThickness : 1.5, x = index ? offset : 0, owner = index ? 'n7' : 'n0';
    const table = index ? copyTable : null, selectedK = table?.rows[0].kFactor ?? k;
    const expected = truth(thickness, selectedK);
    const { sheet, flat, flatError } = body;
    assert.equal(body.valid, true);
    assert.equal(body.bodyCount, 1);
    assert.ok(sheet && flat, JSON.stringify(flatError));
    assert.equal(sheet.thickness, thickness);
    assert.equal(sheet.bendRadius, radius);
    const selectedRow = table ? { table: table.id, rows: [0], how: 'exact', estimate: false } : undefined;
    assert.equal(sheet.kFactor, table ? undefined : k);
    assert.deepEqual(sheet.bendTable, table ?? undefined);
    assert.deepEqual(sheet.bends[0].table, selectedRow);
    assert.equal(sheet.bends[0].kFactor, selectedK);
    assert.equal(sheet.fixedFace, `${owner}.leg0.a`);
    assert.deepEqual(sheet.bends.map(bend => bend.name), [`${owner}.bend1`]);
    pointNear(sheet.bends[0].axis.origin, [x + expected.s, 30, expected.s]);
    pointNear(sheet.bends[0].axis.direction, [0, -1, 0]);
    for (const mass of [body.mass, bodies[index]]) {
      near(mass.volume, expected.volume, 1e-9 * expected.volume);
      pointNear(mass.centroid, [expected.centroid[0] + x, ...expected.centroid.slice(1)]);
    }
    for (const [measure, bounds] of [[Math.min, [x, 0, 0]], [Math.max, [x + 40, 30, 30]]]) {
      pointNear([0, 1, 2].map(axis => measure(...body.points.map(point => point[axis]))), bounds);
    }
    const tolerance = 1e-12 * expected.length;
    assert.equal(flat.fixedFace, sheet.fixedFace);
    pointNear(flat.box.max, [width, expected.length], tolerance);
    near(flat.area, expected.area, 1e-12 * expected.area);
    assert.deepEqual(flat.bends.map(bend => [bend.name, bend.direction]), [[`${owner}.bend1`, 'down']]);
    near(flat.bends[0].allowance, expected.allowance, tolerance);
    assert.deepEqual(flat.bends[0].table, selectedRow);
    const holes = flat.loops.filter(loop => !loop.outer).map(loop => {
      const [arc] = loop.segments;
      assert.equal(arc.kind, 'arc');
      near(arc.radius, bore, tolerance);
      return arc.center;
    }).sort((a, b) => a[1] - b[1]);
    assert.equal(holes.length, 2);
    pointNear(holes[0], [15, 10], tolerance);
    pointNear(holes[1], [15, expected.length - 15], tolerance);
    results.push({ id: body.id, key: bodies[index].key, thickness, volume: body.mass.volume, centroid: body.mass.centroid,
      fixedFace: sheet.fixedFace, bend: sheet.bends[0].name, table: selectedRow, kFactor: selectedK, axis: sheet.bends[0].axis, flat: flat.box.max, area: flat.area, holes });
  }
  f.report.observations.push({ label, results });
}
async function showBoth(f, showFlat, label) {
  const rows = f.page.locator('.outliner .ol-row > button.ol');
  assert.equal(await rows.count(), 2);
  for (const [index, id] of ['original', 'copy'].entries()) {
    await rows.nth(index).click();
    await f.page.waitForFunction(index => window.__studioSelection.selection.bodies[0] === index, index);
    await showFlat(`${label}-${id}-flat`);
  }
}

export async function qualifySheetDuplicate(f, seed, { showFlat, projectRoundTrip, tableCopy = false, tableBaseline = false }) {
  f.phase = 'duplicate the source with a 60 mm gap from its origin';
  await clickModelCommand(f.page, 'Pattern', 'Duplicate');
  const hud = f.page.getByRole('dialog', { name: 'Duplicate', exact: true });
  await hud.getByLabel('Offset X', { exact: true }).fill(String(offset));
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent.trim() === 'preview');
  await button(hud, 'Apply').click();
  await hud.waitFor({ state: 'hidden' });
  await f.changed(seed);
  const copied = await f.doc();
  assert.deepEqual(copied.nodes.slice(0, 7), seed.nodes);
  assert.deepEqual(copied.nodes.slice(7).map(node => node.id), ['n7','n8','n9','n10','n11','n12','n13','n14']);
  assert.deepEqual(copied.nodes[14], { kind: 'translate', parent: { node: 13, side: 'solid' }, offset: [offset, 0, 0], id: 'n14' });
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await checkPair(f, 'duplicate-native', copied, 1.5);
  await showBoth(f, showFlat, '02-duplicate');

  f.phase = 'edit only the copied source sheet thickness';
  await f.openFeatureEditor(7, 'copy sheet');
  const thickness = f.editor().getByLabel('Thickness', { exact: true });
  assert.equal(await thickness.inputValue(), '1.5');
  await thickness.fill('2');
  await f.applyEditor(copied, 'copy-thickness-2');
  const edited = await f.doc();
  const expectedNodes = copied.nodes.map((node, index) => index === 7 ? { ...node, thickness: 2 } : node);
  assert.deepEqual(edited, { ...copied, nodes: expectedNodes });
  await checkPair(f, 'copy-edit-native', edited, 2);
  await showBoth(f, showFlat, '03-after-copy-edit');

  f.phase = 'refuse zero thickness on the copy and preserve both sheets';
  await f.openFeatureEditor(7, 'copy thickness refusal');
  await thickness.fill('0');
  await button(f.editor(), 'Apply').click();
  await f.editor().locator('summary').getByText('Kernel detail', { exact: true }).click();
  await f.editor().getByText(/thickness must be positive/i).waitFor({ timeout: 15000 });
  await f.same(edited);
  await f.snapshot('04-refused-copy-thickness');
  await f.closeEditor();
  await f.undo();
  await f.same(copied);
  await f.redo();
  await f.same(edited);

  f.phase = 'save and reopen both independent sheets';
  const bytes = await projectRoundTrip(edited);
  await checkPair(f, 'reopened-copy-edit-native', edited, 2);
  await showBoth(f, showFlat, '05-reopened');
  f.report.observations.push({ label: 'duplicate-project-readback', bytes: bytes.length, sha256: sha256(bytes) });
  if (!tableCopy) return;

  f.phase = 'load an exact local test bend table on only the copy';
  const table = {
    id: 'D820-exact-copy', sources: [{ id: 'fixture', label: 'Controlled test bend' }],
    rows: [{ thickness: 2, radius: 1.5, angle: 90, kFactor: 0.46, source: 'fixture' }],
  };
  const input = f.page.getByLabel('Bend table file', { exact: true });
  const upload = data => input.setInputFiles({ name: data.id + '.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await upload(table);
  await f.changed(edited);
  const withTable = await f.doc();
  const { kFactor: omitted, ...oldCopy } = edited.nodes[7];
  assert.equal(omitted, k);
  assert.deepEqual(withTable, { ...edited, nodes: edited.nodes.map((node, index) => index === 7 ? { ...oldCopy, bendTable: table } : node) });
  await checkPair(f, 'copy-exact-table-native', withTable, 2, table);
  await showBoth(f, showFlat, '06-exact-table');

  f.phase = 'load a structurally valid table with no 2 mm bend row';
  const invalid = { ...table, id: 'D820-missing-copy-row', rows: [{ ...table.rows[0], thickness: 4 }] };
  await upload(invalid);
  if (tableBaseline) {
    const failure = await f.waitToast(/BEND_TABLE_MISS/);
    const accepted = await f.doc();
    assert.deepEqual(accepted, { ...withTable, nodes: withTable.nodes.map((node, index) => index === 7 ? { ...node, bendTable: invalid } : node) });
    assert.equal(await f.page.evaluate(() => window.__studioFresh), false);
    await f.snapshot('07-baseline-unmatched-table-accepted');
    f.report.observations.push({ label: 'baseline-invalid-table-committed', id: accepted.nodes[7].bendTable.id, failure });
    await f.dismissToasts();
    await f.undo();
    await f.same(withTable);
    return;
  }

  const refusal = await f.waitToast(/Bend table refused.*Check that the table covers the current bends.*BEND_TABLE_MISS/s);
  assert.doesNotMatch(refusal, /Undo the last change/i);
  await f.same(withTable);
  await checkPair(f, 'copy-exact-table-retained-native', withTable, 2, table);
  await f.snapshot('07-unmatched-table-refused');
  f.report.observations.push({ label: 'unmatched-table-refusal', refusal });
  await f.dismissToasts();
  await f.undo();
  await f.same(edited);
  await f.redo();
  await f.same(withTable);
  const tableBytes = await projectRoundTrip(withTable);
  await checkPair(f, 'reopened-copy-exact-table-native', withTable, 2, table);
  await showBoth(f, showFlat, '08-table-reopened');
  f.report.observations.push({ label: 'table-project-readback', bytes: tableBytes.length, sha256: sha256(tableBytes) });
}
