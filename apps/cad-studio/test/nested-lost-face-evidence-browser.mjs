import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2), repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.ok(mode === undefined || ['--diagnosis-baseline', '--diagnosis-chat', '--face-repair-baseline', '--face-repair'].includes(mode));
const diagnosisBaseline = mode === '--diagnosis-baseline', diagnosisChat = mode === '--diagnosis-chat';
const repairBaseline = mode === '--face-repair-baseline', faceRepair = mode === '--face-repair', repairFlow = repairBaseline || faceRepair;
const scripted = 'apps/cad-studio/test/fixtures/scripted-claude.mjs';
if (diagnosisChat) {
  const reserved = createServer().listen(0, '127.0.0.1');
  await once(reserved, 'listening');
  process.env.CAD_STUDIO_CHAT_PORT = String(reserved.address().port);
  await new Promise((resolve, reject) => reserved.close(error => error ? reject(error) : resolve()));
}
const pins = [
  'apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/src/ui/NestedRequirementReadout.tsx',
  'apps/cad-studio/src/storage/ApprovedRequirementChecks.tsx', 'apps/cad-studio/server/cadMcp.ts',
  'apps/cad-studio/scripts/cad-mcp.mjs', 'packages/barocss-cad-model/src/chat/requirementEvidence.ts',
  'packages/barocss-cad-model/src/team/requirementScope.ts', 'packages/barocss-cad-model/src/team/freshness.ts',
  ...(diagnosisChat ? [scripted, 'apps/cad-studio/scripts/chat-server.mjs', 'apps/cad-studio/server/chatServer.ts',
    'apps/cad-studio/server/selectedFaceDiagnosis.ts', 'apps/cad-studio/src/chat/faceDiagnosis.ts',
    'apps/cad-studio/src/chat/useFaceDiagnosisAttachment.ts', 'apps/cad-studio/src/chat/useStudioChat.ts'] : []),
  ...(faceRepair ? ['apps/cad-studio/src/storage/SavedFaceReferenceRepair.tsx',
    'packages/barocss-cad-model/src/chat/nestedFaceRepair.ts', 'packages/barocss-cad-model/src/chat/part/proposals.ts'] : []),
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
    faces: body.bodies[0].mesh.faces.flatMap(face => face.name.split('+')),
    taggedFace: body.bodies[0].mesh.faces.filter(face => face.name === 'n1.side[west2]').map(({ centroid, normal, area }) => ({ centroid, normal, area })) };
}));
console.log(JSON.stringify(reads));
`;
const oracleSource = `
import hashlib, json, math, sys
d = json.load(sys.stdin)
if 'renameRepair' in d:
    before, after = d['before'], d['after']
    assert before['instances'][1] == after['instances'][1]
    l = before['instances'][0]['doc']['instances'][0]['doc']
    r = after['instances'][0]['doc']['instances'][0]['doc']
    assert {k:v for k,v in l.items() if k != 'requirements'} == {k:v for k,v in r.items() if k != 'requirements'}
    q0 = l['requirements'][0]['check']['query']
    q1 = r['requirements'][0]['check']['query']
    assert q0 == {'fn':'distance_between','a':'n1.side[west]','b':'n1.side[east]'}
    assert q1 == {**q0,'a':'n1.side[west2]'}
    assert l['requirements'][0]['check']['value'] == r['requirements'][0]['check']['value'] == 12
    assert [x['volume'] for x in d['native']] == [384,384]
    assert d['native'][0]['taggedFace'] == [{'centroid':[0,4,2],'normal':[-1,0,0],'area':32}]
    assert d['native'][0]['freshness']['unresolved'][0]['candidates'] == ['n1.side[west2]']
    assert d['reads'][0]['evidence'][0]['result']['number'] == 12 and d['reads'][0]['evidence'][0]['result']['verdict'] == 'pass'
    assert d['reads'][1]['evidence'][0]['result']['number'] == 12 and d['reads'][1]['evidence'][0]['result']['verdict'] == 'pass'
    print(json.dumps({'status':'PASS','nativeVolumeMm3':[384,384],'faceAreaMm2':32,'widthMm':12}))
    sys.exit(0)
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
const f = await createFlow({ name: 'nested-lost-face-evidence', envFrozen: repairFlow ? 'D660_SOURCE_FROZEN' : mode ? 'D659_SOURCE_FROZEN' : 'D658_SOURCE_FROZEN', output, inspectorSource, oracleSource,
  initialFiles: pins, requiredFrozen: pins,
  qualification: repairFlow ? 'One selected tag-only face reference repair with retained approval evidence'
    : mode ? 'One selected current face diagnosis in Studio chat' : 'Lost face on one exact nested occurrence with retained approval evidence',
  limits: ['The triangle arrives through the saved native project file, as an external design revision. Studio handles acceptance, Save, Open and diagnostics.'],
});
const empty = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [], outputs: {}, nextId: 0 };
const west = repairFlow ? 'n1.side[west]' : 'n1.side3', east = repairFlow ? 'n1.side[east]' : 'n1.side1';
const requirement = { id: 'WIDTH', source: '12 mm between the named side faces', basis: 'stated', hard: true,
  check: { query: { fn: 'distance_between', a: west, b: east }, op: '==', value: 12, unit: 'mm' } };
