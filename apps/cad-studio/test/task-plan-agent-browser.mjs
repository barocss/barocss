// Actual Studio chat, local chat server and stdio MCP. Run with the heavy gate and frozen sources.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { taskRunSharedInterfaceFlow } from './task-run-shared-interface-flow.mjs';
import { taskRunHoleDiameterFlow } from './task-run-hole-diameter-flow.mjs';
import { taskRunStudioRejectionFlow } from './task-run-studio-rejection-flow.mjs';
import { taskRunStudioDeliveryFlow } from './task-run-studio-delivery-flow.mjs';
import { taskRunStudioApprovalFlow } from './task-run-studio-approval-flow.mjs';
import { taskRunReopenedStopFlow } from './task-run-reopened-stop-flow.mjs';
import { taskRunLiveStopFlow } from './task-run-live-stop-flow.mjs';
import { taskRunLiveStartFlow } from './task-run-live-start-flow.mjs';
import { taskRunReplanFlow } from './task-run-replan-flow.mjs';
import { taskRunRebuildFlow } from './task-run-rebuild-flow.mjs';
import { taskRunBaselineFlow } from './task-run-baseline-flow.mjs';
import { refuseMissingTaskRun, taskRunReopenFlow } from './task-run-reopen-flow.mjs';
import { taskRunPrepareRepairFlow } from './task-run-prepare-repair-flow.mjs';
import { taskRunSingleRepairFlow } from './task-run-single-repair-flow.mjs';
import { instrumentWorkingChecks, taskRunWorkingFlow } from './task-run-working-flow.mjs';
import { taskRunHistoryFlow } from './task-run-history-flow.mjs';
import { taskRunThreeFlow } from './task-run-three-flow.mjs';
import { taskRunStatusFlow } from './task-run-status-flow.mjs';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2), reviewMode = mode === '--review';
const liveStartMode = mode === '--live-start', liveStopMode = mode === '--live-stop';
const sharedHoleDeliveryMode = mode === '--shared-hole-delivery';
const sharedHoleRepairMode = sharedHoleDeliveryMode || mode === '--shared-hole-repair';
const agentFindingMode = sharedHoleRepairMode || mode === '--agent-finding';
const stoppedFindingMode = mode === '--stopped-finding';
const findingMode = stoppedFindingMode || agentFindingMode || mode === '--native-finding';
const interfaceMode = findingMode || mode === '--shared-interface';
const provenanceMode = mode === '--provenance';
const replanMode = provenanceMode || mode === '--replan';
const rebuildMode = mode === '--rebuild';
const baselineMode = mode === '--baseline';
const mixedDiameterMode = mode === '--mixed-diameter';
const reopenedStopMode = mode === '--reopened-stop', studioDeliveryMode = mode === '--studio-delivery' || mixedDiameterMode;
const studioApprovalMode = mode === '--studio-approval' || studioDeliveryMode, studioRejectionMode = mode === '--studio-rejection';
const reopenMode = mode === '--reopen' || baselineMode || reopenedStopMode;
const repairMode = mode === '--repair';
const prepareRepairMode = mode === '--prepare-repair';
const workingMode = mode === '--working' || prepareRepairMode;
const historyMode = mode === '--history' || workingMode;
const diameterMode = mode === '--hole-diameter';
const threeMode = liveStopMode || mode === '--three' || historyMode;
const occurrences = diameterMode ? ['p1'] : repairMode ? ['p3'] : threeMode ? ['p1', 'p2', 'p3'] : ['p1', 'p2'];
const widthMode = mode === '--width' || threeMode, checkpointMode = mode === '--checkpoint' || widthMode, statusMode = mode === '--status' || checkpointMode, startMode = diameterMode || studioRejectionMode || studioApprovalMode || liveStartMode || interfaceMode || replanMode || rebuildMode || reopenMode || repairMode || mode === '--start' || reviewMode || statusMode;
const handoffMode = mode === '--handoff' || startMode, repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.ok(mode === undefined || handoffMode);
await mkdir(output);
const probe = createServer();
probe.listen(0, '127.0.0.1');
await once(probe, 'listening');
process.env.CAD_STUDIO_CHAT_PORT = String(probe.address().port);
await new Promise((done, reject) => probe.close(error => error ? reject(error) : done()));

