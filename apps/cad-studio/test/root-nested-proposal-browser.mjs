import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, initialFile] = process.argv.slice(2), repo = resolve(import.meta.dirname, '../../..');
assert.ok([output, initialFile].every(path => path && isAbsolute(path) && relative(repo, path).startsWith('../')));
const pins = [
  'apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/scripts/cad-mcp.mjs', 'apps/cad-studio/server/cadMcp.ts',
  'packages/barocss-cad-model/src/chat/tools.ts', 'packages/barocss-cad-model/src/chat/part/proposals.ts',
  'packages/barocss-cad-model/src/chat/nestedParameterProposal.ts', 'packages/barocss-cad-model/src/chat/toolDefinitions.ts',
  'packages/barocss-cad-model/src/team/requirementScope.ts', 'packages/barocss-cad-model/src/assembly/definitions.ts',
];
const oracleSource = String.raw`
import json, math, sys
data = json.load(sys.stdin)
expected = {'before': (6, 7), 'after': (4, 7)}
for stage, heights in expected.items():
    item = data[stage]
    for report, box, height, path, origin in zip(item['reports'], item['boxes'], heights, ['p1/p1', 'p2/p1'], [[30, 0, 8], [60, 0, 15]], strict=True):
        assert report['part'] == path and box['id'] == path.split('/')[0]
        assert all(abs(a-b) <= 1e-8 for a,b in zip(box['min'], origin, strict=True))
        assert all(abs(a-b-c) <= 1e-8 for a,b,c in zip(box['max'], origin, [20, 10, height], strict=True))
        measurements = {r['result']['subject']: (r['result']['number'], r['result']['verdict'], r['freshness']['state'])
                        for r in report['evidence'] if r['result']['kind'] == 'requirement'}
        assert measurements['HEIGHT'] == (height, 'pass' if height <= 5 else 'fail', 'current')
        assert math.isclose(measurements['MASS'][0], 20 * 10 * height * 0.00785, rel_tol=0, abs_tol=1e-8)
        assert measurements['MASS'][1:] == ('pass', 'current')
assert data['previewVolume'] == '−400 mm³'
print(json.dumps({'status':'PASS','numericChecks':8,'previewVolumeDelta':-400,'absoluteTolerance':1e-8}))
`;
const f = await createFlow({
  name: 'root-nested-proposal', envFrozen: 'D607_SOURCE_FROZEN', output, initialFiles: pins, requiredFrozen: pins, oracleSource,
  qualification: 'One exact nested parameter repair, root MCP proposal and human Studio approval',
  limits: ['D606 saved input bytes, two ordinary static prisms with reused leaf IDs. Model and authorization checks outside this fixture are focused regressions.'],
  snapshotExtra: () => ({
    placed: window.__studioInstanceBounds?.() ?? [],
    volume: document.querySelector('[aria-label="Volume change"]')?.textContent ?? null,
  }),
});
const filename = 'D607-root.bcad', project = 'D607 root repair';
const paths = ['p1/p1', 'p2/p1'];
const edit = { tool: 'features', args: { action: 'parameters', part: paths[0], set: { H: 4 } } };
const button = name => f.page.getByRole('button', { name, exact: true });
const proposal = () => f.page.getByRole('listitem', { name: 'Proposal P1', exact: true });
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const evidence = (part, expectedRevision) => ['requirements', { action: 'evidence', part, ...(expectedRevision ? { expectedRevision } : {}) }];

async function mcp(file, label, calls) {
  const frames = [{ id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
    ...calls.map(([name, args], i) => ({ id: i + 2, method: 'tools/call', params: { name, arguments: args } }))];
  const run = spawnSync(process.execPath, [join(f.app, 'scripts/cad-mcp.mjs'), '--doc', file, '--autonomy', '4'], {
    input: frames.map(x => JSON.stringify(x) + '\n').join(''), encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024,
  });
  await writeFile(join(output, label + '-mcp.jsonl'), run.stdout ?? '');
  await writeFile(join(output, label + '-mcp.stderr.txt'), run.stderr ?? '');
  assert.equal(run.status, 0, run.error?.message ?? run.stderr);
  const replies = run.stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(replies.map(reply => reply.id), frames.map(frame => frame.id));
  assert.equal(replies[0].result.serverInfo.version, 'barocss-cad-tools-v2');
  return replies.slice(1).map(({ result }) => ({ error: result.isError, body: JSON.parse(result.content[0].text) }));
}

function reports(replies) {
  return replies.map(({ error, body }, i) => {
    assert.equal(error, false, JSON.stringify(body));
    const [file] = body.files;
    assert.deepEqual([file.path, file.bytes, file.sha256], ['requirement-evidence.json', Buffer.byteLength(file.text), sha256(file.text)]);
    const value = JSON.parse(file.text);
    assert.deepEqual([value.part, value.revision], [paths[i], body.revision]);
    return value;
  });
}

async function open(file, expected) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: filename, mimeType: 'application/json', buffer: await readFile(file) });
  await f.same(expected);
}

