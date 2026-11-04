// D537_SOURCE_FROZEN=1 node test/named-sketch-length-browser.mjs /ABS/NEW/OUTPUT
// One retained mixed sketch driving-line dependency lifecycle. Root owns execution/image review.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {isAbsolute, join, relative, resolve} from 'node:path';
import {createFlow, sha256} from './flow-helper.mjs';
import {inspectorSource, oracleSource} from './named-sketch-length-oracles.mjs';

const output = process.argv[2], repo = resolve(import.meta.dirname, '../../..');
const seedFile = '/tmp/barocss-d461-workflow-run01/07-saved-R3-opfs.bcad';
assert.ok(output && isAbsolute(output)); assert.ok(relative(repo, resolve(output)).startsWith('../')); await mkdir(output);
const seedBytes = await readFile(seedFile);
assert.equal(sha256(seedBytes), 'cdfeb4bda2509da3748a3c1ae071a682e7408ee0bdabb5595ae74062b30b4758');
const seedDoc = JSON.parse(seedBytes), projectName = `D537-${randomUUID()}`, partName = 'D537-mixed-line';
const continuationFile = process.env.D537_CONTINUE_UNBOUND_FROM;
const boundContinuationFile = process.env.D537_CONTINUE_BOUND_FROM;
assert.ok(!(continuationFile && boundContinuationFile), 'Choose one continuation entry point');
const recheckBindFile = process.env.D537_RECHECK_BIND_FROM;
let recheckBindDoc = null, recheckBindBytes = null;
if (recheckBindFile) {
  assert.ok(boundContinuationFile && isAbsolute(recheckBindFile), 'Recheck bind needs bound-tail mode and an absolute input');
  recheckBindBytes = await readFile(recheckBindFile); recheckBindDoc = JSON.parse(recheckBindBytes);
  assert.deepEqual(recheckBindDoc, {...seedDoc, parameters: {L: 64}}, 'Recheck bind uses original numeric60 seed plus L64');
}
let boundContinuationDoc = null, boundContinuationBytes = null;
if (boundContinuationFile) {
  assert.ok(isAbsolute(boundContinuationFile), 'Bound continuation input must use an absolute path');
  boundContinuationBytes = await readFile(boundContinuationFile);
  assert.equal(sha256(boundContinuationBytes), 'b35fb299669b05efce35e36e180dc8d72922cb4d0aec4bd511c7cab122817beb', 'Exact captured Studio02 postOpen Span64 bytes');
  boundContinuationDoc = JSON.parse(boundContinuationBytes);
  const n = boundContinuationDoc.nodes[0], {kind, id, ...originalSeed} = seedDoc.nodes[0];
  assert.deepEqual(boundContinuationDoc.parameters, {Span: 64});
  assert.equal(n.kind, 'driven-sketch'); assert.equal(n.version, 1); assert.equal(n.id, id);
  assert.deepEqual(n.seed, originalSeed, 'Bound continuation keeps original numeric60 seed');
  assert.deepEqual(n.bindings, [{kind: 'line-length', entity: 'e1', value: {parameter: 'Span'}}]);
  assert.deepEqual({...boundContinuationDoc, nodes: seedDoc.nodes, parameters: {}}, seedDoc);
  assert.deepEqual(boundContinuationDoc.nodes[1], seedDoc.nodes[1]);
  const {sigs, ...fillet} = boundContinuationDoc.nodes[2], {sigs: oldSigs, ...originalFillet} = seedDoc.nodes[2];
  assert.deepEqual(fillet, originalFillet, 'Only refreshed reference signatures may differ downstream');
}
let continuationDoc = null, continuationBytes = null;
if (continuationFile) {
  assert.ok(isAbsolute(continuationFile), 'Continuation input must use an absolute path');
  continuationBytes = await readFile(continuationFile); continuationDoc = JSON.parse(continuationBytes);
  assert.deepEqual(continuationDoc, {...seedDoc, parameters: {L: 64}}, 'Continue only the exact captured unbound seed plus accepted L64');
}
const f = await createFlow({name: 'named-sketch-length', envFrozen: 'D537_SOURCE_FROZEN', output, inspectorSource, oracleSource,
  qualification: 'D537 actual named mixed line bind64/update68/refuse10/FIRST history/rename/project Open/unbind/numeric edit',
  initialFiles: ['apps/cad-studio/test/named-sketch-length-browser.mjs', 'apps/cad-studio/test/named-sketch-length-oracles.mjs', 'apps/cad-studio/test/mixed-line-dimension-preflight.mjs', seedFile, ...(continuationFile ? [continuationFile] : []), ...(boundContinuationFile ? [boundContinuationFile] : []), ...(recheckBindFile ? [recheckBindFile] : [])],
  extraFrozen: ['packages/barocss-cad-model/src/sketch/settle.ts', 'packages/barocss-cad-model/src/sketch/outlineFields.ts'],
  requiredFrozen: ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/SketchPanel.tsx', 'apps/cad-studio/src/sketch/useSketchActions.ts', 'packages/barocss-cad-model/src/sketch/settle.ts', 'packages/barocss-cad-model/src/engine/evaluate.ts'],
  limits: ['Desktop WebGPU 1440x900 only; root must view original screenshots.',
    'Original raw driven Doc is native producer input; resolved numeric sketch is a labelled observation only.',
    'Independent original line/arc/native graph mathematics cover only selected60/64/68 classes; source residual and native budgets remain separate.',
    'Project Open uses an owned UUID namespace; no export/download/mobile/release.'],
  snapshotExtra: () => ({documentJSON: JSON.stringify(window.__studioDoc), worker: window.__studioBodies?.(), rootFresh: window.__studioFresh,
    workerMessageCount: window.__d537WorkerMessageCount ?? null,
    historyRows: [...document.querySelectorAll('.history .hs')].map(row => ({index: row.getAttribute('data-node-index'), label: row.getAttribute('aria-label'), text: row.textContent, suppressed: row.classList.contains('suppressed')})),
    sketchFields: [...document.querySelectorAll('.sk-panel input')].map(field => ({label: field.getAttribute('aria-label'), value: field.value, locked: field.classList.contains('locked')})),
    sketchConstraints: [...document.querySelectorAll('.sk-panel .kv')].map(row => row.textContent),
    sketchAlerts: [...document.querySelectorAll('.sk-panel [role="alert"]')].map(row => row.textContent),
    alerts: [...document.querySelectorAll('.toast[role="alert"]')].map(row => row.textContent),
    activePath: document.querySelector('[aria-label="Project documents"] [data-active="true"]')?.textContent ?? null,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]')}),
});
f.report.seed = {file: seedFile, bytes: seedBytes.length, sha256: sha256(seedBytes), authority: 'retained original numeric60 authored seed; bound64 FIRST Undo state is separate'};
f.report.projectName = projectName;
if (recheckBindFile) f.report.recheckBind = {file: recheckBindFile, bytes: recheckBindBytes.length, sha256: sha256(recheckBindBytes), authority: 'Repeat only affected actual binding action under the corrected NodeEditor markup'};
if (boundContinuationFile) f.report.boundContinuation = {file: boundContinuationFile, bytes: boundContinuationBytes.length, sha256: sha256(boundContinuationBytes), authority: 'Captured accepted postOpen bound Span64; accepted prefix retained in Studio02, only unbind and numeric edit run here'};
if (continuationFile) f.report.continuation = {file: continuationFile, bytes: continuationBytes.length, sha256: sha256(continuationBytes), authority: 'Exact captured accepted unbound numeric60 seed plus L64; previous add-parameter prefix retained in Studio01'};
const nativeCache = new Map(), labels = new Set(); let projectCreated = false;
const capture = async label => {
  assert.ok(!labels.has(label)); labels.add(label); const state = await f.snapshot(label);
  await writeFile(join(output, `${label}-actual.bcad`), state.documentJSON); return state;
};
let authoredSeed = null, parameterName = 'L';
const invariant = (doc, length) => {
  assert.equal(doc.nodes.length, 3); assert.deepEqual(doc.nodes[1], seedDoc.nodes[1]);
  const {sigs, ...fillet} = doc.nodes[2], {sigs: oldSigs, ...originalFillet} = seedDoc.nodes[2];
  assert.deepEqual(fillet, originalFillet, 'downstream Fillet ownership and reference retained');
  const n = doc.nodes[0];
  if (n.kind === 'driven-sketch') {
    assert.equal(n.version, 1); assert.deepEqual(n.seed, authoredSeed);
    assert.deepEqual(n.bindings, [{kind: 'line-length', entity: 'e1', value: {parameter: parameterName}}]);
    assert.deepEqual(doc.parameters, {[parameterName]: length});
  } else { assert.equal(n.kind, 'sketch'); assert.equal(n.outline.lengths['0'], length); }
};
const qualify = async (label, expectedDoc, length) => {
  f.phase = label; await f.same(expectedDoc); await f.ready(); const state = await capture(label), key = sha256(state.documentJSON);
  const previous = nativeCache.get(key), parameters = {length};
  const read = previous?.read ?? await f.inspect(`${label}-native`, state.doc, {label, parameters});
  f.report.reads.push({label, read, exactWholeDocSha256: key, reusedFrom: previous?.label ?? null});
  const input = {doc: state.doc, documentJSON: state.documentJSON, expectedDoc, seedDoc, authoredSeed, parameterName, read, consumer: state, parameters};
  await writeFile(join(output, `${label}-oracle-input.json`), JSON.stringify(input, null, 2));
  const run = spawnSync('python3', ['-I', join(output, 'named-sketch-length-oracle.py')], {input: JSON.stringify(input), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
  await writeFile(join(output, `${label}-oracle.stdout.json`), run.stdout ?? ''); await writeFile(join(output, `${label}-oracle.stderr.txt`), run.stderr ?? '');
  let parsed = null; try { parsed = JSON.parse(run.stdout ?? ''); } catch { /* Preserve the original first failure. */ }
  f.report.oracles.push({label, exit: run.status, signal: run.signal, stdout: parsed, stderr: run.stderr, reusedNativeFrom: previous?.label ?? null}); await f.persist();
  assert.equal(run.error, undefined); assert.equal(run.status, 0, run.stderr); assert.equal(parsed?.status, 'PASS_ONE_DECLARED_D537_NAMED_SKETCH_LENGTH_STATE');
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
    let C;
    if (boundContinuationFile) {
      if (recheckBindFile) {
        await f.openFile(recheckBindFile, 3); await f.same(recheckBindDoc);
        await f.openFeatureEditor(1, '02-recheck-bind-current-markup');
        const bindSelect = f.editor().getByLabel('Length of edge 1 parameter', {exact: true});
        const bindDOM = await bindSelect.evaluate(select => ({outerHTML: select.outerHTML, disabled: select.disabled, value: select.value,
          parentTag: select.closest('.field')?.tagName ?? null, closestLabel: select.closest('label')?.outerHTML ?? null,
          options: [...select.options].map(option => ({value: option.value, disabled: option.disabled, selected: option.selected, outerHTML: option.outerHTML})),
          controls: [...(select.closest('.field')?.querySelectorAll('input,select') ?? [])].map(control => ({tag: control.tagName, label: control.getAttribute('aria-label'), disabled: control.disabled})),
        }));
        await writeFile(join(output, '02-before-recheck-bind-select-dom.json'), JSON.stringify(bindDOM, null, 2));
        f.report.observations.push({label: 'before-actual-recheck-bind', DOM: bindDOM}); await f.persist();
        await bindSelect.selectOption('L'); await f.applyEditor(recheckBindDoc, '02-rechecked-bound-A64-before-assert');
        const rechecked = await f.doc(); authoredSeed = rechecked.nodes[0].seed; parameterName = 'L';
        const {kind, id, ...originalSeed} = seedDoc.nodes[0]; assert.deepEqual(authoredSeed, originalSeed);
        await qualify('03-rechecked-bind-current-markup-A64', rechecked, 64);
        await f.newPage(); await f.page.setViewportSize({width: 1440, height: 900});
      }
      await f.openFile(boundContinuationFile, 3); await f.same(boundContinuationDoc);
      authoredSeed = boundContinuationDoc.nodes[0].seed; parameterName = 'Span'; C = boundContinuationDoc;
      await capture('13-continuation-postOpen-bound-Span64');
    } else {
      if (continuationFile) {
        await f.openFile(continuationFile, 3); await f.same(continuationDoc); await capture('01-continuation-accepted-unbound-L64');
      } else {
        await f.openFile(seedFile, 3); await f.same(seedDoc); await capture('00-original-R3-seed');
        await f.addParameter('L', 64, '01-add-L64');
      }
      const unbound = await f.doc();
      await f.openFeatureEditor(1, '02-bind-outer-e1');
      await f.editor().getByLabel('Length of edge 1 parameter', {exact: true}).selectOption('L');
      assert.deepEqual(await f.doc(), unbound, 'local selector draft does not commit');
      await f.applyEditor(unbound, '02-bound-A64-before-assert');
      const A = await f.doc(); authoredSeed = A.nodes[0].seed;
      const {kind, id, ...seedFields} = seedDoc.nodes[0];
      assert.deepEqual(authoredSeed, seedFields, 'bind retains original numeric60 authored seed');
      await qualify('03-bound-A64', A, 64);
      await f.openFeatureEditor(1, '04-bound-direct-edit-refusal');
      await f.editor().getByRole('button', {name: 'Edit sketch', exact: true}).click();
      await f.waitToast(/Unbind the line length before editing this sketch\./);
      assert.equal(await f.sketchPanel().count(), 0); await f.same(A); await capture('04-bound-edit-refused');
      await f.closeEditor(); await f.dismissToasts();

      // Observe main-thread Worker submissions without changing any request payload.
      await f.page.evaluate(() => {
        const original = Worker.prototype.postMessage;
        window.__d537WorkerMessageCount = 0;
        Worker.prototype.postMessage = function (...args) {
          window.__d537WorkerMessageCount++;
          return original.apply(this, args);
        };
      });
      const panel = await f.openParameters(), field = panel.getByLabel('Value of L', {exact: true});
      const acceptedA = await capture('05-before-parameter-draft');
      assert.ok(Number.isInteger(acceptedA.workerMessageCount) && acceptedA.workerMessageCount >= 0);
      for (const text of ['', '6', '68']) {
        await field.fill(text); const drafted = await capture('05-draft-' + (text || 'empty'));
        assert.deepEqual(drafted.doc, A); assert.deepEqual(drafted.worker.bodies, acceptedA.worker.bodies);
        assert.deepEqual(drafted.historyRows, acceptedA.historyRows);
        assert.equal(drafted.workerMessageCount, acceptedA.workerMessageCount, 'unsubmitted text sends no Worker request');
      }
      await field.press('Enter'); await f.changed(A); const B = await f.doc();
      await f.closeParameters(panel); const acceptedB = await qualify('06-bound-B68', B, 68);
      assert.ok(acceptedB.workerMessageCount > acceptedA.workerMessageCount, 'valid submission exercises the observed Worker route');
      const invalidPanel = await f.openParameters();
      await invalidPanel.getByLabel('Value of L', {exact: true}).fill('10');
      await invalidPanel.getByLabel('Value of L', {exact: true}).press('Enter');
      const refusal = await f.waitToast(/overlap|profile/i);
      const refused = await capture('07-invalid-positive10-refused');
      assert.deepEqual(refused.doc, B); assert.deepEqual(refused.worker.bodies, acceptedB.worker.bodies);
      assert.deepEqual(refused.historyRows, acceptedB.historyRows);
      f.report.observations.push({label: 'positive10-full-profile-refusal', actualReason: refusal});
      await f.closeParameters(invalidPanel); await f.dismissToasts();
      await f.undo(); await qualify('08-FIRST-Undo-bound-A64', A, 64);
      await f.redo(); await qualify('09-Redo-bound-B68', B, 68);
      const renamePanel = await f.openParameters();
      const nameField = renamePanel.getByLabel('Name of L', {exact: true});
      await nameField.fill('Span'); await nameField.press('Enter'); await f.changed(B);
      parameterName = 'Span'; const renamed = await f.doc();
      await f.closeParameters(renamePanel); await qualify('10-renamed-Span68', renamed, 68);
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
      await writeFile(join(output, '11-own-native-opfs-save.bcad'), new Uint8Array(saved.bytes));
      assert.deepEqual(JSON.parse(new TextDecoder().decode(new Uint8Array(saved.bytes))), renamed);
      f.report.ownedSave = {namespace: `projects/${projectName}`, path: `${partName}.bcad`, bytes: saved.size, sha256: sha256(new Uint8Array(saved.bytes)), exactAcceptedDoc: true};
      await qualify('11-own-project-saved-Span68', renamed, 68);
      const context = f.context; await card.getByRole('button', {name: 'Close project', exact: true}).click();
      await card.getByLabel('Project', {exact: true}).waitFor({state: 'detached'}); await f.page.reload(); await f.ready(); assert.equal(f.context, context);
      card = await versions(); await card.getByLabel('Browser project name', {exact: true}).fill(projectName);
      await card.getByRole('button', {name: 'Project in this browser', exact: true}).click(); await card.getByLabel('Project', {exact: true}).waitFor();
      await card.getByRole('button', {name: `Open ${partName}.bcad`, exact: true}).click(); await f.same(renamed); await f.ready();
      await qualify('12-own-project-reopened-exact-Span68', renamed, 68);
      await f.setParameter('Span', 64, '13-postOpen-Span64-before-assert');
      C = await f.doc(); await qualify('13-postOpen-bound-Span64', C, 64);
    }
    await f.openFeatureEditor(1, '14-unbind');
    const unbindDOM = await f.editor().getByLabel('Length of edge 1 parameter', {exact: true}).evaluate(select => ({
      outerHTML: select.outerHTML, disabled: select.disabled, value: select.value,
      parentTag: select.closest('.field')?.tagName ?? null, closestLabel: select.closest('label')?.outerHTML ?? null,
      options: [...select.options].map(option => ({value: option.value, disabled: option.disabled, selected: option.selected, outerHTML: option.outerHTML})),
      controls: [...(select.closest('.field')?.querySelectorAll('input,select') ?? [])].map(control => ({tag: control.tagName, label: control.getAttribute('aria-label'), disabled: control.disabled})),
    }));
    await writeFile(join(output, '14-before-unbind-select-dom.json'), JSON.stringify(unbindDOM, null, 2));
    f.report.observations.push({label: 'before-actual-unbind-select', DOM: unbindDOM}); await f.persist();
    await f.editor().getByLabel('Length of edge 1 parameter', {exact: true}).selectOption('');
    await f.applyEditor(C, '14-unbound-numeric64-before-assert');
    const U = await f.doc(); assert.equal(U.nodes[0].kind, 'sketch');
    await qualify('14-unbound-numeric64', U, 64);
    await reopen('15-unbound-numeric-edit'); await typeLength(64, 68, '15-local-numeric68');
    const N = await finish(U, '16-actual-Finish-numeric68-before-assert');
    await qualify('17-final-numeric68', N, 68);
    assert.deepEqual(f.report.downloads, []);
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
