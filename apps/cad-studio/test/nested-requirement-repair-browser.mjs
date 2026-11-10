import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output] = process.argv.slice(2), repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
const pins = [
  'apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/scripts/cad-mcp.mjs', 'apps/cad-studio/server/cadMcp.ts',
  'apps/cad-studio/src/storage/VersionsPanel.tsx', 'apps/cad-studio/src/ui/NestedRequirementReadout.tsx',
  'packages/barocss-cad-model/src/assembly/definitions.ts', 'packages/barocss-cad-model/src/chat/requirementEvidence.ts',
  'packages/barocss-cad-model/src/chat/proposals.ts', 'packages/barocss-cad-model/src/versions/log.ts',
];
const oracleSource = String.raw`
import json, math, sys
data = json.load(sys.stdin)
for phase, heights in [('before', [6, 7]), ('after', [4, 7])]:
    doc = data[phase]['doc']
    for i, (host, height, report) in enumerate(zip(doc['instances'], heights, data[phase]['reports'], strict=True), 1):
        leaf, = host['doc']['instances']
        path = f'p{i}/p1'
        assert path == f"{host['id']}/{leaf['id']}" == report['part']
        assert host['position'] == [[30, 0, 8], [60, 0, 15]][i - 1]
        assert leaf['position'] == [0, 0, 0]
        assert host['rotation'] == leaf['rotation'] == [0, 0, 0]
        assert leaf['doc']['parameters']['H'] == height
        sketch, extrusion = leaf['doc']['nodes']
        assert sketch['min'] == [0, 0] and sketch['max'] == [20, 10]
        assert extrusion['height'] == {'parameter': 'H'}
        expected = {'HEIGHT': (height, 5), 'MASS': (20 * 10 * height * 0.00785, 20)}
        for row in report['evidence']:
            result = row['result']
            if result['kind'] != 'requirement':
                continue
            value, cap = expected.pop(result['subject'])
            assert result['part'] == path and result['status'] == 'ok' and row['freshness']['state'] == 'current'
            assert math.isclose(result['number'], value, rel_tol=0, abs_tol=1e-8)
            assert result['verdict'] == ('pass' if value <= cap else 'fail')
            assert row['requirement'] in leaf['doc']['requirements']
            assert data[phase]['studio'][path][result['subject']] == [result['number'], result['verdict']]
        assert not expected
print(json.dumps({'status':'PASS','numericChecks':8,'absoluteTolerance':1e-8}))
`;
const f = await createFlow({
  name: 'nested-requirement-repair', envFrozen: 'D606_SOURCE_FROZEN', output, initialFiles: pins, requiredFrozen: pins, oracleSource,
  qualification: 'User-approved repair through the existing host revision workflow',
  limits: ['One local deterministic MCP caller, one private subassembly, two explicit desktop decisions and two named root snapshots.'],
});

const empty = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [], outputs: {}, nextId: 0 };
const plate = (height, w = 20, d = 10) => ({
  ...empty, nextId: 2, parameters: { H: height }, nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [w, d] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: { parameter: 'H' } },
  ], outputs: { b1: { node: 1, side: 'solid' } },
});
const requirements = [
  { id: 'HEIGHT', source: 'Plate height maximum 5 mm', basis: 'stated', hard: true, check: { query: { fn: 'bbox', axis: 'z' }, op: '<=', value: 5, unit: 'mm' } },
  { id: 'MASS', source: 'Plate mass maximum 20 g', basis: 'stated', hard: true, check: { query: { fn: 'mass' }, op: '<=', value: 20, unit: 'g' } },
];
const moduleOf = (height, material) => ({ ...empty, instances: [{
  id: 'p1', name: 'Leaf plate', doc: { ...plate(height), requirements }, position: [0, 0, 0], rotation: [0, 0, 0], looks: { b1: { material } },
}] });
const initial = { ...plate(2, 6, 6), instances: [
  { id: 'p1', name: 'Left module', doc: moduleOf(6, 'al6061'), position: [30, 0, 8], rotation: [0, 0, 0], part: { id: 'left-module', rev: 'A' }, looks: { 'p1/b1': { material: 'steel' } } },
  { id: 'p2', name: 'Right module', doc: moduleOf(7, 'steel'), position: [60, 0, 15], rotation: [0, 0, 0], part: { id: 'right-module', rev: 'A' } },
] };
const filename = 'D606-root.bcad', hostName = 'D606-left-module.bcad', project = 'D606 nested repair';
const paths = ['p1/p1', 'p2/p1'];
const button = name => f.page.getByRole('button', { name, exact: true });
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const proposal = () => f.page.getByRole('listitem', { name: 'Proposal P1', exact: true });
const instance = () => f.page.getByRole('complementary', { name: 'Instance', exact: true });
const evidence = (part, expectedRevision) => ['requirements', { action: 'evidence', part, ...(expectedRevision ? { expectedRevision } : {}) }];
const change = part => ({ tool: 'features', args: { action: 'parameters', part, set: { H: 4 } } });
const propose = part => ['proposals', { action: 'propose', title: 'Reduce the left plate to 4 mm', ops: [change(part)] }];

