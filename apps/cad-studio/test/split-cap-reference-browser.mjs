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
doc.nodes = doc.nodes.slice(0, 2);
doc.outputs = { b1: { node: 1, side: 'solid' } };
doc.nextId = 2;
const name = 'split-cap-reference.bcad', file = join(output, name);
await writeFile(file, JSON.stringify(doc));

const cap = 'n2.cut.side1';
const pins = [antecedent, 'apps/cad-studio/test/split-cap-reference-browser.mjs', 'apps/cad-studio/test/model-rail-helper.mjs',
  'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/files/useStudioDocumentFiles.ts', 'apps/cad-studio/src/files/documentFile.ts',
  'packages/barocss-cad-model/src/engine/references.ts', 'packages/barocss-cad-model/src/engine/rematch.ts',
  'packages/barocss-cad/src/part/part-model.ts', 'packages/barocss-cad/src/part/part-shell.ts'];
const f = await createFlow({
  name: 'split-cap-reference', envFrozen: 'D790_SOURCE_FROZEN', output, initialFiles: pins, requiredFrozen: pins,
  qualification: 'A Shell on a generated Split cap survives a same-side edit, refuses a live missing-cap edit and is held on cold Open.',
  limits: ['One axis-aligned box, one generated cap, one Shell and one sign reversal.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, faceGeometry, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
try {
  const result = evaluateCadPart(toPartDocument(doc));
  console.log(JSON.stringify(result.outputs.map(body => {
    const { volume, centroid } = massPropertiesOf(body);
    return { id: body.id, volume, centroid, check: checkOutput(body),
      faces: body.brep.faces.map(face => ({ name: face.name, geometry: faceGeometry(face) })) };
  })));
} catch (error) {
  console.log(JSON.stringify({ code: error.code, feature: error.feature, message: error.message }));
}
`,
});
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const field = (parent, name) => parent.getByRole('spinbutton', { name, exact: true });
const row = async key => {
  const index = (await f.bodies()).bodies.findIndex(body => body.key === key);
  assert.ok(index >= 0, 'Missing evaluated body ' + key);
  return f.page.locator('.ol-row:has(.ol-eye)').nth(index);
};
const hud = name => f.page.getByRole('dialog', { name, exact: true });
async function applyHud(name) {
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent?.trim() === 'preview');
  await button(hud(name), 'Apply').click();
  await hud(name).waitFor({ state: 'hidden' });
}
const splitField = name => field(f.editor(), name);
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const project = 'D790 Split cap ' + randomUUID();
async function openProject() {
  if (!(await versions().isVisible())) await button(f.page, 'Project and versions').click();
  await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions(), 'Project in this browser').click();
  await versions().getByLabel('Project', { exact: true }).waitFor();
}
const near = (a, b) => assert.ok(Number.isFinite(a) && Math.abs(a - b) < 1e-8, `${a} versus ${b}`);
async function checkShell(label, cut) {
  f.phase = label;
  const state = await f.snapshot(label), shell = state.doc.nodes[3];
  assert.deepEqual(shell.parent, { node: 2, side: 'negative' });
  assert.deepEqual(shell.open, [cap]);
  assert.ok(shell.sigs?.[cap]);
  assert.equal(shell.rematched, undefined);
  assert.equal(shell.suppressed, undefined);
  const source = { ...state.doc, nodes: state.doc.nodes.slice(0, 3), outputs: {
    b2_negative: { node: 2, side: 'negative' }, b2_positive: { node: 2, side: 'positive' },
  } };
  const halves = await f.inspect(label + '-split', source);
  const cutFace = halves.find(body => body.id === 'n2/0').faces.find(face => face.name === cap);
  assert.equal(cutFace.geometry.kind, 'plane');
  assert.deepEqual(cutFace.geometry.n, [1, 0, 0]);
  near(cutFace.geometry.o[0], cut);
  const native = (await f.inspect(label + '-shell', state.doc)).find(body => body.id === 'n3');
  assert.equal(native.check.valid, true);
  const actual = state.bodies.bodies.find(body => body.key === 'b3');
  const stock = cut * 30 * 10, cavity = (cut - 2) * 26 * 6;
  const volume = stock - cavity, centroid = (stock * cut / 2 - cavity * (cut + 2) / 2) / volume;
  for (const result of [actual, native]) {
    near(result.volume, volume);
    near(result.centroid[0], centroid);
    near(result.centroid[1], 15);
    near(result.centroid[2], 5);
  }
  f.report.observations.push({ label, cut, volume, centroid: [centroid, 15, 5], cap: cutFace });
  return state;
}

await f.run(async () => {
  await f.newPage();
  await f.openFile(file, 2);
  await f.same(doc);

  f.phase = 'author a Split with an explicit +X normal';
  await (await row('b1')).locator('button.ol').click();
  await clickModelCommand(f.page, 'Modify', 'Split');
  await hud('Split').getByLabel('Normal', { exact: true }).selectOption('n');
  await field(hud('Split'), 'Normal X').fill('1');
  await field(hud('Split'), 'Normal Y').fill('0');
  await field(hud('Split'), 'At').fill('24');
  await applyHud('Split');
  await f.changed(doc);
  const split = await f.doc();
  assert.deepEqual(split.nodes[2].normal, [1, 0, 0]);

  f.phase = 'author Shell from a real click on the generated cap';
  await button(await row('b2_positive'), 'Hide body').click();
  await f.changed(split);
  const prepared = await f.doc();
  await button(f.page.locator('.views'), 'Right').click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  const filter = button(f.page, 'Selection filter');
  for (let attempt = 0; attempt < 6 && !(await filter.innerText()).includes('Faces'); attempt++) await filter.click();
  assert.ok((await filter.innerText()).includes('Faces'));
  const point = [24, 15, 5];
  const xy = await f.page.evaluate(point => window.__studioScreenOf(point), point);
  assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), xy), xy);
  await f.page.mouse.click(...xy);
  await f.page.waitForFunction(() => window.__studioSelection?.selection.faces.length === 1);
  await clickModelCommand(f.page, 'Modify', 'Shell');
  assert.equal(await field(hud('Shell'), 'Wall').inputValue(), '2');
  await applyHud('Shell');
  await f.changed(prepared);
  const authored = await checkShell('01-authored-cap-shell', 24);

  f.phase = 'edit the plane without changing the selected cap role';
  await f.openFeatureEditor(2, 'Split plane X30');
  await splitField('At').fill('30');
  await button(f.editor(), 'Apply').click();
  await f.changed(authored.doc);
  await f.closeEditor();
  const edited = await checkShell('02-same-cap-after-edit', 30);

  await f.openFeatureEditor(2, 'Split normal reversal');
  f.phase = 'refuse the missing cap in a live edit';
  await splitField('Normal X').fill('-1');
  await splitField('At').fill('-30');
  await button(f.editor(), 'Apply').click();
  const refusal = f.editor().locator('.hud-error');
  await refusal.getByText('Kernel detail', { exact: true }).click();
  await refusal.getByText(/no face named n2\.cut\.side1 to open/).waitFor();
  const refused = await f.snapshot('03-live-missing-cap-refused');
  assert.deepEqual(refused.doc, edited.doc);
  assert.deepEqual(refused.bodies.bodies, edited.bodies.bodies);
  assert.deepEqual(refused.history, edited.history);
  await f.closeEditor();
  await f.undo();
  await f.same(authored.doc);
  await f.redo();
  await f.same(edited.doc);

  f.phase = 'save the accepted document and compare a cold project Open';
  await openProject();
  await button(f.page, 'Save').click();
  await versions().getByRole('list', { name: 'Project documents', exact: true }).getByText(name, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, name]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const directory = await projects.getDirectoryHandle(project);
    return Array.from(new Uint8Array(await (await (await directory.getFileHandle(name)).getFile()).arrayBuffer()));
  }, [project, name]));
  assert.deepEqual(JSON.parse(bytes), edited.doc);
  await writeFile(join(output, 'saved-split-cap-reference.bcad'), bytes);
  f.report.observations.push({ savedBytes: bytes.length, savedSHA256: sha256(bytes) });
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  assert.notDeepEqual(await f.doc(), edited.doc);
  await openProject();
  await button(versions(), 'Open ' + name).click();
  await f.same(edited.doc);
  await checkShell('04-project-reopens-original-cap', 30);

  f.phase = 'open a cold file with the same stored cap and reversed plane';
  const stale = structuredClone(edited.doc);
  Object.assign(stale.nodes[2], { normal: [-1, 0, 0], at: -30 });
  const nativeRefusal = await f.inspect('05-reversed-native-source', stale);
  assert.deepEqual([nativeRefusal.code, nativeRefusal.feature], ['SELECTION', 'n3']);
  const staleFile = join(output, 'reversed-source-old-cap.bcad');
  await writeFile(staleFile, JSON.stringify(stale));
  await f.newPage();
  await f.openFile(staleFile, 4);
  await f.page.waitForFunction(() => {
    const shell = window.__studioDoc?.nodes?.[3];
    return shell?.held || shell?.rematched;
  });
  const cold = await f.snapshot('05-cold-missing-cap');
  const shell = cold.doc.nodes[3];
  assert.deepEqual(cold.doc.nodes.slice(0, 3), stale.nodes.slice(0, 3));
  f.report.observations.push({ nativeRefusal, opened: shell, outputKeys: Object.keys(cold.doc.outputs) });
  assert.deepEqual(shell.open, [cap], 'A generated cap must not be replaced with a same-facing stock wall');
  assert.equal(shell.rematched, undefined);
  assert.equal(shell.suppressed, true);
  assert.match(shell.held, /n2\.cut\.side1.*gone/);
  assert.deepEqual(cold.doc.outputs, stale.outputs);
  assert.deepEqual(cold.bodies.bodies.map(body => body.key), ['b2_positive', 'b3']);
  for (const [key, cx] of [['b2_positive', 15], ['b3', 45]]) {
    const body = cold.bodies.bodies.find(body => body.key === key);
    near(body.volume, 9000);
    near(body.centroid[0], cx);
  }
  assert.deepEqual(f.report.downloads, []);
});
