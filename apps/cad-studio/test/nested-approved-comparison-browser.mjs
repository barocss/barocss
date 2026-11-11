import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, prior, mode] = process.argv.slice(2), repo = resolve(import.meta.dirname, '../../..');
assert.ok([output, prior].every(path => path && isAbsolute(path) && relative(repo, path).startsWith('../')));
const lifecycle = mode === '--lifecycle', agent = mode === '--agent' || lifecycle;
const followUpBaseline = mode === '--follow-up-baseline', followUp = mode === '--follow-up' || followUpBaseline;
const attachBaseline = mode === '--attach-review-baseline', attachReview = mode === '--attach-review';
const evidenceBaseline = mode === '--save-review-baseline', saveReview = mode === '--save-review' || evidenceBaseline || attachBaseline || attachReview;
const scripted = 'apps/cad-studio/test/fixtures/scripted-claude.mjs';
if (agent || attachReview) {
  const reserved = createServer().listen(0, '127.0.0.1');
  await once(reserved, 'listening');
  process.env.CAD_STUDIO_CHAT_PORT = String(reserved.address().port);
  await new Promise((resolve, reject) => reserved.close(error => error ? reject(error) : resolve()));
}
const pins = [
  'apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/src/storage/VersionsPanel.tsx',
  'apps/cad-studio/src/storage/ApprovedRequirementChecks.tsx', 'packages/barocss-cad-model/src/versions/approvedRequirements.ts',
  'packages/barocss-cad-model/src/chat/nestedParameterProposal.ts', 'packages/barocss-cad-model/src/chat/requirementEvidence.ts',
  'packages/barocss-cad-model/src/team/requirementScope.ts', 'packages/barocss-cad-model/src/versions/log.ts',
  ...((agent || attachReview) ? [scripted, 'apps/cad-studio/scripts/chat-server.mjs', 'apps/cad-studio/server/chatServer.ts', 'apps/cad-studio/server/cadMcp.ts',
    'packages/barocss-cad-model/src/versions/tools.ts', 'packages/barocss-cad-model/src/chat/tools.ts', 'packages/barocss-cad-model/src/chat/tools-v2.json'] : []),
  ...(lifecycle ? ['packages/barocss-cad-model/src/versions/requirementFollowUp.ts',
    'packages/barocss-cad-model/src/chat/groups.ts', 'packages/barocss-cad-model/src/chat/toolDefinitions.ts'] : []),
  ...(followUp ? ['packages/barocss-cad-model/src/versions/requirementFollowUp.ts'] : []),
  ...(attachReview ? ['apps/cad-studio/server/selectedApprovalEvidence.ts', 'apps/cad-studio/src/chat/useApprovalEvidenceAttachment.ts',
    'apps/cad-studio/src/chat/useStudioChat.ts', 'apps/cad-studio/src/chat/client.ts', 'apps/cad-studio/src/ui/ChatPanel.tsx'] : []),
  ...(saveReview && !evidenceBaseline ? ['apps/cad-studio/src/storage/savedApprovalEvidence.ts',
    'packages/barocss-cad-model/src/versions/approvalEvidenceReport.ts', 'packages/barocss-cad-model/src/versions/savedApprovalEvidence.ts'] : []),
];
const oracleSource = String.raw`
import hashlib, json, sys
d = json.load(sys.stdin)
for stage, heights in [('first', [6, 7]), ('approved', [4, 7]), ('working', [8, 7])]:
    for host, height in zip(d[stage]['instances'], heights, strict=True):
        leaf, = host['doc']['instances']
        part = leaf['doc']
        sketch, extrusion = part['nodes']
        assert sketch['min'] == [0, 0] and sketch['max'] == [20, 10]
        assert extrusion['height'] == {'parameter':'H'} and part['parameters']['H'] == height
        assert next(r['check']['value'] for r in part['requirements'] if r['id'] == 'HEIGHT') == 5
assert d['historical'] == '6 mm → 4 mm'
assert d['current'] == '8 mm (want <= 5 mm)'
if 'followUp' in d:
    regressed, = d['followUp']
    assert regressed == {'id':'HEIGHT','status':'Regressed','number':'8 mm'}
    assert d['workingRestored'] == d['approved']
if 'artifact' in d:
    a = d['artifact']
    data = a['text'].encode('utf-8')
    assert len(data) == a['bytes'] and hashlib.sha256(data).hexdigest() == a['sha256']
    r = json.loads(data)
    assert (r['format'], r['version'], r['part'], r['proposal']) == ('barocss-approved-requirement-evidence', 1, 'p1/p1', 'P1')
    for state, pin, name, number, verdict in [('first','from','before',6,'fail'), ('approved','to','after',4,'pass')]:
        saved = d['pins'][pin]
        assert r[pin] == saved
        e = r[name]
        assert e['part'] == r['part'] and e['revision'] == saved['evidenceRevision'] and e['checker'] == 'checkSpec'
        row, = [v for v in e['evidence'] if v.get('requirement', {}).get('id') == 'HEIGHT']
        leaf, = d[state]['instances'][0]['doc']['instances']
        criterion, = [q for q in leaf['doc']['requirements'] if q['id'] == 'HEIGHT']
        assert row['requirement'] == criterion
        assert (row['result']['run'], row['result']['number'], row['result']['verdict'], row['freshness']['state']) == (e['revision'], number, verdict, 'current')
    assert r['recoveries'] == [{'id':'HEIGHT','from':6,'to':4,'unit':'mm'}]
print(json.dumps({'status':'PASS','localHeightChecks':6}))
`;
const f = await createFlow({
  name: 'nested-approved-comparison', envFrozen: attachBaseline || attachReview ? 'D652_SOURCE_FROZEN' : saveReview ? 'D651_SOURCE_FROZEN' : followUp ? 'D650_SOURCE_FROZEN' : lifecycle ? 'D610_SOURCE_FROZEN' : agent ? 'D609_SOURCE_FROZEN' : 'D608_SOURCE_FROZEN',
  output, initialFiles: pins, requiredFrozen: pins, oracleSource,
  qualification: saveReview ? 'Persistent saved approval evidence and pin checks' : followUp ? 'Saved successor in the Studio approval comparison' : lifecycle ? 'A saved regression after a verified approval, independent of the working document' :
    agent ? 'Saved nested approval evidence through the Studio agent version context' : 'Historical comparison of an exact saved nested approval with a different working verdict',
  limits: ['D607 saved root approval and initial failure; ordinary static nested prisms. Delay is applied after real Worker transport decoding.'],
  snapshotExtra: () => ({
    comparison: document.querySelector('[aria-label="Saved approval checks"], [aria-label="Approved requirement checks"]')?.textContent ?? null,
    overlay: window.__studioCompareOverlay?.() ?? null,
  }),
});
const filename = 'D608-root.bcad', project = 'D608 saved nested approval';
const button = name => f.page.getByRole('button', { name, exact: true });
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const history = () => versions().getByRole('region', { name: 'Saved approval checks', exact: true });
const workingChecks = () => versions().getByRole('region', { name: 'Approved requirement checks', exact: true });
const selectTarget = () => versions().getByLabel('Compare to', { exact: true });
const summary = () => versions().getByRole('status', { name: 'Compared changes', exact: true });

