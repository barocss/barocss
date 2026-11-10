import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2], repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
const filename = 'D592-twin-plates.bcad', project = 'D592 approval';
const empty = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [], outputs: {}, nextId: 0 };
const requirements = [
  { id: 'H-CAP', source: 'Drawing note: 10 mm maximum', basis: 'stated', said: 'verified', hard: true, check: { query: { fn: 'bbox', axis: 'z' }, op: '<=', value: 10, unit: 'mm' } },
  { id: 'VOL-CAP', source: 'Drawing note: 2000 mm³ maximum', basis: 'stated', said: 'verified', hard: true, check: { query: { fn: 'volume' }, op: '<=', value: 2000, unit: 'mm3' } },
];
const plate = {
  ...empty, parameters: { H: 11 }, nextId: 2, requirements,
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [20, 10], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: { parameter: 'H' }, id: 'n1' },
  ],
  outputs: { b1: { node: 1, side: 'solid' } },
};
const failed = { ...empty, instances: [
  { id: 'p1', name: 'Target plate', doc: plate, position: [0, 0, 0], rotation: [0, 0, 0] },
  { id: 'p2', name: 'Control plate', doc: plate, position: [40, 0, 0], rotation: [0, 0, 0] },
] };
const pins = [
  'apps/cad-studio/test/proposal-evidence-browser.mjs', 'apps/cad-studio/test/flow-helper.mjs',
  'apps/cad-studio/server/cadMcp.ts', 'apps/cad-studio/scripts/cad-mcp.mjs', 'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/state/useProposalPreview.ts', 'apps/cad-studio/src/ui/ProposalBrowser.tsx', 'apps/cad-studio/src/ui/DesignHistory.tsx',
  'packages/barocss-cad-model/src/chat/part/proposals.ts', 'packages/barocss-cad-model/src/chat/proposals.ts',
  'packages/barocss-cad-model/src/chat/outputs.ts', 'packages/barocss-cad-model/src/chat/merge.ts',
  'packages/barocss-cad-model/src/chat/tools.ts', 'packages/barocss-cad-model/src/engine/container.ts',
  'packages/barocss-cad-model/src/engine/schema/proposals.ts', 'packages/barocss-cad-model/src/util/digest.ts',
];
const f = await createFlow({
  name: 'proposal-evidence', envFrozen: 'D592_SOURCE_FROZEN', output, qualification: 'Human approval binds requirement evidence to an occurrence and saved revision',
  initialFiles: pins, requiredFrozen: pins,
  limits: ['Two top-level placements of one rectangular definition, one named parameter edit, two checkers, desktop Studio and local MCP.'],
  oracleSource: `
import json, sys
data = json.load(sys.stdin)
for phase, heights in [('before', [11, 11]), ('after', [10, 11])]:
    doc = data[phase]['doc']
    for index, (instance, report, height) in enumerate(zip(doc['instances'], data[phase]['reports'], heights, strict=True), 1):
        assert instance['id'] == report['part'] == f'p{index}'
        assert instance['position'] == [40 * (index - 1), 0, 0]
        assert instance['doc']['parameters']['H'] == height
        assert report['checker'] == 'checkSpec'
        rows = {r['requirement']['id']: r for r in report['evidence'] if r['result']['kind'] == 'requirement'}
        assert set(rows) == {'H-CAP', 'VOL-CAP'}
        for rule, value, cap in [('H-CAP', height, 10), ('VOL-CAP', 20 * 10 * height, 2000)]:
            row = rows[rule]
            assert row['requirement'] in instance['doc']['requirements']
            assert row['result']['part'] == instance['id'] and row['result']['subject'] == rule
            assert row['result']['status'] == 'ok' and row['freshness']['state'] == 'current'
            assert abs(row['result']['number'] - value) <= 1e-8
            assert row['result']['verdict'] == ('pass' if value <= cap else 'fail')
print(json.dumps({'status':'PASS','phaseCount':2,'occurrenceCount':2,'numericChecks':8}))
`,
});
const localMcp = join(repo, 'apps/cad-studio/scripts/cad-mcp.mjs');
const button = name => f.page.getByRole('button', { name, exact: true });
const evidence = (part, expectedRevision) => ['requirements', { action: 'evidence', part, ...(expectedRevision ? { expectedRevision } : {}) }];