const part = width => ({ ...empty, parameters: { W: width }, nextId: 2,
  nodes: [{ id: 'n0', kind: 'sketch', profile: 'polygon', points: [[0, 0], [{ parameter: 'W' }, 0], [{ parameter: 'W' }, 8], [0, 8]],
    ...(repairFlow ? { sideTags: { outer: ['south', 'east', 'north', 'west'] } } : {}) },
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

async function verifyRenamedRepair(renamed, prior, saved, evidenceName) {
  const proposal = id => f.page.getByRole('listitem', { name: 'Proposal ' + id, exact: true });
  const check = () => button('Check current face references');
  const choose = () => button('Propose n1.side[west2]');
  const authored = doc => ({ ...doc, proposals: undefined, history: undefined });
  const select = async id => {
    if (!await savedChecks().isVisible()) await compare();
    await check().click();
    await choose().click();
    await proposal(id).waitFor();
    await proposal(id).getByText(/n1\.side\[west\] → n1\.side\[west2\].*12 mm Pass/).waitFor();
    const pending = await f.doc(), p = pending.proposals.at(-1);
    assert.equal(p.by.agent, 'user');
    assert.deepEqual([p.ops[0].args.faceRepair.from, p.ops[0].args.faceRepair.to, p.ops[0].args.faceRepair.source.sha256],
      ['n1.side[west]', 'n1.side[west2]', JSON.parse(saved.evidence).sha256]);
    assert.deepEqual(authored(pending), authored(renamed));
    await proposal(id).getByRole('button', { name: 'Preview', exact: true }).click();
    await proposal(id).getByRole('button', { name: 'Hide', exact: true }).waitFor();
    const delta = await proposal(id).getByLabel('Volume change').innerText();
    assert.match(delta, /^\+0 mm³/);
    await f.same(pending);
    await f.snapshot('preview-' + id);
  };

  f.phase = 'a gone face has no replacement and cannot produce a proposal';
  const lost = structuredClone(renamed), sketch = lost.instances[0].doc.instances[0].doc.nodes[0];
  sketch.points.pop();
  sketch.sideTags.outer = ['south', 'east', 'diagonal'];
  await panel().getByRole('button', { name: 'Close project', exact: true }).click();
  await projectFiles(evidenceName, JSON.stringify(lost));
  await openProject();
  await panel().getByRole('button', { name: 'Open ' + filename, exact: true }).click();
  await f.same(lost);
  await compare();
  await check().click();
  await savedChecks().getByText('No verified replacement for the saved face.', { exact: true }).waitFor();
  assert.equal(await choose().count(), 0);
  await inspectOccurrence(0, 'Unknown', 'no face or edge named "n1.side[west]"');
  await f.same(lost);
  await f.snapshot('02-lost-face-refused');

  f.phase = 'select the exact replacement, preview it and reject without changing the model';
  await panel().getByRole('button', { name: 'Restore Renamed west face', exact: true }).click();
  await f.same(renamed);
  await select('P2');
  await proposal('P2').getByRole('button', { name: 'Reject', exact: true }).click();
  await f.page.waitForFunction(() => window.__studioDoc?.proposals?.at(-1)?.status === 'rejected');
  const rejected = await f.doc();
  assert.deepEqual(authored(rejected), authored(renamed));
  assert.equal(rejected.history.at(-1).kind, 'reject');
  await inspectOccurrence(0, 'Unknown', 'no face or edge named "n1.side[west]"');

  f.phase = 'approve the reselected replacement and reopen the exact updated requirement';
  await select('P3');
  await proposal('P3').getByRole('button', { name: 'Accept', exact: true }).click();
  await f.page.waitForFunction(() => window.__studioDoc?.proposals?.at(-1)?.status === 'accepted');
  await f.ready();
  const accepted = await f.doc();
  const expected = structuredClone(renamed);
  expected.instances[0].doc.instances[0].doc.requirements[0].check.query.a = 'n1.side[west2]';
  assert.deepEqual(authored(accepted), authored(expected));
  assert.equal(accepted.proposals.at(-1).decided.by, 'user');
  await inspectOccurrence(0, 'Pass', '12 mm (want 12 ± 0 mm)');
  await inspectOccurrence(1, 'Pass', '12 mm (want 12 ± 0 mm)');
  await makeVersion('Face reference approved');
  const savedNow = await projectFiles(evidenceName);
  assert.equal(savedNow.evidence, saved.evidence);
  assert.deepEqual(savedNow.snapshots.slice(0, 2), saved.snapshots);
  assert.deepEqual(JSON.parse(savedNow.snapshots.at(-1)), accepted);
  const file = join(output, 'approved-reference.bcad');
  await writeFile(file, savedNow.snapshots.at(-1));
  const reads = (await mcp(file, 'approved-reference', paths.map(path => evidence(path)))).map(reply => {
    assert.equal(reply.error, false, JSON.stringify(reply.body));
    return JSON.parse(reply.body.files[0].text);
  });
  await f.page.reload();
  await f.ready();
  await openProject();
  await panel().getByRole('button', { name: 'Open ' + filename, exact: true }).click();
  await f.same(accepted);
  await inspectOccurrence(0, 'Pass', '12 mm (want 12 ± 0 mm)');
  await compare();
  await savedChecks().getByText('Approval evidence saved', { exact: true }).waitFor();
  assert.deepEqual(await projectFiles(evidenceName), savedNow);
  const native = await f.inspect('approved-replacement', accepted, prior.map(report => report.evidence[0].result));
  await f.runOracle({ renameRepair: true, before: renamed, after: accepted, native, reads }, 'independent-face-repair');
  await f.snapshot('03-approved-face-reopened');
  f.report.observations.push({ lostFaceRefused: true, exactUserSelection: true, zeroVolumeChange: true, rejectionPreservedModel: true,
    acceptedAndReopened: true, currentWidthMm: 12, originalEvidencePreserved: true });
}

async function verifyChatDiagnosis(origin, changed, approved, current, evidenceName, newer) {
  const tool = 'read_selected_face_diagnosis', call = (args = {}) => ({ tool, args });
  const raw = join(output, 'diagnosis-tool-results.jsonl'), cli = join(output, 'diagnosis-scripted-cli.mjs');
  await writeFile(raw, '');
  await writeFile(cli, `#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { appendFileSync } from 'node:fs';
const args = process.argv.slice(2), statusOnly = args[0] === '--version';
const child = spawn(process.execPath, [${JSON.stringify(resolve(repo, scripted))}, ...args], { stdio: ['pipe', 'pipe', 'inherit'] });
const closed = once(child, 'close');
process.on('SIGTERM', () => child.kill('SIGTERM'));
if (!statusOnly) process.stdin.pipe(child.stdin);
for await (const chunk of child.stdout) {
  if (!statusOnly) appendFileSync(${JSON.stringify(raw)}, chunk);
  process.stdout.write(chunk);
}
const [code] = await closed;
process.exitCode = code ?? 1;
`, { mode: 0o700 });
  const server = spawn(process.execPath, [join(f.app, 'scripts/chat-server.mjs')], {
    cwd: f.app, env: { ...process.env, CAD_STUDIO_CLAUDE: cli, CAD_STUDIO_CHAT_ORIGINS: origin }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const closed = once(server, 'close');
  let stdout = '', stderr = '', cursor = 0;
  server.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
  const ready = new Promise(resolve => server.stdout.on('data', chunk => { stdout += chunk; if (stdout.includes('chat server on')) resolve(true); }));
  const chip = () => f.page.getByLabel('Face diagnosis for next message', { exact: true });
  const attach = () => button('Attach face diagnosis to chat');
  const input = () => f.page.getByRole('textbox', { name: 'Chat message', exact: true });
  const isTurn = request => new URL(request.url()).pathname === '/api/chat/turn' && request.method() === 'POST';
  const toolResults = async () => {
    const all = (await readFile(raw, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
      .filter(line => line.type === 'user').flatMap(line => line.message.content);
    const results = all.slice(cursor).map(result => ({ error: result.is_error, body: JSON.parse(result.content[0].text) }));
    cursor = all.length;
    return results;
  };
  const doneOf = text => text.split('\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6))).at(-1);
  async function turn(calls) {
    await f.page.waitForFunction(() => document.querySelector('[aria-label="Chat message"]')?.disabled === false);
    const reply = f.page.waitForResponse(response => isTurn(response.request()));
    await input().fill('script ' + JSON.stringify({ calls }));
    await input().press('Enter');
    const response = await reply;
    assert.ok(response.ok());
    const done = doneOf(await response.text());
    assert.equal(done.end, 'done');
    assert.equal(done.doc, undefined);
    assert.equal(done.ops, undefined);
    await f.page.waitForFunction(() => document.querySelector('[aria-label="Chat message"]')?.disabled === false);
    return { wire: response.request().postDataJSON(), done, results: await toolResults() };
  }
  const send = async (body, pin, requestOrigin = origin) => {
    const response = await f.context.request.post(new URL('/api/chat/turn', origin).href, {
      headers: { origin: requestOrigin }, data: { ...body, text: 'script ' + JSON.stringify({ calls: [call()] }), selectedFaceDiagnosis: pin },
    });
    return { status: response.status(), text: await response.text() };
  };
  try {
    const up = await Promise.race([ready, closed.then(() => false), new Promise(resolve => setTimeout(() => resolve(false), 15000).unref())]);
    assert.ok(up, stderr || 'Chat server did not start');
    await f.page.reload();
    await f.ready();
    await openProject();
    await panel().getByRole('button', { name: 'Open ' + filename, exact: true }).click();
    await f.same(changed);
    await inspectOccurrence(0, 'Unknown', 'no face or edge named "n1.side3"');

    f.phase = 'attach the exact unresolved face and read it through the actual Studio turn';
    await attach().click();
    await chip().getByText('p1/p1 · WIDTH · n1.side3').waitFor();
    await f.snapshot('04-attached-face-diagnosis');
    const selected = await turn([call(), call({ part: 'p2/p1' })]);
    const pin = selected.wire.selectedFaceDiagnosis;
    assert.deepEqual(pin, { revision: current[0].revision, part: paths[0], requirement: 'WIDTH', criterion: sha256(canonicalJSON(requirement)), face: 'n1.side3' });
    assert.deepEqual(selected.wire.doc, changed);
    assert.deepEqual(selected.results.map(row => row.error), [false, true]);
    assert.deepEqual(selected.results[0].body, { revision: pin.revision, definitionRevision: current[0].definitionRevision,
      part: pin.part, requirement, face: pin.face, status: 'unresolved', reason: 'no face or edge named "n1.side3"', repair: 'unsupported' });
    assert.match(selected.results[1].body.error, /takes no arguments/);
    await f.page.getByText('p1/p1 · WIDTH · n1.side3 missing · repair unavailable', { exact: true }).waitFor();
    await chip().waitFor({ state: 'detached' });
    const plain = await turn([call()]);
    assert.equal(plain.wire.selectedFaceDiagnosis, undefined);
    assert.match(plain.results[0].body.error, /Unknown tool/);
    await f.same(changed);

    f.phase = 'refuse a stale revision and recheck a forged sibling pin against its own geometry';
    const stale = await send(selected.wire, { ...pin, revision: '0'.repeat(64) });
    assert.equal(stale.status, 422);
    assert.match(stale.text, /does not match the current occurrence and revision/);
    const wrongFace = await send(selected.wire, { ...pin, face: 'n1.top' });
    assert.equal(wrongFace.status, 422);
    const foreign = await send(selected.wire, pin, 'https://other.invalid');
    assert.equal(foreign.status, 403);
    assert.deepEqual(await toolResults(), []);
    const sibling = await send(selected.wire, { ...pin, part: paths[1] });
    assert.equal(sibling.status, 200);
    assert.equal(doneOf(sibling.text).doc, undefined);
    const [refusal] = await toolResults();
    assert.equal(refusal.error, true);
    assert.match(refusal.body.error, /missing face could not be confirmed/);

    f.phase = 'retire the attachment when the selected occurrence or working revision changes';
    await attach().click();
    await chip().waitFor();
    await inspectOccurrence(1, 'Pass', '12 mm (want 12 ± 0 mm)');
    await chip().waitFor({ state: 'detached' });
    assert.equal(await attach().count(), 0);
    const next = await turn([call()]);
    assert.equal(next.wire.session, undefined);
    assert.equal(next.wire.selectedFaceDiagnosis, undefined);
    await inspectOccurrence(0, 'Unknown', 'no face or edge named "n1.side3"');
    await attach().click();
    await chip().waitFor();
    await panel().getByRole('button', { name: 'Restore Approved face check', exact: true }).click();
    await f.same(approved);
    await chip().waitFor({ state: 'detached' });
    await inspectOccurrence(0, 'Pass', '12 mm (want 12 ± 0 mm)');
    assert.equal(await attach().count(), 0);
    assert.deepEqual(await projectFiles(evidenceName), newer);
    await f.snapshot('05-diagnosis-retired-after-restore');
    f.report.observations.push({ attachedPart: pin.part, attachedFace: pin.face, actualMcpRead: true, unsupportedRepair: true,
      noToolWithoutAttachment: true, staleHttp: stale.status, wrongFaceHttp: wrongFace.status, foreignHttp: foreign.status, passingSiblingRefused: true,
      siblingSelectionRetired: true, revisionRestoreRetired: true, savedEvidencePreserved: true });
  } finally {
    server.kill('SIGTERM');
    await closed;
    await writeFile(join(output, 'diagnosis-chat-stderr.txt'), stderr);
  }
}

function canonicalJSON(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJSON).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort()
    .map(key => JSON.stringify(key) + ':' + canonicalJSON(value[key])).join(',') + '}';
  return JSON.stringify(value);
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

  if (repairFlow) {
    f.phase = 'open a renamed face on the same prism and review the saved approval';
    const renamed = structuredClone(approved);
    renamed.instances[0].doc.instances[0].doc.nodes[0].sideTags.outer[3] = 'west2';
    await panel().getByRole('button', { name: 'Close project', exact: true }).click();
    await projectFiles(evidenceName, JSON.stringify(renamed));
    await openProject();
    await panel().getByRole('button', { name: 'Open ' + filename, exact: true }).click();
    await f.same(renamed);
    await makeVersion('Renamed west face');
    await compare();
    await savedChecks().getByText('Approval evidence saved', { exact: true }).waitFor();
    await inspectOccurrence(0, 'Unknown', 'no face or edge named "n1.side[west]"');
    const freshness = await f.inspect('named-rename', renamed, prior.map(report => report.evidence[0].result));
    assert.deepEqual(freshness[0].freshness.unresolved.map(({ face, why, candidates }) => [face, why, candidates]),
      [[west, 'renamed', ['n1.side[west2]']]]);
    assert.deepEqual(freshness.map(read => read.volume), [384, 384]);
    if (repairBaseline) {
      f.phase = 'baseline has no proposal action for the uniquely renamed face';
      assert.equal(await button('Check current face references').count(), 0);
      await f.snapshot('02-baseline-renamed-face');
      f.report.observations.push({ sameShape: true, uniqueRename: true, repairActionAvailable: false });
      return;
    }
    await verifyRenamedRepair(renamed, prior, saved, evidenceName);
    return;
  }

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
  if (diagnosisBaseline) {
    f.phase = 'the existing nested diagnosis has no chat attachment action';
    assert.equal(await button('Attach face diagnosis to chat').count(), 0);
    f.report.observations.push({ currentDiagnosisVisible: true, attachAvailable: false });
  }
  if (diagnosisChat) await verifyChatDiagnosis(origin, changed, approved, current, evidenceName, newer);
  assert.deepEqual(f.report.downloads, []);
});
