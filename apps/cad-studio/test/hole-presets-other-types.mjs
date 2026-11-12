import assert from 'node:assert/strict';

const cases = [
  { type: 'through', preset: 'Pilot 6', fields: [], file: 'D827-through.bcad' },
  { type: 'countersink', preset: 'Sink 6', fields: [['Countersink Ø', '10']], file: 'D827-countersink.bcad' },
  { type: 'counterbore', preset: 'Seat 6', fields: [['Counterbore Ø', '10'], ['Counterbore depth', '2']], file: 'D827-counterbore.bcad' },
];
const ref = node => ({ node, side: 'solid' });
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const field = (parent, name) => parent.getByLabel(name, { exact: true });
const distance = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));

async function checkHole(f, label, doc, source, type, depth = 2) {
  const counterbore = type === 'counterbore', countersink = type === 'countersink';
  const top = counterbore ? 3 : 2;
  const location = { center: [25, 6], axis: 'x', face: 'n1.side1' };
  const pilot = { kind: 'hole', parent: ref(1), radius: 3, ...location, ...(countersink ? { countersink: 10 } : {}), id: 'n2' };
  const nodes = [...source.nodes, pilot];
  if (counterbore) nodes.push({ kind: 'hole', parent: ref(2), radius: 5, depth, ...location, id: 'n3' });
  assert.deepEqual(doc.nodes, nodes);
  assert.deepEqual(doc.outputs, { ['b' + top]: ref(top) });
  const body = await f.inspect(label, doc);
  assert.ok(body.valid && body.count === 1);
  assert.deepEqual(body.shells, [true]);

  const pilotVolume = 360 * Math.PI;
  // The counterbore is an annulus. The extra countersink area at depth s is π((5-s)²-3²), for 0 ≤ s ≤ 2.
  const extra = counterbore ? 16 * Math.PI * depth : countersink ? 44 * Math.PI / 3 : 0;
  const extraCenter = counterbore ? 90 - depth / 2 : 90 - 7 / 11;
  const volume = 14400 - pilotVolume - extra;
  const centroid = [(14400 * 70 - pilotVolume * 70 - extra * extraCenter) / volume, 25, 6];
  const { fresh, massReady, bodies } = await f.bodies();
  assert.ok(fresh && massReady);
  assert.deepEqual(bodies.map(body => body.key), ['b' + top]);
  for (const result of [body, bodies[0]]) {
    assert.ok(Math.abs(result.volume - volume) < 1e-7, JSON.stringify(result));
    assert.ok(distance(result.centroid, centroid) < 1e-8, JSON.stringify(result));
  }

  const rims = counterbore ? [[50, 3], [90 - depth, 3], [90 - depth, 5], [90, 5]]
    : countersink ? [[50, 3], [88, 3], [90, 5]] : [[50, 3], [90, 3]];
  for (const [x, radius] of rims) {
    const ring = body.corners.filter(([a, b, c]) => Math.abs(a - x) < 1e-8 && Math.abs(Math.hypot(b - 25, c - 6) - radius) < 1e-8);
    assert.ok(ring.length >= 2, JSON.stringify({ x, radius, ring }));
  }
  const walls = body.faces.filter(face => face.kind === 'cylinder');
  assert.deepEqual([...new Set(walls.map(face => Math.round(face.r)))].sort(), counterbore ? [3, 5] : [3]);
  for (const wall of walls) {
    assert.equal(wall.out, -1);
    assert.ok(Math.hypot(wall.c[1] - 25, wall.c[2] - 6) < 1e-8);
    assert.ok(Math.hypot(Math.abs(wall.a[0]) - 1, wall.a[1], wall.a[2]) < 1e-8);
  }
  const shoulder = body.faces.some(face => face.kind === 'plane' && Math.abs(face.o[0] - (90 - depth)) < 1e-8 &&
    distance(face.n, [1, 0, 0]) < 1e-8);
  assert.equal(shoulder, counterbore);
  if (countersink) assert.ok(body.faces.some(face => face.kind === 'other' && face.name?.startsWith('n2.countersink-')));
  f.report.observations.push({ label, type, depth: counterbore ? depth : undefined, volume: body.volume, centroid: body.centroid, rims, shoulder });
}

