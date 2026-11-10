import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2], repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
const filename = 'D591-plate.bcad', project = 'D591 evidence';
const requirement = {
  id: 'H-CAP', source: 'get_part_summary recorded a 10 mm maximum — 기준', basis: 'stated', said: 'verified', hard: true,
  check: { query: { fn: 'bbox', axis: 'z' }, op: '<=', value: 10, unit: 'mm' },
};
const failed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: { H: 11 },
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [20, 10], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: { parameter: 'H' }, id: 'n1' },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2, requirements: [requirement],
};
const pins = [
  'apps/cad-studio/test/requirement-evidence-browser.mjs', 'apps/cad-studio/test/flow-helper.mjs',
  'apps/cad-studio/server/cadMcp.ts', 'apps/cad-studio/scripts/cad-mcp.mjs', 'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/state/useModelChecks.ts', 'apps/cad-studio/src/ui/RequirementsBrowser.tsx',
  'packages/barocss-cad-model/src/chat/outputs.ts', 'packages/barocss-cad-model/src/chat/outputDefinitions.ts',
  'packages/barocss-cad-model/src/chat/groups.ts', 'packages/barocss-cad-model/src/chat/contract.ts',
  'packages/barocss-cad-model/src/chat/tools-v2.json', 'packages/barocss-cad-model/src/util/revision.ts',
  'packages/barocss-cad-model/src/team/freshness.ts', 'packages/barocss-cad-model/src/chat/spec.ts',
];

const f = await createFlow({
  name: 'requirement-evidence', envFrozen: 'D591_SOURCE_FROZEN', output, qualification: 'Local MCP evidence for saved native Studio revisions',
  initialFiles: pins, requiredFrozen: pins,
  limits: ['One native root plate, one height requirement, actual local MCP and Studio.'],
  snapshotExtra: () => ({ requirementClass: document.querySelector('.req[aria-label="Requirement H-CAP"]')?.classList[1] }),
  oracleSource: `
import json, sys
states = json.load(sys.stdin)
for height, datum in zip([11, 10], states, strict=True):
    studio, report = datum['studio'], datum['report']
    row = report['evidence'][0]
    body, = studio['bodies']['bodies']
    assert studio['doc']['parameters']['H'] == height
    assert abs(body['volume'] - 20 * 10 * height) <= 1e-8
    assert all(abs(a-b) <= 1e-8 for a,b in zip(body['centroid'], [10, 5, height/2], strict=True))
    verdict = 'pass' if height <= 10 else 'fail'
    assert row['result']['number'] == height and row['result']['verdict'] == verdict
    assert row['freshness']['state'] == 'current' and studio['requirementClass'] == verdict
    assert row['requirement'] == studio['doc']['requirements'][0]
assert states[0]['report']['revision'] != states[1]['report']['revision']
print(json.dumps({'status':'PASS','states':len(states)}))
`,
});