async function openProject() {
  if (!(await versions().isVisible())) await button('Project and versions').click();
  await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await versions().getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await versions().getByLabel('Project', { exact: true }).waitFor();
}

async function makeVersion(name) {
  if (!(await versions().isVisible())) await button('Project and versions').click();
  await versions().getByRole('textbox', { name: 'Version name', exact: true }).fill(name);
  await versions().getByRole('button', { name: 'Make version', exact: true }).click();
  await versions().getByRole('listitem', { name: 'Version ' + name, exact: true }).waitFor();
}

function readProject() {
  return f.page.evaluate(async ({ project, filename }) => {
    const storage = await navigator.storage.getDirectory();
    const folder = await (await storage.getDirectoryHandle('projects')).getDirectoryHandle(project);
    const read = async (dir, name) => (await (await dir.getFileHandle(name)).getFile()).text();
    const metadata = await folder.getDirectoryHandle('.barocss');
    const versions = await metadata.getDirectoryHandle('versions');
    const snapshots = await metadata.getDirectoryHandle('snapshots');
    const log = JSON.parse(await read(versions, filename + '.json'));
    return { doc: await read(folder, filename), snapshots: await Promise.all(log.versions.map(v => read(snapshots, v.snapshot + '.bcad'))) };
  }, { project, filename });
}