async function open(bytes, expected) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: filename, mimeType: 'application/json', buffer: bytes });
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

function projectBytes() {
  return f.page.evaluate(async ({ project, filename }) => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
    const read = async (folder, name) => (await (await folder.getFileHandle(name)).getFile()).text();
    const meta = await dir.getDirectoryHandle('.barocss');
    const log = await read(await meta.getDirectoryHandle('versions'), filename + '.json');
    const snapshots = await meta.getDirectoryHandle('snapshots');
    return { doc: await read(dir, filename), log, snapshots: await Promise.all(JSON.parse(log).versions.map(v => read(snapshots, v.snapshot + '.bcad'))) };
  }, { project, filename });
}

// Stage the exact native files as a separate project writer. Reopen through the product to get a fresh file tag.
async function replaceProjectHead(bytes, expected) {
  await versions().getByRole('button', { name: 'Close project', exact: true }).click();
  await f.page.evaluate(async ({ project, filename, text }) => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
    const writer = await (await dir.getFileHandle(filename)).createWritable();
    await writer.write(text);
    await writer.close();
  }, { project, filename, text: bytes.toString('utf8') });
  await openProject();
  await versions().getByRole('button', { name: 'Open ' + filename, exact: true }).click();
  await f.same(expected);
}

async function inspectWorkingHeight(height = 8, verdict = 'Fail') {
  const leaf = f.page.locator('.ol.instance.nested[data-path="p1/p1"]');
  if (!(await leaf.isVisible())) await button('Show the parts of Left module').click();
  await leaf.click();
  const row = f.page.getByRole('group', { name: 'Local requirement HEIGHT', exact: true });
  const measurement = row.getByText(height + ' mm (want <= 5 mm)', { exact: true });
  await measurement.waitFor();
  assert.ok((await row.innerText()).includes('HEIGHT · ' + verdict));
  return measurement.innerText();
}

async function installHold() {
  await f.page.evaluate(async () => {
    const url = '/src/engine/client.ts';
    const { EngineClient } = await import(url);
    const original = EngineClient.prototype.part;
    let armed = false, held, completed = 0;
    EngineClient.prototype.part = async function (doc, revision, slot) {
      const capture = armed && slot === 'read';
      if (capture) armed = false;
      const result = await original.call(this, doc, revision, slot);
      if (capture) {
        if (!result?.ok) throw new Error('Expected a decoded read result');
        await new Promise(resolve => { held = resolve; });
        completed++;
      }
      return result;
    };
    window.__d608Hold = {
      arm() { armed = true; }, held: () => Boolean(held), completed: () => completed,
      release() { const deliver = held; held = undefined; deliver(); },
    };
  });
}

