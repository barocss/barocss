import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const output = process.argv[2], repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
await mkdir(output);
const antecedent = 'apps/cad-studio/test/fixtures/linear-cut-pattern.bcad';
const doc = JSON.parse(await readFile(resolve(repo, antecedent), 'utf8'));
doc.nodes = [...doc.nodes.slice(0, 2), { kind: 'split', parent: { node: 1, side: 'solid' }, axis: 'x', at: 24, id: 'n2' }];
doc.outputs = { b2_negative: { node: 2, side: 'negative' }, b2_positive: { node: 2, side: 'positive' } };
doc.nextId = 3;
const name = 'split-side-material.bcad', file = join(output, name);
await writeFile(file, JSON.stringify(doc));

const pins = [antecedent, 'apps/cad-studio/test/model-rail-helper.mjs', 'apps/cad-studio/test/split-side-material-browser.mjs', 'apps/cad-studio/src/ui/BodyBrowserRows.tsx',
  'apps/cad-studio/src/ui/SelectionInspector.tsx', 'apps/cad-studio/src/ui/BomPanel.tsx',
  'packages/barocss-cad-model/src/app/lookKey.ts', 'packages/barocss-cad-model/src/app/bodies.ts',
  'packages/barocss-cad-model/src/assembly/looks.ts', 'packages/barocss-cad-model/src/bom/bom.ts', 'packages/barocss-cad-model/src/library/builtin/materials.json'];
const f = await createFlow({
  name: 'split-side-material', envFrozen: 'D789_SOURCE_FROZEN', output, initialFiles: pins, requiredFrozen: pins,
  qualification: 'Move the negative Split side in Studio and retain independent material and visibility through history and project Open.',
  limits: ['One box, one X split, one negative-side Move, two known catalog materials and a desktop project.'],
  snapshotExtra: () => ({
    rows: [...document.querySelectorAll('.ol-row:has(.ol-eye)')].map(row => ({
      label: row.querySelector('button.ol')?.textContent,
      hidden: row.classList.contains('hidden-obj'),
    })),
    material: document.querySelector('select[aria-label="Material"]')?.value ?? null,
    bom: document.querySelector('[aria-label="BOM totals"]')?.textContent ?? null,
  }),
});
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const material = () => f.page.getByLabel('Material', { exact: true });
const row = async key => {
  const index = (await f.bodies()).bodies.findIndex(body => body.key === key);
  assert.ok(index >= 0, 'Missing evaluated body ' + key);
  return f.page.locator('.ol-row:has(.ol-eye)').nth(index);
};
const select = async key => (await row(key)).locator('button.ol').click();
async function setMaterial(key, id) {
  await select(key);
  const before = await f.doc();
  await material().selectOption(id);
  await f.changed(before);
}
async function readLooks(negative, positive) {
  await select(negative);
  const a = await material().inputValue();
  await select(positive);
  return [a, await material().inputValue()];
}
async function checkMass(label, negative, positive, cut) {
  await clickModelCommand(f.page, 'Inspect', 'BOM');
  await f.page.getByLabel('BOM totals', { exact: true }).waitFor();
  const state = await f.snapshot(label);
  await button(f.page, 'Close BOM').click();
  const volumes = [negative, positive].map(key => state.bodies.bodies.find(body => body.key === key).volume);
  assert.ok(Math.abs(volumes[0] - cut * 30 * 10) < 1e-8);
  assert.ok(Math.abs(volumes[1] - (60 - cut) * 30 * 10) < 1e-8);
  const expected = (cut * 30 * 10 * 7.85 + (60 - cut) * 30 * 10 * 1.04) / 1000;
  assert.ok(state.bom.endsWith(`· ${Number(expected.toFixed(1))} g (the parts')`), state.bom);
  return state;
}
async function pickAt(point, expectedKey) {
  await f.page.keyboard.press('Escape');
  const pixel = await f.page.evaluate(point => window.__studioScreenOf(point), point);
  assert.ok(pixel?.length === 2 && pixel.every(Number.isFinite));
  assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), pixel));
  await f.page.mouse.click(...pixel);
  const index = (await f.bodies()).bodies.findIndex(body => body.key === expectedKey);
  await f.page.waitForFunction(index => {
    const keys = window.__studioSelection?.selection.bodies;
    return keys && (index < 0 ? keys.length === 0 : keys.length === 1 && keys[0] === index);
  }, index);
}
const project = 'D789 Split material ' + randomUUID();
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
async function openProject() {
  if (!(await versions().isVisible())) await button(f.page, 'Project and versions').click();
  await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions(), 'Project in this browser').click();
  await versions().getByLabel('Project', { exact: true }).waitFor();
}

