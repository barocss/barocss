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
const persistFollowUpBaseline = mode === '--save-follow-up-baseline';
const attachFollowUpBaseline = mode === '--attach-follow-up-baseline', attachFollowUp = mode === '--attach-follow-up';
const retainRepairBaseline = mode === '--retain-repair-baseline', retainRepair = mode === '--retain-repair';
const retainResolution = retainRepairBaseline || retainRepair;
const resolutionBaseline = mode === '--saved-repair-baseline', resolution = mode === '--saved-repair' || retainResolution;
const repairBaseline = mode === '--repair-follow-up-baseline';
const repairFollowUp = mode === '--repair-follow-up' || resolutionBaseline || resolution;
const repairReview = repairBaseline || repairFollowUp;
const persistFollowUp = mode === '--save-follow-up' || persistFollowUpBaseline || attachFollowUpBaseline || attachFollowUp || repairReview;
const followUpBaseline = mode === '--follow-up-baseline', followUp = mode === '--follow-up' || followUpBaseline || persistFollowUp;
const attachBaseline = mode === '--attach-review-baseline', attachReview = mode === '--attach-review';
const attachedAgent = attachReview || attachFollowUp || repairReview;
const evidenceBaseline = mode === '--save-review-baseline', saveReview = mode === '--save-review' || evidenceBaseline || attachBaseline || attachReview;
const scripted = 'apps/cad-studio/test/fixtures/scripted-claude.mjs';
if (agent || attachedAgent) {
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
  ...((agent || attachedAgent) ? [scripted, 'apps/cad-studio/scripts/chat-server.mjs', 'apps/cad-studio/server/chatServer.ts', 'apps/cad-studio/server/cadMcp.ts',
    'packages/barocss-cad-model/src/versions/tools.ts', 'packages/barocss-cad-model/src/chat/tools.ts', 'packages/barocss-cad-model/src/chat/tools-v2.json'] : []),
  ...(lifecycle ? ['packages/barocss-cad-model/src/versions/requirementFollowUp.ts',
    'packages/barocss-cad-model/src/chat/groups.ts', 'packages/barocss-cad-model/src/chat/toolDefinitions.ts'] : []),
  ...(followUp ? ['packages/barocss-cad-model/src/versions/requirementFollowUp.ts'] : []),
  ...(persistFollowUp ? ['apps/cad-studio/src/storage/savedApprovalEvidence.ts', 'packages/barocss-cad-model/src/versions/savedApprovalEvidence.ts'] : []),
  ...(attachedAgent ? ['apps/cad-studio/server/selectedApprovalEvidence.ts', 'apps/cad-studio/src/chat/useApprovalEvidenceAttachment.ts',
    'apps/cad-studio/src/chat/useStudioChat.ts', 'apps/cad-studio/src/chat/client.ts', 'apps/cad-studio/src/ui/ChatPanel.tsx'] : []),
  ...(repairFollowUp ? ['apps/cad-studio/server/selectedFollowUpRepair.ts', 'apps/cad-studio/src/ui/ProposalBrowser.tsx',
    'packages/barocss-cad-model/src/chat/merge.ts', 'packages/barocss-cad-model/src/chat/part/proposals.ts',
    'packages/barocss-cad-model/src/engine/schema/proposals.ts'] : []),
  ...(resolution ? ['apps/cad-studio/src/storage/savedFollowUpRepair.ts', 'apps/cad-studio/src/storage/SavedRepairChecks.tsx'] : []),
  ...(retainRepair ? ['apps/cad-studio/src/storage/useEvidenceSave.ts'] : []),
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
    if 'later' in d['pins']:
        f = r['followUp']
        assert f['version'] == d['pins']['later'] and f['status'] == 'checked'
        assert f['findings'] == [{'id':'HEIGHT','status':'regressed'}]
        e = f['evidence']
        assert e['part'] == r['part'] and e['revision'] == f['version']['evidenceRevision'] and e['checker'] == 'checkSpec'
        row, = [v for v in e['evidence'] if v.get('requirement', {}).get('id') == 'HEIGHT']
        leaf, = d['working']['instances'][0]['doc']['instances']
        assert row['requirement'] == leaf['doc']['requirements'][0]
        assert (row['result']['run'], row['result']['number'], row['result']['verdict'], row['freshness']['state']) == (e['revision'], 8, 'fail', 'current')
if 'repaired' in d:
    before, after = d['working']['instances'], d['repaired']['instances']
    assert before[1] == after[1]
    assert before[0]['position'] == after[0]['position'] and before[0]['rotation'] == after[0]['rotation']
    leaf_before, = before[0]['doc']['instances']
    leaf_after, = after[0]['doc']['instances']
    assert leaf_before['position'] == leaf_after['position'] and leaf_before['rotation'] == leaf_after['rotation']
    before_doc, after_doc = leaf_before['doc'], leaf_after['doc']
    assert before_doc['nodes'] == after_doc['nodes'] and before_doc['requirements'] == after_doc['requirements']
    sketch, extrusion = after_doc['nodes']
    assert extrusion['height'] == {'parameter':'H'}
    width, depth = (b - a for a, b in zip(sketch['min'], sketch['max'], strict=True))
    old_h, new_h = before_doc['parameters']['H'], after_doc['parameters']['H']
    assert (width, depth, old_h, new_h) == (20, 10, 8, 4)
    assert (old_h > 5 and new_h <= 5) and width * depth * (new_h - old_h) == -800
    assert d['previewVolume'] == '−800 mm³'
    report = {'status':'PASS','volumeDeltaMm3':-800,'siblingPreserved':True}
    if 'resolution' in d:
        proof = d['resolution']
        later = d['pins']['later']
        repair = proof['repairedVersion']
        assert proof['versions'][-1] == repair
        assert proof['versions'][-2]['parents'] == [later['id']]
        assert repair['parents'] == [proof['versions'][-2]['id']]
        assert proof['original'] == f'{old_h} mm' and proof['measurement'] == f'{old_h} mm → {new_h} mm'
        proposal = d['repaired']['proposals'][-1]
        assert proposal['id'] == 'P2' and proposal['decided']['by'] == 'user'
        assert proposal['follow_up_repair'] == {'evidence_sha256': a['sha256'], 'version': later['id'], 'part': 'p1/p1', 'requirements': ['HEIGHT']}
        assert proposal['decided']['evidence_revisions']['before'] == later['evidenceRevision']
        report.update({'savedLineage':True, 'savedRecoveryMm':[old_h,new_h]})
        if 'repairFile' in d:
            file = d['repairFile']
            payload = file['text'].encode('utf-8')
            assert (file['path'], file['mime'], file['encoding']) == ('saved-repair-evidence.json', 'application/json', 'utf-8')
            assert len(payload) == file['bytes'] and hashlib.sha256(payload).hexdigest() == file['sha256']
            saved = json.loads(payload)
            assert (saved['format'], saved['version']) == ('barocss-saved-repair-evidence', 1)
            ctx = saved['context']
            assert ctx['approval'] == {'from': d['pins']['from'], 'to': d['pins']['to'], 'part':'p1/p1', 'proposal':'P1'}
            assert ctx['followUpSHA256'] == a['sha256'] and ctx['followUp'] == ctx['base'] == later
            assert ctx['repaired'] == {key: repair[key] for key in ['id','revision','snapshot']} | {'evidenceRevision':proposal['decided']['evidence_revisions']['after']}
            assert ctx['proposal'] == 'P2' and ctx['requirements'] == ['HEIGHT']
            assert saved['historical'] == saved['before']
            for column, pin, expected, verdict in [('before','base',8,'fail'), ('after','repaired',4,'pass')]:
                evidence = saved[column]
                row, = [v for v in evidence['evidence'] if v.get('requirement', {}).get('id') == 'HEIGHT']
                assert evidence['revision'] == ctx[pin]['evidenceRevision'] == row['result']['run']
                assert evidence['checker'] == 'checkSpec' and evidence['part'] == row['result']['part'] == 'p1/p1'
                assert row['requirement'] == before_doc['requirements'][0] and row['freshness']['state'] == 'current'
                assert (row['result']['number'], row['result']['verdict']) == (expected, verdict)
            report.update({'retainedProof':True, 'reportsChecked':3})
    print(json.dumps(report))
else:
    print(json.dumps({'status':'PASS','localHeightChecks':6}))
`;
const f = await createFlow({
  name: 'nested-approved-comparison', envFrozen: retainResolution ? 'D657_SOURCE_FROZEN' : resolutionBaseline || resolution ? 'D656_SOURCE_FROZEN' : repairReview ? 'D655_SOURCE_FROZEN' : attachFollowUpBaseline || attachFollowUp ? 'D654_SOURCE_FROZEN' : persistFollowUp ? 'D653_SOURCE_FROZEN' : attachBaseline || attachReview ? 'D652_SOURCE_FROZEN' : saveReview ? 'D651_SOURCE_FROZEN' : followUp ? 'D650_SOURCE_FROZEN' : lifecycle ? 'D610_SOURCE_FROZEN' : agent ? 'D609_SOURCE_FROZEN' : 'D608_SOURCE_FROZEN',
  output, initialFiles: pins, requiredFrozen: pins, oracleSource,
  qualification: retainResolution ? 'Retain a verified saved repair and reopen it without evaluation' : resolutionBaseline || resolution ? 'Link a retained saved failure to a newer user-approved repair' : repairReview ? 'Prepare a repair from a selected saved regression after a fresh check' : saveReview ? 'Persistent saved approval evidence and pin checks' : followUp ? 'Saved successor in the Studio approval comparison' : lifecycle ? 'A saved regression after a verified approval, independent of the working document' :
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

async function inspectSavedFollowUp({ saved, first, approved, working, skipped, historical, current, pair }) {
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
  if (persistFollowUpBaseline) {
    assert.equal(await result().getByRole('button', { name: 'Save follow-up evidence', exact: true }).count(), 0);
    f.report.observations.push({ laterVerdictVisible: true, saveActionAvailable: false });
    return null;
  }

  if (persistFollowUp) {
    await verifyPersistedFollowUp({ saved, first, approved, working, skipped, historical, current, pair });
    return null;
  }

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

async function reopenAndBlockChecks(working, approvedVersionId) {
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
        return Promise.reject(new Error('Read-slot evaluation blocked by the saved evidence test.'));
      }
      return original.call(this, doc, revision, slot);
    };
  });
  await versions().getByRole('button', { name: 'Compare Initial nested failure', exact: true }).click();
  await selectTarget().selectOption(approvedVersionId);
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

  f.phase = 'open the persisted review in a fresh page with check evaluation blocked';
  await reopenAndBlockChecks(working, afterVersion.id);
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
  await reopenAndBlockChecks(working, afterVersion.id);
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

async function verifyPersistedFollowUp({ saved, first, approved, working, skipped, historical, current, pair }) {
  const [beforeVersion, approvedVersion, laterVersion, skippedVersion] = JSON.parse(saved.log).versions;
  const stem = sha256(JSON.stringify([filename, beforeVersion.id, approvedVersion.id, 'p1/p1']));
  const pairFile = stem + '.json', laterFile = stem + '-' + laterVersion.id + '.json';
  const section = () => history().getByRole('region', { name: 'Saved follow-up checks', exact: true });
  const save = () => section().getByRole('button', { name: 'Save follow-up evidence', exact: true });
  const stored = () => section().getByText('Follow-up evidence saved', { exact: true });
  const regression = () => section().getByText('Regressed', { exact: true });

  f.phase = 'save the three pinned revisions without creating a separate approval file';
  assert.equal(await approvalEvidenceFile(pairFile), null);
  assert.equal(await approvalEvidenceFile(laterFile), null);
  await save().click();
  await stored().waitFor();
  const bytes = await approvalEvidenceFile(laterFile);
  assert.ok(bytes);
  assert.equal(await approvalEvidenceFile(pairFile), null);
  const artifact = JSON.parse(bytes), report = JSON.parse(artifact.text);
  const pin = (version, evidenceRevision) => ({ id: version.id, snapshot: version.snapshot, revision: version.revision, evidenceRevision });
  const pins = { from: pin(beforeVersion, pair.before), to: pin(approvedVersion, pair.after),
    later: pin(laterVersion, report.followUp.evidence.revision) };
  assert.deepEqual([report.from, report.to, report.followUp.version], [pins.from, pins.to, pins.later]);
  await f.runOracle({ first, approved, working, historical, current, artifact, pins }, 'persisted-follow-up');
  await f.same(approved);
  assert.deepEqual(await projectBytes(), saved);
  await writeFile(join(output, 'follow-up-evidence-envelope.json'), bytes);
  await f.snapshot('06-follow-up-evidence-saved');

  f.phase = 'reopen all three saved checks with the live evaluation blocked';
  const select = () => history().getByLabel('Follow-up version', { exact: true });
  await reopenAndBlockChecks(skipped, approvedVersion.id);
  await history().getByText(historical, { exact: true }).waitFor();
  assert.deepEqual(await select().locator('option').evaluateAll(options => options.map(option => option.value)), ['', laterVersion.id]);
  await select().selectOption(laterVersion.id);
  await stored().waitFor();
  await regression().waitFor();
  assert.equal(await section().getByText('8 mm', { exact: true }).count(), 1);
  assert.equal(await f.page.evaluate(() => window.__d651ReadAttempts), 0);
  assert.equal(await approvalEvidenceFile(laterFile), bytes);
  await f.snapshot('07-follow-up-evidence-reopened');
  if (attachFollowUpBaseline) {
    assert.equal(await section().getByRole('button', { name: 'Attach follow-up evidence to chat', exact: true }).count(), 0);
    f.report.observations.push({ savedFollowUpVisible: true, attachActionAvailable: false });
    return;
  }
  if (attachFollowUp) {
    await verifyAttachedApproval(saved, skipped, artifact, laterFile, bytes, pins);
    assert.equal(await approvalEvidenceFile(pairFile), null);
    return;
  }
  if (repairBaseline) {
    const origin = new URL(f.server.resolvedUrls.local[0]).origin;
    await withScriptedAgent(origin, async turn => {
      f.phase = 'baseline refuses to prepare a selected repair while evidence remains readable';
      await section().getByRole('button', { name: 'Attach follow-up evidence to chat', exact: true }).click();
      await f.page.getByLabel('Approval evidence for next message', { exact: true }).getByText('Saved follow-up · p1/p1').waitFor();
      const out = await turn([{ tool: 'read_selected_approval_evidence', args: {} },
        { tool: 'propose_selected_follow_up_repair', args: { working_revision: pins.later.evidenceRevision } }]);
      assert.deepEqual(out.results.map(result => result.error), [false, true]);
      assert.match(out.results[1].body.error, /Unknown tool/);
      await f.same(skipped);
      f.report.observations.push({ selectedEvidenceReadable: true, repairToolAvailable: false });
      await f.snapshot('00-no-selected-repair-tool');
    });
    return;
  }
  if (repairFollowUp) {
    await verifySelectedRepair({ saved, skipped, working, first, approved, historical, current, artifact, pins, laterFile, bytes });
    return;
  }

  // Keep the original pair through the independent action, then verify it stays readable through the refused later record.
  await history().getByRole('button', { name: 'Save approval evidence', exact: true }).click();
  await history().getByText('Approval evidence saved', { exact: true }).waitFor();
  const pairBytes = await approvalEvidenceFile(pairFile);
  assert.ok(pairBytes);
  const wrong = JSON.stringify({ ...report, followUp: { ...report.followUp, version: { ...pins.later, id: skippedVersion.id } } }) + '\n';
  const invalid = JSON.stringify({ ...artifact, text: wrong, bytes: Buffer.byteLength(wrong), sha256: sha256(wrong) });
  await approvalEvidenceFile(laterFile, invalid);

  f.phase = 'refuse a mismatched later pin while preserving the original pair';
  await reopenAndBlockChecks(skipped, approvedVersion.id);
  await history().getByText('Approval evidence saved', { exact: true }).waitFor();
  await select().selectOption(laterVersion.id);
  await section().getByText('Saved follow-up evidence does not match this review.', { exact: true }).waitFor();
  assert.equal(await regression().count(), 0);
  assert.equal(await save().count(), 0);
  assert.equal(await f.page.evaluate(() => window.__d651ReadAttempts), 0);
  assert.equal(await approvalEvidenceFile(pairFile), pairBytes);
  assert.equal(await approvalEvidenceFile(laterFile), invalid);
  assert.deepEqual(await projectBytes(), saved);
  await f.same(skipped);
  await f.snapshot('08-follow-up-pin-refused');
  f.report.observations.push({ pins, payloadSHA256: artifact.sha256, persistedFileSHA256: sha256(bytes), laterVerdict: 'regressed',
    reopenedWithoutCheckEvaluation: true, separatePairPreserved: true, mismatchedPinRefused: true, storedVersionsUnchanged: true });
}

async function verifySelectedRepair({ saved, skipped, working, first, approved, historical, current, artifact, pins, laterFile, bytes }) {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const read = { tool: 'requirements', args: { action: 'evidence', part: 'p1/p1' } };
  const repair = working_revision => ({ tool: 'propose_selected_follow_up_repair', args: { working_revision } });
  const restore = name => versions().getByRole('button', { name: 'Restore ' + name, exact: true }).click();
  const attach = async () => {
    if (!await history().isVisible()) {
      await versions().getByRole('button', { name: 'Compare Initial nested failure', exact: true }).click();
      await selectTarget().selectOption(pins.to.id);
    }
    await history().getByLabel('Follow-up version', { exact: true }).selectOption(pins.later.id);
    await history().getByRole('button', { name: 'Attach follow-up evidence to chat', exact: true }).click();
    await f.page.getByLabel('Approval evidence for next message', { exact: true }).getByText('Saved follow-up · p1/p1').waitFor();
  };
  const height = result => {
    assert.equal(result.error, false);
    const evidence = JSON.parse(result.body.files[0].text);
    const row = evidence.evidence.find(item => item.requirement?.id === 'HEIGHT');
    assert.equal(row.freshness.state, 'current');
    return { revision: evidence.revision, measured: row.result.number, verdict: row.result.verdict };
  };
  const proposal = () => f.page.getByRole('listitem', { name: 'Proposal P2', exact: true });

  await f.page.reload();
  await f.ready();
  await openProject();
  await versions().getByRole('button', { name: 'Open ' + filename, exact: true }).click();
  await f.same(skipped);
  await withScriptedAgent(origin, async turn => {
    f.phase = 'the same historical failure cannot authorize a repair without attachment or a current failure';
    const absent = await turn([read, repair(pins.later.evidenceRevision)]);
    const live = height(absent.results[0]);
    assert.deepEqual([live.measured, live.verdict], [3, 'pass']);
    assert.match(absent.results[1].body.error, /Unknown tool/);
    await attach();
    const refused = await turn([repair(pins.later.evidenceRevision), repair(live.revision)]);
    assert.deepEqual(refused.results.map(result => result.body.code), ['REPAIR_STALE', 'REPAIR_ALREADY_PASSING']);
    await f.same(skipped);
    assert.deepEqual(await projectBytes(), saved);
    await f.snapshot('08-stale-and-passing-refused');

    f.phase = 'the current result fails but a working edit arrives during the repair turn';
    await restore('Later working failure');
    await f.same(working);
    const failed = height((await turn([read])).results[0]);
    assert.deepEqual(failed, { revision: pins.later.evidenceRevision, measured: 8, verdict: 'fail' });
    await attach();
    const late = await turn([repair(failed.revision), { pause: 1800 }], async () => {
      await restore('Skipped later version');
      await f.same(skipped);
      assert.ok(await f.page.getByText('Working…', { exact: true }).isVisible());
    }, true);
    assert.equal(late.results[0].body.proposal, 'P2');
    assert.equal(late.done.doc.proposals.at(-1).status, 'open');
    await f.same(skipped);
    assert.equal(await proposal().count(), 0);
    await f.snapshot('09-late-repair-discarded');

    f.phase = 'prepare one current repair, refuse agent acceptance and preview the placed candidate';
    await restore('Later working failure');
    await f.same(working);
    await attach();
    const prepared = await turn([{ tool: 'read_selected_approval_evidence', args: {} }, repair(failed.revision),
      { tool: 'proposals', args: { action: 'accept', id: 'P2' } }], undefined, true);
    assert.deepEqual(prepared.results.map(result => result.error), [false, false, true]);
    assert.deepEqual(prepared.results[0].body.file, artifact);
    assert.equal(prepared.results[1].body.applied, false);
    assert.match(prepared.results[2].body.error, /user.s approval/);
    const pending = await f.doc(), record = pending.proposals.at(-1);
    assert.deepEqual({ ...pending, proposals: working.proposals, history: working.history }, working);
    assert.deepEqual([record.id, record.status, record.base_evidence_revision], ['P2', 'open', failed.revision]);
    assert.deepEqual(record.follow_up_repair, { evidence_sha256: artifact.sha256, version: pins.later.id, part: 'p1/p1', requirements: ['HEIGHT'] });
    await f.page.getByLabel('Proposal P2 from the chat', { exact: true }).waitFor();
    if (await versions().isVisible()) await button('Project and versions').click();
    await proposal().getByRole('button', { name: 'Preview', exact: true }).click();
    await proposal().getByRole('button', { name: 'Hide', exact: true }).waitFor();
    const previewVolume = await proposal().getByLabel('Volume change').innerText();
    assert.equal(previewVolume, '−800 mm³');
    await f.same(pending);
    assert.deepEqual(await projectBytes(), saved);
    await f.snapshot('10-preview-before-approval');

    f.phase = 'approve only in Studio and save and reopen the repaired assembly';
    await proposal().getByRole('button', { name: 'Accept', exact: true }).click();
    await f.page.waitForFunction(() => window.__studioDoc?.proposals?.find(p => p.id === 'P2')?.status === 'accepted');
    await f.ready();
    const repaired = await f.doc(), acceptance = repaired.proposals.at(-1).decided;
    assert.deepEqual([acceptance.by, acceptance.evidence_revisions.before], ['user', failed.revision]);
    assert.deepEqual(repaired.proposals.at(-1).follow_up_repair, record.follow_up_repair);
    const nowPassing = height((await turn([read, repair(failed.revision)])).results[0]);
    assert.deepEqual(nowPassing, { revision: acceptance.evidence_revisions.after, measured: 4, verdict: 'pass' });
    await inspectWorkingHeight(4, 'Pass');
    await makeVersion('Selected regression repaired');
    const retained = await projectBytes();
    assert.deepEqual(JSON.parse(retained.doc), repaired);
    assert.deepEqual(retained.snapshots.slice(0, saved.snapshots.length), saved.snapshots);
    assert.equal(await approvalEvidenceFile(laterFile), bytes);
    await f.page.reload();
    await f.ready();
    await openProject();
    await versions().getByRole('button', { name: 'Open ' + filename, exact: true }).click();
    await f.same(repaired);
    await inspectWorkingHeight(4, 'Pass');
    await f.runOracle({ first, approved, working, historical, current, artifact, pins, repaired, previewVolume }, 'selected-repair');
    await f.snapshot('11-repaired-and-reopened');
    f.report.observations.push({ evidence: artifact.sha256, currentBefore: failed, currentAfter: nowPassing, previewVolume,
      proposal: record.id, missingAttachmentRefused: true, staleRefused: true, passingRefused: true, lateDiscarded: true,
      agentAcceptanceRefused: true, userApproved: true, savedAndReopened: true, originalEvidencePreserved: true });
    if (resolutionBaseline || resolution)
      await verifySavedResolution({ retained, repaired, working, first, approved, historical, current, artifact, pins, laterFile, bytes, previewVolume });
  });
}

async function verifySavedResolution({ retained, repaired, working, first, approved, historical, current, artifact, pins, laterFile, bytes, previewVolume }) {
  const followUp = () => history().getByRole('region', { name: 'Saved follow-up checks', exact: true });
  const select = () => followUp().getByLabel('Repair version', { exact: true });
  const result = () => followUp().getByRole('region', { name: 'Saved repair checks', exact: true });
  const versionsAtSave = JSON.parse(retained.log).versions;
  const repairedVersion = versionsAtSave.at(-1);
  const chooseFollowUp = async () => {
    await versions().getByRole('button', { name: 'Compare Initial nested failure', exact: true }).click();
    await selectTarget().selectOption(pins.to.id);
    await history().getByLabel('Follow-up version', { exact: true }).selectOption(pins.later.id);
    await followUp().getByText('Follow-up evidence saved', { exact: true }).waitFor();
    await followUp().getByText('Regressed', { exact: true }).waitFor();
    await followUp().getByText('8 mm', { exact: true }).waitFor();
  };
  f.phase = 'show the retained failure after reopening the saved repair';
  await chooseFollowUp();
  if (resolutionBaseline) {
    assert.equal(await select().count(), 0);
    await f.same(repaired);
    await f.snapshot('12-baseline-no-repair-review');
    f.report.observations.push({ retainedFailureVisible: true, savedUserRepairExists: true, repairReviewAvailable: false });
    return;
  }
  f.phase = 'refuse a passing saved snapshot without the linked approval';
  await select().selectOption({ label: 'Skipped later version' });
  await result().getByText('No matching user-approved repair for this saved regression.', { exact: true }).waitFor();
  assert.equal(await result().getByText('Fail → Pass', { exact: true }).count(), 0);
  await f.same(repaired);
  await f.snapshot('12-unrelated-pass-refused');

  f.phase = 'show the linked failure and later passing result while the working model fails';
  await versions().getByRole('button', { name: 'Restore Later working failure', exact: true }).click();
  await f.same(working);
  await inspectWorkingHeight();
  await chooseFollowUp();
  await select().selectOption(repairedVersion.id);
  await result().getByText('P2 · Selected regression repaired', { exact: true }).waitFor();
  const verdict = result().getByText('Fail → Pass', { exact: true });
  const measured = result().getByText('8 mm → 4 mm', { exact: true });
  await verdict.waitFor();
  await measured.waitFor();
  await followUp().getByText('Regressed', { exact: true }).waitFor();
  await f.same(working);
  assert.deepEqual(await projectBytes(), retained);
  assert.equal(await approvalEvidenceFile(laterFile), bytes);
  await f.runOracle({ first, approved, working, historical, current, artifact, pins, repaired, previewVolume,
    resolution: { measurement: await measured.innerText(), original: '8 mm', repairedVersion, versions: versionsAtSave } }, 'saved-repair');
  await measured.scrollIntoViewIfNeeded();
  await f.snapshot('13-saved-repair-while-working-fails');
  if (retainResolution) {
    await verifyRetainedRepair({ retained, repaired, working, first, approved, historical, current, artifact, pins, laterFile, bytes, previewVolume,
      repairedVersion, versionsAtSave, followUp, select, result });
    return;
  }
  await select().selectOption({ label: 'None' });
  await result().waitFor({ state: 'detached' });
  await followUp().getByText('Regressed', { exact: true }).waitFor();
  f.report.observations.push({ independentPassingVersionRefused: true, savedRepairShown: true, currentWorkingStillFails: true,
    savedFilesUnchanged: true, originalFailureVisible: true });
}

async function verifyRetainedRepair({ retained, repaired, working, first, approved, historical, current, artifact, pins, laterFile, bytes,
  previewVolume, repairedVersion, versionsAtSave, followUp, select, result }) {
  const file = laterFile.replace(/\.json$/, '-repair-' + repairedVersion.id + '.json');
  const save = () => result().getByRole('button', { name: 'Save repair evidence', exact: true });
  const stored = () => result().getByText('Repair evidence saved', { exact: true });
  const measured = () => result().getByText('8 mm → 4 mm', { exact: true });
  const reads = () => f.page.evaluate(() => window.__d651ReadAttempts);
  const reopen = async () => {
    await reopenAndBlockChecks(repaired, pins.to.id);
    await history().getByLabel('Follow-up version', { exact: true }).selectOption(pins.later.id);
    await followUp().getByText('Regressed', { exact: true }).waitFor();
    await select().selectOption(repairedVersion.id);
  };
  assert.equal(await approvalEvidenceFile(file), null);
  if (retainRepairBaseline) {
    f.phase = 'baseline cannot reopen the verified repair without evaluation';
    assert.equal(await save().count(), 0);
    await reopen();
    await result().getByText('Could not verify the saved repair.', { exact: true }).waitFor();
    assert.ok(await reads() > 0);
    assert.equal(await measured().count(), 0);
    await f.snapshot('14-baseline-repair-requires-evaluation');
    f.report.observations.push({ repairSaveUnavailable: true, repairReopenRequiresEvaluation: true });
    return;
  }
  f.phase = 'keep the exact saved repair beside the original failure';
  await save().click();
  await stored().waitFor();
  const kept = await approvalEvidenceFile(file);
  assert.ok(kept);
  const repairFile = JSON.parse(kept), proof = JSON.parse(repairFile.text);
  assert.equal(repairFile.sha256, sha256(repairFile.text));
  assert.equal(await approvalEvidenceFile(laterFile), bytes);
  assert.deepEqual(await projectBytes(), retained);
  await f.same(working);
  await f.snapshot('14-repair-evidence-kept');

  f.phase = 'reopen both failure and saved repair with Worker reads blocked';
  await reopen();
  await stored().waitFor();
  await measured().waitFor();
  assert.equal(await reads(), 0);
  assert.equal(await approvalEvidenceFile(file), kept);
  assert.equal(await approvalEvidenceFile(laterFile), bytes);
  assert.deepEqual(await projectBytes(), retained);
  await f.same(repaired);
  await f.runOracle({ first, approved, working, historical, current, artifact, pins, repaired, previewVolume,
    resolution: { measurement: await measured().innerText(), original: '8 mm', repairedVersion, versions: versionsAtSave },
    repairFile }, 'retained-repair');
  await measured().scrollIntoViewIfNeeded();
  await f.snapshot('15-reopened-repair-evidence');

  f.phase = 'refuse a rehashed repair file pinned to a different approval base';
  const badText = JSON.stringify({ ...proof, context: { ...proof.context, base: { ...proof.context.base, id: versionsAtSave.at(-2).id } } }) + '\n';
  const wrong = JSON.stringify({ ...repairFile, text: badText, sha256: sha256(badText), bytes: Buffer.byteLength(badText) });
  await approvalEvidenceFile(file, wrong);
  await reopen();
  await result().getByText('Saved repair evidence does not match this review.', { exact: true }).waitFor();
  assert.equal(await measured().count(), 0);
  assert.equal(await save().count(), 0);
  assert.equal(await reads(), 0);
  assert.equal(await approvalEvidenceFile(file), wrong);
  assert.equal(await approvalEvidenceFile(laterFile), bytes);
  assert.deepEqual(await projectBytes(), retained);
  await f.same(repaired);
  await result().scrollIntoViewIfNeeded();
  await f.snapshot('16-mismatched-repair-pin-refused');
  f.report.observations.push({ originalFailureUnchanged: true, exactRepairRetained: true, workerReadsOnReopen: 0,
    mismatchedRepairPinRefused: true, mismatchedFilePreserved: true, projectFilesUnchanged: true });
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

  async function turn(calls, afterSend, allowWrite = false) {
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
    if (!allowWrite) assert.equal(done.doc, undefined);
    assert.equal(done.versions, undefined);
    if (!allowWrite) assert.equal(done.ops, undefined);
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
  const kind = pins.later ? 'follow-up' : 'approval';
  const attach = () => history().getByRole('button', { name: `Attach ${kind} evidence to chat`, exact: true });
  const chip = () => f.page.getByLabel('Approval evidence for next message', { exact: true });
  await withScriptedAgent(origin, async turn => {
    f.phase = 'read the exact saved report through the explicitly attached agent tool';
    await attach().click();
    await chip().getByText(`Saved ${kind} · p1/p1`).waitFor();
    const attached = await turn([call({ part: 'p2/p1' }), call()]);
    assert.deepEqual(attached.wire.selectedApproval, artifact);
    assert.deepEqual(attached.wire.doc, working);
    for (const pin of Object.values(pins)) assert.ok(Object.hasOwn(attached.wire.versions.snapshots, pin.snapshot));
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
    delete incomplete.versions.snapshots[(pins.later ?? pins.from).snapshot];
    await refuse(incomplete);
    if (pins.later) {
      const report = JSON.parse(artifact.text), skipped = JSON.parse(saved.log).versions.at(-1);
      const wrongLater = JSON.stringify({ ...report, followUp: { ...report.followUp, version: { ...pins.later, id: skipped.id } } }) + '\n';
      await refuse({ ...attached.wire, selectedApproval: { ...artifact, text: wrongLater, bytes: Buffer.byteLength(wrongLater), sha256: sha256(wrongLater) } });
    }

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
    if (pins.later) await history().getByLabel('Follow-up version', { exact: true }).selectOption(pins.later.id);
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
    f.report.observations.push({ pins, payloadSHA256: artifact.sha256, exactAgentArtifact: true, refusedHttp: pins.later ? 3 : 2, argumentRefused: true,
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
    const observation = await inspectSavedFollowUp({ saved, first, approved, working, skipped, historical, current, pair });
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