export async function runOtherHolePresets({ f, key, first, second, open, pick, startHole, savePreset, saveAndReopen, editState }) {
  const hud = () => f.page.getByRole('dialog', { name: 'Hole', exact: true });
  const preset = () => field(hud(), 'Hole preset');
  const type = () => field(hud(), 'Type');
  const preview = () => f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent.trim() === 'preview');
  const arm = () => f.page.evaluate(() => window.__holeHold.arm());
  const release = () => f.page.evaluate(() => window.__holeHold.release());
  const held = async ok => {
    await f.page.waitForFunction(() => !!window.__holeHold.read());
    const result = await f.page.evaluate(() => window.__holeHold.read());
    assert.equal(result.ok, ok, JSON.stringify(result));
  };
  const use = async name => { await preset().selectOption(name); await button(hud(), 'Use preset').click(); };
  const center = async () => {
    await field(hud(), 'Centre Y').fill('25');
    await field(hud(), 'Centre Z').fill('6');
    await preview();
  };

  f.phase = 'store three typed options on the first part top face';
  await f.newPage();
  await open('D827-top.bcad', first);
  await pick('Top', [14, 12, 10]);
  const original = await editState();
  await startHole();
  for (const entry of cases) {
    await type().selectOption(entry.type);
    await field(hud(), 'Diameter').fill('6');
    for (const [label, value] of entry.fields) await field(hud(), label).fill(value);
    await savePreset(entry.preset);
  }
  await preview();
  await f.same(first);
  assert.deepEqual(await editState(), original);

  f.phase = 'retire a successful preset preview when Open replaces the document';
  await arm();
  await use('Pilot 6');
  await held(true);
  await field(hud(), 'Diameter').press('Enter');
  await open('D827-fresh-target.bcad', second);
  await hud().waitFor({ state: 'hidden' });
  await release();
  await f.same(second);
  await f.undo();
  await f.same(first);
  await f.redo();
  await f.same(second);
  f.report.observations.push({ label: 'retired-success-on-open', sourceUnchanged: true, firstHistoryIsOpen: true });

  let committed;
  for (const entry of cases) {
    f.phase = 'apply ' + entry.type + ' options to fresh right face';
    await open(entry.file, second);
    await pick('Right', [90, 25, 6]);
    const selected = await editState();
    await startHole();
    await center();
    if (entry.type === 'through') {
      await type().selectOption('blind');
      await preview();
      await arm();
      await field(hud(), 'Depth').fill('0');
      await held(false);
      await field(hud(), 'Diameter').press('Enter');
    }
    await use(entry.preset);
    if (entry.type === 'through') await release();
    await preview();
    await f.same(second);
    assert.deepEqual(await editState(), selected);
    assert.equal(await type().inputValue(), entry.type);
    assert.equal(await field(hud(), 'Diameter').inputValue(), '6');
    assert.equal(await field(hud(), 'Centre Y').inputValue(), '25');
    assert.equal(await field(hud(), 'Centre Z').inputValue(), '6');
    for (const [label, value] of entry.fields) assert.equal(await field(hud(), label).inputValue(), value);
    await button(hud(), 'Apply').click();
    await hud().waitFor({ state: 'hidden' });
    await f.changed(second);
    committed = await f.doc();
    await checkHole(f, 'applied-' + entry.type, committed, second, entry.type);
    await f.snapshot('applied-' + entry.type);
    await f.undo();
    await f.same(second);
    await f.redo();
    await f.same(committed);
  }

  f.phase = 'delete the preset and reopen the counterbore with both history nodes';
  await pick('Right', [90, 35, 6]);
  const acceptedControls = await editState();
  await startHole();
  await preset().selectOption('Seat 6');
  await button(hud(), 'Delete preset').click();
  assert.equal(await preset().locator('option').filter({ hasText: 'Seat 6' }).count(), 0);
  await button(hud(), 'Cancel').click();
  await f.same(committed);
  assert.deepEqual(await editState(), acceptedControls);
  const saved = await saveAndReopen(committed, cases.at(-1).file);
  await checkHole(f, 'reopened-counterbore', committed, second, 'counterbore');
  f.report.observations.push({ label: 'counterbore-project-without-preset', ...saved });
  await f.openFeatureEditor(3, 'reopened counterbore recess');
  await field(f.editor(), 'Depth').fill('3');
  await f.applyEditor(committed, 'reopened-recess-three');
  const edited = await f.doc();
  await checkHole(f, 'edited-counterbore', edited, second, 'counterbore', 3);

  f.phase = 'retire the old preview when another command starts and when New replaces the part';
  const startHeldHole = async () => {
    await pick('Right', [90, 35, 6]);
    await startHole();
    await arm();
    await use('Pilot 6');
    await held(true);
    await field(hud(), 'Diameter').press('Enter');
  };
  await startHeldHole();
  await f.page.evaluate(() => document.activeElement.blur());
  await f.command('Box');
  const box = f.page.getByRole('dialog', { name: 'Box', exact: true });
  await box.waitFor();
  await release();
  await box.locator('.status').getByText('preview', { exact: true }).waitFor();
  await f.same(edited);
  await button(box, 'Cancel').click();
  await startHeldHole();
  await button(f.page, 'New part').click();
  await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await hud().waitFor({ state: 'hidden' });
  const blank = await f.doc();
  await release();
  await f.same(blank);
  await f.page.keyboard.press('h');
  await f.waitToast(/select the flat face where the hole goes in/i);
  assert.equal(await hud().isVisible(), false);
  await f.undo();
  await f.same(edited);
  await f.redo();
  await f.same(blank);
  f.report.observations.push({ label: 'retired-success-on-command-and-new', sourceUnchanged: true, firstHistoryIsNew: true });

  f.phase = 'reject an incompatible local store and keep manual Hole usable';
  const corrupt = '{"version":2,"presets":[]}';
  await f.page.evaluate(([key, data]) => localStorage.setItem(key, data), [key, corrupt]);
  await open('D827-manual-hole.bcad', second);
  await pick('Right', [90, 25, 6]);
  await startHole();
  await hud().getByText('Saved hole presets could not be read.', { exact: true }).waitFor();
  assert.ok(await preset().isDisabled());
  await field(hud(), 'Diameter').fill('6');
  await center();
  await button(hud(), 'Apply').click();
  await f.changed(second);
  await checkHole(f, 'manual-after-corrupt-store', await f.doc(), second, 'through');
  assert.equal(await f.page.evaluate(key => localStorage.getItem(key), key), corrupt);
  await f.snapshot('manual-after-corrupt-store');
  assert.deepEqual(f.report.downloads, []);
}
