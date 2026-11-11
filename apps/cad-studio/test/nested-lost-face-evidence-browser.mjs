import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output] = process.argv.slice(2), repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
const pins = [
  'apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/src/ui/NestedRequirementReadout.tsx',
  'apps/cad-studio/src/storage/ApprovedRequirementChecks.tsx', 'apps/cad-studio/server/cadMcp.ts',
  'apps/cad-studio/scripts/cad-mcp.mjs', 'packages/barocss-cad-model/src/chat/requirementEvidence.ts',
  'packages/barocss-cad-model/src/team/requirementScope.ts', 'packages/barocss-cad-model/src/team/freshness.ts',
];
const inspectorSource = `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { freshnessOf, passes, type Result } from '@barocss/cad-model/team/freshness';
import { nestedRequirementDoc, nestedRequirementScope } from '@barocss/cad-model/team/requirementScope';
const doc: StudioDoc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const rows: Result[] = JSON.parse(process.argv[3]);
const evaluate = async (input: StudioDoc) => evaluateDoc(input, 1);
const reads = await Promise.all(rows.map(async saved => {
  const part = saved.part!;
  const scope = nestedRequirementScope(doc, part);
  assert.ok(!('error' in scope));
  const body = await evaluate(nestedRequirementDoc(doc, scope));
  assert.ok(body.ok && body.bodies.length === 1);
  const freshness = await freshnessOf(saved, doc, evaluate);
  return { part, freshness, oldPassNow: passes(saved, freshness), volume: body.bodies[0].volume,
    faces: body.bodies[0].mesh.faces.flatMap(face => face.name.split('+')) };
}));
console.log(JSON.stringify(reads));
`;
const oracleSource = `
import hashlib, json, math, sys
d = json.load(sys.stdin)
assert d['approved']['instances'][0]['doc']['instances'][0]['doc'] == d['approved']['instances'][1]['doc']['instances'][0]['doc']
assert d['approved']['instances'][1] == d['changed']['instances'][1]
for index, (path, side_count, area) in enumerate([('p1/p1', 3, 48), ('p2/p1', 4, 96)]):
    leaf = d['changed']['instances'][index]['doc']['instances'][0]['doc']
    coords = [[leaf['parameters'][v['parameter']] if isinstance(v, dict) else v for v in p] for p in leaf['nodes'][0]['points']]
    assert len(coords) == side_count
    twice = sum(x*v - y*u for (x,y),(u,v) in zip(coords, coords[1:] + coords[:1], strict=True))
    assert twice == 2*area and leaf['nodes'][1]['height'] == 4
    native = d['freshness'][index]
    assert native['part'] == path and math.isclose(native['volume'], 4*area, abs_tol=1e-8)
    assert ('n1.side3' in native['faces']) == (index == 1)
    assert 'n1.side1' in native['faces'] and native['oldPassNow'] == (index == 1)
    assert native['freshness']['state'] == ('current' if index == 1 else 'unresolved')
    report = d['current'][index]
    row = report['evidence'][0]['result']
    assert report['part'] == row['part'] == path
    assert (row['status'], row['number'], row.get('verdict')) == (('ok', 12, 'pass') if index == 1 else ('unsupported', None, None))
lost, = d['freshness'][0]['freshness']['unresolved']
assert lost['face'] == 'n1.side3' and lost['why'] == 'gone' and lost['candidates'] == []
proof = d['retained']
assert hashlib.sha256(proof['text'].encode()).hexdigest() == proof['sha256']
saved = json.loads(proof['text'])
assert saved['part'] == 'p1/p1' and saved['after']['revision'] == d['prior'][0]['revision']
assert saved['recoveries'] == [{'id':'WIDTH','from':14,'to':12,'unit':'mm'}]
assert saved['after']['evidence'][0]['result']['verdict'] == 'pass'
print(json.dumps({'status':'PASS','lostFace':'n1.side3','volumesMm3':[192,384],'historicalRecoveryMm':[14,12]}))
`;
const f = await createFlow({ name: 'nested-lost-face-evidence', envFrozen: 'D658_SOURCE_FROZEN', output, inspectorSource, oracleSource,
  initialFiles: pins, requiredFrozen: pins, qualification: 'Lost face on one exact nested occurrence with retained approval evidence',
  limits: ['The triangle arrives through the saved native project file, as an external design revision. Studio handles acceptance, Save, Open and diagnostics.'],
});
const empty = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [], outputs: {}, nextId: 0 };
const requirement = { id: 'WIDTH', source: '12 mm between the named side faces', basis: 'stated', hard: true,
  check: { query: { fn: 'distance_between', a: 'n1.side3', b: 'n1.side1' }, op: '==', value: 12, unit: 'mm' } };
