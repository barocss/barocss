// D617 actual Studio chat, local chat server and stdio MCP. Run with the heavy gate and frozen sources.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2], repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
await mkdir(output);
const probe = createServer();
probe.listen(0, '127.0.0.1');
await once(probe, 'listening');
process.env.CAD_STUDIO_CHAT_PORT = String(probe.address().port);
await new Promise((done, reject) => probe.close(error => error ? reject(error) : done()));

const scripted = 'apps/cad-studio/test/fixtures/scripted-claude.mjs';
const pins = [
  'apps/cad-studio/test/task-plan-agent-browser.mjs', scripted, 'apps/cad-studio/test/task-run-fixture.ts',
  'apps/cad-studio/scripts/chat-server.mjs', 'apps/cad-studio/scripts/cad-cli.mjs',
  'apps/cad-studio/server/chatServer.ts', 'apps/cad-studio/server/cadMcp.ts',
  'apps/cad-studio/server/taskRun/cli.ts', 'apps/cad-studio/server/taskRun/localPlan.ts',
  ...['team/taskPlan', 'team/localHeightPlan', 'chat/tools', 'chat/part/requirements', 'chat/groups', 'chat/toolDefinitions',
    'chat/contract', 'util/digest'].map(name => `packages/barocss-cad-model/src/${name}.ts`),
  'packages/barocss-cad-model/src/chat/tools-v2.json',
];
const f = await createFlow({
  name: 'task-plan-agent', envFrozen: 'D617_SOURCE_FROZEN', output, initialFiles: pins, requiredFrozen: pins,
  inspectorSource: `import { readFileSync } from 'node:fs';
import { digestOf } from '@barocss/cad-model/util/digest';
import { fixtureDoc } from './test/task-run-fixture';
if (process.argv[3]) console.log(JSON.stringify(digestOf(JSON.parse(readFileSync(process.argv[2], 'utf8')))));
else {
  const doc = fixtureDoc();
  doc.instances[1].doc.requirements[0].id = 'check_spec';
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
  qualification: 'Studio chat reads the same authored task plan as the CLI and detects a changed turn model',
  limits: ['Controlled local tool calls use the real Studio, chat server and stdio MCP. Two existing extrusion-height occurrences.'],
});
const button = name => f.page.getByRole('button', { name, exact: true });
const panel = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const project = 'D617 plan query';
const call = (extra = {}) => ({ tool: 'requirements', args: { action: 'plan_tasks', occurrences: ['p1', 'p2'], ...extra } });
async function open(name, doc) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/octet-stream', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
}
async function savedBytes() {
  return Buffer.from(await f.page.evaluate(async project => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
    return [...new Uint8Array(await (await (await dir.getFileHandle('housing.bcad')).getFile()).arrayBuffer())];
  }, project));
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin, create = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await create({ ...options, serviceWorkers: 'block', acceptDownloads: false });
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
  const env = { ...process.env, CAD_STUDIO_CLAUDE: wrapper, CAD_STUDIO_CHAT_ORIGINS: origin };
  for (const key of ['CAD_SCRIPTED_COST_USD', 'CAD_SCRIPTED_SLEEP_MS', 'CAD_SCRIPTED_MARK', 'CAD_AB_LOG']) delete env[key];
  const chat = spawn(process.execPath, [join(f.app, 'scripts/chat-server.mjs')], { cwd: f.app, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const closed = once(chat, 'close');
  let stdout = '', stderr = '', cursor = 0;
  chat.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-8000); });
  const ready = new Promise(done => chat.stdout.on('data', chunk => {
    stdout += chunk;
    if (stdout.includes('chat server on')) done(true);
  }));
  const isTurn = request => new URL(request.url()).pathname === '/api/chat/turn' && request.method() === 'POST';

  async function turn(label, calls) {
    const input = f.page.getByRole('textbox', { name: 'Chat message', exact: true });
    if (!(await input.isVisible())) await button('Chat').first().click();
    await f.page.waitForFunction(() => document.querySelector('[aria-label="Chat message"]')?.disabled === false);
    const response = f.page.waitForResponse(reply => isTurn(reply.request())), request = f.page.waitForRequest(isTurn);
    await input.fill('script ' + JSON.stringify({ calls }));
    await input.press('Enter');
    const wire = (await request).postDataJSON(), reply = await response;
    assert.ok(reply.ok());
    const events = (await reply.text()).split('\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)));
    assert.equal(events.some(event => event.type === 'state'), false);
    const done = events.at(-1);
    assert.equal(done.end, 'done', JSON.stringify(done));
    for (const field of ['doc', 'versions', 'ops', 'selection']) assert.equal(done[field], undefined, field);
    await f.page.waitForFunction(() => document.querySelector('[aria-label="Chat message"]')?.disabled === false);
    const all = (await readFile(rawPath, 'utf8')).trim().split('\n').map(line => JSON.parse(line))
      .filter(line => line.type === 'user').flatMap(line => line.message.content);
    const results = all.slice(cursor).map(result => ({ error: result.is_error, body: JSON.parse(result.content[0].text) }));
    cursor = all.length;
    const revision = await f.inspect(label + '-revision', wire.doc, true);
    for (const result of results) assert.equal(result.body.revision, revision);
    return { results, revision, events: events.filter(event => event.type === 'tool') };
  }

  try {
    assert.ok(await Promise.race([ready, closed.then(() => false), new Promise(done => setTimeout(() => done(false), 15000).unref())]), stderr || 'Local chat server did not start');
    f.phase = 'save the current Studio model and read its plan through the actual agent';
    await f.newPage();
    const source = await f.inspect('fixture', {});
    await open('housing.bcad', source);
    await button('Project and versions').click();
    await panel().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
    await panel().getByRole('button', { name: 'Project in this browser', exact: true }).click();
    await button('Save').click();
    await panel().getByRole('list', { name: 'Project documents', exact: true }).getByText('housing.bcad', { exact: true }).waitFor();
    const saved = await savedBytes(), path = join(output, 'housing.bcad');
    await writeFile(path, saved);
    const cli = spawnSync(process.execPath, [join(f.app, 'scripts/cad-cli.mjs'), 'task-run', 'plan', path, 'p1', 'p2'],
      { cwd: f.app, encoding: 'utf8', timeout: 30000 });
    assert.equal(cli.status, 0, cli.stderr);
    await writeFile(join(output, 'cli-plan.json'), cli.stdout);
    const cliPlan = JSON.parse(cli.stdout), first = await turn('ready', [call()]);
    assert.deepEqual(first.results.map(result => result.error), [false]);
    assert.deepEqual(first.results[0].body.targets, cliPlan.targets);
    assert.equal(first.results[0].body.revision, cliPlan.modelDigest);
    assert.equal(first.results[0].body.status, 'ready');
    assert.equal(first.events[0].summary, '2 local height targets ready');
    await f.same(source);
    await f.snapshot('01-ready-plan');

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