async function inspectSavedFollowUp(saved, approved, historical) {
  const select = () => history().getByLabel('Follow-up version', { exact: true });
  const result = () => history().getByRole('region', { name: 'Saved follow-up checks', exact: true });
  const [firstVersion, approvedVersion, laterVersion, skippedVersion] = JSON.parse(saved.log).versions;
  assert.deepEqual(laterVersion.parents, [approvedVersion.id]);
  assert.deepEqual(skippedVersion.parents, [laterVersion.id]);
  await versions().getByRole('button', { name: 'Restore Approved nested repair', exact: true }).click();
  await f.same(approved);
  const workingPass = await inspectWorkingHeight(4, 'Pass');
  await versions().getByRole('button', { name: 'Compare Initial nested failure', exact: true }).click();
  await selectTarget().selectOption(approvedVersion.id);
  await history().getByText(historical, { exact: true }).waitFor();
  if (followUpBaseline) {
    assert.equal(await select().count(), 0);
    assert.equal(await result().count(), 0);
    await f.snapshot('00-no-saved-successor-control');
    f.report.observations.push({ pairVisible: true, directSuccessorExists: true, followUpAvailable: false, workingRestored: true });
    return null;
  }

  f.phase = 'open the direct saved successor while the working part passes';
  const choices = await select().locator('option').evaluateAll(options => options.map(option => option.value));
  assert.deepEqual(choices, ['', laterVersion.id]);
  await select().selectOption(laterVersion.id);
  const id = result().getByText('HEIGHT', { exact: true });
  const status = result().getByText('Regressed', { exact: true });
  const number = result().getByText('8 mm', { exact: true });
  await status.waitFor();
  const findings = [{ id: await id.innerText(), status: await status.innerText(), number: await number.innerText() }];
  await f.same(approved);
  assert.deepEqual(await projectBytes(), saved);
  await f.snapshot('04-saved-regression-working-restored');

  f.phase = 'retire the successor check when the saved comparison changes';
  await select().selectOption('');
  assert.equal(await result().count(), 0);
  await installHold();
  await f.page.evaluate(() => window.__d608Hold.arm());
  await select().selectOption(laterVersion.id);
  await f.page.waitForFunction(() => window.__d608Hold.held());
  await result().getByText('Checking follow-up…', { exact: true }).waitFor();
  await selectTarget().selectOption('');
  await workingChecks().getByText(historical, { exact: true }).waitFor();
  await f.page.evaluate(() => window.__d608Hold.release());
  await f.page.waitForFunction(() => window.__d608Hold.completed() === 1);
  assert.equal(await f.page.getByLabel('Follow-up version', { exact: true }).count(), 0);
  assert.equal(await f.page.getByRole('region', { name: 'Saved follow-up checks', exact: true }).count(), 0);
  await selectTarget().selectOption(approvedVersion.id);
  await history().getByText(historical, { exact: true }).waitFor();
  assert.equal(await select().inputValue(), '');
  assert.deepEqual(await projectBytes(), saved);
  const workingRestored = await f.doc();
  assert.deepEqual(workingRestored, approved);
  f.report.observations.push({ firstVersion: firstVersion.id, approvedVersion: approvedVersion.id,
    directSuccessor: laterVersion.id, skippedVersion: skippedVersion.id, findings, workingPass, exactFilesPreserved: true, heldReadRetired: true });
  await f.snapshot('05-late-follow-up-retired');
  return { followUp: findings, workingRestored };
}

function approvalEvidenceFile(name, replacement) {
  return f.page.evaluate(async ({ project, name, replacement }) => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
    try {
      const folder = await (await dir.getDirectoryHandle('.barocss')).getDirectoryHandle('approval-evidence');
      const handle = await folder.getFileHandle(name);
      if (replacement !== undefined) {
        const writer = await handle.createWritable();
        await writer.write(replacement);
        await writer.close();
      }
      return (await handle.getFile()).text();
    } catch (error) {
      if (error.name === 'NotFoundError') return null;
      throw error;
    }
  }, { project, name, replacement });
}