async function inspectLeaf(i, height, verdict) {
  const leaf = f.page.locator(`.ol.instance.nested[data-path="${paths[i]}"]`);
  if (!(await leaf.isVisible())) await button('Show the parts of ' + ['Left module', 'Right module'][i]).click();
  await leaf.click();
  const card = f.page.getByRole('complementary', { name: 'Nested part', exact: true });
  await card.getByTestId('nested-path').getByText(paths[i], { exact: true }).waitFor();
  const row = card.getByRole('group', { name: 'Local requirement HEIGHT', exact: true });
  await row.getByText(`${height} mm`, { exact: false }).waitFor();
  assert.match(await row.innerText(), new RegExp(`HEIGHT · ${verdict}`));
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  const bytes = await readFile(initialFile), initial = JSON.parse(bytes);
  assert.equal(sha256(bytes), '18bf58e74c939982b8653df592a275ee7a2a59492ce2e77c254eee76454ec19c');
  const pendingFile = join(output, 'pending-root.bcad');
  await writeFile(pendingFile, bytes);
  f.phase = 'actual MCP requires a proposal and keeps the original assembly';
  const [direct, batch, ...initialReads] = await mcp(pendingFile, 'before', [
    ['features', edit.args], ['features', { action: 'batch', ops: [edit] }], ...paths.map(part => evidence(part)),
  ]);
  assert.ok(direct.error && batch.error);
  assert.match(direct.body.error, /requires a root proposal/);
  assert.match(batch.body.error, /requires a root proposal/);
  assert.deepEqual(await readFile(pendingFile), bytes);
  const beforeReports = reports(initialReads);
  const [created, denied, ...pendingReads] = await mcp(pendingFile, 'pending', [
    ['proposals', { action: 'propose', title: 'Reduce the left plate to 4 mm', ops: [edit] }],
    ['proposals', { action: 'accept', id: 'P1' }], ...paths.map(part => evidence(part)),
  ]);
  assert.equal(created.error, false, JSON.stringify(created));
  assert.deepEqual(created.body.risk.approval, ['assembly']);
  assert.match(created.body.summary, /p1\/p1: H 6 → 4, p1\/p1 local checks 1\/1\/0 → 2\/0\/0/);
  assert.equal(created.body.risk.level, 'high');
  assert.deepEqual(created.body.risk.hard_requirements_changed, ['p1/p1:HEIGHT']);
  assert.equal(denied.error, true);
  assert.match(denied.body.error, /user.s approval/);
  assert.deepEqual(reports(pendingReads), beforeReports);
  const pending = JSON.parse(await readFile(pendingFile, 'utf8'));
  assert.deepEqual(pending.instances, initial.instances);

  f.phase = 'Studio refuses rebase on a newer document reusing the same path';
  const stale = structuredClone(pending), staleFile = join(output, 'reused-path.bcad');
  stale.instances[0].doc.instances[0].doc.parameters.H = 8;
  await writeFile(staleFile, JSON.stringify(stale));
  await f.newPage();
  await open(staleFile, stale);
  await button('Chat').first().click();
  await proposal().getByRole('button', { name: 'Rebase & preview', exact: true }).click();
  await f.waitToast(/Make a new proposal on the current document/);
  assert.equal(await proposal().getByRole('button', { name: 'Accept', exact: true }).count(), 0);
  await f.same(stale);
  await f.snapshot('01-stale-rebase-refused');

  f.phase = 'desktop preview uses the placed candidate and leaves the saved failure intact';
  await f.newPage();
  await open(pendingFile, pending);
  await inspectLeaf(0, 6, 'Fail');
  await inspectLeaf(1, 7, 'Fail');
  const before = await f.snapshot('02-original-failure');
  await openProject();
  await makeVersion('Initial failure');
  const savedBefore = await readProject();
  assert.deepEqual(JSON.parse(savedBefore.snapshots[0]), pending);
  await button('Project and versions').click();
  await button('Chat').first().click();
  await proposal().getByText(/p1\/p1 local checks 1\/1\/0 → 2\/0\/0/).waitFor();
  await proposal().getByText(/high risk/i, { exact: true }).waitFor();
  await proposal().getByRole('button', { name: 'Preview', exact: true }).click();
  await proposal().getByRole('button', { name: 'Hide', exact: true }).waitFor();
  await proposal().getByLabel('Volume change').waitFor();
  const preview = await f.snapshot('03-placed-preview');
  assert.equal(preview.volume, '−400 mm³');
  await f.same(pending);
  assert.deepEqual(await readProject(), savedBefore);

  f.phase = 'Studio approval records the root pair and preserves the sibling';
  await proposal().getByRole('button', { name: 'Accept', exact: true }).click();
  await f.page.waitForFunction(() => window.__studioDoc?.proposals?.[0]?.status === 'accepted');
  await f.ready();
  const accepted = await f.doc();
  const [left, right] = accepted.instances, history = accepted.history.at(-1), decision = accepted.proposals[0].decided;
  assert.deepEqual([left.doc.instances[0].doc.parameters.H, left.part.rev, history.by.agent, history.proposal], [4, 'B', 'user', 'P1']);
  assert.deepEqual([left.position, left.rotation, left.looks], [initial.instances[0].position, initial.instances[0].rotation, initial.instances[0].looks]);
  assert.deepEqual(right, initial.instances[1]);
  assert.deepEqual(accepted.nodes, pending.nodes);
  assert.deepEqual(history.evidence_revisions, decision.evidence_revisions);
  assert.equal(history.evidence_revisions.before, beforeReports[0].revision);
  await inspectLeaf(0, 4, 'Pass');
  const after = await f.snapshot('04-approved-target');
  await inspectLeaf(1, 7, 'Fail');
  await f.undo();
  await f.same(pending);
  await inspectLeaf(0, 6, 'Fail');
  await f.redo();
  await f.same(accepted);
  await inspectLeaf(0, 4, 'Pass');
  await button('Chat').first().click();
  await makeVersion('Approved nested repair');
  const saved = await readProject();
  assert.equal(saved.snapshots[0], savedBefore.snapshots[0]);
  assert.deepEqual(JSON.parse(saved.doc), accepted);
  assert.deepEqual(JSON.parse(saved.snapshots[1]), accepted);

  f.phase = 'fresh Open and local MCP bind the exact root revision pair';
  const savedFile = join(output, 'approved-root.bcad');
  await writeFile(savedFile, saved.doc);
  await f.newPage();
  await open(savedFile, accepted);
  await inspectLeaf(0, 4, 'Pass');
  await inspectLeaf(1, 7, 'Fail');
  await f.snapshot('05-fresh-open');
  const [oldPin, ...acceptedReads] = await mcp(savedFile, 'accepted', [
    evidence(paths[0], beforeReports[0].revision), ...paths.map(part => evidence(part, history.evidence_revisions.after)),
  ]);
  assert.equal(oldPin.error, true);
  assert.match(oldPin.body.error, /OUTPUT_STALE/);
  const acceptedReports = reports(acceptedReads);
  assert.equal(acceptedReports[1].definitionRevision, beforeReports[1].definitionRevision);
  assert.notEqual(acceptedReports[0].definitionRevision, beforeReports[0].definitionRevision);
  assert.equal(await readFile(savedFile, 'utf8'), saved.doc);
  assert.deepEqual(await readFile(initialFile), bytes);
  await f.runOracle({ before: { reports: beforeReports, boxes: before.placed }, after: { reports: acceptedReports, boxes: after.placed }, previewVolume: preview.volume }, 'independent-root-repair');
  f.report.observations.push({ pair: history.evidence_revisions, originalSHA256: sha256(saved.snapshots[0]), approvedSHA256: sha256(saved.doc), previewVolume: preview.volume });
  assert.deepEqual(f.report.downloads, []);
});