const part = width => ({ ...empty, parameters: { W: width }, nextId: 2,
  nodes: [{ id: 'n0', kind: 'sketch', profile: 'polygon', points: [[0, 0], [{ parameter: 'W' }, 0], [{ parameter: 'W' }, 8], [0, 8]] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 4 }], outputs: { b1: { node: 1, side: 'solid' } }, requirements: [requirement] });
const instance = (id, name, doc, position) => ({ id, name, doc, position, rotation: [0, 0, 0] });
const host = width => ({ ...empty, instances: [instance('p1', 'Leaf plate', part(width), [0, 0, 0])] });
const initial = { ...empty, nextId: 2, nodes: [{ id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [6, 6] },
  { id: 'n1', kind: 'extrude', sketch: 0, height: 2 }], outputs: { b1: { node: 1, side: 'solid' } }, instances: [
  instance('p1', 'Left module', host(14), [30, 0, 8]), instance('p2', 'Right module', host(12), [60, 0, 15]),
] };
const paths = ['p1/p1', 'p2/p1'], names = ['Left module', 'Right module'];
const filename = 'D658-assembly.bcad', project = 'D658 lost face';
const button = name => f.page.getByRole('button', { name, exact: true });
const panel = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const savedChecks = () => panel().getByRole('region', { name: 'Saved approval checks', exact: true });
const evidence = (part, expectedRevision) => ['requirements', { action: 'evidence', part, ...(expectedRevision ? { expectedRevision } : {}) }];