async function verifyPersistentReview({ saved, pair, first, approved, working, historical, current }) {
  const [beforeVersion, afterVersion, laterVersion] = JSON.parse(saved.log).versions;
  const file = sha256(JSON.stringify([filename, beforeVersion.id, afterVersion.id, 'p1/p1'])) + '.json';
  const save = () => history().getByRole('button', { name: 'Save approval evidence', exact: true });
  const stored = () => history().getByText('Approval evidence saved', { exact: true });
  const measurement = () => history().getByText(historical, { exact: true });
  assert.equal(await approvalEvidenceFile(file), null);
  if (evidenceBaseline) {
    assert.equal(await save().count(), 0);
    f.report.observations.push({ approvalVisible: true, saveActionAvailable: false, artifactExists: false });
    await f.snapshot('00-approval-evidence-baseline');
    return;
  }

  f.phase = 'save exact approval evidence without changing the model or versions';
  await save().click();
  await stored().waitFor();
  const bytes = await approvalEvidenceFile(file);
  assert.ok(bytes);
  const artifact = JSON.parse(bytes);
  const pin = (version, evidenceRevision) => ({ id: version.id, snapshot: version.snapshot, revision: version.revision, evidenceRevision });
  const pins = { from: pin(beforeVersion, pair.before), to: pin(afterVersion, pair.after) };
  const report = JSON.parse(artifact.text);
  assert.deepEqual([report.from, report.to], [pins.from, pins.to]);
  await f.runOracle({ first, approved, working, historical, current, artifact, pins }, 'persisted-approval');
  assert.deepEqual(await projectBytes(), saved);
  await f.same(working);
  await f.snapshot('06-approval-evidence-saved');
  await writeFile(join(output, 'approval-evidence-envelope.json'), bytes);

  async function reopenAndBlockChecks() {
    await f.page.reload();
    await f.ready();
    await openProject();
    await versions().getByRole('button', { name: 'Open ' + filename, exact: true }).click();
    await f.same(working);
    await f.page.evaluate(async () => {
      const url = '/src/engine/client.ts';
      const { EngineClient } = await import(url);
      const original = EngineClient.prototype.part;
      window.__d651ReadAttempts = 0;
      EngineClient.prototype.part = function (doc, revision, slot) {
        if (slot === 'read') {
          window.__d651ReadAttempts++;
          return Promise.reject(new Error('Read-slot evaluation blocked by D651.'));
        }
        return original.call(this, doc, revision, slot);
      };
    });
    await versions().getByRole('button', { name: 'Compare Initial nested failure', exact: true }).click();
    await selectTarget().selectOption(afterVersion.id);
  }

  f.phase = 'open the persisted review in a fresh page with check evaluation blocked';
  await reopenAndBlockChecks();
  await stored().waitFor();
  await measurement().waitFor();
  assert.equal(await f.page.evaluate(() => window.__d651ReadAttempts), 0);
  assert.equal(await approvalEvidenceFile(file), bytes);
  await f.snapshot('07-approval-evidence-reopened');
  if (attachBaseline) {
    assert.equal(await history().getByRole('button', { name: 'Attach approval evidence to chat', exact: true }).count(), 0);
    f.report.observations.push({ savedEvidenceVisible: true, attachActionAvailable: false });
    return;
  }

  if (attachReview) {
    await verifyAttachedApproval(saved, working, artifact, file, bytes, pins);
    return;
  }
  f.phase = 'refuse a mismatched approval pin even when the payload checksum is valid';
  const wrongReport = JSON.stringify({ ...report, to: { ...report.to, id: laterVersion.id } }) + '\n';
  const wrongBytes = JSON.stringify({ ...artifact, text: wrongReport, bytes: Buffer.byteLength(wrongReport), sha256: sha256(wrongReport) });
  assert.equal(await approvalEvidenceFile(file, wrongBytes), wrongBytes);
  await reopenAndBlockChecks();
  await history().getByText('Saved approval evidence does not match this review.', { exact: true }).waitFor();
  assert.equal(await measurement().count(), 0);
  assert.equal(await save().count(), 0);
  assert.equal(await f.page.evaluate(() => window.__d651ReadAttempts), 0);
  assert.equal(await approvalEvidenceFile(file), wrongBytes);
  await f.same(working);
  assert.deepEqual(await projectBytes(), saved);
  await f.snapshot('08-approval-evidence-refused');
  f.report.observations.push({ pins, persistedFileSHA256: sha256(bytes), payloadSHA256: artifact.sha256,
    reopenedWithoutCheckEvaluation: true, mismatchedPinRefused: true, storedVersionsUnchanged: true });
}

