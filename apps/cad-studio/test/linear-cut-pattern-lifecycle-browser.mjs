// D534: bounded lifecycle from the exact retained D373 accepted pattern; no creation/count2 replay.
// D534_SOURCE_FROZEN=1 node test/linear-cut-pattern-lifecycle-browser.mjs /ABS/NEW/OUTPUT
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {isAbsolute, join, relative, resolve} from 'node:path';
import {createFlow, sha256} from './flow-helper.mjs';
import {inspectorSource, oracleSource} from './linear-cut-pattern-lifecycle-oracles.mjs';

const output = process.argv[2], repo = resolve(import.meta.dirname, '../../..');
const seedFile = join(repo, 'apps/cad-studio/handover/notes/linear-cut-pattern-closeout-2026-10-31/run-01/accepted.bcad');
assert.ok(output && isAbsolute(output)); assert.ok(relative(repo, resolve(output)).startsWith('../')); await mkdir(output);
const seedBytes = await readFile(seedFile);
assert.equal(sha256(seedBytes), '020a7942b1fb4cc177b13c43bf0561c2002094ea5afc82ca3841cbccd900944c');
const seedDoc = JSON.parse(seedBytes), projectName = `D534-${randomUUID()}`, partName = 'D534-linear-cut-pattern';
const f = await createFlow({name: 'linear-cut-pattern-lifecycle', envFrozen: 'D534_SOURCE_FROZEN', output, inspectorSource, oracleSource,
  qualification: 'D534 one retained linear CUT source-width/spacing/count/refusal/history/suppression/project lifecycle',
  initialFiles: ['apps/cad-studio/test/linear-cut-pattern-lifecycle-browser.mjs', 'apps/cad-studio/test/linear-cut-pattern-lifecycle-oracles.mjs', seedFile],
  requiredFrozen: ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx', 'apps/cad-studio/src/state/useFeatureHistory.ts', 'packages/barocss-cad-model/src/engine/evaluate.ts'],
  limits: ['Desktop WebGPU 1440x900 only; root must review original screenshots.', 'Retained D373 w4/s16/count3 is antecedent only; no new creation, original HUD refusal or count2 loop replay.',
    'Five High-defined physical states at toolWidth6 only. No general pattern/Boolean/core/P1 acceptance.',
    'Invalid history Spacing0 is an Apply refusal, not a preview. FIRST Undo after this refusal must reach exact preceding B.',
    'Native BRep/mass authority and independent literal Python are separate from current Worker/display observations.', 'Only owned OPFS project is written/removed; no download/export/mobile/release.'],
  snapshotExtra: () => ({documentJSON: JSON.stringify(window.__studioDoc), worker: window.__studioBodies?.(), rootFresh: window.__studioFresh,
    historyRows: [...document.querySelectorAll('.history .hs')].map(row => ({index: row.getAttribute('data-node-index'), label: row.getAttribute('aria-label'), text: row.textContent, suppressed: row.classList.contains('suppressed')})),
    editorFields: [...document.querySelectorAll('.node-editor input,.node-editor select')].map(field => ({label: field.getAttribute('aria-label'), value: field.value})),
    alerts: [...document.querySelectorAll('.toast[role="alert"]')].map(alert => alert.textContent),
    project: document.querySelector('[aria-label="Project"]')?.textContent ?? null,
    activePath: document.querySelector('[aria-label="Project documents"] [data-active="true"]')?.textContent ?? null,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]')}),
});
f.report.seed = {file: seedFile, sha256: sha256(seedBytes), bytes: seedBytes.length, authority: 'retained accepted antecedent only'};
f.report.projectName = projectName;
const nativeCache = new Map(), labels = new Set(); let projectCreated = false;
const capture = async label => {
  assert.ok(!labels.has(label)); labels.add(label); const state = await f.snapshot(label);
  await writeFile(join(output, `${label}-actual.bcad`), state.documentJSON); return state;
};
const parameters = (spacing, count, suppressed = false) => ({toolWidth: 6, spacing, count, suppressed});
const qualify = async (label, expectedDoc, params) => {
  f.phase = label; await f.same(expectedDoc); await f.ready(); const state = await capture(label), key = sha256(state.documentJSON);
  const previous = nativeCache.get(key), read = previous?.read ?? await f.inspect(`${label}-native`, state.doc, {label, parameters: params});
  f.report.reads.push({label, read, exactWholeDocSha256: key, reusedFrom: previous?.label ?? null});
  const input = {doc: state.doc, documentJSON: state.documentJSON, expectedDoc, seedDoc, read, consumer: state, parameters: params};
  await writeFile(join(output, `${label}-oracle-input.json`), JSON.stringify(input, null, 2));
  const run = spawnSync('python3', ['-I', join(output, 'linear-cut-pattern-lifecycle-oracle.py')], {input: JSON.stringify(input), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
  await writeFile(join(output, `${label}-oracle.stdout.json`), run.stdout ?? ''); await writeFile(join(output, `${label}-oracle.stderr.txt`), run.stderr ?? '');
  let parsed = null; try { parsed = JSON.parse(run.stdout ?? ''); } catch { /* Original output remains the failure evidence. */ }
  f.report.oracles.push({label, exit: run.status, signal: run.signal, stdout: parsed, stderr: run.stderr, reusedNativeFrom: previous?.label ?? null}); await f.persist();
  assert.equal(run.error, undefined); assert.equal(run.status, 0, run.stderr); assert.equal(parsed?.status, 'PASS_ONE_DECLARED_D534_LINEAR_CUT_PATTERN_STATE');
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
const suppress = async wanted => {
  await f.closeEditor(); await f.page.locator('.history .hs[data-node-index="6"]').click({button: 'right'});
  await f.page.getByRole('menuitem', {name: wanted ? 'Suppress' : 'Unsuppress', exact: true}).click();
};
await f.run(async () => {
  await f.newPage(); await f.page.setViewportSize({width: 1440, height: 900});
  try {
    f.phase = 'public Open exact retained accepted D373 pattern';
    await f.openFile(seedFile, 7); await f.same(seedDoc); await capture('00-retained-pattern-antecedent');
    f.phase = 'public tool source Width4 to6 with fixed left corner';
    await edit(3, 'Width', 4, 6, seedDoc, '01-tool-width6');
    const A = structuredClone(seedDoc); A.nodes[2].max[0] = 6; delete A.nodes[3].made;
    assert.deepEqual(A.nodes[1].made, seedDoc.nodes[1].made);
    await qualify('02-A-width6-spacing16-count3', A, parameters(16, 3));
    await edit(6, 'Spacing', 16, 12, A, '03-spacing12');
    const B = structuredClone(A); B.nodes[6].spacing = 12;
    await qualify('04-B-width6-spacing12-count3', B, parameters(12, 3));
    await edit(6, 'Count', 3, 4, B, '05-count4');
    const C = structuredClone(B); C.nodes[6].count = 4;
    const acceptedC = await qualify('06-C-width6-spacing12-count4', C, parameters(12, 4));

    f.phase = 'history Spacing0 Apply refuses and retains accepted C';
    await f.dismissToasts(); await f.openFeatureEditor(6, 'invalid-spacing0');
    const spacing = f.editor().getByLabel('Spacing', {exact: true}); assert.equal(Number(await spacing.inputValue()), 12);
    await spacing.fill('0'); await capture('07-spacing0-typed-before-Apply');
    await f.editor().getByRole('button', {name: 'Apply', exact: true}).click();
    const alert = f.page.getByRole('alert').filter({hasText: 'The design was not changed'}); await alert.waitFor({timeout: 60000});
    const details = alert.locator('details summary'); if (await details.count()) await details.click();
    const refused = await capture('08-spacing0-Apply-refused');
    assert.match(await alert.textContent(), /spacing must not be zero/i);
    assert.deepEqual(refused.doc, C); assert.deepEqual(refused.historyRows, acceptedC.historyRows); assert.deepEqual(refused.worker.bodies, acceptedC.worker.bodies);
    f.report.observations.push({label: 'history-spacing0-Apply-refusal', actualReason: await alert.textContent(), nativeCategoryAuthority: 'PARAMETER from focused native control; GUI records actual specific reason', previewClaim: 'NONE'});
    await f.closeEditor(); await alert.getByRole('button', {name: 'Dismiss', exact: true}).click();
    await qualify('09-refused-Apply-retains-C', C, parameters(12, 4));
    f.phase = 'FIRST Undo after refused Apply must reach exact B, then Redo C';
    await f.undo(); await qualify('10-FIRST-undo-after-refusal-exact-B', B, parameters(12, 3));
    await f.redo(); await qualify('11-redo-exact-C', C, parameters(12, 4));

    f.phase = 'public pattern Suppress and Unsuppress';
    await suppress(true); const D = structuredClone(C); D.nodes[6].suppressed = true;
    await qualify('12-D-pattern-suppressed-original-cut-only', D, parameters(12, 4, true));
    await suppress(false); await qualify('13-unsuppress-exact-C', C, parameters(12, 4));

    f.phase = 'own project public Save Close same-context reload Open C';
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
    await writeFile(join(output, '14-own-native-opfs-save.bcad'), new Uint8Array(saved.bytes));
    assert.deepEqual(JSON.parse(new TextDecoder().decode(new Uint8Array(saved.bytes))), C);
    f.report.ownedSave = {namespace: `projects/${projectName}`, path: `${partName}.bcad`, bytes: saved.size, sha256: sha256(new Uint8Array(saved.bytes)), exactAcceptedDoc: true};
    await qualify('14-own-project-saved-C', C, parameters(12, 4));
    const context = f.context; await card.getByRole('button', {name: 'Close project', exact: true}).click();
    await card.getByLabel('Project', {exact: true}).waitFor({state: 'detached'}); await f.page.reload(); await f.ready(); assert.equal(f.context, context);
    card = await versions(); await card.getByLabel('Browser project name', {exact: true}).fill(projectName);
    await card.getByRole('button', {name: 'Project in this browser', exact: true}).click(); await card.getByLabel('Project', {exact: true}).waitFor();
    await card.getByRole('button', {name: `Open ${partName}.bcad`, exact: true}).click(); await f.same(C); await f.ready();
    await qualify('15-own-project-reopened-C', C, parameters(12, 4));
    f.phase = 'post-Open Spacing12 to10';
    await edit(6, 'Spacing', 12, 10, C, '16-postOpen-spacing10'); const E = structuredClone(C); E.nodes[6].spacing = 10;
    await qualify('17-E-postOpen-width6-spacing10-count4', E, parameters(10, 4));
    assert.equal(nativeCache.size, 5); assert.deepEqual(f.report.downloads, []);
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