async function mcp(file, label, calls) {
  const frames = [{ id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
    ...calls.map(([name, args], i) => ({ id: i + 2, method: 'tools/call', params: { name, arguments: args } }))];
  const run = spawnSync(process.execPath, [join(f.app, 'scripts/cad-mcp.mjs'), '--doc', file, '--autonomy', '4'], {
    input: frames.map(frame => JSON.stringify({ jsonrpc: '2.0', ...frame })).join('\n') + '\n',
    encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024,
  });
  await writeFile(join(output, label + '-mcp.jsonl'), run.stdout ?? '');
  await writeFile(join(output, label + '-mcp.stderr.txt'), run.stderr ?? '');
  assert.equal(run.status, 0, run.error?.message ?? run.stderr);
  const replies = run.stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(replies.map(reply => reply.id), frames.map(frame => frame.id));
  return replies.slice(1).map(({ result }) => ({ error: result.isError, body: JSON.parse(result.content[0].text) }));
}

function reports(replies) {
  return replies.map(({ error, body }, index) => {
    assert.equal(error, false, JSON.stringify(body));
    const [file] = body.files, report = JSON.parse(file.text);
    assert.deepEqual([file.path, file.bytes, file.sha256], ['requirement-evidence.json', Buffer.byteLength(file.text), sha256(file.text)]);
    assert.deepEqual([report.part, report.revision, report.evidence[0].requirement], [paths[index], body.revision, requirement]);
    return report;
  });
}

async function inspectOccurrence(index, verdict, reason) {
  const leaf = f.page.locator(`.ol.instance.nested[data-path="${paths[index]}"]`);
  if (!(await leaf.isVisible())) await button('Show the parts of ' + names[index]).click();
  await leaf.click();
  const card = f.page.getByRole('complementary', { name: 'Nested part', exact: true });
  await card.getByTestId('nested-path').getByText(paths[index], { exact: true }).waitFor();
  const row = card.getByRole('group', { name: 'Local requirement WIDTH', exact: true });
  await row.getByText('WIDTH · ' + verdict, { exact: false }).waitFor();
  await row.getByText(reason, { exact: true }).waitFor();
  if (verdict === 'Unknown') assert.doesNotMatch(await row.innerText(), /mm \(want/);
}

async function openProject() {
  if (!(await panel().isVisible())) await button('Project and versions').click();
  await panel().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await panel().getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await panel().getByLabel('Project', { exact: true }).waitFor();
}

async function makeVersion(name) {
  if (!(await panel().isVisible())) await button('Project and versions').click();
  await panel().getByRole('textbox', { name: 'Version name', exact: true }).fill(name);
  await panel().getByRole('button', { name: 'Make version', exact: true }).click();
  await panel().getByRole('listitem', { name: 'Version ' + name, exact: true }).waitFor();
}

const projectFiles = (evidenceName, replacement) => f.page.evaluate(async ({ project, filename, evidenceName, replacement }) => {
  const root = await navigator.storage.getDirectory();
  const folder = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
  const meta = await folder.getDirectoryHandle('.barocss');
  const read = async (dir, file) => (await (await dir.getFileHandle(file)).getFile()).text();
  if (replacement) {
    const handle = await folder.getFileHandle(filename), writer = await handle.createWritable();
    await writer.write(replacement); await writer.close();
  }
  const log = JSON.parse(await read(await meta.getDirectoryHandle('versions'), filename + '.json'));
  const snapshots = await meta.getDirectoryHandle('snapshots');
  const evidence = evidenceName ? await read(await meta.getDirectoryHandle('approval-evidence'), evidenceName) : null;
  return { log, snapshots: await Promise.all(log.versions.map(v => read(snapshots, v.snapshot + '.bcad'))), evidence };
}, { project, filename, evidenceName, replacement });

async function compare() {
  await panel().getByRole('button', { name: 'Compare Original width failure', exact: true }).click();
  await panel().getByLabel('Compare to', { exact: true }).selectOption({ label: 'Approved face check' });
  await savedChecks().getByText('14 mm → 12 mm', { exact: true }).waitFor();
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin, newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  f.phase = 'accept and retain the original named-face repair';
  const pendingFile = join(output, filename);
  await writeFile(pendingFile, JSON.stringify(initial));
  const [created] = await mcp(pendingFile, 'pending', [['proposals', { action: 'propose', title: 'Set the left width to 12 mm',
    ops: [{ tool: 'features', args: { action: 'parameters', part: paths[0], set: { W: 12 } } }] }]]);
  assert.equal(created.error, false, JSON.stringify(created.body));
  const pending = JSON.parse(await readFile(pendingFile, 'utf8'));
  await f.newPage();
  await f.openFile(pendingFile, 2);
  await f.same(pending);
  await inspectOccurrence(0, 'Fail', '14 mm (want 12 ± 0 mm)');
  await openProject();
  await makeVersion('Original width failure');
  await button('Project and versions').click();
  await button('Chat').first().click();
  await f.page.getByRole('listitem', { name: 'Proposal P1', exact: true }).getByRole('button', { name: 'Accept', exact: true }).click();
  await f.page.waitForFunction(() => window.__studioDoc?.proposals?.[0]?.status === 'accepted');
  await f.ready();
  const approved = await f.doc();
  assert.deepEqual(approved.instances[0].doc.instances[0].doc, approved.instances[1].doc.instances[0].doc);
  await makeVersion('Approved face check');
  await compare();
  await savedChecks().getByRole('button', { name: 'Save approval evidence', exact: true }).click();
  await savedChecks().getByText('Approval evidence saved', { exact: true }).waitFor();
  const [from, to] = (await projectFiles()).log.versions;
  const evidenceName = sha256(JSON.stringify([filename, from.id, to.id, paths[0]])) + '.json';
  const saved = await projectFiles(evidenceName);
  assert.deepEqual(saved.snapshots.map(JSON.parse), [pending, approved]);
  const approvedFile = join(output, 'approved.bcad');
  await writeFile(approvedFile, saved.snapshots[1]);
  const prior = reports(await mcp(approvedFile, 'approved', paths.map(path => evidence(path))));
  assert.equal(prior[0].definitionRevision, prior[1].definitionRevision);
  assert.notEqual(prior[0].evidence[0].result.id, prior[1].evidence[0].result.id);
  assert.deepEqual(prior.map(report => [report.evidence[0].result.number, report.evidence[0].result.verdict]), [[12, 'pass'], [12, 'pass']]);
  await f.snapshot('01-retained-named-face-approval');

  f.phase = 'open a valid external revision with only the left named face gone';
  const changed = structuredClone(approved);
  changed.instances[0].doc.instances[0].doc.nodes[0].points.pop();
  await panel().getByRole('button', { name: 'Close project', exact: true }).click();
  await projectFiles(evidenceName, JSON.stringify(changed));
  await openProject();
  await panel().getByRole('button', { name: 'Open ' + filename, exact: true }).click();
  await f.same(changed);
  await makeVersion('Left face removed');
  const newer = await projectFiles(evidenceName);
  assert.deepEqual(newer.snapshots.slice(0, 2), saved.snapshots);
  assert.equal(newer.evidence, saved.evidence);
  await f.page.reload();
  await f.ready();
  await openProject();
  await panel().getByRole('button', { name: 'Open ' + filename, exact: true }).click();
  await f.same(changed);
  await compare();
  await savedChecks().getByText('Approval evidence saved', { exact: true }).waitFor();
  await inspectOccurrence(0, 'Unknown', 'no face or edge named "n1.side3"');
  await f.page.getByRole('group', { name: 'Local requirement WIDTH', exact: true }).scrollIntoViewIfNeeded();
  await f.snapshot('02-original-approval-and-left-missing-face');
  await inspectOccurrence(1, 'Pass', '12 mm (want 12 ± 0 mm)');
  await f.snapshot('03-current-sibling-pass');
  await inspectOccurrence(0, 'Unknown', 'no face or edge named "n1.side3"');
  await f.same(changed);
  assert.deepEqual(await projectFiles(evidenceName), newer);

  f.phase = 'read exact current MCP evidence and recheck both original reports against the changed geometry';
  const changedFile = join(output, 'changed.bcad');
  await writeFile(changedFile, newer.snapshots[2]);
  const [stale, ...reads] = await mcp(changedFile, 'changed', [evidence(paths[0], prior[0].revision), ...paths.map(path => evidence(path))]);
  assert.equal(stale.error, true);
  assert.match(stale.body.error, /OUTPUT_STALE/);
  assert.equal(stale.body.files, undefined);
  const current = reports(reads);
  const [left, right] = current.map(report => report.evidence[0].result);
  assert.deepEqual([left.status, left.number, left.verdict, left.why], ['unsupported', null, undefined, 'no face or edge named "n1.side3"']);
  assert.deepEqual([right.status, right.number, right.verdict], ['ok', 12, 'pass']);
  assert.equal(current[1].definitionRevision, prior[1].definitionRevision);
  assert.notEqual(current[0].definitionRevision, prior[0].definitionRevision);
  const freshness = await f.inspect('prior-evidence-on-current-geometry', changed, prior.map(report => report.evidence[0].result));
  assert.deepEqual(freshness.map(item => [item.freshness.state, item.oldPassNow]), [['unresolved', false], ['current', true]]);
  assert.deepEqual(freshness[0].freshness.unresolved.map(({ face, why, candidates }) => [face, why, candidates]), [['n1.side3', 'gone', []]]);
  assert.equal(await readFile(changedFile, 'utf8'), newer.snapshots[2]);
  await f.runOracle({ approved, changed, prior, current, freshness, retained: JSON.parse(saved.evidence) }, 'independent-lost-face');
  f.report.observations.push({ paths, lostFace: 'n1.side3', oldLeft: 'unresolved', currentLeft: 'unsupported', currentRight: 'pass',
    volumesMm3: freshness.map(row => row.volume), savedEvidencePreserved: true, stalePinRefused: true });
  assert.deepEqual(f.report.downloads, []);
});
