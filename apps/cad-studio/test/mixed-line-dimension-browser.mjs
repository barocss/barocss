// D536_SOURCE_FROZEN=1 node test/mixed-line-dimension-browser.mjs /ABS/NEW/OUTPUT
// One retained mixed sketch driving-line dependency lifecycle. Root owns execution/image review.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {isAbsolute, join, relative, resolve} from 'node:path';
import {createFlow, sha256} from './flow-helper.mjs';
import {inspectorSource, oracleSource} from './mixed-line-dimension-oracles.mjs';

const output = process.argv[2], repo = resolve(import.meta.dirname, '../../..');
const seedFile = '/tmp/barocss-d461-workflow-run01/07-saved-R3-opfs.bcad';
assert.ok(output && isAbsolute(output)); assert.ok(relative(repo, resolve(output)).startsWith('../')); await mkdir(output);
const seedBytes = await readFile(seedFile);
assert.equal(sha256(seedBytes), 'cdfeb4bda2509da3748a3c1ae071a682e7408ee0bdabb5595ae74062b30b4758');
const seedDoc = JSON.parse(seedBytes), projectName = `D536-${randomUUID()}`, partName = 'D536-mixed-line';
const f = await createFlow({name: 'mixed-line-dimension', envFrozen: 'D536_SOURCE_FROZEN', output, inspectorSource, oracleSource,
  qualification: 'D536 retained mixed R3 sketch driving line60 to64, Finish overlap refusal/FIRST history, own project roundtrip and line68',
  initialFiles: ['apps/cad-studio/test/mixed-line-dimension-browser.mjs', 'apps/cad-studio/test/mixed-line-dimension-oracles.mjs', 'apps/cad-studio/test/mixed-line-dimension-preflight.mjs', seedFile],
  extraFrozen: ['packages/barocss-cad-model/src/sketch/settle.ts', 'packages/barocss-cad-model/src/sketch/outlineFields.ts'],
  requiredFrozen: ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/SketchPanel.tsx', 'apps/cad-studio/src/sketch/useSketchActions.ts', 'packages/barocss-cad-model/src/sketch/settle.ts', 'packages/barocss-cad-model/src/engine/evaluate.ts'],
  limits: ['Desktop WebGPU 1440x900 only; root must view original screenshots.',
    'Retained D461 R3 antecedent; no Round creation/radius loop replay or named sketch-parameter binding.',
    'Actual accepted Finish Docs are captured, not forced to controlled candidate unlocked coordinates. High checks actual solver residuals and original native final/pre-Fillet geometry separately.',
    'Length10 is a profile Finish overlap refusal, not native PARAMETER or NodeEditor Apply. Cancel closes local sketch before FIRST document Undo.',
    'Historical n2 reference signature stays the seed creation anchor; it is not a current physical measurement.',
    'Project Open is the public project consumer, not standalone verifyDocumentFile. Only the owned UUID OPFS namespace is written/removed; no export/download/mobile/release.'],
  snapshotExtra: () => ({documentJSON: JSON.stringify(window.__studioDoc), worker: window.__studioBodies?.(), rootFresh: window.__studioFresh,
    historyRows: [...document.querySelectorAll('.history .hs')].map(row => ({index: row.getAttribute('data-node-index'), label: row.getAttribute('aria-label'), text: row.textContent, suppressed: row.classList.contains('suppressed')})),
    sketchFields: [...document.querySelectorAll('.sk-panel input')].map(field => ({label: field.getAttribute('aria-label'), value: field.value, locked: field.classList.contains('locked')})),
    sketchConstraints: [...document.querySelectorAll('.sk-panel .kv')].map(row => row.textContent),
    sketchAlerts: [...document.querySelectorAll('.sk-panel [role="alert"]')].map(row => row.textContent),
    alerts: [...document.querySelectorAll('.toast[role="alert"]')].map(row => row.textContent),
    activePath: document.querySelector('[aria-label="Project documents"] [data-active="true"]')?.textContent ?? null,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]')}),
});
f.report.seed = {file: seedFile, bytes: seedBytes.length, sha256: sha256(seedBytes), authority: 'retained R3 antecedent; original S physical binding at FIRST Undo'};
f.report.projectName = projectName;
const nativeCache = new Map(), labels = new Set(); let projectCreated = false;
const capture = async label => {
  assert.ok(!labels.has(label)); labels.add(label); const state = await f.snapshot(label);
  await writeFile(join(output, `${label}-actual.bcad`), state.documentJSON); return state;
};
const invariant = (doc, length) => {
  assert.deepEqual({...doc, nodes: seedDoc.nodes}, seedDoc, 'document envelope/output/nextId retained');
  assert.equal(doc.nodes.length, 3); assert.deepEqual(doc.nodes.slice(1), seedDoc.nodes.slice(1), 'downstream features/references/historical signatures retained');
  const sketch = doc.nodes[0], original = seedDoc.nodes[0];
  const {segments, outline, ...extras} = sketch, {segments: oldSegments, outline: oldOutline, ...oldExtras} = original;
  assert.deepEqual(extras, oldExtras, 'holes/construction/sideTags/ID and other sketch fields retained');
  assert.deepEqual(outline.lengths, {'0': length, '1': 20});
  const {points, bulges, lengths, ...constraints} = outline, {points: oldPoints, bulges: oldBulges, lengths: oldLengths, ...oldConstraints} = oldOutline;
  assert.deepEqual(constraints, oldConstraints, 'R3/tangents/HV and other constraints retained');
  assert.equal(segments.length, oldSegments.length); assert.deepEqual(segments.map(s => s.kind), oldSegments.map(s => s.kind));
  assert.equal(points.length, oldPoints.length); assert.equal(bulges.length, oldBulges.length);
};
const qualify = async (label, expectedDoc, length) => {
  f.phase = label; await f.same(expectedDoc); await f.ready(); const state = await capture(label), key = sha256(state.documentJSON);
  const previous = nativeCache.get(key), parameters = {length};
  const read = previous?.read ?? await f.inspect(`${label}-native`, state.doc, {label, parameters});
  f.report.reads.push({label, read, exactWholeDocSha256: key, reusedFrom: previous?.label ?? null});
  const input = {doc: state.doc, documentJSON: state.documentJSON, expectedDoc, seedDoc, read, consumer: state, parameters};
  await writeFile(join(output, `${label}-oracle-input.json`), JSON.stringify(input, null, 2));
  const run = spawnSync('python3', ['-I', join(output, 'mixed-line-dimension-oracle.py')], {input: JSON.stringify(input), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
  await writeFile(join(output, `${label}-oracle.stdout.json`), run.stdout ?? ''); await writeFile(join(output, `${label}-oracle.stderr.txt`), run.stderr ?? '');
  let parsed = null; try { parsed = JSON.parse(run.stdout ?? ''); } catch { /* Preserve the original first failure. */ }
  f.report.oracles.push({label, exit: run.status, signal: run.signal, stdout: parsed, stderr: run.stderr, reusedNativeFrom: previous?.label ?? null}); await f.persist();
  assert.equal(run.error, undefined); assert.equal(run.status, 0, run.stderr); assert.equal(parsed?.status, 'PASS_ONE_DECLARED_D536_MIXED_LINE_DIMENSION_STATE');
  invariant(state.doc, length); assert.deepEqual(state.doc, expectedDoc); assert.equal(state.rootFresh, true); assert.equal(state.worker.fresh, true); assert.equal(state.worker.massReady, true);
  if (!previous) nativeCache.set(key, {label, read}); return state;
};
const reopen = async label => {
  f.phase = label; await f.page.getByRole('button', {name: 'Model', exact: true}).click(); await f.closeEditor();
  await f.openFeatureEditor(1, label); await f.editor().getByRole('button', {name: 'Edit sketch', exact: true}).click();
  await f.sketchPanel().waitFor(); await f.sketchPanel().getByLabel('Edge 1 length', {exact: true}).waitFor();
};
const typeLength = async (oldLength, length, label) => {
  const field = f.sketchPanel().getByLabel('Edge 1 length', {exact: true}); assert.equal(Number(await field.inputValue()), oldLength);
  await field.fill(String(length)); await field.press('Enter');
  await f.page.waitForFunction(length => { const field = document.querySelector('.sk-panel input[aria-label="Edge 1 length"]'); return field && Number(field.value) === length && field.classList.contains('locked') && !document.querySelector('.sk-panel [role="alert"]'); }, length);
  return capture(label);
};
const finish = async (previous, label) => {
  f.phase = label; await f.page.locator('.topbar button.finish').click(); await f.sketchPanel().waitFor({state: 'hidden'});
  await f.changed(previous); await f.ready(); const actual = await capture(label); return actual.doc;
};
const versions = async () => {
  await f.closeEditor(); await f.page.getByRole('button', {name: 'Model', exact: true}).click(); const card = f.page.getByLabel('Versions panel', {exact: true});
  if (!await card.isVisible()) await f.page.getByRole('button', {name: 'Project and versions', exact: true}).click(); await card.waitFor(); return card;
};
await f.run(async () => {
  await f.newPage(); await f.page.setViewportSize({width: 1440, height: 900});
  try {
    await f.openFile(seedFile, 3); await f.same(seedDoc); await capture('00-original-R3-seed-antecedent');
    await reopen('01-reopen-original-sketch'); await typeLength(60, 64, '01-driving-line64-local');
    const A = await finish(seedDoc, '02-actual-Finish-A64-before-assert');
    const acceptedA = await qualify('03-A-line64', A, 64);

    await f.dismissToasts(); await reopen('04-reopen-for-positive-invalid-line10');
    await typeLength(64, 10, '04-line10-local-before-Finish');
    await f.page.locator('.topbar button.finish').click();
    const alert = f.page.getByRole('alert').filter({hasText: 'Finish the profile first'}); await alert.waitFor();
    const refused = await capture('05-line10-Finish-refused-before-assert');
    assert.match(await alert.textContent(), /Shapes 1 and 2 overlap: draw them as one outline, or put one in its own sketch\./);
    assert.deepEqual(refused.doc, A); assert.deepEqual(refused.historyRows, acceptedA.historyRows); assert.deepEqual(refused.worker.bodies, acceptedA.worker.bodies);
    f.report.observations.push({label: 'positive-line10-Finish-overlap-refusal', actualReason: await alert.textContent(), authority: 'profileOf admission refusal; not native PARAMETER or NodeEditor Apply'});
    await f.page.evaluate(() => document.activeElement?.blur()); await f.page.keyboard.press('Escape');
    await f.sketchPanel().waitFor({state: 'hidden'}); await f.dismissToasts();
    await qualify('06-refusal-retains-A64', A, 64);
    await f.undo(); await qualify('07-FIRST-document-Undo-exact-S60', seedDoc, 60);
    await f.redo(); await qualify('08-Redo-exact-captured-A64', A, 64);

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
    await writeFile(join(output, '09-own-native-opfs-save.bcad'), new Uint8Array(saved.bytes));
    assert.deepEqual(JSON.parse(new TextDecoder().decode(new Uint8Array(saved.bytes))), A);
    f.report.ownedSave = {namespace: `projects/${projectName}`, path: `${partName}.bcad`, bytes: saved.size, sha256: sha256(new Uint8Array(saved.bytes)), exactAcceptedDoc: true};
    await qualify('09-own-project-saved-A64', A, 64);
    const context = f.context; await card.getByRole('button', {name: 'Close project', exact: true}).click();
    await card.getByLabel('Project', {exact: true}).waitFor({state: 'detached'}); await f.page.reload(); await f.ready(); assert.equal(f.context, context);
    card = await versions(); await card.getByLabel('Browser project name', {exact: true}).fill(projectName);
    await card.getByRole('button', {name: 'Project in this browser', exact: true}).click(); await card.getByLabel('Project', {exact: true}).waitFor();
    await card.getByRole('button', {name: `Open ${partName}.bcad`, exact: true}).click(); await f.same(A); await f.ready();
    await qualify('10-own-project-reopened-exact-A64', A, 64);
    await reopen('11-postOpen-reopen-sketch'); await typeLength(64, 68, '11-postOpen-driving-line68-local');
    const B = await finish(A, '12-actual-Finish-B68-before-assert'); await qualify('13-postOpen-B-line68', B, 68);
    assert.equal(nativeCache.size, 3); assert.equal(f.report.reads.length, 7); assert.deepEqual(f.report.downloads, []);
    f.report.nativeCaptures = nativeCache.size; f.report.currentWorkerBindings = f.report.reads.length;
    f.report.exactWholeDocNativeReuses = f.report.reads.filter(read => read.reusedFrom !== null).length; assert.equal(f.report.exactWholeDocNativeReuses, 4);
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