async function mcp(path, label, calls) {
  const frames = [{ id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
    ...calls.map(([name, args], i) => ({ id: i + 2, method: 'tools/call', params: { name, arguments: args } }))];
  const result = spawnSync(process.execPath, [join(f.app, 'scripts/cad-mcp.mjs'), '--doc', path, '--autonomy', '4'], {
    input: frames.map(frame => JSON.stringify({ jsonrpc: '2.0', ...frame }) + '\n').join(''),
    encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024,
  });
  await writeFile(join(output, label + '-mcp.jsonl'), result.stdout ?? '');
  await writeFile(join(output, label + '-mcp.stderr.txt'), result.stderr ?? '');
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  const replies = result.stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(replies.map(reply => reply.id), frames.map(frame => frame.id));
  assert.equal(replies[0].result.serverInfo.version, 'barocss-cad-tools-v2');
  return replies.slice(1).map(({ result }) => ({ error: result.isError, body: JSON.parse(result.content[0].text) }));
}

function report(reply, part) {
  assert.equal(reply.error, false, JSON.stringify(reply));
  const [file] = reply.body.files;
  assert.deepEqual([file.path, file.bytes, file.sha256], ['requirement-evidence.json', Buffer.byteLength(file.text), sha256(file.text)]);
  const result = JSON.parse(file.text);
  assert.deepEqual([result.part, result.revision, result.checker], [part, reply.body.revision, 'checkSpec']);
  return result;
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

function readProject(file, withVersions = false) {
  return f.page.evaluate(async ({ project, file, withVersions }) => {
    const storage = await navigator.storage.getDirectory();
    const folder = await (await storage.getDirectoryHandle('projects')).getDirectoryHandle(project);
    const read = async (dir, name) => (await (await dir.getFileHandle(name)).getFile()).text();
    const doc = await read(folder, file);
    if (!withVersions) return { doc };
    const metadata = await folder.getDirectoryHandle('.barocss');
    const versions = await metadata.getDirectoryHandle('versions');
    const snapshots = await metadata.getDirectoryHandle('snapshots');
    const log = await read(versions, file + '.json');
    const saved = await Promise.all(JSON.parse(log).versions.map(async v => ({ name: v.name, bytes: await read(snapshots, v.snapshot + '.bcad') })));
    return { doc, log, saved };
  }, { project, file, withVersions });
}

async function verdict(i, height) {
  const host = initial.instances[i];
  const leaf = f.page.locator(`.ol.instance.nested[data-path="${paths[i]}"]`);
  if (!(await leaf.isVisible())) await button('Show the parts of ' + host.name).click();
  await leaf.click();
  const card = f.page.getByRole('complementary', { name: 'Nested part', exact: true });
  await card.getByTestId('nested-path').getByText(paths[i], { exact: true }).waitFor();
  const readout = card.getByRole('region', { name: 'Local requirements', exact: true });
  await readout.getByText(`${height} mm`, { exact: false }).waitFor();
  const rows = {};
  for (const [id, unit] of [['HEIGHT', 'mm'], ['MASS', 'g']]) {
    const text = await readout.getByRole('group', { name: 'Local requirement ' + id, exact: true }).innerText();
    const [, state] = text.match(new RegExp(`^[✓✗?]${id} · (Pass|Fail|Unknown)`, 'm')) ?? [];
    const [, value] = text.match(new RegExp(`^(-?[0-9.]+) ${unit} \\(want `, 'm')) ?? [];
    assert.ok(state && value, text);
    rows[id] = [Number(value), state.toLowerCase()];
  }
  assert.deepEqual(rows.HEIGHT, [height, height <= 5 ? 'pass' : 'fail']);
  return rows;
}

async function leafResults(left) {
  return { [paths[0]]: await verdict(0, left), [paths[1]]: await verdict(1, 7) };
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
  const initialFile = join(output, filename), hostFile = join(output, hostName);
  const initialBytes = JSON.stringify(initial);
  await writeFile(initialFile, initialBytes);
  await writeFile(hostFile, JSON.stringify(initial.instances[0].doc));

  f.phase = 'root-scoped nested mutation and proposal refuse without writes';
  const [direct, rootProposal, ...initialReads] = await mcp(initialFile, 'root-before', [
    ['features', change(paths[0]).args], propose(paths[0]), ...paths.map(path => evidence(path)),
  ]);
  for (const refused of [direct, rootProposal]) {
    assert.equal(refused.error, true, JSON.stringify(refused));
    assert.match(refused.body.error, /No part "p1\/p1"/);
  }
  assert.equal(await readFile(initialFile, 'utf8'), initialBytes);
  const firstReports = paths.map((part, i) => report(initialReads[i], part));
  f.report.directRootRefusals = [direct.body.error, rootProposal.body.error];

  f.phase = 'the real MCP prepares a private host proposal without authorizing it';
  const [oldHostRead, created, denied, retainedHostRead] = await mcp(hostFile, 'private-host', [
    evidence('p1'), propose('p1'), ['proposals', { action: 'accept', id: 'P1' }], evidence('p1'),
  ]);
  assert.equal(created.error, false, JSON.stringify(created));
  assert.deepEqual(created.body.risk.approval, ['assembly']);
  assert.equal(denied.error, true, JSON.stringify(denied));
  assert.match(denied.body.error, /user.s approval/);
  const privateBefore = report(oldHostRead, 'p1');
  assert.deepEqual(report(retainedHostRead, 'p1'), privateBefore);
  const pending = JSON.parse(await readFile(hostFile, 'utf8'));
  assert.equal(pending.proposals[0].base_evidence_revision, privateBefore.revision);
  assert.deepEqual(pending.instances, initial.instances[0].doc.instances);

  f.phase = 'save the original failing assembly and inspect both current paths';
  await f.newPage();
  await f.openFile(initialFile, 2);
  await f.same(initial);
  const beforeStudio = await leafResults(6);
  await f.snapshot('01-original-failure');
  await openProject();
  await makeVersion('Initial failure');
  const original = await readProject(filename, true);
  assert.deepEqual(original.saved.map(v => v.name), ['Initial failure']);
  assert.deepEqual(JSON.parse(original.saved[0].bytes), initial);

  f.phase = 'user previews and accepts the scoped proposal in the private host';
  await f.openFile(hostFile, 0);
  await f.same(pending);
  await button('Chat').first().click();
  await proposal().getByRole('button', { name: 'Preview', exact: true }).click();
  await proposal().getByRole('button', { name: 'Hide', exact: true }).waitFor();
  await f.same(pending);
  await f.snapshot('02-private-preview');
  await proposal().getByRole('button', { name: 'Accept', exact: true }).click();
  await f.page.waitForFunction(() => window.__studioDoc?.proposals?.[0]?.status === 'accepted');
  await f.ready();
  const acceptedHost = await f.doc(), childDecision = acceptedHost.history.at(-1);
  assert.deepEqual([childDecision.kind, childDecision.by.agent, childDecision.proposal, acceptedHost.instances[0].doc.parameters.H], ['accept', 'user', 'P1', 4]);
  assert.equal(childDecision.evidence_revisions.before, privateBefore.revision);
  assert.deepEqual(childDecision.evidence_revisions, acceptedHost.proposals[0].decided.evidence_revisions);
  await button('Chat').first().click();
  await makeVersion('Approved host correction');
  const staged = await readProject(hostName);
  assert.deepEqual(JSON.parse(staged.doc), acceptedHost);
  const candidate = join(output, 'approved-left-module.bcad');
  await writeFile(candidate, staged.doc);
  const [acceptedPrivate] = await mcp(candidate, 'approved-host', [evidence('p1', childDecision.evidence_revisions.after)]);
  assert.equal(report(acceptedPrivate, 'p1').evidence[0].result.verdict, 'pass');

  f.phase = 'offer the approved file and retain the root failure until a separate acceptance';
  await versions().getByRole('button', { name: 'Open ' + filename, exact: true }).click();
  await f.same(initial);
  await button('Project and versions').click();
  await f.page.locator('.ol.instance:not(.nested)').filter({ hasText: 'Left module' }).click();
  await instance().getByLabel('New revision file').setInputFiles(candidate);
  await instance().getByRole('button', { name: 'Accept Rev B', exact: true }).waitFor();
  const offered = await f.doc();
  assert.deepEqual(offered.instances, initial.instances);
  assert.equal(offered.pendingParts['left-module'].doc.instances[0].doc.parameters.H, 4);
  assert.deepEqual(await leafResults(6), beforeStudio);
  await f.snapshot('03-offered-still-failing');

  f.phase = 'root revision acceptance changes only the selected branch and is undoable';
  await f.page.locator('.ol.instance:not(.nested)').filter({ hasText: 'Left module' }).click();
  await instance().getByRole('button', { name: 'Accept Rev B', exact: true }).click();
  await f.page.waitForFunction(() => window.__studioDoc?.instances?.[0]?.part?.rev === 'B');
  await f.ready();
  const accepted = await f.doc();
  assert.deepEqual(accepted.instances[0].doc, acceptedHost);
  assert.deepEqual(accepted.instances[1], initial.instances[1]);
  for (const key of ['id', 'position', 'rotation', 'looks']) assert.deepEqual(accepted.instances[0][key], initial.instances[0][key]);
  assert.equal(accepted.pendingParts, undefined);
  const afterStudio = await leafResults(4);
  assert.deepEqual(afterStudio[paths[1]], beforeStudio[paths[1]]);
  await f.snapshot('04-accepted-target');
  await f.undo();
  await f.same(offered);
  assert.deepEqual(await leafResults(6), beforeStudio);
  await f.redo();
  await f.same(accepted);
  assert.deepEqual(await leafResults(4), afterStudio);

  f.phase = 'reload the project and compare the original and corrected snapshots without restoring';
  await makeVersion('Accepted nested revision');
  const persisted = await readProject(filename, true);
  assert.deepEqual(persisted.saved.map(v => v.name), ['Initial failure', 'Accepted nested revision']);
  assert.equal(persisted.saved[0].bytes, original.saved[0].bytes);
  assert.deepEqual(JSON.parse(persisted.saved[1].bytes), accepted);
  await f.page.reload();
  await f.ready();
  await openProject();
  await versions().getByRole('button', { name: 'Open ' + filename, exact: true }).click();
  await f.same(accepted);
  await versions().getByRole('button', { name: 'Compare Initial failure', exact: true }).click();
  await versions().getByLabel('Compare to', { exact: true }).selectOption({ label: 'Accepted nested revision' });
  const comparison = versions().getByRole('status', { name: 'Compared changes', exact: true });
  await comparison.getByText('Initial failure → Accepted nested revision · saved versions', { exact: true }).waitFor();
  assert.match(await comparison.innerText(), /p1/);
  assert.equal(await versions().getByRole('region', { name: 'Saved approval checks', exact: true }).count(), 0);
  assert.equal(accepted.history, undefined);
  assert.deepEqual(await readProject(filename, true), persisted);
  await f.snapshot('05-saved-comparison');
  await button('Project and versions').click();
  assert.deepEqual(await leafResults(4), afterStudio);
  await f.snapshot('06-reopened-target-and-control');

  f.phase = 're-read original and accepted bytes with fresh MCP and independent arithmetic';
  const savedBefore = join(output, 'original-snapshot.bcad'), savedAfter = join(output, 'accepted-snapshot.bcad');
  await writeFile(savedBefore, persisted.saved[0].bytes);
  await writeFile(savedAfter, persisted.saved[1].bytes);
  const oldReads = await mcp(savedBefore, 'saved-initial', paths.map((part, i) => evidence(part, firstReports[i].revision)));
  const newReads = await mcp(savedAfter, 'saved-accepted', [evidence(paths[0], firstReports[0].revision), ...paths.map(part => evidence(part))]);
  const stale = newReads.shift();
  assert.equal(stale.error, true);
  assert.match(stale.body.error, /OUTPUT_STALE/);
  assert.equal(stale.body.files, undefined);
  const oldReports = oldReads.map((reply, i) => report(reply, paths[i]));
  const newReports = newReads.map((reply, i) => report(reply, paths[i]));
  assert.deepEqual(oldReports, firstReports);
  assert.notEqual(newReports[0].definitionRevision, oldReports[0].definitionRevision);
  assert.equal(newReports[1].definitionRevision, oldReports[1].definitionRevision);
  assert.equal(await readFile(savedBefore, 'utf8'), persisted.saved[0].bytes);
  assert.equal(await readFile(savedAfter, 'utf8'), persisted.saved[1].bytes);
  await f.runOracle({ before: { doc: initial, reports: oldReports, studio: beforeStudio }, after: { doc: accepted, reports: newReports, studio: afterStudio } }, 'nested-repair-oracle');
  f.report.observations.push({ beforeStudio, afterStudio, childApproval: childDecision.evidence_revisions,
    rootApprovalHistoryPresent: false, savedApprovalReadoutPresent: false, initialSHA256: sha256(persisted.saved[0].bytes), acceptedSHA256: sha256(persisted.saved[1].bytes) });
  assert.deepEqual(f.report.downloads, []);
});
