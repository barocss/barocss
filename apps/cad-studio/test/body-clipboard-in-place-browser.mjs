// D564 / #2310. Run under the heavy gate from apps/cad-studio.
// D564_SOURCE_FROZEN=1 node test/body-clipboard-in-place-browser.mjs EXTERNAL_OUTPUT
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createClipboardReplacementFlow } from './body-clipboard-replacement-helper.mjs';

const repo = resolve(import.meta.dirname, '../../..');
const { f, fixtures: [child, base], start, button, open, copySingle, bodyOracle, history, checkStale, freshPaste } =
  await createClipboardReplacementFlow({
    workId: 'D564', name: 'body-clipboard-in-place', driver: import.meta.filename, output: process.argv[2],
    required: [
      'apps/cad-studio/src/app/editInPlace.ts', 'apps/cad-studio/src/ui/NodeEditor.tsx',
      'apps/cad-studio/src/ui/InstancePanel.tsx', 'packages/barocss-cad-model/src/assembly/definitions.ts',
    ],
    limits: ['One assembly with one placed box. Public Edit part, Cancel and Finish controls.'],
  });

const banner = () => f.page.getByRole('status', { name: 'Editing a part in place', exact: true });

async function enter(label, childDoc) {
  f.phase = label;
  await f.page.locator('.ol.instance:not(.nested)').click();
  await f.page.getByRole('complementary', { name: 'Instance', exact: true })
    .getByRole('button', { name: 'Edit part', exact: true }).click();
  await banner().waitFor();
  await f.same(childDoc);
  const inside = await f.snapshot(label);
  assert.deepEqual(inside.bodies.bodies.map(body => body.key), ['b1']);
  assert.equal(inside.undo.enabled, false);
  assert.equal(inside.redo.enabled, false);
  return inside;
}

await f.run(async () => {
  await start();
  await open(base, 'open the base box');
  f.phase = 'insert the independent child box';
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Insert part').click()]);
  await chooser.setFiles(resolve(repo, child.path));
  await f.page.waitForFunction(() => window.__studioDoc.instances?.length === 1);
  await f.ready();
  const assembly = await copySingle('01-base-copied');
  const [instance] = assembly.doc.instances;
  assert.deepEqual(instance.doc, child.doc);
  assert.deepEqual(assembly.doc.nodes, base.doc.nodes);
  await bodyOracle(assembly, base, [0]);

  const inside = await enter('02-enter-child', instance.doc);
  await bodyOracle(inside, child, [0]);
  await checkStale('03-base-paste-refused-inside', inside);
  await copySingle('04-child-copied-before-cancel');

  f.phase = 'cancel unedited session';
  await banner().getByRole('button', { name: 'Cancel', exact: true }).click();
  await banner().waitFor({ state: 'hidden' });
  await f.same(assembly.doc);
  const cancelled = await f.snapshot('05-cancel-restores-assembly');
  for (const field of ['undo', 'redo', 'history', 'fileName', 'dirty']) assert.deepEqual(cancelled[field], assembly[field]);
  await checkStale('06-child-paste-refused-after-cancel', cancelled);

  await enter('07-enter-child-again', instance.doc);
  await f.openFeatureEditor(1, 'child box');
  await f.editor().getByRole('spinbutton', { name: 'Distance', exact: true }).fill('12');
  const edited = await f.applyEditor(instance.doc, '08-child-edited');
  assert.equal(edited.doc.nodes[1].height, 12);
  assert.deepEqual(Object.keys(edited.doc.outputs), ['b1']);
  await bodyOracle(edited, { size: [10, 10, 12] }, [0]);
  await copySingle('09-child-copied-before-finish');

  f.phase = 'finish edited session';
  await banner().getByRole('button', { name: 'Finish', exact: true }).click();
  await banner().waitFor({ state: 'hidden' });
  await f.page.waitForFunction(() => window.__studioDoc.instances?.length === 1);
  await f.ready();
  const finished = await f.snapshot('10-finish-returns-edited-assembly');
  const [updated] = finished.doc.instances;
  assert.equal(updated.id, instance.id);
  assert.deepEqual(updated.position, instance.position);
  assert.deepEqual(updated.rotation, instance.rotation);
  assert.deepEqual(updated.doc.nodes, edited.doc.nodes);
  assert.deepEqual(updated.doc.outputs, edited.doc.outputs);
  assert.deepEqual(finished.doc.nodes, base.doc.nodes);
  assert.deepEqual(finished.doc.outputs, base.doc.outputs);
  await bodyOracle(finished, base, [0]);
  await checkStale('11-child-paste-refused-after-finish', finished);
  await history('Undo', '12-undo-finish', assembly.doc);
  await history('Redo', '13-redo-finish', finished.doc);

  const pasted = await freshPaste(finished.doc, base, 22);
  assert.deepEqual(pasted.doc.instances, finished.doc.instances);
  assert.deepEqual(f.report.downloads, []);
});
