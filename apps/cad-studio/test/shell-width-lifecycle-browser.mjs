// D535: one retained open-top Shell source-width/history/refusal/wall/project lifecycle.
// D535_SOURCE_FROZEN=1 node test/shell-width-lifecycle-browser.mjs /ABS/NEW/OUTPUT
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {isAbsolute, join, relative, resolve} from 'node:path';
import {createFlow, sha256} from './flow-helper.mjs';
import {inspectorSource, oracleSource} from './shell-width-lifecycle-oracles.mjs';

const output = process.argv[2], repo = resolve(import.meta.dirname, '../../..');
const seedFile = '/tmp/barocss-d449-category-run01/shell-edited.bcad';
assert.ok(output && isAbsolute(output)); assert.ok(relative(repo, resolve(output)).startsWith('../')); await mkdir(output);
const seedBytes = await readFile(seedFile);
assert.equal(seedBytes.length, 582); assert.equal(sha256(seedBytes), '17351eb2ad01ffbafcf9c76d21e2da5030b794600ca80a55a41a0928fdbaf6c9');
const seedDoc = JSON.parse(seedBytes), projectName = `D535-${randomUUID()}`, partName = 'D535-shell-width';
const f = await createFlow({name: 'shell-width-lifecycle', envFrozen: 'D535_SOURCE_FROZEN', output, inspectorSource, oracleSource,
  qualification: 'D535 one retained open-top Shell source Width80 to60, collapse Apply refusal and FIRST history, Wall3 to2, own project roundtrip and Width70',
  initialFiles: ['apps/cad-studio/test/shell-width-lifecycle-browser.mjs', 'apps/cad-studio/test/shell-width-lifecycle-oracles.mjs', seedFile],
  requiredFrozen: ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx', 'apps/cad-studio/src/state/useFeatureHistory.ts', 'packages/barocss-cad-model/src/engine/evaluate.ts'],
  limits: ['Desktop WebGPU 1440x900 only; root must review original screenshots.', 'Retained D449 open-top Shell; no recreation or full Shell/thicken/core/P1 acceptance.',
    'Four High-defined physical classes S80/3,A60/3,B60/2,C70/2. Initial Open is an antecedent; FIRST Undo binds S to fresh native proof.',
    'Invalid source Width4 at Wall3 is a NodeEditor Apply refusal, not a preview. FIRST Undo after refusal must reach exact original S.',
    'Stored n2 top signature is the historical creation anchor p20/area3200 and stays unchanged. Current parent face geometry is observed independently; stored anchor is not a current measurement.',
    'Project Open is the public project consumer, not a standalone verifyDocumentFile/rematching certificate.',
    'High native BRep/mass authority and independent literal Python are separate from current Worker/display observations. Only owned OPFS project is written/removed; no download/export/mobile/release.'],
  snapshotExtra: () => ({documentJSON: JSON.stringify(window.__studioDoc), worker: window.__studioBodies?.(), rootFresh: window.__studioFresh,
    historyRows: [...document.querySelectorAll('.history .hs')].map(row => ({index: row.getAttribute('data-node-index'), label: row.getAttribute('aria-label'), text: row.textContent, suppressed: row.classList.contains('suppressed')})),
    editorFields: [...document.querySelectorAll('.node-editor input,.node-editor select')].map(field => ({label: field.getAttribute('aria-label'), value: field.value})),
    alerts: [...document.querySelectorAll('.toast[role="alert"]')].map(alert => alert.textContent),
    project: document.querySelector('[aria-label="Project"]')?.textContent ?? null,
    activePath: document.querySelector('[aria-label="Project documents"] [data-active="true"]')?.textContent ?? null,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]')}),
});
f.report.seed = {file: seedFile, sha256: sha256(seedBytes), bytes: seedBytes.length, authority: 'retained open-top Shell antecedent; S physical consumer qualified at FIRST Undo'};
f.report.projectName = projectName;
const nativeCache = new Map(), labels = new Set(); let projectCreated = false;
const capture = async label => {
  assert.ok(!labels.has(label)); labels.add(label); const state = await f.snapshot(label);
  await writeFile(join(output, `${label}-actual.bcad`), state.documentJSON); return state;
};
const parameters = (width, wall) => ({width, wall});
const expected = (width, wall) => {
  const doc = structuredClone(seedDoc), sketch = doc.nodes[0];
  sketch.max[0] = width - 20;
  sketch.outline.points = sketch.outline.points.map(([x, y]) => [x === 60 ? width - 20 : x, y]);
  sketch.outline.lengths['0'] = width;
  doc.nodes[2].thickness = wall;
  return doc;
};
const qualify = async (label, expectedDoc, params) => {
  f.phase = label; await f.same(expectedDoc); await f.ready(); const state = await capture(label), key = sha256(state.documentJSON);
  const previous = nativeCache.get(key), read = previous?.read ?? await f.inspect(`${label}-native`, state.doc, {label, parameters: params});
  f.report.reads.push({label, read, exactWholeDocSha256: key, reusedFrom: previous?.label ?? null});
  const input = {doc: state.doc, documentJSON: state.documentJSON, expectedDoc, seedDoc, read, consumer: state, parameters: params};
  await writeFile(join(output, `${label}-oracle-input.json`), JSON.stringify(input, null, 2));
  const run = spawnSync('python3', ['-I', join(output, 'shell-width-lifecycle-oracle.py')], {input: JSON.stringify(input), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
  await writeFile(join(output, `${label}-oracle.stdout.json`), run.stdout ?? ''); await writeFile(join(output, `${label}-oracle.stderr.txt`), run.stderr ?? '');
  let parsed = null; try { parsed = JSON.parse(run.stdout ?? ''); } catch { /* Original output remains the failure evidence. */ }
  f.report.oracles.push({label, exit: run.status, signal: run.signal, stdout: parsed, stderr: run.stderr, reusedNativeFrom: previous?.label ?? null}); await f.persist();
  assert.equal(run.error, undefined); assert.equal(run.status, 0, run.stderr); assert.equal(parsed?.status, 'PASS_ONE_DECLARED_D535_SHELL_WIDTH_STATE');
  assert.deepEqual(state.doc, expectedDoc); assert.equal(state.rootFresh, true); assert.equal(state.worker.fresh, true); assert.equal(state.worker.massReady, true);
  if (!previous) nativeCache.set(key, {label, read}); return state;
};
const edit = async (index, fieldName, oldValue, value, previous, label) => {
  await f.openFeatureEditor(index, label); const field = f.editor().getByLabel(fieldName, {exact: true});
  assert.equal(Number(await field.inputValue()), oldValue); await field.fill(String(value)); await capture(`${label}-typed`);
  await f.editor().getByRole('button', {name: 'Apply', exact: true}).click(); await f.changed(previous); await f.closeEditor();
};
const versions = async () => {
  await f.closeEditor(); await f.page.getByRole('button', {name: 'Model', exact: true}).click(); const card = f.page.getByLabel('Versions panel', {exact: true});
  if (!await card.isVisible()) await f.page.getByRole('button', {name: 'Project and versions', exact: true}).click(); await card.waitFor(); return card;
};
await f.run(async () => {
  await f.newPage(); await f.page.setViewportSize({width: 1440, height: 900});
  try {
    f.phase = 'public Open exact retained open-top Shell S80/3';
    await f.openFile(seedFile, 3); await f.same(seedDoc); await capture('00-retained-open-top-shell-antecedent');
    f.phase = 'public original Extrude Width80 to60 at Wall3';
    await edit(1, 'Width', 80, 60, seedDoc, '01-source-width60');
    const A = expected(60, 3), acceptedA = await qualify('02-A-width60-wall3', A, parameters(60, 3));

    f.phase = 'invalid source Width4 Apply collapses hollow and retains accepted A';
    await f.dismissToasts(); await f.openFeatureEditor(1, 'invalid-source-width4');
    const width = f.editor().getByLabel('Width', {exact: true}); assert.equal(Number(await width.inputValue()), 60);
    await width.fill('4'); await capture('03-source-width4-typed-before-Apply');
    await f.editor().getByRole('button', {name: 'Apply', exact: true}).click();
    const alert = f.page.getByRole('alert').filter({hasText: 'The design was not changed'}); await alert.waitFor({timeout: 60000});
    const details = alert.locator('details summary'); if (await details.count()) await details.click();
    const refused = await capture('04-source-width4-Apply-refused');
    assert.match(await alert.textContent(), /a wall of 3 mm leaves no hollow inside this body/i);
    assert.deepEqual(refused.doc, A); assert.deepEqual(refused.historyRows, acceptedA.historyRows); assert.deepEqual(refused.worker.bodies, acceptedA.worker.bodies);
    f.report.observations.push({label: 'source-width4-shell-collapse-Apply-refusal', actualReason: await alert.textContent(),
      nativeCategoryAuthority: 'PARAMETER from focused native control; GUI records actual specific reason', previewClaim: 'NONE'});
    await f.closeEditor(); await alert.getByRole('button', {name: 'Dismiss', exact: true}).click();
    await qualify('05-refused-Apply-retains-A60-wall3', A, parameters(60, 3));
    f.phase = 'FIRST Undo after refused Apply restores exact S80/3, then Redo A60/3';
    await f.undo(); await qualify('06-FIRST-undo-after-refusal-exact-S80-wall3', seedDoc, parameters(80, 3));
    await f.redo(); await qualify('07-redo-exact-A60-wall3', A, parameters(60, 3));

    f.phase = 'public Shell Wall3 to2 at Width60';
    await edit(2, 'Wall', 3, 2, A, '08-shell-wall2');
    const B = expected(60, 2); await qualify('09-B-width60-wall2', B, parameters(60, 2));

    f.phase = 'own project public Save Close same-context reload Open B';
    let card = await versions();
    const absent = await f.page.evaluate(async name => {
      const root = await navigator.storage.getDirectory();
      try { const projects = await root.getDirectoryHandle('projects'); await projects.getDirectoryHandle(name); return false; }
      catch (error) { if (error.name === 'NotFoundError') return true; throw error; }
    }, projectName); assert.equal(absent, true, 'Never overwrite an existing namespace');
    await card.getByLabel('Browser project name', {exact: true}).fill(projectName);
    await card.getByRole('button', {name: 'Project in this browser', exact: true}).click(); await card.getByLabel('Project', {exact: true}).waitFor(); projectCreated = true;
    await f.page.locator('.doc-tab input').fill(partName); await f.page.getByRole('button', {name: 'Save', exact: true}).click();
    await f.page.getByLabel('Unsaved changes', {exact: true}).waitFor({state: 'detached'});
    await card.locator('[aria-label="Project documents"] li[data-active="true"]').filter({hasText: `${partName}.bcad`}).waitFor();
    const saved = await f.page.evaluate(async ({projectName, partName}) => {
      const root = await navigator.storage.getDirectory(), directory = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(projectName);
      const file = await (await directory.getFileHandle(`${partName}.bcad`)).getFile(); return {bytes: Array.from(new Uint8Array(await file.arrayBuffer())), size: file.size};
    }, {projectName, partName});
    await writeFile(join(output, '10-own-native-opfs-save.bcad'), new Uint8Array(saved.bytes));
    assert.deepEqual(JSON.parse(new TextDecoder().decode(new Uint8Array(saved.bytes))), B);
    f.report.ownedSave = {namespace: `projects/${projectName}`, path: `${partName}.bcad`, bytes: saved.size, sha256: sha256(new Uint8Array(saved.bytes)), exactAcceptedDoc: true};
    await qualify('10-own-project-saved-B60-wall2', B, parameters(60, 2));
    const context = f.context; await card.getByRole('button', {name: 'Close project', exact: true}).click();
    await card.getByLabel('Project', {exact: true}).waitFor({state: 'detached'}); await f.page.reload(); await f.ready(); assert.equal(f.context, context);
    card = await versions(); await card.getByLabel('Browser project name', {exact: true}).fill(projectName);
    await card.getByRole('button', {name: 'Project in this browser', exact: true}).click(); await card.getByLabel('Project', {exact: true}).waitFor();
    await card.getByRole('button', {name: `Open ${partName}.bcad`, exact: true}).click(); await f.same(B); await f.ready();
    await qualify('11-own-project-reopened-B60-wall2', B, parameters(60, 2));
    f.phase = 'post-Open original Extrude Width60 to70 at Wall2';
    await edit(1, 'Width', 60, 70, B, '12-postOpen-source-width70');
    const C = expected(70, 2); await qualify('13-C-postOpen-width70-wall2', C, parameters(70, 2));
    assert.equal(nativeCache.size, 4); assert.deepEqual(f.report.downloads, []);
    f.report.nativeCaptures = nativeCache.size; f.report.currentWorkerBindings = f.report.reads.length;
    f.report.exactWholeDocNativeReuses = f.report.reads.filter(read => read.reusedFrom !== null).length;
  } finally {
    if (projectCreated) {
      const cleanup = {ownedProject: projectName};
      try {
        const card = await versions(), close = card.getByRole('button', {name: 'Close project', exact: true}); if (await close.count()) await close.click();
        cleanup.namespace = await f.page.evaluate(async name => {
          const root = await navigator.storage.getDirectory(), projects = await root.getDirectoryHandle('projects'); await projects.removeEntry(name, {recursive: true});
          try { await projects.getDirectoryHandle(name); return 'STILL_PRESENT'; } catch (error) { if (error.name === 'NotFoundError') return 'REMOVED_AND_ABSENT'; throw error; }
        }, projectName); assert.equal(cleanup.namespace, 'REMOVED_AND_ABSENT');
      } finally { f.report.cleanup.push(cleanup); await f.persist(); }
    }
  }
});