async function mcp(path, label, calls) {
  const initialize = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } };
  const requests = calls.map(([name, args], i) => ({ jsonrpc: '2.0', id: i + 2, method: 'tools/call', params: { name, arguments: args } }));
  const result = spawnSync(process.execPath, [localMcp, '--doc', path, '--autonomy', '4'], {
    input: [initialize, ...requests].map(frame => JSON.stringify(frame) + '\n').join(''),
    encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024,
  });
  await writeFile(join(f.output, label + '-mcp.jsonl'), result.stdout ?? '');
  assert.equal(result.status, 0, result.stderr);
  const [hello, ...replies] = result.stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(hello.result.serverInfo.version, 'barocss-cad-tools-v2');
  assert.deepEqual(replies.map(reply => reply.id), requests.map(request => request.id));
  return replies.map(({ result }) => {
    const body = JSON.parse(result.content[0].text);
    if (!result.isError && body.files) assert.deepEqual(result.structuredContent, body);
    return { error: result.isError, body };
  });
}

async function report(reply, label, part) {
  assert.equal(reply.error, false, JSON.stringify(reply));
  const [file] = reply.body.files;
  assert.deepEqual([file.path, file.bytes, file.sha256], ['requirement-evidence.json', Buffer.byteLength(file.text), sha256(file.text)]);
  await writeFile(join(f.output, label + '-evidence.json'), file.text);
  const data = JSON.parse(file.text);
  assert.deepEqual([data.format, data.version, data.part, data.revision], ['barocss-requirement-evidence', 1, part, reply.body.revision]);
  assert.deepEqual(data.evidence.filter(row => row.result.kind === 'requirement').map(row => row.requirement), requirements);
  return data;
}

