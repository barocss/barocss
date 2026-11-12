// D765/B08-02: public branch switches, a two-parent merge and refusal without answers.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const fixture = join(import.meta.dirname, 'fixtures', 'bracket.bcad');
const pins = [
  'apps/cad-studio/test/project-branch-merge-browser.mjs', 'apps/cad-studio/test/fixtures/bracket.bcad',
  'apps/cad-studio/handover/roadmap-tracks/16-b08-evidence-ledger.md',
  'apps/cad-studio/src/storage/useProject.ts', 'apps/cad-studio/src/storage/project.ts', 'apps/cad-studio/src/storage/VersionsPanel.tsx',
  'packages/barocss-cad-model/src/versions/log.ts', 'packages/barocss-cad-model/src/versions/merge.ts',
];

const f = await createFlow({
  name: 'project-branch-merge', envFrozen: 'D765_SOURCE_FROZEN', output: process.argv[2],
  qualification: 'B08-02 branch switch, compatible merge, conflict and reopen',
  initialFiles: pins, requiredFrozen: pins,
  limits: ['One rectangular extrusion, one independent parameter edit, one same-feature conflict and one browser project.'],
  inspectorSource: String.raw`
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
const result = evaluateDoc(JSON.parse(readFileSync(process.argv[2], 'utf8')), 0);
assert.equal(result.ok, true, JSON.stringify(result.error));
assert.equal(result.bodies.length, 1);
const body = result.bodies[0];
console.log(JSON.stringify({ volume: body.volume, centroid: body.centroid, bounds: body.mesh.bounds }));
`,
  oracleSource: String.raw`
import json, math, sys
x = json.load(sys.stdin)
d, h = x["doc"], x["height"]
assert d["nodes"][0]["min"] == [0,0] and d["nodes"][0]["max"] == [30,12]
assert d["nodes"][1]["height"] == h
assert d["parameters"] == x["parameters"]
for read in (x["native"], x["current"]):
    assert math.isclose(read["volume"], 30*12*h, rel_tol=1e-9)
    assert all(abs(v-w) <= 1e-9 for v,w in zip(read["centroid"], [15,6,h/2], strict=True))
assert x["native"]["bounds"] == {"min":[0,0,0],"max":[30,12,h]}
print(json.dumps({"status":"PASS","height":h,"volume":360*h}))
`,
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    branch: document.querySelector('[aria-label="Branch"]')?.value ?? null,
    activePath: document.querySelector('[aria-label="Project documents"] [data-active="true"]')?.textContent ?? null,
  }),
});

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return url.origin === origin ? route.continue() : route.abort();
    });
    return context;
  };
  await f.newPage();
  const page = f.page, button = name => page.getByRole('button', { name, exact: true });
  const versions = page.getByRole('complementary', { name: 'Versions panel', exact: true });
  const project = 'D765 branches', file = 'bracket.bcad';
  const branch = versions.getByLabel('Branch', { exact: true });
  const mergeFrom = versions.getByLabel('Merge from', { exact: true });
  const dirty = page.getByLabel('Unsaved changes', { exact: true });
  const attach = async () => {
    if (!(await versions.isVisible())) await button('Project and versions').click();
    await versions.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
    await versions.getByRole('button', { name: 'Project in this browser', exact: true }).click();
    await versions.getByLabel('Project', { exact: true }).waitFor();
  };
  const readNative = path => page.evaluate(async ([project, path]) => {
    const root = await navigator.storage.getDirectory();
    let dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
    for (const segment of path.slice(0, -1)) dir = await dir.getDirectoryHandle(segment);
    return (await (await dir.getFileHandle(path.at(-1))).getFile()).text();
  }, [project, path]);
  const readPart = () => readNative([file]);
  const readLog = () => readNative(['.barocss', 'versions', file + '.json']);
  const readSnapshot = version => readNative(['.barocss', 'snapshots', version.snapshot + '.bcad']);
  const versionRow = name => versions.getByLabel('Version ' + name, { exact: true });
  const head = (log, name = log.current) => {
    const pointer = log.branches.find(item => item.name === name);
    assert.ok(pointer, 'missing branch ' + name);
    const version = log.versions.find(item => item.id === pointer.head);
    assert.ok(version, 'missing head for ' + name);
    return version;
  };
  const save = async () => {
    await button('Save').click();
    await dirty.waitFor({ state: 'hidden' });
  };
  const makeVersion = async name => {
    await versions.getByLabel('Version name', { exact: true }).fill(name);
    await versions.getByRole('button', { name: 'Make version', exact: true }).click();
    await versionRow(name).waitFor();
    await dirty.waitFor({ state: 'hidden' });
    const version = head(JSON.parse(await readLog()));
    assert.equal(version.name, name);
    const doc = await f.doc();
    assert.deepEqual(JSON.parse(await readSnapshot(version)), doc);
    assert.deepEqual(JSON.parse(await readPart()), doc);
    return version;
  };
  const makeBranch = async name => {
    await versions.getByLabel('Branch name', { exact: true }).fill(name);
    await versions.getByRole('button', { name: 'Make branch', exact: true }).click();
    await branch.locator('option').filter({ hasText: name }).waitFor({ state: 'attached' });
  };
  const switchTo = async (name, expected) => {
    await branch.selectOption(name);
    await page.waitForFunction(([name, height, parameters]) => {
      const doc = window.__studioDoc;
      return document.querySelector('[aria-label="Branch"]')?.value === name &&
        doc.nodes[1]?.height === height && JSON.stringify(doc.parameters) === parameters;
    }, [name, expected.nodes[1].height, JSON.stringify(expected.parameters)]);
    await dirty.waitFor();
    await f.ready();
    assert.deepEqual(await f.doc(), expected);
    assert.equal(JSON.parse(await readLog()).current, name);
  };
  const binding = async (label, name, height, parameters, isDirty) => {
    await f.ready();
    const state = await f.snapshot(label);
    assert.equal(state.branch, name);
    assert.equal(state.dirty, isDirty);
    assert.equal(state.activePath, file);
    assert.equal(state.bodies.bodies.length, 1);
    const native = await f.inspect(label, state.doc);
    await f.runOracle({ doc: state.doc, native, current: state.bodies.bodies[0], height, parameters }, label);
    return state;
  };
  const editHeight = async height => {
    const before = await f.doc();
    await f.openFeatureEditor(1);
    await f.editor().getByLabel('Distance', { exact: true }).fill(String(height));
    await f.editor().getByRole('button', { name: 'Apply', exact: true }).click();
    await f.changed(before);
    await f.closeEditor();
  };
  const reopen = async (name, doc) => {
    await versions.getByRole('button', { name: 'Close project', exact: true }).click();
    await versions.getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
    await page.reload();
    await f.ready();
    await attach();
    await versions.getByRole('button', { name: 'Open ' + file, exact: true }).click();
    await branch.waitFor();
    await dirty.waitFor({ state: 'hidden' });
    assert.equal(await branch.inputValue(), name);
    await f.ready();
    assert.deepEqual(await f.doc(), doc);
  };

  f.phase = 'Create divergent branch heads from one native version';
  await f.openFile(fixture, 2);
  await page.waitForFunction(() => window.__studioDoc.nodes?.[1]?.height === 6);
  await attach();
  const root = await makeVersion('Base');
  assert.deepEqual(root.parents, []);
  const base = (await binding('main-base', 'main', 6, {}, false)).doc;
  await makeBranch('parameters');
  const sharedLog = JSON.parse(await readLog());
  assert.equal(head(sharedLog, 'parameters').id, root.id);
  await switchTo('parameters', base);
  const { doc: withParameter } = await f.addParameter('margin', 3, 'parameters-edited');
  const theirs = await makeVersion('Add margin');
  assert.deepEqual(theirs.parents, [root.id]);
  await switchTo('main', base);
  await editHeight(8);
  const ours = await makeVersion('Height 8');
  assert.deepEqual(ours.parents, [root.id]);
  await binding('main-height-8', 'main', 8, {}, false);
  const beforeMerge = await readPart();

  f.phase = 'Merge compatible heads and verify Save and project Open';
  await mergeFrom.selectOption('parameters');
  await versions.getByRole('button', { name: 'Merge', exact: true }).click();
  await page.waitForFunction(() => window.__studioDoc.parameters?.margin === 3);
  await dirty.waitFor();
  const merged = (await binding('compatible-merge', 'main', 8, { margin: 3 }, true)).doc;
  assert.deepEqual(merged.parameters, withParameter.parameters);
  const mergedLog = await readLog();
  const log = JSON.parse(mergedLog);
  const merge = head(log);
  assert.deepEqual(merge.parents, [ours.id, theirs.id]);
  assert.equal(log.versions.length, 4);
  assert.equal(head(log, 'parameters').id, theirs.id);
  const mergedSnapshot = await readSnapshot(merge);
  assert.deepEqual(JSON.parse(mergedSnapshot), merged);
  assert.equal(await readPart(), beforeMerge);
  await save();
  const mergedSaved = await readPart();
  assert.deepEqual(JSON.parse(mergedSaved), merged);
  await reopen('main', merged);
  await versionRow(merge.id).waitFor();
  await binding('reopened-merge', 'main', 8, { margin: 3 }, false);
  assert.equal(await readLog(), mergedLog);
  assert.equal(await readSnapshot(merge), mergedSnapshot);
  assert.equal(await readPart(), mergedSaved);
  f.report.files.push({ case: 'compatible merge', version: merge.id, parents: merge.parents, saved: sha256(mergedSaved), log: sha256(mergedLog), snapshot: sha256(mergedSnapshot) });

  f.phase = 'Refuse a same-feature merge and verify unchanged project bytes';
  await makeBranch('conflict');
  await switchTo('conflict', merged);
  await editHeight(10);
  const side = await makeVersion('Side height 10');
  assert.deepEqual(side.parents, [merge.id]);
  await binding('side-height-10', 'conflict', 10, { margin: 3 }, false);
  await switchTo('main', merged);
  await editHeight(12);
  const current = await makeVersion('Main height 12');
  assert.deepEqual(current.parents, [merge.id]);
  const before = await binding('main-before-conflict', 'main', 12, { margin: 3 }, false);
  const savedBeforeConflict = await readPart();
  const logBeforeConflict = await readLog();
  const versionsBeforeConflict = JSON.parse(logBeforeConflict).versions;
  const snapshotsBeforeConflict = await Promise.all(versionsBeforeConflict.map(readSnapshot));
  await mergeFrom.selectOption('conflict');
  await versions.getByRole('button', { name: 'Merge', exact: true }).click();
  const conflicts = versions.getByRole('alert', { name: 'Merge conflicts', exact: true });
  await conflicts.getByLabel('Conflict feature:n1', { exact: true }).waitFor();
  assert.match(await conflicts.innerText(), /1 conflict: choose a side for each/);
  assert.equal(await conflicts.getByRole('button', { name: 'Merge with these answers', exact: true }).isDisabled(), true);
  const refused = await binding('conflict-refused', 'main', 12, { margin: 3 }, false);
  for (const key of ['doc', 'history', 'selection']) assert.deepEqual(refused[key], before[key]);
  assert.equal(await readPart(), savedBeforeConflict);
  assert.equal(await readLog(), logBeforeConflict);
  assert.deepEqual(await Promise.all(versionsBeforeConflict.map(readSnapshot)), snapshotsBeforeConflict);
  await reopen('main', before.doc);
  await versionRow(current.name).waitFor();
  await binding('reopened-after-conflict', 'main', 12, { margin: 3 }, false);
  assert.equal(await readPart(), savedBeforeConflict);
  assert.equal(await readLog(), logBeforeConflict);
  assert.deepEqual(await Promise.all(versionsBeforeConflict.map(readSnapshot)), snapshotsBeforeConflict);
  f.report.files.push({
    case: 'refusal', ours: current.id, theirs: side.id, commonParent: merge.id,
    saved: sha256(savedBeforeConflict), log: sha256(logBeforeConflict), snapshots: snapshotsBeforeConflict.map(sha256),
  });
  assert.deepEqual(f.report.downloads, []);
});
