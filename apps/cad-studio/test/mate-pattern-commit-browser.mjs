// D413: current Studio mate UI refuses unsettled pattern changes before committing.
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const output = resolve(process.argv[2] ?? ''), file = resolve(process.argv[3] ?? '');
assert.ok(process.argv[2] && process.argv[3]);
const f = await createFlow({
  name: 'mate-pattern-commit', envFrozen: 'MATE_PATTERN_SOURCE_FROZEN', output,
  qualification: 'D413_PATTERN_MATE_PRECOMMIT',
  initialFiles: ['apps/cad-studio/test/mate-pattern-commit-browser.mjs', file, file + '.edit.bcad'],
  requiredFrozen: ['apps/cad-studio/src/assembly/useAssembly.ts'],
  inspectorSource: "export { addMate, editMate, lockPart } from '@barocss/cad-model/assembly/edit';",
  limits: [
    'One native linear two-occurrence pattern with a Pin and Cap; no closed-loop physics or general solver acceptance.',
    'Finish refusal and edit refusal exercised through actual native reference picker/editor. Lock cycle and pending faces are deterministic real-hook tests, not actual UI cycle acceptance.',
    'No Save/export/download or paid call. Font CSS fulfilled empty before navigation; no external font assets.',
  ],
});
const mates = () => f.page.getByRole('complementary', { name: 'Mates', exact: true });
async function pick(part, geometry) {
  await mates().getByLabel('Reference part', { exact: true }).selectOption(part);
  await mates().getByLabel('Reference geometry', { exact: true }).selectOption(geometry);
  await mates().getByRole('button', { name: 'Pick mate reference', exact: true }).click();
}
async function waitInstances() {
  await f.page.waitForFunction(() => window.__studioInstanceBounds?.()?.length === 3 && window.__studioInstanceBounds().every(i => i.min && i.max), null, { timeout: 60000 });
  await f.ready();
}
await f.run(async () => {
  const fonts = { stylesheets: 0, assets: 0 }, newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async (...args) => {
    const context = await newContext(...args);
    await context.route('https://fonts.googleapis.com/**', route => {
      fonts.stylesheets++;
      return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    });
    await context.route('https://fonts.gstatic.com/**', route => {
      fonts.assets++;
      return route.fulfill({ status: 204, body: '' });
    });
    return context;
  };
  try { await f.newPage(); } finally { f.browser.newContext = newContext; }

  const editOnly = process.env.FLOW_ONLY === 'edit';
  if (!editOnly) {
    f.phase = 'Open current native pattern fixture';
    await f.openFile(file, 2);
    await waitInstances();
    const base = await f.doc();
    assert.deepEqual(base.instances.map(i => i.id).sort(), ['p1', 'p2', 'pat1-1']);
    await f.page.getByRole('button', { name: 'Iso', exact: true }).click();
    await f.page.getByTitle('Frame all (F)', { exact: true }).click();
    await f.page.locator('.ol.instance').filter({ hasText: 'Cap' }).click();

    f.phase = 'cycle-closing finish refused before document/history commit';
    await mates().getByRole('button', { name: 'Add mate', exact: true }).click();
    await mates().getByLabel('Mate type', { exact: true }).selectOption('coincident');
    await pick('p2', 'n1.top');
    await pick('p1', 'n1.bottom');
    const refusal = mates().getByRole('status', { name: 'Mate refused', exact: true });
    await refusal.waitFor();
    assert.match(await refusal.innerText(), /Mate m2 .*would leave pattern pat1 unsettled/);
    await f.same(base);
    assert.match(await mates().innerText(), /1 · Stays.*Cap/s);
    await f.snapshot('01-cycle-refused');

    f.phase = 'Cancel recovery and valid pattern mate';
    await mates().getByRole('button', { name: 'Cancel', exact: true }).click();
    await f.same(base);
    await mates().getByRole('button', { name: 'Add mate', exact: true }).click();
    await mates().getByLabel('Mate type', { exact: true }).selectOption('coincident');
    await pick('base', 'n1.top');
    await pick('p1', 'n1.bottom');
    await f.changed(base);
    await f.page.waitForFunction(() => window.__studioDoc?.instances?.find(i => i.id === 'p1')?.position[2] === 10 && window.__studioDoc?.instances?.find(i => i.id === 'pat1-1')?.position[2] === 10);
    const valid = await f.doc();
    assert.equal(valid.mates.length, 2);
    assert.deepEqual(valid.mates.at(-1).b, { part: 'p1', face: 'n1.bottom' });
    await f.snapshot('02-valid-mate');
    await f.undo(); await f.same(base);
    await f.redo(); await f.same(valid);
    await f.undo(); await f.same(base);

  }

  f.phase = 'settled feedback mate edit refused before document/history commit';
  await f.openFile(file + '.edit.bcad', 2);
  await waitInstances();
  await f.page.waitForFunction(() => window.__studioDoc?.mates?.length === 2);
  const editBase = await f.doc();
  await f.page.locator('.ol.instance').filter({ hasText: 'Cap' }).click();
  if (!await mates().getByLabel('Mate distance', { exact: true }).count()) {
    await mates().locator('button.ol.mate').filter({ hasText: 'Distance' }).click();
  }
  await mates().getByLabel('Mate distance', { exact: true }).fill('-39');
  await mates().getByLabel('Mate distance', { exact: true }).press('Enter');
  await f.page.waitForFunction(() => [...document.querySelectorAll('.toast')].some(e => /would leave pattern pat1 unsettled/.test(e.textContent)));
  await f.same(editBase);
  assert.equal(await mates().getByLabel('Mate distance', { exact: true }).inputValue(), '-40');
  await mates().getByLabel('Mate distance', { exact: true }).scrollIntoViewIfNeeded();
  await f.snapshot('03-edit-refused');
  assert.equal(fonts.assets, 0);
  assert.deepEqual(f.report.downloads, []);
  f.report.observations.push({
    finishCycleRefusal: editOnly ? 'PRIOR_RUN01_PASS' : true, firstPickRetained: editOnly ? 'PRIOR_RUN01_PASS' : true, cancelRecovery: editOnly ? 'PRIOR_RUN01_PASS' : true,
    validPatternMate: editOnly ? 'PRIOR_RUN01_PASS' : true, undoRedoExact: editOnly ? 'PRIOR_RUN01_PASS' : true, editCycleRefusal: true,
    refusalDocumentsUnchanged: true, lockCycle: 'FOCUSED_HOOK_ONLY', fonts,
    outboundFiles: 'NOT_RUN',
  });
});