await f.run(async () => {
  await f.newPage();
  await f.openFile(file, 3);
  await f.same(doc);
  const [negative, positive, moved] = ['b2_negative', 'b2_positive', 'b3'];
  f.phase = 'assign different materials to the original Split sides';
  await setMaterial(negative, 'steel');
  await setMaterial(positive, 'abs');
  assert.deepEqual(await readLooks(negative, positive), ['steel', 'abs']);
  const original = await checkMass('01-two-materials', negative, positive, 24);
  assert.deepEqual(original.doc.bodies, { b1_negative: { material: 'steel' }, b1: { material: 'abs' } });

  f.phase = 'move the negative side and compare material and visibility';
  await select(negative);
  await f.page.keyboard.press('g');
  const hud = f.page.getByRole('dialog', { name: 'Move', exact: true });
  await hud.getByLabel('ΔY', { exact: true }).fill('40');
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent?.trim() === 'preview');
  await button(hud, 'Apply').click();
  await hud.waitFor({ state: 'hidden' });
  await f.changed(original.doc);
  const movedDoc = await f.doc();
  assert.deepEqual(movedDoc.nodes[3], { kind: 'translate', parent: { node: 2, side: 'negative' }, offset: [0, 40, 0], id: 'n3' });
  assert.deepEqual(movedDoc.bodies, original.doc.bodies);
  const afterMove = await readLooks(moved, positive);
  await clickModelCommand(f.page, 'Inspect', 'BOM');
  await f.page.getByLabel('BOM totals', { exact: true }).waitFor();
  const movedState = await f.snapshot('02-moved-negative');
  await button(f.page, 'Close BOM').click();
  await button(await row(moved), 'Hide body').click();
  await f.changed(movedDoc);
  const hidden = await f.snapshot('03-hidden-negative');
  const [hiddenSibling, hiddenMoved] = hidden.rows.map(row => row.hidden);
  f.report.observations.push({ afterMove, mass: movedState.bom, hiddenSibling, hiddenMoved });
  assert.deepEqual({ afterMove, mass: movedState.bom, hiddenSibling, hiddenMoved },
    { afterMove: ['steel', 'abs'], mass: original.bom, hiddenSibling: false, hiddenMoved: true });
  assert.deepEqual(hidden.doc.bodies, { b1_negative: { material: 'steel', hidden: true }, b1: { material: 'abs' } });

  f.phase = 'undo and redo the visibility change and Move';
  await f.undo();
  await f.same(movedDoc);
  await f.undo();
  await f.same(original.doc);
  assert.deepEqual(await readLooks(negative, positive), ['steel', 'abs']);
  await f.redo();
  await f.same(movedDoc);
  assert.deepEqual(await readLooks(moved, positive), ['steel', 'abs']);
  await f.redo();
  await f.same(hidden.doc);
  const redone = await checkMass('04-redone-visibility', moved, positive, 24);
  assert.deepEqual(redone.rows.map(row => row.hidden), [false, true]);

  f.phase = 'save the hidden side and open the exact project bytes after reload';
  await openProject();
  await button(f.page, 'Save').click();
  await versions().getByRole('list', { name: 'Project documents', exact: true }).getByText(name, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, name]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const directory = await projects.getDirectoryHandle(project);
    return Array.from(new Uint8Array(await (await (await directory.getFileHandle(name)).getFile()).arrayBuffer()));
  }, [project, name]));
  assert.deepEqual(JSON.parse(bytes), hidden.doc);
  await writeFile(join(output, 'saved-split-side-material.bcad'), bytes);
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  assert.notDeepEqual(await f.doc(), hidden.doc);
  await openProject();
  await button(versions(), 'Open ' + name).click();
  await f.same(hidden.doc);
  const reopened = await checkMass('05-reopened-hidden-negative', moved, positive, 24);
  assert.deepEqual(reopened.rows.map(row => row.hidden), [false, true]);
  f.phase = 'pick the visible side and miss the hidden side in the reopened viewport';
  await f.page.locator('.views').getByRole('button', { name: 'Top', exact: true }).click();
  await f.page.keyboard.press('f');
  const filter = button(f.page, 'Selection filter');
  for (let attempt = 0; attempt < 4 && !(await filter.innerText()).includes('Bodies'); attempt++) await filter.click();
  assert.ok((await filter.innerText()).includes('Bodies'));
  await f.frame([[42, 15], [12, 55]]);
  await pickAt([42, 15, 10], positive);
  await pickAt([12, 55, 10], null);
  await button(await row(moved), 'Show body').click();
  await f.same(movedDoc);
  await pickAt([12, 55, 10], moved);
  await f.snapshot('06-viewport-reshown-negative');
  assert.deepEqual(await readLooks(moved, positive), ['steel', 'abs']);
  await f.openFeatureEditor(2, 'Split plane after project Open');
  await f.editor().getByRole('spinbutton', { name: 'At', exact: true }).fill('30');
  await button(f.editor(), 'Apply').click();
  await f.changed(movedDoc);
  await f.closeEditor();
  const expected = structuredClone(movedDoc);
  expected.nodes[2].at = 30;
  await f.same(expected);
  const edited = await checkMass('07-reopened-edit', moved, positive, 30);
  assert.deepEqual(edited.rows.map(row => row.hidden), [false, false]);
  assert.deepEqual(await readLooks(moved, positive), ['steel', 'abs']);
  f.report.observations.push({ savedBytes: bytes.length, savedSHA256: sha256(bytes), editedMass: edited.bom });
  assert.deepEqual(f.report.downloads, []);
});