const scripted = 'apps/cad-studio/test/fixtures/scripted-claude.mjs';
const pins = [
  'apps/cad-studio/test/task-plan-agent-browser.mjs', 'apps/cad-studio/test/task-run-status-flow.mjs', 'apps/cad-studio/test/task-run-three-flow.mjs', 'apps/cad-studio/test/task-run-history-flow.mjs', 'apps/cad-studio/test/task-run-working-flow.mjs', 'apps/cad-studio/test/task-run-single-repair-flow.mjs', 'apps/cad-studio/test/task-run-prepare-repair-flow.mjs', 'apps/cad-studio/test/task-run-reopen-flow.mjs', 'apps/cad-studio/test/task-run-baseline-flow.mjs', 'apps/cad-studio/test/task-run-rebuild-flow.mjs', 'apps/cad-studio/test/task-run-replan-flow.mjs', 'apps/cad-studio/test/task-run-shared-interface-flow.mjs', scripted, 'apps/cad-studio/test/task-run-fixture.ts',
  'apps/cad-studio/scripts/chat-server.mjs', 'apps/cad-studio/scripts/cad-cli.mjs', 'apps/cad-studio/server/cadCli.ts',
  'apps/cad-studio/server/chatServer.ts', 'apps/cad-studio/server/cadMcp.ts',
  'apps/cad-studio/server/taskRun/cli.ts', 'apps/cad-studio/server/taskRun/localPlan.ts',
  ...['team/taskPlan', 'team/taskExecution', 'team/localHeightPlan', 'chat/tools', 'chat/part/requirements', 'chat/groups', 'chat/toolDefinitions',
    'chat/contract', 'util/digest'].map(name => `packages/barocss-cad-model/src/${name}.ts`),
  'packages/barocss-cad-model/src/chat/tools-v2.json',
  'apps/cad-studio/src/files/taskRunHandoff.ts', 'apps/cad-studio/src/chat/taskRunOffer.ts',
  'apps/cad-studio/test/fixtures/task-run-terminal.py',
  'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/ChatPanel.tsx',
  'apps/cad-studio/src/files/useStudioDocumentFiles.ts', 'apps/cad-studio/src/chat/localTaskRun.ts', 'apps/cad-studio/src/files/taskCheckpoint.ts', 'apps/cad-studio/src/files/taskCandidateReview.ts',
  'apps/cad-studio/src/storage/CandidateReviewSection.tsx', 'apps/cad-studio/src/storage/VersionsPanel.tsx',
  'apps/cad-studio/src/layout/DockSection.tsx',
  ...['host', 'store', 'thread', 'workerEntry', 'start', 'localService', 'localServiceEntry', 'nativeEvidence'].map(name => `apps/cad-studio/server/taskRun/${name}.ts`),
  ...(sharedHoleRepairMode ? [
    'apps/cad-studio/test/task-run-shared-hole-repair-flow.mjs',
    'apps/cad-studio/src/state/useProposalPreview.ts', 'apps/cad-studio/src/ui/ProposalBrowser.tsx',
    'apps/cad-studio/src/storage/useProject.ts', 'apps/cad-studio/src/chat/useStudioChat.ts',
    ...['app/editFields', 'chat/part/proposals', 'chat/part/features', 'chat/requirementEvidence', 'team/parts'].map(name => `packages/barocss-cad-model/src/${name}.ts`),
  ] : []),
  ...(sharedHoleDeliveryMode ? ['apps/cad-studio/test/task-run-shared-hole-delivery-flow.mjs'] : []),
  ...(liveStartMode ? ['apps/cad-studio/test/task-run-live-start-flow.mjs'] : []),
  ...(liveStopMode ? ['apps/cad-studio/test/task-run-live-stop-flow.mjs'] : []),
  ...(reopenedStopMode ? ['apps/cad-studio/test/task-run-reopened-stop-flow.mjs'] : []),
  ...(studioApprovalMode ? ['apps/cad-studio/test/task-run-studio-approval-flow.mjs'] : []),
  ...(diameterMode ? ['apps/cad-studio/test/task-run-hole-diameter-flow.mjs', 'packages/barocss-cad-model/src/team/localHeightPlan.ts'] : []),
  ...(studioRejectionMode ? ['apps/cad-studio/test/task-run-studio-rejection-flow.mjs'] : []),
  ...(studioDeliveryMode ? ['apps/cad-studio/test/task-run-studio-delivery-flow.mjs', 'packages/barocss-cad-model/src/chat/requirementEvidence.ts'] : []),
  ...((liveStartMode || liveStopMode) ? ['apps/cad-studio/test/fixtures/task-run-worker-barrier.mjs'] : []),
];
const f = await createFlow({
  name: 'task-plan-agent', envFrozen: mixedDiameterMode ? 'D647_SOURCE_FROZEN' : diameterMode ? 'D646_SOURCE_FROZEN' : studioRejectionMode ? 'D645_SOURCE_FROZEN' : studioDeliveryMode ? 'D644_SOURCE_FROZEN' : studioApprovalMode ? 'D643_SOURCE_FROZEN' : reopenedStopMode ? 'D642_SOURCE_FROZEN' : liveStopMode ? 'D641_SOURCE_FROZEN' : liveStartMode ? 'D640_SOURCE_FROZEN' : stoppedFindingMode ? 'D639_SOURCE_FROZEN' : sharedHoleDeliveryMode ? 'D638_SOURCE_FROZEN' : sharedHoleRepairMode ? 'D637_SOURCE_FROZEN' : agentFindingMode ? 'D636_SOURCE_FROZEN' : findingMode ? 'D635_SOURCE_FROZEN' : interfaceMode ? 'D634_SOURCE_FROZEN' : provenanceMode ? 'D633_SOURCE_FROZEN' : replanMode ? 'D632_SOURCE_FROZEN' : rebuildMode ? 'D631_SOURCE_FROZEN' : baselineMode ? 'D630_SOURCE_FROZEN' : reopenMode ? 'D629_SOURCE_FROZEN' : repairMode ? 'D627_SOURCE_FROZEN' : prepareRepairMode ? 'D628_SOURCE_FROZEN' : workingMode ? 'D626_SOURCE_FROZEN' : historyMode ? 'D625_SOURCE_FROZEN' : threeMode ? 'D624_SOURCE_FROZEN' : widthMode ? 'D623_SOURCE_FROZEN' : checkpointMode ? 'D622_SOURCE_FROZEN' : statusMode ? 'D621_SOURCE_FROZEN' : reviewMode ? 'D620_SOURCE_FROZEN' : startMode ? 'D619_SOURCE_FROZEN' : handoffMode ? 'D618_SOURCE_FROZEN' : 'D617_SOURCE_FROZEN', output, initialFiles: pins, requiredFrozen: pins,
  inspectorSource: `import { readFileSync } from 'node:fs';
import { digestOf, requirementEvidenceRevision } from '@barocss/cad-model/util/digest';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { fixtureDoc, holeDiameterDocs, mixedDiameterDoc, sharedHoleDoc, singleRepairDoc, threeOccurrenceDoc } from './test/task-run-fixture';
if (process.argv[3]) {
  const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const action = JSON.parse(process.argv[3]);
  if (action === 'hole-native-evidence' || action === 'sibling-hole-native-evidence') {
    const part = action === 'sibling-hole-native-evidence' ? 1 : 0;
    const native = evaluatePart(doc.instances[part].doc, 0);
    if (!native.ok || native.bodies.length !== 1 || !native.faceTable?.['n2.side0']) throw new Error('Expected a native bore and one body.');
    const [body] = native.bodies;
    console.log(JSON.stringify({ face: native.faceTable['n2.side0'], volumeMm3: body.volume, centroidMm: body.centroid }));
  } else console.log(JSON.stringify(action === 'requirement-evidence' ? requirementEvidenceRevision(doc) : digestOf(doc)));
}
else if (${diameterMode}) console.log(JSON.stringify(holeDiameterDocs()));
else if (${mixedDiameterMode}) console.log(JSON.stringify(mixedDiameterDoc()));
else {
  const doc = ${interfaceMode} ? sharedHoleDoc() : ${repairMode} ? singleRepairDoc() : ${threeMode} ? threeOccurrenceDoc() : fixtureDoc();
  doc.instances[1].doc.requirements[0].id = 'check_spec';
  if (${widthMode}) {
    doc.instances[0].doc.requirements[0] = { ...doc.instances[0].doc.requirements[0], id: 'width', source: 'Use the stated width in mm.',
      check: { ...doc.instances[0].doc.requirements[0].check, query: { fn: 'bbox', axis: 'x' }, value: 24 } };
  }
  console.log(JSON.stringify(doc));
}`,
  oracleSource: String.raw`
import json, sys
d = json.load(sys.stdin)
for doc, report, want in zip(d['documents'], d['reports'], ([6,4],[6],[6,5]), strict=True):
    scopes = [{'occurrence': part['id'], 'feature': part['doc']['nodes'][1]['id'], 'field': 'height'} for part in doc['instances']]
    assert scopes == report['tasks']
    assert [row['heightMm'] for row in report['targets']] == want
    for row in report['targets']:
        part = next(part for part in doc['instances'] if part['id'] == row['id'])
        check = next(req for req in part['doc']['requirements'] if req['id'] == row['requirementId'])
        assert check['hard'] and check['basis'] == 'stated'
        assert check['check']['query'] == {'fn':'bbox','axis':'z'}
        assert check['check']['unit'] == 'mm' and check['check']['op'] == '=='
        assert check['check']['value'] == row['heightMm'] and check['check']['tol'] == row['toleranceMm']
        assert part['doc']['nodes'][1]['height'] == row['currentHeightMm']
assert d['reports'][1]['issues'][0]['inputs'] == ['requirement:check_spec:ambiguous']
print(json.dumps({'status':'PASS','targetHeights':[[6,4],[6],[6,5]],'productImports':0}))
`,
  qualification: mixedDiameterMode ? 'Approve height and rebuilt through-hole diameter, then save and reopen the assembly' : diameterMode ? 'Approve a native through-hole diameter and refuse a shared pattern in Studio' : studioRejectionMode ? 'Reject one reviewed candidate and approve the sibling in Studio' : studioDeliveryMode ? 'Approve both tasks in Studio and reopen the exact saved assembly' : studioApprovalMode ? 'Approve the reviewed candidate directly from Studio and reopen the checkpoint' : reopenedStopMode ? 'Stop a reopened run and preserve the approved checkpoint' : liveStopMode ? 'Stop the live Studio run and reopen its accepted baseline' : liveStartMode ? 'Show a durable run while its initial native workers remain active' : stoppedFindingMode ? 'Stop a failed shared hole run and reopen its exact baseline in Studio' : sharedHoleDeliveryMode ? 'Deliver both height edits from the explicitly repaired shared hole through Studio project Save and Open' : sharedHoleRepairMode ? 'Repair a shared hole through an explicitly accepted Studio proposal and recheck the exact saved assembly' : agentFindingMode ? 'Read selected native evidence in Studio chat and refuse a different working revision' : findingMode ? 'Read host-confirmed native failure details on a durable task' : interfaceMode ? 'Protect the approved two-part assembly when the shared hole interface conflicts' : provenanceMode ? 'Reopen the durable provenance of a replacement run' : replanMode ? 'Replace a stale candidate from revised saved requirements' : rebuildMode ? 'Rebuild a stale independent candidate from Studio without approving it' : baselineMode ? 'Open the verified native run baseline and retire stale reads' : reopenMode ? 'Reopen the same started run in fresh Studio contexts' : repairMode ? 'Repair one failed occurrence on the saved working model' : prepareRepairMode ? 'Prepare and explicitly start a repair from a saved working failure' : workingMode ? 'Compare historical approval with current occurrence checks and retire late replies' : historyMode ? 'Inspect all published task checks without replacing the working model' : threeMode ? 'Review and publish three independent tasks from one Studio run' : widthMode ? 'Deliver one rectangular width edit and one extrusion-height edit from the same Studio run' : checkpointMode ? 'Open both terminal-approved checkpoints directly from the owned Studio run' : statusMode ? 'Refresh a local run across terminal approval, sibling rebuild and final checkpoint delivery' : reviewMode ? 'Review both held candidates directly in desktop Studio and refuse a retired attempt' : startMode ? 'Start a verified local run from Studio and return the terminal-approved checkpoint' : handoffMode ? 'Export a reviewed Studio plan and exact native bytes to the local worker and return the approved checkpoint' :
    'Studio chat reads the same authored task plan as the CLI and detects a changed turn model',
  limits: ['Controlled local tool calls use the real Studio, chat server and stdio MCP.',
    mixedDiameterMode ? 'One native through-hole diameter and one sibling extrusion height in a single saved Studio run.' : diameterMode ? 'One independent native through-hole and one protected sibling, with a shared-pattern refusal control.' : sharedHoleDeliveryMode ? 'One shared hole repair and two extrusion-height publications in a desktop Studio project.' : sharedHoleRepairMode ? 'One hole diameter repair on two plates and two unpublished extrusion-height candidates.' : repairMode ? 'One extrusion-height repair in a three-occurrence assembly.' : threeMode ? 'One rectangular width and two extrusion-height tasks.' : widthMode ? 'One width task on a solid rectangle and one height task on its sibling.' : 'Two existing extrusion-height occurrences.'],
});
const button = name => f.page.getByRole('button', { name, exact: true });
const panel = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const review = () => panel().getByRole('region', { name: 'Worker candidate review', exact: true });
async function bounds(p1, p2) {
  await f.page.waitForFunction(([p1, p2]) => {
    const rows = window.__studioInstanceBounds?.();
    return rows?.length === 2 && rows.find(row => row.id === 'p1')?.max[2] === p1 && rows.find(row => row.id === 'p2')?.max[2] === p2;
  }, [p1, p2]);
}
const project = mixedDiameterMode ? 'D647 mixed dimension delivery' : diameterMode ? 'D646 through-hole diameter' : studioDeliveryMode ? 'D644 Studio approval delivery' : interfaceMode ? 'D634 shared hole interface' : replanMode ? 'D632 replacement plan' : rebuildMode ? 'D631 rebuild stale candidate' : reopenMode ? 'D629 reopen local run' : repairMode ? 'D627 scoped repair' : threeMode ? 'D624 three local tasks' : widthMode ? 'D623 width task' : checkpointMode ? 'D622 local checkpoint' : statusMode ? 'D621 local run status' : reviewMode ? 'D620 local review' : startMode ? 'D619 local start' : handoffMode ? 'D618 local handoff' : 'D617 plan query';
const readySummary = `${occurrences.length} local ${widthMode || diameterMode || mixedDiameterMode ? 'dimension' : 'height'} target${occurrences.length === 1 ? '' : 's'} ready`;
const call = (extra = {}) => ({ tool: 'requirements', args: { action: 'plan_tasks', occurrences, ...extra } });
async function openFile(name, buffer) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/octet-stream', buffer });
}
async function open(name, doc) {
  await openFile(name, Buffer.from(JSON.stringify(doc)));
  await f.same(doc);
}
async function savedBytes(name = 'housing.bcad') {
  return Buffer.from(await f.page.evaluate(async ({ project, name }) => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
    return [...new Uint8Array(await (await (await dir.getFileHandle(name)).getFile()).arrayBuffer())];
  }, { project, name }));
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin, create = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await create({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    if (workingMode) await context.addInitScript(instrumentWorkingChecks);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };

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
  const runRoot = join(output, 'service-runs');
  const env = { ...process.env, CAD_STUDIO_CLAUDE: wrapper, CAD_STUDIO_CHAT_ORIGINS: origin, CAD_STUDIO_TASK_RUN_DIR: runRoot };
  const workerBarrier = join(output, 'worker-barrier');
  if (liveStartMode || liveStopMode) {
    await mkdir(workerBarrier);
    env.CAD_STUDIO_TEST_WORKER_BARRIER = workerBarrier;
    env.NODE_OPTIONS = [env.NODE_OPTIONS, '--import=' + new URL('./fixtures/task-run-worker-barrier.mjs', import.meta.url).href].filter(Boolean).join(' ');
  }
  for (const key of ['CAD_SCRIPTED_COST_USD', 'CAD_SCRIPTED_SLEEP_MS', 'CAD_SCRIPTED_MARK', 'CAD_AB_LOG']) delete env[key];
  const chat = spawn(process.execPath, [join(f.app, 'scripts/chat-server.mjs')], { cwd: f.app, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const closed = once(chat, 'close');
  let stdout = '', stderr = '', cursor = 0;
  chat.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-8000); });
  const ready = new Promise(done => chat.stdout.on('data', chunk => {
    stdout += chunk;
    if (stdout.includes('chat server on')) done(true);
  }));
  const isStart = request => new URL(request.url()).pathname === '/api/chat/task-runs/start' && request.method() === 'POST';
  const requests = [];
  const isReview = request => new URL(request.url()).pathname === '/api/chat/task-runs/review' && request.method() === 'POST';
  const expectedConsole = [];
  const isTurn = request => new URL(request.url()).pathname === '/api/chat/turn' && request.method() === 'POST';

  async function turn(label, calls, { proposal = false, requirementEvidence = false } = {}) {
    const input = f.page.getByRole('textbox', { name: 'Chat message', exact: true });
    if (!(await input.isVisible())) await button('Chat').first().click();
    await f.page.waitForFunction(() => document.querySelector('[aria-label="Chat message"]')?.disabled === false);
    const response = f.page.waitForResponse(reply => isTurn(reply.request())), request = f.page.waitForRequest(isTurn);
    await input.fill('script ' + JSON.stringify({ calls }));
    await input.press('Enter');
    const wire = (await request).postDataJSON(), reply = await response;
    assert.ok(reply.ok());
    const events = (await reply.text()).split('\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)));
    const done = events.at(-1);
    assert.equal(done.end, 'done', JSON.stringify(done));
    for (const field of ['versions', 'selection']) assert.equal(done[field], undefined, field);
    await f.page.waitForFunction(() => document.querySelector('[aria-label="Chat message"]')?.disabled === false);
    const all = (await readFile(rawPath, 'utf8')).trim().split('\n').map(line => JSON.parse(line))
      .filter(line => line.type === 'user').flatMap(line => line.message.content);
    const results = all.slice(cursor).map(result => ({ error: result.is_error, body: JSON.parse(result.content[0].text) }));
    cursor = all.length;
    assert.equal(results.length, calls.length, JSON.stringify(results));
    const revision = await f.inspect(label + '-revision', wire.doc, requirementEvidence ? 'requirement-evidence' : true);
    if (proposal) {
      assert.ok(done.doc, JSON.stringify(results));
      assert.deepEqual(events.flatMap(event => event.ops ?? []).map(op => op.tool), ['propose']);
    } else {
      assert.equal(events.some(event => event.type === 'state'), false);
      for (const field of ['doc', 'ops']) assert.equal(done[field], undefined, field);
      for (const result of results) assert.equal(result.body.revision, revision);
    }
    return { results, revision, doc: done.doc, taskFinding: wire.taskFinding, events: events.filter(event => event.type === 'tool') };
  }

  try {
    assert.ok(await Promise.race([ready, closed.then(() => false), new Promise(done => setTimeout(() => done(false), 15000).unref())]), stderr || 'Local chat server did not start');
    f.phase = 'save the current Studio model and read its plan through the actual agent';
    await f.newPage();
    f.page.on('request', request => { if (isStart(request)) requests.push(request); });
    f.page.on('console', message => {
      if (reviewMode && message.type() === 'error' && message.location().url === origin + '/api/chat/task-runs/review'
        && /409/.test(message.text())) expectedConsole.push(message.text());
    });
    const fixture = await f.inspect('fixture', {});
    const source = diameterMode ? fixture.source : fixture;
    if (diameterMode) {
      f.phase = 'refuse a through-hole diameter task on a shared pattern';
      await open('shared-pattern.bcad', fixture.shared);
      const blocked = await turn('shared-diameter', [call()]);
      assert.equal(blocked.results[0].body.status, 'blocked');
      assert.deepEqual(blocked.results[0].body.issues.map(issue => issue.code), ['SHARED_HOLE_PATTERN']);
      assert.equal(blocked.events[0].taskRunOffer, undefined);
      await f.page.getByText('Local dimension plan blocked · 1 issue', { exact: true }).waitFor();
      await writeFile(join(output, 'd646-shared-planning.json'), JSON.stringify(blocked.results[0].body));
      await f.same(fixture.shared);
      await assert.rejects(readdir(runRoot), { code: 'ENOENT' });
      await f.snapshot('00-shared-pattern-refused');
      f.phase = 'save the independent through-hole and inspect its dimension plan';
    }
    await open('housing.bcad', source);
    await button('Project and versions').click();
    await panel().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
    await panel().getByRole('button', { name: 'Project in this browser', exact: true }).click();
    await button('Save').click();
    await panel().getByRole('list', { name: 'Project documents', exact: true }).getByText('housing.bcad', { exact: true }).waitFor();
    const saved = await savedBytes(), path = join(output, 'housing.bcad');
    await writeFile(path, saved);
    const cli = spawnSync(process.execPath, [join(f.app, 'scripts/cad-cli.mjs'), 'task-run', 'plan', path, ...occurrences],
      { cwd: f.app, encoding: 'utf8', timeout: 30000 });
    assert.equal(cli.status, 0, cli.stderr);
    await writeFile(join(output, 'cli-plan.json'), cli.stdout);
    const cliPlan = JSON.parse(cli.stdout), first = await turn('ready', [call()]);
    assert.deepEqual(first.results.map(result => result.error), [false]);
    assert.deepEqual(first.results[0].body.targets, cliPlan.targets);
    assert.equal(first.results[0].body.revision, cliPlan.modelDigest);
    assert.equal(first.results[0].body.status, 'ready');
    assert.equal(first.events[0].summary, readySummary);
    if (mixedDiameterMode) {
      assert.deepEqual(cliPlan.targets, [
        { id: 'p1', requirementId: 'height', currentHeightMm: 5, heightMm: 6, toleranceMm: 0.001 },
        { id: 'p2', requirementId: 'bore', currentDiameterMm: 4, diameterMm: 6, toleranceMm: 0.001 },
      ]);
      assert.deepEqual(first.results[0].body.tasks, [
        { occurrence: 'p1', feature: 'n1', field: 'height' },
        { occurrence: 'p2', feature: 'n2', field: 'diameter' },
      ]);
    }
    if (diameterMode) {
      assert.deepEqual(cliPlan.targets, [{ id: 'p1', requirementId: 'bore', currentDiameterMm: 4, diameterMm: 6, toleranceMm: 0.001 }]);
      assert.deepEqual(first.results[0].body.tasks, [{ occurrence: 'p1', feature: 'n2', field: 'diameter' }]);
      assert.deepEqual(cliPlan.plan.protectedOccurrences, ['p2']);
    }
    if (repairMode) {
      assert.deepEqual(cliPlan.targets.map(t => [t.id, t.currentHeightMm, t.heightMm]), [['p3', 7, 5]]);
      assert.equal(cliPlan.limits.concurrent, 1);
      assert.equal(cliPlan.budget, 4);
      assert.deepEqual(cliPlan.plan.protectedOccurrences, ['p1', 'p2']);
      const satisfied = await turn('already-satisfied', [call({ occurrences: ['p1'] })]);
      assert.equal(satisfied.results[0].body.status, 'blocked');
      assert.deepEqual(satisfied.results[0].body.issues.map(issue => issue.code), ['UNCOVERED_REQUIREMENT']);
      assert.equal(satisfied.events[0].taskRunOffer, undefined);
    }
    await f.same(source);
    await f.snapshot('01-ready-plan');
    let handoff, studioRun;
    if (handoffMode) {
      f.phase = 'click export and retain the exact project bytes in the handoff';
      await f.page.evaluate(() => {
        const blobs = new Map(), createURL = URL.createObjectURL, click = HTMLAnchorElement.prototype.click;
        window.__d618Exports = [];
        URL.createObjectURL = function (blob) {
          const url = createURL.call(this, blob);
          if (blob.type === 'application/octet-stream') blobs.set(url, blob);
          return url;
        };
        HTMLAnchorElement.prototype.click = function () {
          const blob = blobs.get(this.href);
          if (!blob || !this.download.endsWith('.bcad-task')) return click.call(this);
          window.__d618Exports.push(blob.arrayBuffer().then(bytes => ({ name: this.download, bytes: [...new Uint8Array(bytes)] })));
          blobs.delete(this.href);
        };
      });
      assert.deepEqual(first.events[0].taskRunOffer.targets, cliPlan.targets);
      assert.equal(await f.page.evaluate(() => window.__d618Exports.length), 0);
      const row = f.page.locator('details.chat-tool').filter({ hasText: readySummary });
      await row.locator('summary').click();
      if (diameterMode) await row.getByText('p1 · Diameter 4 → 6 mm', { exact: true }).waitFor();
      else if (repairMode) await row.getByText('p3 · 7 → 5 mm', { exact: true }).waitFor();
      else {
        await row.getByText(widthMode ? 'p1 · Width 20 → 24 mm' : 'p1 · 5 → 6 mm', { exact: true }).waitFor();
        await row.getByText(mixedDiameterMode ? 'p2 · Diameter 4 → 6 mm' : 'p2 · 3 → 4 mm', { exact: true }).waitFor();
        if (threeMode) await row.getByText('p3 · 3 → 5 mm', { exact: true }).waitFor();
      }
      await f.snapshot('04-export-task-run');
      await row.getByRole('button', { name: 'Export task run', exact: true }).click();
      await f.page.waitForFunction(() => window.__d618Exports.length === 1);
      const exported = await f.page.evaluate(() => window.__d618Exports[0]);
      assert.equal(exported.name, 'housing.bcad-task');
      handoff = join(output, exported.name);
      const bytes = Buffer.from(exported.bytes), headerEnd = 12 + bytes.readUInt32LE(8);
      assert.equal(bytes.subarray(0, 8).toString(), 'BCADTSK1');
      assert.deepEqual(bytes.subarray(headerEnd), saved);
      const { receipt } = JSON.parse(bytes.subarray(12, headerEnd).toString('utf8'));
      assert.deepEqual(receipt.offer, first.events[0].taskRunOffer);
      assert.equal(receipt.sourceSHA256, sha256(saved));
      await writeFile(handoff, bytes);

      const start = row.getByRole('button', { name: 'Start local run', exact: true });
      if (startMode) {
        f.phase = 'start held local candidates and reuse the existing run';
        if (repairMode) {
          await f.addParameter('afterPlan', 7, '05-edit-after-repair-plan');
          await start.click();
          await row.getByText('The working model differs from the reviewed plan. Save and inspect it again.', { exact: true }).waitFor();
          await button('Undo').click();
          await f.same(source);
        }
        if (reopenMode) await refuseMissingTaskRun({ f, openFile, bytes, source, runRoot });
        assert.equal(requests.length, 0);
        await assert.rejects(readdir(runRoot), { code: 'ENOENT' });
        const endpoint = origin + '/api/chat/task-runs/start';
        const headers = { origin, 'x-barocss-task-run': 'start', 'content-type': 'application/octet-stream' };
        const invalid = await f.page.request.post(endpoint, { headers, data: Buffer.concat([bytes, Buffer.from(' ')]), maxRedirects: 0 });
        assert.equal(invalid.status(), 400);
        assert.match((await invalid.json()).error, /saved source does not match/);
        await assert.rejects(readdir(runRoot), { code: 'ENOENT' });
        const key = sha256(JSON.stringify({ occurrences, source: sha256(saved) }));
        await mkdir(join(runRoot, key), { recursive: true, mode: 0o700 });
        await writeFile(join(runRoot, key, 'writer-1.json'), JSON.stringify({ epoch: 1, pid: process.pid, id: 'interrupted-writer' }), { mode: 0o600 });
        await writeFile(join(runRoot, key, 'released-1.json'), JSON.stringify('interrupted-writer'), { mode: 0o600 });
        await f.page.evaluate(() => {
          const fetchImpl = window.fetch;
          window.__d619RequestHashes = [];
          window.fetch = function (input, init) {
            if (input === '/api/chat/task-runs/start') {
              const hash = init.body.arrayBuffer().then(bytes => crypto.subtle.digest('SHA-256', bytes))
                .then(bytes => [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join(''));
              window.__d619RequestHashes.push(hash);
            }
            return fetchImpl.call(this, input, init);
          };
        });
        const launch = async () => {
          const [reply] = await Promise.all([f.page.waitForResponse(response => isStart(response.request())), start.click()]);
          assert.equal(reply.status(), 200, await reply.text());
          const request = reply.request();
          assert.equal((await request.allHeaders()).origin, origin);
          assert.equal((await request.allHeaders())['x-barocss-task-run'], 'start');
          assert.equal(await f.page.evaluate(() => window.__d619RequestHashes.at(-1)), sha256(bytes));
          return reply.json();
        };
        if (liveStartMode || liveStopMode) {
          const flow = liveStopMode ? taskRunLiveStopFlow : taskRunLiveStartFlow;
          await flow({ f, row, start, source, saved, bytes, workerBarrier, runRoot, openFile, open });
          assert.deepEqual(f.report.downloads, []);
          return;
        }
        const firstLaunch = await launch();
        studioRun = firstLaunch.directory;
        assert.equal(firstLaunch.reused, false);
        assert.equal(firstLaunch.phase, 'active');
        assert.equal(relative(runRoot, studioRun).length, 64);
        assert.match(relative(runRoot, studioRun), /^[a-f0-9]{64}$/);
        assert.deepEqual(await readdir(runRoot), [relative(runRoot, studioRun)]);
        assert.deepEqual(firstLaunch.tasks.map(task => [task.id, task.phase]), occurrences.map(id => [id, 'awaiting-decision']));
        await row.getByText('Local run started · active', { exact: true }).waitFor();
        assert.ok(!(await row.innerText()).includes(firstLaunch.directory));
        assert.equal(await row.getByText(firstLaunch.directory, { exact: true }).count(), 0);
        for (const id of occurrences) await row.getByText(id + ' · awaiting decision', { exact: true }).waitFor();
        const runJson = join(studioRun, 'run.json'), initial = await readFile(runJson);
        const { record } = JSON.parse(initial);
        assert.deepEqual(record.commits, []);
        assert.equal(record.pending, undefined);
        assert.equal(record.epoch, 2);
        assert.equal(record.accepted.sha256, sha256(saved));
        const volumes = record.state.tasks.map(task => task.candidate.geometry.volumeMm3);
        if (diameterMode) {
          assert.equal(volumes.length, 1);
          assert.ok(Math.abs(volumes[0] - (1200 - 9 * Math.PI) * 6) < 1e-8);
        } else if (mixedDiameterMode) {
          assert.equal(volumes.length, 2);
          assert.equal(volumes[0], 1200);
          assert.ok(Math.abs(volumes[1] - (1200 - 9 * Math.PI) * 6) < 1e-8);
        } else if (interfaceMode) {
          for (const [actual, expected] of volumes.map((actual, i) => [actual, ([200, 96][i] - 4 * Math.PI) * [6, 4][i]]))
            assert.ok(Math.abs(actual - expected) < 1e-8, JSON.stringify({ actual, expected }));
        } else assert.deepEqual(volumes, repairMode ? [480] : threeMode ? [1200, 384, 480] : [1200, 384]);
        await f.same(source);
        await f.snapshot('06-local-run-started');
        assert.deepEqual(await launch(), { ...firstLaunch, reused: true });
        await row.getByText('Existing local run · active', { exact: true }).waitFor();
        assert.deepEqual(await readFile(runJson), initial);
        assert.deepEqual(await readdir(runRoot), [relative(runRoot, studioRun)]);
        if (diameterMode) {
          await taskRunHoleDiameterFlow({ f, row, launch: firstLaunch, source, saved, bytes, openFile, turn });
          assert.deepEqual(f.report.downloads, []);
          return;
        }
        if (studioRejectionMode) {
          await taskRunStudioRejectionFlow({ f, row, launch: firstLaunch, source, saved, bytes, openFile });
          assert.deepEqual(f.report.downloads, []);
          return;
        }
        if (studioApprovalMode) {
          const deliver = studioDeliveryMode ? values => taskRunStudioDeliveryFlow({ f, row, launch: firstLaunch, source, saved,
            project, savedBytes, turn, siblingDiameter: mixedDiameterMode, ...values }) : undefined;
          await taskRunStudioApprovalFlow({ f, row, launch: firstLaunch, source, saved, bytes, openFile, deliver, siblingDiameter: mixedDiameterMode });
          assert.deepEqual(f.report.downloads, []);
          return;
        }
        if (interfaceMode) {
          await taskRunSharedInterfaceFlow({ f, row, source, launch: firstLaunch, open, openFile, runRoot, turn, call, readySummary, findingMode, agentFindingMode, sharedHoleRepairMode, sharedHoleDeliveryMode, stoppedFindingMode });
          assert.deepEqual(f.report.downloads, []);
          return;
        }
        if (replanMode) {
          await taskRunReplanFlow({ f, row, launch: firstLaunch, open, openFile, requests, runRoot, provenanceMode });
          assert.deepEqual(f.report.downloads, []);
          return;
        }
        if (rebuildMode) {
          await taskRunRebuildFlow({ f, origin, row, launch: firstLaunch, source, saved, savedBytes });
          assert.deepEqual(f.report.downloads, []);
          return;
        }
        if (reopenMode) {
          const options = { f, openFile, open, bytes, source, saved, launch: firstLaunch };
          if (reopenedStopMode) await taskRunReopenedStopFlow(options);
          else if (baselineMode) await taskRunBaselineFlow(options);
          else await taskRunReopenFlow(options);
          assert.deepEqual(f.report.downloads, []);
          return;
        }
        if (repairMode) {
          await taskRunSingleRepairFlow({ f, row, launch: firstLaunch, source, saved, savedBytes });
          assert.deepEqual(f.report.downloads, []);
          return;
        }
        const reversed = {
          offer: { ...receipt.offer, occurrences: [...receipt.offer.occurrences].reverse(), targets: [...receipt.offer.targets].reverse() },
          sourceSHA256: receipt.sourceSHA256,
        };
        const canonical = value => value === null || typeof value !== 'object' ? JSON.stringify(value)
          : Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
          : '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
        const reverseHeader = Buffer.from(JSON.stringify({ receipt: reversed, digest: sha256(canonical(reversed)) }));
        const reversePrefix = Buffer.from(bytes.subarray(0, 12));
        reversePrefix.writeUInt32LE(reverseHeader.length, 8);
        const reused = await f.page.request.post(endpoint, { headers,
          data: Buffer.concat([reversePrefix, reverseHeader, saved]), maxRedirects: 0 });
        assert.equal(reused.status(), 200, await reused.text());
        assert.deepEqual(await reused.json(), { ...firstLaunch, reused: true });
        assert.deepEqual(await readFile(runJson), initial);
        f.report.observations.push({ studioRunStarted: true, explicitPostCount: requests.length,
          durableReplayUnchanged: true, reversedSelectionReused: true, interruptedStartRecovered: true, forgedBytesRefused: true, unpublishedCandidates: occurrences.length, acceptedBaselineSHA256: record.accepted.sha256 });
        if (threeMode) {
          const { final, accepted } = await taskRunThreeFlow({ f, origin, row, launch: firstLaunch, source, saved, savedBytes });
          if (historyMode) await taskRunHistoryFlow({ f, origin, row, launch: firstLaunch, final, accepted, saved, savedBytes });
          if (workingMode) await taskRunWorkingFlow({ f, row, accepted, source, open });
          if (prepareRepairMode) await taskRunPrepareRepairFlow({ f, row, accepted, open, requests, runRoot });
          assert.deepEqual(f.report.downloads, []);
          return;
        }
        if (statusMode) {
          await taskRunStatusFlow({ f, origin, firstRow: row.first(), directCheckpoint: checkpointMode, widthMode, launch: firstLaunch, source, saved, savedBytes, openFile, startRequests: requests,
            duplicateRow: async () => {
              await turn('ready-duplicate', [call()]);
              const second = row.last();
              await second.locator('summary').click();
              return second;
            },
          });
          assert.deepEqual(f.report.downloads, []);
          return;
        }
        if (reviewMode) {
          const choose = id => row.getByRole('button', { name: 'Review candidate ' + id, exact: true });
          const runFiles = (await readdir(studioRun)).sort();
          f.phase = 'review and render both held candidates from the existing Studio row';
          const undoBefore = await button('Undo').isDisabled(), redoBefore = await button('Redo').isDisabled();
          await button('Parameters').click();
          assert.equal(await choose('p1').isDisabled(), true);
          await button('Parameters').click();
          await panel().getByRole('button', { name: 'Collapse Project & versions', exact: true }).click();
          assert.equal(await panel().getByRole('button', { name: 'Expand Project & versions', exact: true }).count(), 1);
          for (const [id, oldHeight, newHeight, p1, p2, volume] of [['p1', 5, 6, 6, 3, 200], ['p2', 3, 4, 5, 4, 96]]) {
            const pin = firstLaunch.tasks.find(task => task.id === id).review;
            await choose(id).click();
            await review().getByText(`Height · ${oldHeight} mm → ${newHeight} mm`, { exact: true }).waitFor();
            await review().getByText(`Volume change · +${volume} mm³`, { exact: true }).waitFor();
            await review().getByText(pin.candidateDigest.slice(0, 12), { exact: true }).waitFor();
            await review().getByText(pin.attemptId, { exact: true }).waitFor();
            assert.match(await review().getByRole('list', { name: 'Candidate checks' }).innerText(), /Pass/);
            assert.equal(await review().getByRole('button', { name: /^(Approve|Reject)$/ }).count(), 0);
            await bounds(p1, p2);
            await f.same(source);
            await f.snapshot('07-local-preview-' + id);
            await review().getByRole('button', { name: 'Show accepted model', exact: true }).click();
            await bounds(5, 3);
          }
          await review().getByRole('button', { name: 'Preview candidate', exact: true }).click();
          await bounds(5, 4);
          await panel().getByRole('button', { name: 'Collapse Project & versions', exact: true }).click();
          await bounds(5, 3);
          assert.equal(await review().count(), 0);
          await choose('p2').click();
          await bounds(5, 4);
          assert.deepEqual(await readFile(runJson), initial);
          assert.deepEqual((await readdir(studioRun)).sort(), runFiles);
          assert.deepEqual(await savedBytes(), saved);
          assert.equal(await button('Undo').isDisabled(), undoBefore);
          assert.equal(await button('Redo').isDisabled(), redoBefore);

          const reviewRoute = '**/api/chat/task-runs/review';
          async function withFinalReadHeld(onHeld, status) {
            let release, readCount = 0, seen = 0;
            const blockedRead = new Promise(resolve => { release = resolve; });
            const holdFinal = async route => {
              if (++readCount === 2) await blockedRead;
              return route.fallback();
            };
            await f.page.route(reviewRoute, holdFinal);
            try {
              const finalRequest = f.page.waitForRequest(request => isReview(request) && ++seen === 2);
              const found = f.page.waitForResponse(async response => isReview(response.request()) && response.request() === await finalRequest);
              await choose('p2').click();
              await finalRequest;
              await onHeld();
              release();
              const response = await found;
              assert.equal(response.status(), status, await response.text());
              await choose('p2').filter({ hasText: /^Review$/ }).waitFor();
              return response;
            } finally { release(); await f.page.unroute(reviewRoute, holdFinal); }
          }

          f.phase = 'retire a late review when the Versions toolbar closes the panel';
          await withFinalReadHeld(async () => {
            await button('Project and versions').click();
            await panel().waitFor({ state: 'hidden' });
          }, 200);
          assert.equal(await panel().count(), 0);
          await bounds(5, 3);
          await button('Project and versions').click();
          await panel().waitFor();
          assert.equal(await review().count(), 0);

          f.phase = 'refuse a wrong successful response at the final freshness check';
          let readCount = 0;
          const corruptFinal = async route => {
            if (++readCount !== 2) return route.fallback();
            const actual = await route.fetch();
            assert.equal(actual.status(), 200);
            return route.fulfill({ response: actual, json: { review: 'invalid receipt' } });
          };
          await f.page.route(reviewRoute, corruptFinal);
          try {
            await choose('p2').click();
            await row.getByText('The local run returned a different worker candidate.', { exact: true }).waitFor();
            assert.equal(await review().count(), 0);
            await bounds(5, 3);
          } finally { await f.page.unroute(reviewRoute, corruptFinal); }

          f.phase = 'refuse a candidate rejected at the terminal between the two review reads';
          await choose('p2').click();
          await bounds(5, 4);
          const candidateFile = join(output, 'retire-lid.bcad-candidate');
          const args = [process.execPath, join(f.app, 'scripts/cad-cli.mjs'), 'task-run'];
          const exported = spawnSync(args[0], [...args.slice(1), 'review', studioRun, 'p2', candidateFile],
            { cwd: f.app, encoding: 'utf8', timeout: 30000 });
          assert.equal(exported.status, 0, exported.stderr);
          const pin = JSON.parse(exported.stdout).candidateReview;
          const refusal = await withFinalReadHeld(async () => {
            assert.equal(await review().count(), 0);
            await bounds(5, 3);
            const terminal = spawnSync('python3', ['-I', join(f.app, 'test/fixtures/task-run-terminal.py'),
              'reject ' + pin.candidateDigest.slice(0, 12), '{}', ...args,
              'decide', studioRun, 'd620-terminal-reject-lid', 'p2', 'reject', '--review', candidateFile],
              { cwd: f.app, encoding: 'utf8', timeout: 90000 });
            await writeFile(join(output, 'd620-terminal-reject.stdout.jsonl'), terminal.stdout);
            await writeFile(join(output, 'd620-terminal-reject.stderr.txt'), terminal.stderr);
            assert.equal(terminal.status, 0, terminal.error?.message ?? terminal.stderr);
            assert.equal(JSON.parse(terminal.stdout.trim().split('\n').at(-1)).outcome.code, 'RUN_REJECTED');
          }, 409);
          assert.match((await refusal.json()).error, /no longer awaiting review/);
          await row.getByText(/This candidate is no longer awaiting review/).waitFor();
          assert.equal(await review().count(), 0);
          await bounds(5, 3);
          await f.same(source);
          await f.snapshot('08-retired-candidate-refused');
          f.phase = 'refuse a current candidate on a different working baseline';
          const other = structuredClone(source);
          other.instances[0].doc.nodes[1].height = 7;
          await open('different-baseline.bcad', other);
          await choose('p1').click();
          await row.getByText(/Open the exact native baseline/).waitFor();
          assert.equal(await review().count(), 0);
          await bounds(7, 3);
          await f.same(other);
          assert.deepEqual(await savedBytes(), saved);
          f.report.observations.push({ directReview: ['p1', 'p2'], previewHeightsMm: [[6, 3], [5, 4]], volumeDeltaMm3: [200, 96],
            competingInspectorBlocked: true, collapsedVersionsReopened: true, collapseRestoredBaseline: true, toolbarCloseRetiredLateReview: true, baselineBoundsRestored: true, runAndHistoryUnchangedByReview: true,
            malformedFinalResponseRefused: true, terminalRejectionRefused: true, wrongWorkingBaselineRefused: true });
        }
      }

      if (!reviewMode) {
        f.phase = 'refuse a same-tag byte change during the final project read';
        await f.page.evaluate(() => {
          const read = File.prototype.arrayBuffer;
          let count = 0;
          File.prototype.arrayBuffer = async function () {
            const buffer = await read.call(this);
            if (this.name === 'housing.bcad' && ++count === 2) {
              File.prototype.arrayBuffer = read;
              const changed = new Uint8Array(buffer);
              if (changed[0] !== 123 || changed[1] !== 10) throw new Error('Expected the saved JSON prefix');
              changed[1] = 32;
            }
            return buffer;
          };
        });
        if (startMode) {
          await start.click();
          await row.getByText(/The saved source moved/).waitFor();
          assert.equal(requests.length, 2);
        } else {
          await row.getByRole('button', { name: 'Export task run', exact: true }).click();
          await f.waitToast(/The saved source moved/);
          assert.equal(await f.page.evaluate(() => window.__d618Exports.length), 1);
          await f.dismissToasts();
        }

        f.phase = 'refuse the old offer after opening a byte-identical model as another file';
        await openFile('other-housing.bcad', saved);
        await f.same(source);
        if (startMode) {
          await start.click();
          await row.getByText(/The saved source moved/).waitFor();
          assert.equal(requests.length, 2);
        } else {
          await row.getByRole('button', { name: 'Export task run', exact: true }).click();
          await f.waitToast(/The saved source moved/);
          assert.equal(await f.page.evaluate(() => window.__d618Exports.length), 1);
          await f.dismissToasts();
        }
      }
    }

    f.phase = 'open a changed source and report its unresolved target';
    const blocked = structuredClone(source);
    blocked.instances[1].doc.requirements[0].basis = 'ambiguous';
    blocked.instances[1].doc.requirements[0].check.value = 5;
    await open('needs-confirmation.bcad', blocked);
    const second = await turn('blocked', [call({ expectedRevision: first.revision }), call()]);
    assert.deepEqual(second.results.map(result => result.error), [true, false]);
    assert.match(second.results[0].body.error, /OUTPUT_STALE/);
    assert.notEqual(second.revision, first.revision);
    assert.equal(second.results[0].body.targets, undefined);
    assert.equal(second.results[1].body.status, 'blocked');
    assert.deepEqual(second.results[1].body.targets, cliPlan.targets.slice(0, 1));
    assert.deepEqual(second.results[1].body.issues.map(({ occurrence, inputs }) => [occurrence, inputs]), [['p2', ['requirement:check_spec:ambiguous']]]);
    await f.page.getByText('Local height plan blocked · 1 issue', { exact: true }).waitFor();
    if (handoffMode) {
      assert.equal(second.events[1].taskRunOffer, undefined);
      const denied = f.page.locator('details.chat-tool').filter({ hasText: 'Local height plan blocked · 1 issue' });
      await denied.locator('summary').click();
      assert.equal(await denied.getByRole('button', { name: 'Export task run', exact: true }).count(), 0);
      assert.equal(await denied.getByRole('button', { name: 'Start local run', exact: true }).count(), 0);
    }
    await f.same(blocked);
    await f.snapshot('02-stale-and-blocked');

    f.phase = 'read a new ready plan after the saved requirement is stated';
    const resolved = structuredClone(blocked);
    resolved.instances[1].doc.requirements[0].basis = 'stated';
    await open('confirmed-height.bcad', resolved);
    const third = await turn('resolved', [call()]);
    assert.equal(third.results[0].body.status, 'ready');
    assert.notEqual(third.revision, second.revision);
    assert.equal(third.results[0].body.targets[1].requirementId, 'check_spec');
    assert.equal(third.results[0].body.targets[1].heightMm, 5);
    await f.runOracle({ documents: [source, blocked, resolved],
      reports: [first.results[0].body, second.results[1].body, third.results[0].body] }, 'authored-targets');
    await f.same(resolved);
    assert.deepEqual(await savedBytes(), saved);
    assert.deepEqual(f.report.downloads, []);
    await f.snapshot('03-new-ready-plan');
    if (handoffMode) {
      f.phase = 'return one terminal approval to Studio';
      const run = studioRun ?? join(output, 'run'), argv = [process.execPath, join(f.app, 'scripts/cad-cli.mjs'), 'task-run'];
      const invoke = async (label, ...args) => {
        const result = spawnSync(argv[0], [...argv.slice(1), ...args], { cwd: f.app, encoding: 'utf8', timeout: 30000 });
        await writeFile(join(output, label + '.stdout.json'), result.stdout);
        await writeFile(join(output, label + '.stderr.txt'), result.stderr);
        assert.equal(result.status, 0, result.error?.message ?? result.stderr);
        return JSON.parse(result.stdout);
      };
      const launched = startMode ? await invoke('studio-run-status', 'status', run)
        : await invoke('handoff-start', 'start', run, '--handoff', handoff);
      assert.deepEqual(launched.tasks.map(task => [task.id, task.phase, task.geometry.volumeMm3]),
        [['p1', 'awaiting-decision', 1200], ['p2', reviewMode ? 'cancelled' : 'awaiting-decision', 384]]);
      assert.equal(launched.accepted.sha256, sha256(saved));
      const candidateFile = join(output, 'base.bcad-candidate');
      const { candidateReview } = await invoke('handoff-review', 'review', run, 'p1', candidateFile);
      await openFile('original-housing.bcad', saved);
      await f.same(source);
      await openFile('base.bcad-candidate', await readFile(candidateFile));
      await f.page.getByRole('region', { name: 'Worker candidate review', exact: true }).getByText('Height · 5 mm → 6 mm', { exact: true }).waitFor();
      const terminal = spawnSync('python3', ['-I', join(f.app, 'test/fixtures/task-run-terminal.py'),
        'approve ' + candidateReview.candidateDigest.slice(0, 12), '{}', ...argv,
        'decide', run, 'approve-handoff-base', 'p1', 'approve', '--review', candidateFile],
        { cwd: f.app, encoding: 'utf8', timeout: 90000 });
      await writeFile(join(output, 'handoff-approve.stdout.jsonl'), terminal.stdout);
      await writeFile(join(output, 'handoff-approve.stderr.txt'), terminal.stderr);
      assert.equal(terminal.status, 0, terminal.error?.message ?? terminal.stderr);
      assert.equal(JSON.parse(terminal.stdout.trim().split('\n').at(-1)).outcome.code, 'RUN_ACCEPTED');
      const checkpoint = join(output, 'approved-handoff.bcad-run');
      await invoke('handoff-checkpoint', 'export', run, checkpoint);
      await openFile('approved-handoff.bcad-run', await readFile(checkpoint));
      const checks = f.page.getByRole('region', { name: 'Worker checkpoint checks', exact: true });
      await checks.waitFor();
      assert.deepEqual(await checks.getByRole('cell').allTextContents(), ['Fail · 5 mm', 'Pass · 6 mm']);
      assert.deepEqual((await f.doc()).instances.map(part => part.doc.nodes[1].height), [6, 3]);
      assert.deepEqual(await savedBytes(), saved);
      assert.equal(await f.page.evaluate(() => window.__d618Exports.length), 1);
      await f.snapshot('05-terminal-approved');
      f.report.observations.push({ handoffSHA256: sha256(await readFile(handoff)), originalBytesPreserved: true,
        ...(!reviewMode ? { sameContentReplacementRefused: true, sameTagByteChangeRefused: true } : {}), blockedOfferHasNoAction: true, geometryMm3: [1200, 384], approvals: 1 });
    }
    if (reviewMode) {
      assert.equal(expectedConsole.length, 2);
      f.report.expectedConsoleErrors = [...expectedConsole];
      for (const expected of expectedConsole) {
        const index = f.report.consoleErrors.indexOf(expected);
        assert.ok(index >= 0);
        f.report.consoleErrors.splice(index, 1);
      }
    }
    f.report.observations.push({ readyRevision: first.revision, blockedRevision: second.revision, resolvedRevision: third.revision,
      targetHeights: [[6, 4], [6], [6, 5]], cliPlanMatches: true, staleRefused: true, authoredID: 'check_spec',
      savedSourceSHA256: sha256(saved), projectBytesUnchanged: true, documentWrites: 0 });
  } finally {
    if (chat.exitCode === null && chat.signalCode === null) chat.kill('SIGTERM');
    await closed;
    await writeFile(join(output, 'chat-stderr.txt'), stderr);
    f.report.cleanup.push('CHAT_CLOSED');
  }
});