async function withScriptedAgent(origin, check) {
  const rawPath = join(output, 'scripted-tool-results.jsonl'), wrapper = join(output, 'record-scripted-claude.mjs');
  const wrapperSource = `#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { appendFileSync } from 'node:fs';
const args = process.argv.slice(2);
const cli = spawn(process.execPath, [${JSON.stringify(resolve(repo, scripted))}, ...args], { stdio: ['pipe', 'pipe', 'inherit'] });
const closed = once(cli, 'close');
process.on('SIGTERM', () => cli.kill('SIGTERM'));
if (args[0] !== '--version') process.stdin.pipe(cli.stdin);
for await (const chunk of cli.stdout) {
  if (args[0] !== '--version') appendFileSync(${JSON.stringify(rawPath)}, chunk);
  process.stdout.write(chunk);
}
const [code] = await closed;
process.exitCode = code ?? 1;
`;
  await writeFile(wrapper, wrapperSource, { mode: 0o700, flag: 'wx' });
  const env = { ...process.env, CAD_STUDIO_CLAUDE: wrapper, CAD_STUDIO_CHAT_ORIGINS: origin };
  for (const key of ['CAD_SCRIPTED_COST_USD', 'CAD_SCRIPTED_SLEEP_MS', 'CAD_SCRIPTED_MARK', 'CAD_AB_LOG']) delete env[key];
  const chat = spawn(process.execPath, [join(f.app, 'scripts/chat-server.mjs')], { cwd: f.app, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const closed = once(chat, 'close');
  let stdout = '', stderr = '', cursor = 0;
  chat.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
  const ready = new Promise(resolve => chat.stdout.on('data', chunk => { stdout += chunk; if (stdout.includes('chat server on')) resolve(true); }));
  const isTurn = request => new URL(request.url()).pathname === '/api/chat/turn' && request.method() === 'POST';

  async function turn(calls, afterSend) {
    const input = f.page.getByRole('textbox', { name: 'Chat message', exact: true });
    if (!(await input.isVisible())) await button('Chat').first().click();
    await f.page.waitForFunction(() => document.querySelector('[aria-label="Chat message"]')?.disabled === false);
    const response = f.page.waitForResponse(r => isTurn(r.request()));
    const request = f.page.waitForRequest(isTurn);
    await input.fill('script ' + JSON.stringify({ calls }));
    await input.press('Enter');
    const wire = (await request).postDataJSON();
    if (afterSend) await afterSend();
    const reply = await response;
    assert.ok(reply.ok());
    const events = (await reply.text()).split('\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)));
    const done = events.at(-1);
    assert.equal(done.end, 'done', JSON.stringify(done));
    assert.equal(done.doc, undefined);
    assert.equal(done.versions, undefined);
    assert.equal(done.ops, undefined);
    await f.page.waitForFunction(() => document.querySelector('[aria-label="Chat message"]')?.disabled === false);
    const all = (await readFile(rawPath, 'utf8')).trim().split('\n').map(line => JSON.parse(line))
      .filter(line => line.type === 'user').flatMap(line => line.message.content);
    const results = all.slice(cursor).map(result => ({ error: result.is_error, body: JSON.parse(result.content[0].text) }));
    cursor = all.length;
    return { done, wire, results };
  }

  try {
    const startup = await Promise.race([ready, closed.then(() => false), new Promise(resolve => setTimeout(() => resolve(false), 15000).unref())]);
    assert.ok(startup, stderr || 'Chat server did not start');
    await check(turn);
  } finally {
    chat.kill('SIGTERM');
    await closed;
    await writeFile(join(output, 'chat-stderr.txt'), stderr);
    f.report.cleanup.push('CHAT_CLOSED');
  }
}

async function verifyAttachedApproval(saved, working, artifact, file, bytes, pins) {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const tool = 'read_selected_approval_evidence', call = (args = {}) => ({ tool, args });
  const attach = () => history().getByRole('button', { name: 'Attach approval evidence to chat', exact: true });
  const chip = () => f.page.getByLabel('Approval evidence for next message', { exact: true });
  await withScriptedAgent(origin, async turn => {
    f.phase = 'read the exact saved report through the explicitly attached agent tool';
    await attach().click();
    await chip().getByText('Saved approval · p1/p1').waitFor();
    const attached = await turn([call({ part: 'p2/p1' }), call()]);
    assert.deepEqual(attached.wire.selectedApproval, artifact);
    assert.deepEqual(attached.wire.doc, working);
    assert.ok(Object.hasOwn(attached.wire.versions.snapshots, pins.from.snapshot));
    assert.ok(Object.hasOwn(attached.wire.versions.snapshots, pins.to.snapshot));
    assert.deepEqual(attached.results.map(r => r.error), [true, false]);
    assert.match(attached.results[0].body.error, /takes no arguments/);
    assert.deepEqual(attached.results[1].body.file, artifact);
    assert.equal(attached.done.versionsWanted, undefined);
    await chip().waitFor({ state: 'detached' });
    await f.same(working);
    await f.snapshot('08-attached-approval-agent-read');

    f.phase = 'refuse a different occurrence and a missing snapshot before a chat turn';
    const refuse = async wire => {
      const response = await fetch(origin + '/api/chat/turn', { method: 'POST',
        headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(wire) });
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: 'Selected approval evidence does not match the saved versions.' });
    };
    const wrongReport = JSON.stringify({ ...JSON.parse(artifact.text), part: 'p2/p1' }) + '\n';
    await refuse({ ...attached.wire, selectedApproval: { ...artifact, text: wrongReport, bytes: Buffer.byteLength(wrongReport), sha256: sha256(wrongReport) } });
    const incomplete = structuredClone(attached.wire);
    delete incomplete.versions.snapshots[pins.from.snapshot];
    await refuse(incomplete);

    f.phase = 'consume the attachment and retire the attached session when the project closes';
    const plain = await turn([call()]);
    assert.equal(plain.wire.selectedApproval, undefined);
    assert.equal(plain.wire.session, attached.done.session);
    assert.equal(plain.results[0].error, true);
    assert.match(plain.results[0].body.error, /Unknown tool/);
    await attach().click();
    await chip().waitFor();
    await versions().getByRole('button', { name: 'Close project', exact: true }).click();
    await chip().waitFor({ state: 'detached' });
    await openProject();
    await versions().getByRole('button', { name: 'Open ' + filename, exact: true }).click();
    await f.same(working);
    const reopened = await turn([call()]);
    assert.equal(reopened.wire.selectedApproval, undefined);
    assert.equal(reopened.wire.session, undefined);
    assert.equal(reopened.results[0].error, true);
    assert.equal(await approvalEvidenceFile(file), bytes);
    assert.deepEqual(await projectBytes(), saved);

    f.phase = 'retire an unsent attachment when another document opens';
    await versions().getByRole('button', { name: 'Compare Initial nested failure', exact: true }).click();
    await selectTarget().selectOption(pins.to.id);
    await attach().click();
    await chip().waitFor();
    const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles({ name: 'Another part.bcad', mimeType: 'application/json', buffer: Buffer.from(saved.doc) });
    await chip().waitFor({ state: 'detached' });
    await f.same(working);
    const other = await turn([call()]);
    assert.equal(other.wire.selectedApproval, undefined);
    assert.equal(other.results[0].error, true);
    assert.equal(await approvalEvidenceFile(file), bytes);
    assert.deepEqual(await projectBytes(), saved);
    await f.snapshot('09-attachment-retired');
    f.report.observations.push({ pins, payloadSHA256: artifact.sha256, exactAgentArtifact: true, refusedHttp: 2, argumentRefused: true,
      nextTurnUnattached: true, projectCloseRetired: true, anotherDocumentRetired: true, oldSessionRetired: true, filesUnchanged: true });
  });
}

async function agentEvidence(origin, saved, working, pair) {
  const [initial, approved, later] = JSON.parse(saved.log).versions;
  const args = { action: 'approval_evidence', from: initial.id, to: approved.id, part: 'p1/p1' };
  const call = (extra = {}) => ({ tool: 'history', args: { ...args, ...extra } });
  const current = { tool: 'requirements', args: { action: 'evidence', part: 'p1/p1' } };
  await withScriptedAgent(origin, async turn => {
    f.phase = 'first real chat turn asks for both older snapshots without a project write';
    const first = await turn([call()]);
    assert.deepEqual(Object.keys(first.wire.versions.snapshots), [later.snapshot]);
    assert.deepEqual(first.done.versionsWanted, [initial.id, approved.id]);
    assert.equal(first.results[0].error, true);
    assert.equal(first.results[0].body.code, 'VERSION_NOT_LOADED');
    assert.equal(first.results[0].body.files, undefined);
    assert.deepEqual(await projectBytes(), saved);

    f.phase = 'next real chat turn reads exact approval evidence and the separate working failure';
    const second = await turn([call(), current, call({ part: 'p2/p1' }), call({ to: later.id })]);
    assert.deepEqual(Object.keys(second.wire.versions.snapshots).sort(), [initial.snapshot, approved.snapshot, later.snapshot].sort());
    assert.deepEqual(second.results.map(result => result.error), [false, false, true, true]);
    const [approvedReply, workingReply, sibling, wrong] = second.results.map(result => result.body);
    assert.match(sibling.error, /cannot be matched/);
    assert.match(wrong.error, /matching nested approval/);
    assert.equal(sibling.files, undefined);
    assert.equal(wrong.files, undefined);
    const [file] = approvedReply.files;
    assert.deepEqual([file.path, file.bytes, file.sha256], ['approved-requirement-evidence.json', Buffer.byteLength(file.text), sha256(file.text)]);
    const report = JSON.parse(file.text), live = JSON.parse(workingReply.files[0].text);
    for (const [key, record, evidenceRevision] of [['from', initial, pair.before], ['to', approved, pair.after]]) {
      const pin = { id: record.id, snapshot: record.snapshot, revision: record.revision, evidenceRevision };
      assert.deepEqual(report[key], pin);
      assert.deepEqual(approvedReply[key], pin);
    }
    assert.deepEqual(report.recoveries, [{ id: 'HEIGHT', from: 6, to: 4, unit: 'mm' }]);
    assert.deepEqual(report.changed, []);
    const measured = [report.before, report.after, live].map(item => {
      const row = item.evidence.find(entry => entry.requirement?.id === 'HEIGHT');
      assert.deepEqual([row.requirement.check.value, row.freshness.state], [5, 'current']);
      return [row.result.number, row.result.verdict];
    });
    assert.deepEqual(measured, [[6, 'fail'], [4, 'pass'], [8, 'fail']]);
    assert.deepEqual(await projectBytes(), saved);
    await f.same(working);
    await f.snapshot('04-agent-saved-approval');
    await writeFile(join(output, file.path), file.text);

    f.phase = 'a late wanted-only result cannot hydrate a reopened project owner';
    await f.page.reload();
    await f.ready();
    await openProject();
    await versions().getByRole('button', { name: 'Open ' + filename, exact: true }).click();
    await f.same(working);
    await versions().getByRole('button', { name: 'Compare Initial nested failure', exact: true }).waitFor();
    const retired = await turn([{ pause: 800 }, call()], () => versions().getByRole('button', { name: 'Close project', exact: true }).click());
    assert.deepEqual(retired.done.versionsWanted, [initial.id, approved.id]);
    await openProject();
    await versions().getByRole('button', { name: 'Open ' + filename, exact: true }).click();
    await f.same(working);
    await versions().getByRole('button', { name: 'Compare Initial nested failure', exact: true }).waitFor();
    const next = await turn([call()]);
    assert.deepEqual(Object.keys(next.wire.versions.snapshots), [later.snapshot]);
    assert.equal(next.results[0].body.code, 'VERSION_NOT_LOADED');
    assert.deepEqual(await projectBytes(), saved);
    await f.snapshot('05-reopened-owner-refuses-old-receipt');
    f.report.observations.push({ agentReportSHA256: file.sha256, measured, requested: first.done.versionsWanted,
      hydrated: Object.keys(second.wire.versions.snapshots), lateReceiptDiscarded: true, versionsUnchanged: true });
    if (lifecycle) {
      f.phase = 'read a saved regression after restoring the passing version as working geometry';
      await f.page.reload();
      await f.ready();
      await openProject();
      await versions().getByRole('button', { name: 'Open ' + filename, exact: true }).click();
      await versions().getByRole('button', { name: 'Restore Approved nested repair', exact: true }).click();
      await f.same(JSON.parse(saved.snapshots[1]));
      const requested = await turn([call({ later: later.id })]);
      assert.deepEqual(Object.keys(requested.wire.versions.snapshots), [later.snapshot]);
      assert.deepEqual(requested.done.versionsWanted, [initial.id, approved.id, later.id]);
      assert.deepEqual(requested.results[0].body.missing, [initial.id, approved.id]);
      const run = await turn([call({ later: later.id }), current, call({ later: 'current' }),
        call({ from: approved.id, to: later.id, later: initial.id })]);
      assert.deepEqual(run.results.map(item => item.error), [false, false, true, true]);
      assert.equal(run.results[2].body.files, undefined);
      assert.equal(run.results[3].body.code, 'VERSION_LINEAGE');
      const [reportFile] = run.results[0].body.files;
      assert.deepEqual([reportFile.path, reportFile.bytes, reportFile.sha256],
        ['approved-requirement-evidence.json', Buffer.byteLength(reportFile.text), sha256(reportFile.text)]);
      const lifecycleReport = JSON.parse(reportFile.text), liveReport = JSON.parse(run.results[1].body.files[0].text);
      const { followUp, ...historic } = lifecycleReport;
      assert.deepEqual(historic, report, 'the optional read preserves the exact historic report');
      assert.equal(followUp.status, 'checked', JSON.stringify(followUp));
      assert.deepEqual(followUp.findings, [{ id: 'HEIGHT', status: 'regressed' }]);
      assert.deepEqual(followUp.version, { id: later.id, snapshot: later.snapshot, revision: later.revision, evidenceRevision: followUp.evidence.revision });
      const check = evidence => {
        const row = evidence.evidence.find(entry => entry.requirement?.id === 'HEIGHT');
        assert.deepEqual([evidence.part, evidence.checker, row.result.run, row.freshness.state],
          ['p1/p1', 'checkSpec', evidence.revision, 'current']);
        return [row.result.number, row.result.verdict];
      };
      const savedAndWorking = [historic.before, historic.after, followUp.evidence, liveReport].map(check);
      assert.deepEqual(savedAndWorking, [[6, 'fail'], [4, 'pass'], [8, 'fail'], [4, 'pass']]);
      assert.deepEqual(await projectBytes(), saved);
      await f.same(JSON.parse(saved.snapshots[1]));
      await f.snapshot('06-saved-regression-working-pass');
      await writeFile(join(output, 'saved-requirement-lifecycle.json'), reportFile.text);
      f.report.observations.push({ lifecycleReportSHA256: reportFile.sha256, savedAndWorking, followUp: followUp.version,
        requested: requested.done.versionsWanted, storedBytesUnchanged: true });
    }
  });
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
  const firstBytes = await readFile(join(prior, 'pending-root.bcad')), approvedBytes = await readFile(join(prior, 'approved-root.bcad'));
  assert.equal(sha256(firstBytes), '4a171b922166b99ca5cf9488ffe94b2b8717809c616fd6ddabde1def9c6a727c');
  assert.equal(sha256(approvedBytes), '60005695aaf7a59dd6599f1f17058cb24a3f355ea9acd997992595188f0bab6c');
  const first = JSON.parse(firstBytes), approved = JSON.parse(approvedBytes);
  const pair = approved.history.at(-1).evidence_revisions;
  assert.deepEqual(pair, approved.proposals[0].decided.evidence_revisions);
  const working = structuredClone(approved);
  working.instances[0].part.rev = 'C';
  working.instances[0].doc.instances[0].doc.parameters.H = 8;
  const workingBytes = Buffer.from(JSON.stringify(working));

  f.phase = 'save the two exact D607 revisions and a later failing working version';
  await f.newPage();
  await open(firstBytes, first);
  await openProject();
  await makeVersion('Initial nested failure');
  const original = await projectBytes();
  await replaceProjectHead(approvedBytes, approved);
  await makeVersion('Approved nested repair');
  await replaceProjectHead(workingBytes, working);
  await makeVersion('Later working failure');
  const skipped = structuredClone(working);
  if (followUp) {
    skipped.instances[0].part.rev = 'D';
    skipped.instances[0].doc.instances[0].doc.parameters.H = 3;
    await replaceProjectHead(Buffer.from(JSON.stringify(skipped)), skipped);
    await makeVersion('Skipped later version');
  }
  const saved = await projectBytes();
  assert.deepEqual(saved.snapshots.map(bytes => JSON.parse(bytes)), followUp ? [first, approved, working, skipped] : [first, approved, working]);
  assert.deepEqual(saved.snapshots.slice(0, 2), [firstBytes.toString('utf8'), approvedBytes.toString('utf8')]);
  assert.equal(saved.snapshots[0], original.snapshots[0]);
  assert.deepEqual(JSON.parse(saved.doc), followUp ? skipped : working);

  f.phase = 'project reload and compare the saved pair';
  await f.page.reload();
  await f.ready();
  await openProject();
  await versions().getByRole('button', { name: 'Open ' + filename, exact: true }).click();
  await f.same(followUp ? skipped : working);
  if (followUp) {
    await versions().getByRole('button', { name: 'Restore Later working failure', exact: true }).click();
    await f.same(working);
  }
  const current = await inspectWorkingHeight();
  await versions().getByRole('button', { name: 'Compare Initial nested failure', exact: true }).click();
  await summary().getByText('From the version to the working document', { exact: true }).waitFor();
  assert.equal(await workingChecks().count(), 0);
  await selectTarget().selectOption({ label: 'Approved nested repair' });
  await summary().getByText('Initial nested failure → Approved nested repair · saved versions', { exact: true }).waitFor();
  if (mode === '--baseline') {
    assert.equal(await history().count(), 0);
    await f.snapshot('00-baseline-no-nested-checks');
    f.report.observations.push({ scopeAvailable: false, source: sha256(firstBytes), approved: sha256(approvedBytes), pair });
    return;
  }
  const recovery = history().getByText('6 mm → 4 mm', { exact: true });
  await recovery.waitFor();
  assert.match(await history().innerText(), /HEIGHT · Fail → Pass/);
  const choices = await history().getByLabel('Requirement occurrence', { exact: true }).locator('option').evaluateAll(options => options.map(option => option.value));
  assert.deepEqual(choices, ['p1/p1']);
  const historical = await recovery.innerText();
  assert.equal(await inspectWorkingHeight(), current);
  const compared = await f.snapshot('01-saved-repair-and-working-failure');
  assert.equal(compared.overlay, null);
  if (saveReview) {
    await verifyPersistentReview({ saved, pair, first, approved, working, historical, current });
    assert.deepEqual(f.report.downloads, []);
    return;
  }
  if (followUp) {
    const observation = await inspectSavedFollowUp(saved, approved, historical);
    if (observation) await f.runOracle({ first, approved, working, historical, current, ...observation }, 'saved-follow-up-heights');
    assert.deepEqual(f.report.downloads, []);
    return;
  }

  f.phase = 'retire a held comparison when the target changes';
  await selectTarget().selectOption({ label: 'Later working failure' });
  await summary().getByText('Initial nested failure → Later working failure · saved versions', { exact: true }).waitFor();
  assert.equal(await history().count(), 0);
  await installHold();
  await f.page.evaluate(() => window.__d608Hold.arm());
  await selectTarget().selectOption({ label: 'Approved nested repair' });
  await f.page.waitForFunction(() => window.__d608Hold.held());
  await history().getByText('Checking both revisions…', { exact: true }).waitFor();
  await selectTarget().selectOption({ label: 'Later working failure' });
  await summary().getByText('Initial nested failure → Later working failure · saved versions', { exact: true }).waitFor();
  await f.page.evaluate(() => window.__d608Hold.release());
  await f.page.waitForFunction(() => window.__d608Hold.completed() === 1);
  await f.snapshot('02-retired-read');
  assert.equal(await history().count(), 0);
  assert.equal(await workingChecks().count(), 0);

  await selectTarget().selectOption({ label: 'Approved nested repair' });
  await recovery.waitFor();
  await f.same(working);
  assert.deepEqual(await projectBytes(), saved);
  await f.snapshot('03-reselected-saved-repair');
  await f.runOracle({ first, approved, working, historical, current }, 'saved-versus-working-heights');
  f.report.observations.push({ pair, choices, historical, current, source: sha256(firstBytes), approved: sha256(approvedBytes),
    saved: saved.snapshots.map(sha256), heldReads: 1 });
  if (agent) await agentEvidence(origin, saved, working, pair);
  assert.deepEqual(f.report.downloads, []);
});