async function open(bytes) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: filename, mimeType: 'application/json', buffer: bytes });
  await f.same(JSON.parse(bytes));
}
const proposalCard = () => f.page.getByRole('listitem', { name: 'Proposal P1', exact: true });

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  f.report.runtimeOwnership = { nodePID: process.pid, serverURL: origin };
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
  f.phase = 'retain failing reports and require human approval';
  const path = join(f.output, 'pending.bcad');
  await writeFile(path, JSON.stringify(failed));
  const first = await mcp(path, 'before', [evidence('p1'), evidence('p2')]);
  const before = [await report(first[0], 'initial-p1', 'p1'), await report(first[1], 'initial-p2', 'p2')];
  const [proposal, refused, unchanged] = await mcp(path, 'pending', [
    ['proposals', { action: 'propose', title: 'Reduce target plate to 10 mm', ops: [{ tool: 'features', args: { action: 'parameters', part: 'p1', set: { H: 10 } } }] }],
    ['proposals', { action: 'accept', id: 'P1' }],
    evidence('p1', before[0].revision),
  ]);
  assert.equal(proposal.error, false, JSON.stringify(proposal));
  assert.deepEqual(proposal.body.risk.approval, ['assembly']);
  assert.equal(refused.error, true);
  assert.match(refused.body.error, /user.s approval.*assembly/);
  assert.deepEqual(unchanged.body.files, first[0].body.files);
  const pending = await readFile(path), pendingDoc = JSON.parse(pending);
  assert.equal(pendingDoc.proposals[0].base_evidence_revision, before[0].revision);
  assert.deepEqual(pendingDoc.instances, failed.instances);
  assert.deepEqual(pendingDoc.history.map(entry => entry.kind), ['proposal']);
  const scopedPath = join(f.output, 'scoped-pending.bcad');
  await writeFile(scopedPath, JSON.stringify(failed));
  const [scoped, denied] = await mcp(scopedPath, 'scoped', [
    ['proposals', { action: 'propose', part: 'p1', title: 'Child-scoped edit', ops: [{ tool: 'features', args: { action: 'parameters', set: { H: 10 } } }] }],
    ['proposals', { action: 'accept', part: 'p1', id: 'P1' }],
  ]);
  assert.equal(scoped.error, false, JSON.stringify(scoped));
  assert.equal(denied.error, true);
  assert.match(denied.body.error, /placed part always needs the user.s approval/);
  assert.equal(JSON.parse(await readFile(scopedPath)).instances[0].doc.parameters.H, 11);

  f.phase = 'Studio refuses stale approval after only the control occurrence moves';
  const moved = { ...pendingDoc, instances: [pendingDoc.instances[0], { ...pendingDoc.instances[1], position: [45, 0, 0] }] };
  await f.newPage();
  await open(Buffer.from(JSON.stringify(moved)));
  await button('Chat').first().click();
  await proposalCard().getByRole('button', { name: 'Rebase & preview', exact: true }).waitFor();
  assert.equal(await proposalCard().getByRole('button', { name: 'Accept', exact: true }).count(), 0);
  await proposalCard().getByText(/assembly change/).waitFor();
  await f.snapshot('01-stale-control-occurrence');
  await proposalCard().getByRole('button', { name: 'Rebase & preview', exact: true }).click();
  await proposalCard().getByRole('button', { name: 'Hide', exact: true }).waitFor();
  const rebased = await f.doc();
  assert.deepEqual(rebased.instances, moved.instances);
  assert.deepEqual(rebased.history.map(entry => entry.kind), ['proposal', 'rebase']);
  assert.notEqual(rebased.proposals[0].base_evidence_revision, before[0].revision);
  await f.snapshot('02-rebase-keeps-approval-open');

  f.phase = 'Studio preview leaves evidence unchanged until explicit user acceptance';
  await f.newPage();
  await open(pending);
  await button('Chat').first().click();
  await proposalCard().getByRole('button', { name: 'Preview', exact: true }).click();
  await proposalCard().getByRole('button', { name: 'Hide', exact: true }).waitFor();
  await f.same(pendingDoc);
  const beforeStudio = await f.snapshot('03-pending-preview');
  await proposalCard().getByRole('button', { name: 'Accept', exact: true }).click();
  await f.page.waitForFunction(() => window.__studioDoc?.proposals?.[0]?.status === 'accepted');
  await f.ready();
  const accepted = await f.snapshot('04-user-accepted');
  assert.deepEqual(accepted.doc.instances.map(instance => instance.doc.parameters.H), [10, 11]);
  assert.deepEqual(accepted.doc.instances[1], pendingDoc.instances[1]);
  const decision = accepted.doc.proposals[0].decided, history = accepted.doc.history.at(-1);
  assert.deepEqual([history.kind, history.proposal, history.by.agent, history.proposed_by.agent, decision.by, decision.at], ['accept', 'P1', 'user', 'chat', 'user', history.at]);
  assert.deepEqual(decision.evidence_revisions, history.evidence_revisions);

  f.phase = 'Studio project Save and fresh Open';
  await button('Project and versions').click();
  const versions = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await versions.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await versions.getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await versions.getByLabel('Project', { exact: true }).waitFor();
  await button('Save').click();
  await versions.getByRole('list', { name: 'Project documents', exact: true }).getByText(filename, { exact: true }).waitFor();
  const saved = Buffer.from(await f.page.evaluate(async ({ project, filename }) => {
    const root = await navigator.storage.getDirectory();
    const projects = await root.getDirectoryHandle('projects');
    const handle = await (await projects.getDirectoryHandle(project)).getFileHandle(filename);
    return [...new Uint8Array(await (await handle.getFile()).arrayBuffer())];
  }, { project, filename }));
  assert.deepEqual(JSON.parse(saved), accepted.doc);
  const savedPath = join(f.output, 'saved-opfs.bcad');
  await writeFile(savedPath, saved);
  f.report.files.push({ file: savedPath, hash: sha256(saved), source: 'Actual Studio OPFS' });
  await f.newPage();
  await open(saved);
  await button('Show design history').click();
  const historyRow = f.page.locator('.hist.accept');
  await historyRow.getByText(/user/).waitFor();
  const reopened = await f.snapshot('05-reopened-user-history');

  f.phase = 'fresh MCP joins the exact saved revision to the retained failed artifact';
  const [stale, p1, p2] = await mcp(savedPath, 'reopened', [evidence('p1', before[0].revision), evidence('p1', history.evidence_revisions.after), evidence('p2', history.evidence_revisions.after)]);
  assert.equal(stale.error, true);
  assert.match(stale.body.error, /OUTPUT_STALE/);
  assert.equal(stale.body.files, undefined);
  const after = [await report(p1, 'accepted-p1', 'p1'), await report(p2, 'accepted-p2', 'p2')];
  assert.deepEqual(history.evidence_revisions, { before: before[0].revision, after: after[0].revision });
  assert.notEqual(after[0].definitionRevision, before[0].definitionRevision);
  assert.equal(after[1].definitionRevision, before[1].definitionRevision);
  assert.equal(sha256(await readFile(join(f.output, 'initial-p1-evidence.json'))), first[0].body.files[0].sha256);
  assert.deepEqual(await readFile(savedPath), saved);
  await f.runOracle({ before: { doc: beforeStudio.doc, reports: before }, after: { doc: reopened.doc, reports: after } }, 'approval-occurrence-evidence');
  f.report.revisions = history.evidence_revisions;
  assert.deepEqual(f.report.downloads, []);
});