const localMcp = join(repo, 'apps/cad-studio/scripts/cad-mcp.mjs');
const button = name => f.page.getByRole('button', { name, exact: true });
const evidence = expectedRevision => ['requirements', { action: 'evidence', ...(expectedRevision ? { expectedRevision } : {}) }];
async function mcp(path, label, calls) {
  const initialize = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } };
  const requests = calls.map(([name, args], i) => ({ jsonrpc: '2.0', id: i + 2, method: 'tools/call', params: { name, arguments: args } }));
  const result = spawnSync(process.execPath, [localMcp, '--doc', path, '--autonomy', '4'], {
    input: [initialize, ...requests].map(frame => JSON.stringify(frame) + '\n').join(''),
    encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024,
  });
  await writeFile(join(f.output, label + '-mcp.jsonl'), result.stdout ?? '');
  await writeFile(join(f.output, label + '-mcp.stderr.txt'), result.stderr ?? '');
  assert.equal(result.status, 0, result.stderr);
  const [hello, ...replies] = result.stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(hello.result.serverInfo.version, 'barocss-cad-tools-v2');
  assert.deepEqual(replies.map(reply => reply.id), requests.map(request => request.id));
  return replies.map(reply => {
    const text = JSON.parse(reply.result.content[0].text);
    if (!reply.result.isError && text.files) assert.deepEqual(reply.result.structuredContent, text);
    return { error: reply.result.isError, text };
  });
}
async function report(reply, label) {
  assert.equal(reply.error, false, JSON.stringify(reply));
  const [file] = reply.text.files;
  assert.equal(file.path, 'requirement-evidence.json');
  assert.equal(file.bytes, Buffer.byteLength(file.text));
  assert.equal(file.sha256, sha256(file.text));
  await writeFile(join(f.output, label + '-evidence.json'), file.text);
  const data = JSON.parse(file.text);
  assert.deepEqual([data.format, data.version, data.part, data.revision, data.definitionRevision], ['barocss-requirement-evidence', 1, 'base', reply.text.revision, reply.text.revision]);
  assert.deepEqual(data.evidence[0].requirement, requirement);
  return data;
}
async function open(bytes) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: filename, mimeType: 'application/json', buffer: bytes });
}
async function capture(label, verdict) {
  await f.ready();
  await f.page.locator('.req.' + verdict + '[aria-label="Requirement H-CAP"]').waitFor();
  return f.snapshot(label);
}

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

  f.phase = 'local MCP reads the accepted geometry while a proposal is pending';
  const file = join(f.output, 'accepted-11.bcad');
  const initial = Buffer.from(JSON.stringify(failed));
  await writeFile(file, initial);
  const [first] = await mcp(file, 'initial', [evidence()]);
  const initialReport = await report(first, 'initial');
  assert.deepEqual(await readFile(file), initial);
  const [proposal, second] = await mcp(file, 'pending', [
    ['proposals', { action: 'propose', title: 'Reduce plate to 10 mm', ops: [{ tool: 'features', args: { action: 'parameters', set: { H: 10 } } }] }],
    evidence(initialReport.revision),
  ]);
  assert.equal(proposal.error, false, JSON.stringify(proposal));
  assert.deepEqual(second.text.files, first.text.files);
  const pending = await readFile(file), pendingDoc = JSON.parse(pending);
  assert.equal(pendingDoc.parameters.H, 11);
  assert.equal(pendingDoc.proposals[0].status, 'open');

  f.phase = 'actual Studio edits the accepted part and saves project bytes';
  await f.newPage();
  await open(pending);
  await f.same(pendingDoc);
  const before = await capture('01-accepted-failure', 'fail');
  await f.setParameter('H', 10, '02-edited');
  const after = await capture('03-current-pass', 'pass');
  assert.equal(after.doc.proposals[0].status, 'open');

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
  assert.deepEqual(JSON.parse(saved), after.doc);
  const savedPath = join(f.output, 'saved-opfs.bcad');
  await writeFile(savedPath, saved);
  f.report.files.push({ file: savedPath, hash: sha256(saved), source: 'Actual Studio OPFS' });
  await f.newPage();
  await open(saved);
  await f.same(after.doc);
  const reopened = await capture('04-reopened-pass', 'pass');

  f.phase = 'fresh MCP distinguishes the old and new accepted revision';
  const [stale, current] = await mcp(savedPath, 'reopened', [evidence(initialReport.revision), evidence()]);
  assert.equal(stale.error, true);
  assert.match(stale.text.error, /OUTPUT_STALE/);
  assert.equal(stale.text.files, undefined);
  const currentReport = await report(current, 'reopened');
  assert.deepEqual(await readFile(savedPath), saved);
  await f.runOracle([{ studio: before, report: initialReport }, { studio: reopened, report: currentReport }], 'accepted-revision-evidence');
  f.report.revisions = [initialReport.revision, currentReport.revision];
  assert.deepEqual(f.report.downloads, []);
});
