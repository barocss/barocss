import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const pins = ['apps/cad-studio/src/ui/Hud.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx',
  'packages/barocss-cad-model/src/engine/errors.ts', 'packages/barocss-cad/src/blend/general-shell.ts',
  'packages/barocss-cad/src/part/part-shell.ts'];
const revised = process.env.D1189_GUARDED === '1';
if (revised) pins.push('packages/barocss-cad/src/part/part-box-shell.ts');
const f = await createFlow({
  name: 'step-shell-opening', output: process.argv[2], envFrozen: 'D1189_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'The original top opening must remain when a STEP box Shell is made or edited.',
  limits: ['Exact two-boxes STEP fixture, top of the 10 × 10 × 5 mm part. Desktop WebGPU.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkBrep, faceGeometry, massPropertiesOf } from '@barocss/cad';
import { partSnapshot } from '@barocss/cad-model/engine/part';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log(JSON.stringify(partSnapshot(doc).outputs.map(output => ({
  id: output.id, volume: massPropertiesOf(output).volume, solids: output.bodyCount,
  strict: checkBrep(output.brep, { strict: true }).valid,
  points: output.brep.vertices.map(vertex => vertex.point),
  faces: output.brep.faces.map(face => ({
    name: face.name, geometry: faceGeometry(face),
    loops: face.loops.map(id => output.brep.loops.find(loop => loop.id === id).kind).sort(),
  })),
}))));
`,
});
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} vs ${expected}`);
const matchingPoint = (points, want) => points.some(point => point.every((coordinate, axis) => Math.abs(coordinate - want[axis]) < 1e-7));

async function native(label, doc, wall) {
  const bodies = await f.inspect(label, doc);
  assert.equal(bodies.length, 2);
  assert.ok(bodies.every(body => body.strict && body.solids === 1));
  const edited = doc.nodes.at(-1).kind === 'shell';
  const target = bodies.find(body => body.id === (edited ? 'n1' : 'n0/0'));
  const other = bodies.find(body => body.id === 'n0/1');
  assert.ok(target && other);
  const expected = wall ? 500 - (10 - 2 * wall) ** 2 * (5 - wall) : 500;
  near(target.volume, expected);
  near(other.volume, 144);
  const top = target.faces.find(face => face.geometry.kind === 'plane'
    && Math.abs(face.geometry.o[2] - 5) < 1e-8 && face.geometry.n[2] > 0.99);
  assert.ok(top);
  assert.deepEqual(top.loops, wall ? ['inner', 'outer'] : ['outer']);
  if (wall) for (const z of [wall, 5]) for (const x of [wall, 10 - wall]) for (const y of [wall, 10 - wall])
    assert.ok(matchingPoint(target.points, [x, y, z]), JSON.stringify({ expected: [x, y, z], points: target.points }));
  const summary = { label, wall, expected, volume: target.volume, other: other.volume, openingLoops: top.loops };
  f.report.observations.push(summary);
}

async function setWall(hud, wall) {
  const field = hud.getByLabel('Wall', { exact: true });
  await field.fill('');
  await hud.getByText('Enter a value', { exact: true }).waitFor();
  await field.fill(String(wall));
  await hud.locator('.status.ok, .hud-error details').waitFor();
  return hud.locator('.status').innerText();
}

await f.run(async () => {
  const step = await readFile(process.argv[3]);
  assert.equal(sha256(step), 'b425a5a94604bd94d4f0b55192368480c217792862552f8cd3a38eedd33c28b7');
  f.report.files.push({ name: 'two-boxes.step', sha256: sha256(step) });
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'two-boxes.step', mimeType: 'application/step', buffer: step });
  await f.waitToast(/STEP opened.*2 solids.*millimetres/);
  await f.ready();
  const source = await f.doc();
  assert.equal(source.nodes[0].step, step.toString());
  await native('original-native', source, 0);

  f.phase = 'Pick the imported face and create a Wall 3 open Shell';
  await button('Top', f.page.getByRole('group', { name: 'Views', exact: true })).click();
  if (await button('Ortho').getAttribute('aria-pressed') !== 'true') await button('Ortho').click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  const pixel = await f.page.evaluate(() => window.__studioScreenOf([5, 5, 5]));
  assert.ok(pixel?.length === 2);
  await f.page.mouse.click(...pixel);
  await f.page.waitForFunction(() => window.__studioSelection.selection.faces.length === 1);
  await clickModelCommand(f.page, 'Modify', 'Shell');
  let hud = f.page.getByRole('dialog', { name: 'Shell', exact: true });
  if (revised) {
    assert.equal(await setWall(hud, 5), 'refused');
    const notice = hud.getByRole('status');
    assert.match(await notice.innerText(), /The wall is too thick/);
    assert.match(await notice.locator('code').textContent(), /n0\.a\.top.*less than 5 mm/i);
    assert.equal(await button('Apply', hud).isEnabled(), false);
    await f.same(source);
    await f.snapshot('creation-wall-5-refused');
  }
  assert.equal(await setWall(hud, 3), 'preview');
  await button('Apply', hud).click();
  await f.changed(source);
  const good = (await f.snapshot('wall-3-applied')).doc;
  const originalShell = good.nodes[1];
  assert.equal(originalShell.kind, 'shell');
  assert.equal(originalShell.thickness, 3);
  assert.deepEqual(originalShell.open, ['n0.a.top']);
  assert.deepEqual(originalShell.parent, { node: 0, side: 'part0' });
  await native('wall-3-native', good, 3);

  f.phase = 'Reject Wall 5 and preserve the accepted opening';
  await f.openFeatureEditor(1, 'Open Shell History');
  const editor = f.editor();
  const field = editor.getByLabel('Wall', { exact: true });
  await field.fill('5');
  await button('Apply', editor).click();
  await f.page.waitForFunction(() => window.__studioDoc.nodes[1]?.thickness === 5
    || document.querySelector('.node-editor .hud-error-title'));
  await f.snapshot('wall-5-result');
  const attempted = await f.doc();
  if (attempted.nodes[1].thickness === 5) await native('closed-wall-5-native', attempted, 0);
  assert.equal(attempted.nodes[1].thickness, 3, 'Wall 5 restored the removed top face and History committed it');
  assert.match(await editor.innerText(), /The wall is too thick/i);
  await f.same(good);

  f.phase = 'The same editor still accepts a small real aperture';
  const thinOpeningWall = 4.999;
  await field.fill(String(thinOpeningWall));
  await button('Apply', editor).click();
  await f.changed(good);
  const tight = (await f.snapshot('small-opening-applied')).doc;
  assert.deepEqual(tight.nodes[1], { ...originalShell, thickness: thinOpeningWall });
  await native('small-opening-native', tight, thinOpeningWall);
  await f.undo();
  await f.same(good);
  await f.redo();
  await f.same(tight);
});
