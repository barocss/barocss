// D533: one declared public Hole-on-Chamfer dependency lifecycle. Root owns heavy execution and image review.
// D533_SOURCE_FROZEN=1 node test/hole-chamfer-lifecycle-browser.mjs /ABS/NEW/OUTPUT [EXACT_D449_SEED]
// D533_CONTINUE_PROJECT_FROM=/ABS/ORIGINAL_STUDIO01_OPFS_B runs only the pinned B project continuation and C edit.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {isAbsolute, join, relative, resolve} from 'node:path';
import {createFlow, sha256} from './flow-helper.mjs';
import {inspectorSource, oracleSource} from './hole-chamfer-lifecycle-oracles.mjs';

const output = process.argv[2], seedFile = resolve(process.argv[3] ?? '/tmp/barocss-d449-category-run01/chamfer-edited.bcad');
assert.ok(output && isAbsolute(output));
assert.ok(relative(resolve(import.meta.dirname, '../../..'), resolve(output)).startsWith('../'));
await mkdir(output);
const seedBytes = await readFile(seedFile);
assert.equal(seedBytes.length, 607); assert.equal(sha256(seedBytes), 'bff9ee71ea46e2432a186016c8e74d639c15b08803fe388f6a9dd5980059b7bb');
const seedDoc = JSON.parse(seedBytes), projectName = `D533-${randomUUID()}`, partName = 'D533-hole-chamfer';
const continuationFile = process.env.D533_CONTINUE_PROJECT_FROM;
let continuationDoc = null, continuationBytes = null;
if (continuationFile) {
  assert.ok(isAbsolute(continuationFile), 'Continuation requires the absolute original actual OPFS capture');
  continuationBytes = await readFile(continuationFile);
  assert.equal(sha256(continuationBytes), '5ef280347fcc0f2d923d64b998b9646948bd0b7f3fa310c59851a2f9fbf3c9d9');
  continuationDoc = JSON.parse(continuationBytes);
  const declaredB = structuredClone(seedDoc); declaredB.nodes[2].distance = 2;
  declaredB.nodes.push({kind: 'hole', parent: {node: 2, side: 'solid'}, radius: 2, center: [20, 0], face: 'n1.top', id: 'n3'});
  declaredB.outputs = {b3: {node: 3, side: 'solid'}}; declaredB.nextId = 4;
  assert.deepEqual(continuationDoc, declaredB, 'Continuation must be exactly the declared B derived from the original seed');
}
const f = await createFlow({name: 'hole-chamfer-lifecycle', envFrozen: 'D533_SOURCE_FROZEN', output, inspectorSource, oracleSource,
  qualification: continuationFile ? 'D533 bounded continuation: original captured B public Open, new own project roundtrip and post-Open Hole4 to6 only; passed prefix NOT_RERUN' : 'D533 one existing ordinary Through Hole on retained Chamfer: upstream edit/history/refused new preview/project lifecycle',
  initialFiles: ['apps/cad-studio/test/hole-chamfer-lifecycle-browser.mjs', 'apps/cad-studio/test/hole-chamfer-lifecycle-oracles.mjs', seedFile, ...(continuationFile ? [continuationFile] : [])],
  requiredFrozen: ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx', 'packages/barocss-cad-model/src/engine/evaluate.ts'],
  limits: ['Desktop WebGPU 1440x900 only; root must view original images.', 'Exact retained D449 seed; no broad Chamfer/Hole family or complete P1 acceptance.',
    'High-owned native inspector and independent literal Python oracle are separate from current Worker/display observations.',
    'Seed is pick-map antecedent only, not a new physical qualification.', 'New Chamfer1000 preview refusal/disabled Apply/Cancel is distinct from a NodeEditor Apply refusal.',
    'Only owned OPFS namespace is written/removed. No download, export, mobile or release.'],
  snapshotExtra: () => ({documentJSON: JSON.stringify(window.__studioDoc), worker: window.__studioBodies?.(), rootFresh: window.__studioFresh,
    historyRows: [...document.querySelectorAll('.history .hs')].map(row => ({index: row.getAttribute('data-node-index'), label: row.getAttribute('aria-label'), text: row.textContent})),
    editorFields: [...document.querySelectorAll('.node-editor input,.node-editor select')].map(field => ({label: field.getAttribute('aria-label'), value: field.value})),
    hudStatus: document.querySelector('.hud .status')?.textContent ?? null, hudError: document.querySelector('.hud-error')?.textContent ?? null,
    project: document.querySelector('[aria-label="Project"]')?.textContent ?? null,
    activePath: document.querySelector('[aria-label="Project documents"] [data-active="true"]')?.textContent ?? null,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]')}),
});
f.report.seed = {file: seedFile, bytes: seedBytes.length, sha256: sha256(seedBytes), authority: 'retained exact antecedent; pick-only here'};
f.report.projectName = projectName;
f.report.mode = continuationFile ? 'BOUNDED_PROJECT_CONTINUATION' : 'FULL_DECLARED_LIFECYCLE';
if (continuationFile) f.report.continuation = {file: continuationFile, bytes: continuationBytes.length, sha256: sha256(continuationBytes),
  wholeDocDerivedFromSeed: true, source: 'Original D533 Studio01 actual accepted B OPFS save',
  skippedPassedPrefix: ['Hole4 creation', 'upstream Chamfer3 to2', 'FIRST Undo/Redo', 'new Chamfer1000 preview refusal/Cancel'],
  originalReceiptScopeEligibility: 'Root must retain original Studio01 receipt and executed sources; this continuation does not replay or relabel that prefix'};
const labels = new Set(), nativeCache = new Map(); let projectCreated = false;
const capture = async label => {
  assert.ok(!labels.has(label)); labels.add(label); const state = await f.snapshot(label);
  await writeFile(join(output, `${label}-actual.bcad`), state.documentJSON); return state;
};
const qualify = async (label, expectedDoc, parameters, existingState) => {
  f.phase = label; await f.same(expectedDoc); await f.ready(); const state = existingState ?? await capture(label), key = sha256(state.documentJSON);
  const previous = nativeCache.get(key), read = previous?.read ?? await f.inspect(`${label}-native`, state.doc, {label, parameters});
  f.report.reads.push({label, read, exactWholeDocSha256: key, reusedFrom: previous?.label ?? null});
  const input = {doc: state.doc, documentJSON: state.documentJSON, expectedDoc, seedDoc, read, consumer: state, parameters};
  await writeFile(join(output, `${label}-oracle-input.json`), JSON.stringify(input, null, 2));
  const run = spawnSync('python3', ['-I', join(output, 'hole-chamfer-lifecycle-oracle.py')], {input: JSON.stringify(input), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
  await writeFile(join(output, `${label}-oracle.stdout.json`), run.stdout ?? ''); await writeFile(join(output, `${label}-oracle.stderr.txt`), run.stderr ?? '');
  let parsed = null; try { parsed = JSON.parse(run.stdout ?? ''); } catch { /* Preserve original stdout and failure below. */ }
  f.report.oracles.push({label, exit: run.status, signal: run.signal, stdout: parsed, stderr: run.stderr, reusedNativeFrom: previous?.label ?? null}); await f.persist();
  assert.equal(run.error, undefined); assert.equal(run.status, 0, run.stderr);
  assert.equal(parsed?.status, 'PASS_ONE_DECLARED_D533_HOLE_CHAMFER_STATE'); assert.deepEqual(state.doc, expectedDoc);
  assert.equal(state.rootFresh, true); assert.equal(state.worker.fresh, true); assert.equal(state.worker.massReady, true);
  if (!previous) nativeCache.set(key, {label, read}); await f.same(state.doc); return {state, read};
};
const filter = async wanted => {
  const button = f.page.getByRole('button', {name: 'Selection filter', exact: true});
  for (let i = 0; i < 6; i++) { if ((await button.innerText()).includes(wanted)) return; await button.click(); }
  assert.fail(`Public selection filter ${wanted}`);
};
const pick = async (kind, index, bodyIndex, point, label) => {
  await f.closeEditor(); await f.page.keyboard.press('Escape'); await filter(kind === 'faces' ? 'Faces' : 'Edges');
  await f.page.getByRole('button', {name: 'Top', exact: true}).click();
  await f.page.getByTitle('Frame all (F)', {exact: true}).click(); await f.page.waitForTimeout(500);
  const xy = await f.page.evaluate(point => window.__studioScreenOf(point), point); assert.ok(xy?.length === 2 && xy.every(Number.isFinite));
  const canvasHit = await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.vp-canvas'), xy); assert.equal(canvasHit, true, 'Actual projected pick must hit the viewport canvas');
  await f.page.mouse.move(xy[0], xy[1]); await f.page.mouse.click(xy[0], xy[1]);
  await f.page.waitForFunction(({kind, index, bodyIndex}) => {
    const selected = window.__studioSelection?.selection?.[kind]; return selected?.length === 1 && selected[0].body === bodyIndex && selected[0][kind === 'faces' ? 'face' : 'edge'] === index;
  }, {kind, index, bodyIndex}, {timeout: 15000});
  return capture(label);
};
const edit = async (index, fieldName, oldValue, value, previous, label) => {
  await f.openFeatureEditor(index, label); const field = f.editor().getByLabel(fieldName, {exact: true});
  assert.equal(Number(await field.inputValue()), oldValue); await field.fill(String(value)); await capture(`${label}-typed`);
  await f.editor().getByRole('button', {name: 'Apply', exact: true}).click(); await f.changed(previous); await f.closeEditor(); await f.ready();
};
const versions = async () => {
  await f.closeEditor(); await f.page.getByRole('button', {name: 'Model', exact: true}).click();
  const card = f.page.getByLabel('Versions panel', {exact: true});
  if (!await card.isVisible()) await f.page.getByRole('button', {name: 'Project and versions', exact: true}).click();
  await card.waitFor(); return card;
};
await f.run(async () => {
  await f.newPage(); await f.page.setViewportSize({width: 1440, height: 900});
  try {
    let B;
    if (continuationFile) {
      f.phase = 'bounded continuation public Open original captured B before new project lifecycle';
      await f.openFile(continuationFile, 4); B = continuationDoc; await f.same(B);
      await qualify('continue-00-original-captured-B-public-open', B, {chamferDistance: 2, holeDiameter: 4});
    } else {
    f.phase = 'public Open exact retained Chamfer3 seed and actual top-face pointer pick';
    await f.openFile(seedFile, 3); const opened = await capture('00-retained-seed-open'); assert.deepEqual(opened.doc, seedDoc);
    const map = await f.inspect('00-seed-pick-only', opened.doc, {label: 'seed-pick-only', pickOnly: true});
    const top = map.display.faces.find(face => face.nativeName.split('+').includes('n1.top')); assert.ok(top);
    await pick('faces', top.index, map.display.bodyIndex, top.centroid, '01-real-surviving-top-selected');
    f.phase = 'public Through Hole diameter4 centre20,0 on current Chamfer output';
    await f.command('Hole'); const hole = f.page.getByRole('dialog', {name: 'Hole', exact: true}); await hole.waitFor();
    await hole.getByLabel('Type', {exact: true}).selectOption('through'); await hole.getByLabel('Copies', {exact: true}).selectOption('one');
    for (const [label, value] of [['Diameter', 4], ['Centre X', 20], ['Centre Y', 0]]) await hole.getByLabel(label, {exact: true}).fill(String(value));
    await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview'); await capture('02-through-hole-preview');
    await hole.getByRole('button', {name: 'Apply', exact: true}).click(); await f.changed(seedDoc); await hole.waitFor({state: 'hidden'}); await f.ready();
    const acceptedA = await capture('03-hole4-on-chamfer3'), A = acceptedA.doc;
    assert.equal(A.nodes.length, 4); assert.deepEqual(A.nodes.slice(0, 3), seedDoc.nodes);
    assert.equal(A.nodes[3].kind, 'hole'); assert.equal(A.nodes[3].id, 'n3'); assert.deepEqual(A.nodes[3].parent, {node: 2, side: 'solid'});
    assert.equal(A.nodes[3].face, 'n1.top'); assert.deepEqual(A.nodes[3].center, [20, 0]); assert.equal(A.nodes[3].radius, 2);
    for (const field of ['axis', 'side', 'depth', 'pattern', 'thread', 'countersink']) assert.equal(A.nodes[3][field], undefined);
    assert.deepEqual(A.outputs, {b3: {node: 3, side: 'solid'}}); assert.equal(A.nextId, 4);
    await qualify('03-hole4-on-chamfer3', A, {chamferDistance: 3, holeDiameter: 4}, acceptedA);

    f.phase = 'public upstream history Chamfer Distance3 to2';
    await edit(2, 'Distance', 3, 2, A, '04-upstream-chamfer-distance2');
    B = structuredClone(A); B.nodes[2].distance = 2;
    const stateB = await qualify('05-hole4-on-chamfer2', B, {chamferDistance: 2, holeDiameter: 4});
    f.phase = 'FIRST public Undo and Redo preserve exact dependency documents';
    await f.undo(); await qualify('06-FIRST-undo-chamfer3', A, {chamferDistance: 3, holeDiameter: 4});
    await f.redo(); await qualify('07-redo-chamfer2', B, {chamferDistance: 2, holeDiameter: 4});

    f.phase = 'actual surviving back-top edge and NEW Chamfer1000 preview refusal';
    const edge = stateB.read.display.edges.find(edge => edge.names.includes('n1.side[e3]|n1.top')
      && [edge.a, edge.b].every(point => Math.abs(point[1] - 20) < 1e-9 && Math.abs(point[2] - 10) < 1e-9)); assert.ok(edge);
    const edgePoint = [0, 1, 2].map(k => (edge.a[k] + edge.b[k]) / 2);
    const selected = await pick('edges', edge.index, stateB.read.display.bodyIndex, edgePoint, '08-real-back-top-edge-selected');
    await f.command('Chamfer'); const chamfer = f.page.getByRole('dialog', {name: 'Chamfer', exact: true}); await chamfer.waitFor();
    await chamfer.getByLabel('Distance', {exact: true}).fill('1000');
    await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'refused', null, {timeout: 60000});
    const detail = chamfer.locator('details summary'); if (await detail.count()) await detail.click();
    const refused = await capture('09-NEW-chamfer1000-preview-refused');
    assert.equal(await chamfer.getByRole('button', {name: 'Apply', exact: true}).isDisabled(), true);
    assert.ok(refused.hudError); assert.match(refused.hudError, /RADIUS_EXCEEDS_FACE/); assert.match(refused.hudError, /chamfer 1000 mm/);
    assert.deepEqual(refused.doc, B); assert.deepEqual(refused.historyRows, selected.historyRows); assert.deepEqual(refused.worker.bodies, selected.worker.bodies);
    await chamfer.getByRole('button', {name: 'Cancel', exact: true}).click(); await chamfer.waitFor({state: 'hidden'});
    await qualify('10-preview-Cancel-retains-accepted-chamfer2-hole4', B, {chamferDistance: 2, holeDiameter: 4});
    }

    f.phase = 'own OPFS project public Save Close same-context reload Open';
    let card = await versions(); await card.getByLabel('Browser project name', {exact: true}).fill(projectName);
    const namespaceAbsent = await f.page.evaluate(async name => {
      const root = await navigator.storage.getDirectory();
      try { const projects = await root.getDirectoryHandle('projects'); await projects.getDirectoryHandle(name); return false; }
      catch (error) { if (error.name === 'NotFoundError') return true; throw error; }
    }, projectName); assert.equal(namespaceAbsent, true, 'Never adopt or overwrite another existing project namespace');
    await card.getByRole('button', {name: 'Project in this browser', exact: true}).click(); await card.getByLabel('Project', {exact: true}).waitFor(); projectCreated = true;
    await f.page.locator('.doc-tab input').fill(partName); await f.page.getByRole('button', {name: 'Save', exact: true}).click();
    await f.page.getByLabel('Unsaved changes', {exact: true}).waitFor({state: 'detached'});
    await card.locator('[aria-label="Project documents"] li[data-active="true"]').filter({hasText: `${partName}.bcad`}).waitFor();
    const native = await f.page.evaluate(async ({projectName, partName}) => {
      const root = await navigator.storage.getDirectory(), directory = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(projectName);
      const file = await (await directory.getFileHandle(`${partName}.bcad`)).getFile(); return {size: file.size, bytes: Array.from(new Uint8Array(await file.arrayBuffer()))};
    }, {projectName, partName});
    await writeFile(join(output, '11-own-native-opfs-save.bcad'), new Uint8Array(native.bytes));
    assert.deepEqual(JSON.parse(new TextDecoder().decode(new Uint8Array(native.bytes))), B);
    f.report.ownedSave = {namespace: `projects/${projectName}`, path: `${partName}.bcad`, bytes: native.size, sha256: sha256(new Uint8Array(native.bytes)), exactAcceptedDoc: true};
    await qualify('11-own-project-save', B, {chamferDistance: 2, holeDiameter: 4});
    const context = f.context; await card.getByRole('button', {name: 'Close project', exact: true}).click();
    await card.getByLabel('Project', {exact: true}).waitFor({state: 'detached'}); await f.page.reload(); await f.ready(); assert.equal(f.context, context);
    card = await versions(); await card.getByLabel('Browser project name', {exact: true}).fill(projectName);
    await card.getByRole('button', {name: 'Project in this browser', exact: true}).click(); await card.getByLabel('Project', {exact: true}).waitFor();
    await card.getByRole('button', {name: `Open ${partName}.bcad`, exact: true}).click(); await f.same(B); await f.ready();
    await qualify('12-own-project-reopened', B, {chamferDistance: 2, holeDiameter: 4});
    f.phase = 'post-Open public Hole Diameter4 to6 changes accepted native geometry';
    await edit(3, 'Diameter', 4, 6, B, '13-postOpen-hole-diameter6');
    const C = structuredClone(B); C.nodes[3].radius = 3;
    await qualify('14-postOpen-hole6-on-chamfer2', C, {chamferDistance: 2, holeDiameter: 6});
    assert.equal(nativeCache.size, continuationFile ? 2 : 3); assert.deepEqual(f.report.downloads, []);
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
