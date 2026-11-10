// D579 / #2414. Run under the heavy gate from apps/cad-studio.
// D579_SOURCE_FROZEN=1 node test/requirement-best-snapshot-browser.mjs EXTERNAL_OUTPUT --expect=repro|fixed
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.ok(['--expect=repro', '--expect=fixed'].includes(mode));
const repro = mode === '--expect=repro';
const width = repro ? 20 : 10;
const base = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: { W: 30 },
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [{ parameter: 'W' }, { parameter: 'W' }], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 5, id: 'n1' },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
  requirements: [
    { id: 'H', source: 'Volume at most 600 mm³', hard: true, check: { query: { fn: 'volume' }, op: '<=', value: 600, unit: 'mm³' } },
    ...['x', 'y'].map(axis => ({ id: 'S' + axis, source: axis + ' length of 20 mm', hard: false,
      check: { query: { fn: 'bbox', axis }, op: '==', value: 20, unit: 'mm' } })),
  ],
};
const oracleSource = String.raw`
import json, math, sys
data = json.load(sys.stdin)
w = data['width']
body, = data['bodies']
volume = 5 * w * w
center = [w/2, w/2, 2.5]
assert math.isclose(body['volume'], volume, abs_tol=1e-9, rel_tol=0), body
assert all(math.isclose(a,b,abs_tol=1e-9,rel_tol=0) for a,b in zip(body['centroid'],center,strict=True)), body
print(json.dumps({'status':'PASS','width':w,'volume':volume,'center':center,'hardCapPass':volume<=600}))
`;
const fixture = 'apps/cad-studio/test/fixtures/scripted-claude.mjs';
const pins = ['apps/cad-studio/test/requirement-best-snapshot-browser.mjs', fixture,
  'apps/cad-studio/scripts/chat-server.mjs', 'apps/cad-studio/server/chatServer.ts', 'apps/cad-studio/server/cadMcp.ts',
  ...['spec', 'tools', 'toolDefinitions', 'groups', 'part/requirements', 'part/history'].map(name => 'packages/barocss-cad-model/src/chat/' + name + '.ts')];
const f = await createFlow({
  name: 'requirement-best-snapshot', envFrozen: 'D579_SOURCE_FROZEN', output, qualification: 'D579 #2414 desktop',
  initialFiles: pins, requiredFrozen: pins, oracleSource,
  limits: ['The model is replaced by the existing scripted Claude executable. The real Chat server and MCP tools process every call. The wrapper copies their stdout to the external receipt directory.'],
  snapshotExtra: () => ({ requirementSummary: document.querySelector('.req-head .muted')?.textContent }),
});
const button = name => f.page.getByRole('button', { name, exact: true });
const check = { tool: 'requirements', args: { action: 'check' } };
const best = { tool: 'history', args: { action: 'best' } };
const summary = { tool: 'query', args: { action: 'summary', response_format: 'concise' } };
const edit = (w, because) => ({ tool: 'features', args: { action: 'parameters', set: { W: w }, ...(because ? { because } : {}) } });

async function open(name, bytes, doc) {
  f.phase = 'public Open ' + name;
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/octet-stream', buffer: bytes });
  await f.same(doc);
}

async function snapshot(label, doc) {
  await f.same(doc);
  const w = doc.parameters.W;
  const hardPass = 5 * w * w <= 600;
  const softPass = w === 20;
  const passes = Number(hardPass) + 2 * Number(softPass);
  const summaryText = `${passes} ✓ · ${3 - passes} ✗ · 0 ?`;
  await f.page.waitForFunction(({ summaryText, hardPass, softPass, w }) => {
    if (document.querySelector('.req-head .muted')?.textContent !== summaryText) return false;
    return [['H', hardPass, 5 * w * w], ['Sx', softPass, w], ['Sy', softPass, w]].every(([id, pass, value]) => {
      const row = document.querySelector(`[aria-label="Requirement ${id}"]`);
      return row?.classList.contains(pass ? 'pass' : 'fail') && (pass || row.textContent.includes(` · ${value} (want `));
    });
  }, { summaryText, hardPass, softPass, w });
  const state = await f.snapshot(label);
  assert.equal(state.requirementSummary, summaryText);
  return f.runOracle({ width: w, bodies: state.bodies.bodies }, label);
}

async function turn(calls) {
  await button('Chat').click();
  const input = f.page.getByRole('textbox', { name: 'Chat message', exact: true });
  await f.page.waitForFunction(() => document.querySelector('[aria-label="Chat message"]')?.disabled === false, null, { timeout: 20000 });
  await f.page.getByLabel('Autonomy', { exact: true }).selectOption('3');
  const [response] = await Promise.all([
    f.page.waitForResponse(r => new URL(r.url()).pathname === '/api/chat/turn' && r.request().method() === 'POST'),
    (async () => {
      await input.fill('script ' + JSON.stringify({ calls }));
      await input.press('Enter');
    })(),
  ]);
  assert.ok(response.ok());
  const events = (await response.text()).split('\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)));
  assert.equal(events.at(-1)?.end, 'done', JSON.stringify(events.at(-1)));
  assert.equal(events.filter(event => event.type === 'tool').length, calls.length);
  await f.page.waitForFunction(() => document.querySelector('[aria-label="Chat message"]')?.disabled === false, null, { timeout: 30000 });
  await button('Close chat').click();
  return events;
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return url.origin === origin ? route.continue() : route.abort();
    });
    return context;
  };

  const wrapper = resolve(f.output, 'record-scripted-claude.mjs');
  const rawPath = resolve(f.output, 'scripted-tool-results.jsonl');
  const wrapperSource = `#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { appendFileSync } from 'node:fs';
const args = process.argv.slice(2);
const cli = spawn(process.execPath, [${JSON.stringify(resolve(repo, fixture))}, ...args], { stdio: ['pipe', 'pipe', 'inherit'] });
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
  f.report.wrapperSha256 = sha256(wrapperSource);
  const env = { ...process.env, CAD_STUDIO_CLAUDE: wrapper, CAD_STUDIO_CHAT_ORIGINS: origin };
  for (const key of ['CAD_SCRIPTED_COST_USD', 'CAD_SCRIPTED_SLEEP_MS', 'CAD_SCRIPTED_MARK', 'CAD_AB_LOG']) delete env[key];
  const chat = spawn(process.execPath, [resolve(f.app, 'scripts/chat-server.mjs')], { cwd: f.app, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const closed = once(chat, 'close');
  f.report.runtimeOwnership = { nodePID: process.pid, chatPID: chat.pid, serverURL: origin };
  let stderr = '';
  chat.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
  try {
    f.phase = 'start loopback chat server with scripted CLI';
    let stdout = '';
    const ready = new Promise(resolve => chat.stdout.on('data', chunk => {
      stdout += chunk;
      if (stdout.includes('chat server on')) resolve();
    }));
    const startup = await Promise.race([ready.then(() => true), closed.then(() => false), new Promise(resolve => setTimeout(() => resolve(false), 15000).unref())]);
    assert.ok(startup, stderr || 'Chat server did not start');
    await f.newPage();
    await open('D579-before', Buffer.from(JSON.stringify(base)), base);
    await snapshot('01-before', base);
    f.phase = 'one actual chat turn checks and restores candidates';
    const calls = [best, edit(10), check, check, check, summary, edit(20, 'controlled ranking fixture'), check, summary, edit(12), best, check];
    const events = await turn(calls);
    assert.equal(events.at(-1).doc.parameters.W, width);
    await f.changed(base);
    const reportDoc = await f.doc();
    assert.equal(reportDoc.parameters.W, width);
    assert.deepEqual(reportDoc.requirements, base.requirements);
    const raw = (await readFile(rawPath, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    const results = raw.filter(line => line.type === 'user').flatMap(line => line.message.content)
      .map(result => ({ error: !!result.is_error, data: JSON.parse(result.content[0].text) }));
    assert.deepEqual(results.map(result => result.error), calls.map((_, index) => index === 0));
    assert.match(results[0].data.error, /No checked snapshot yet/);
    const valid = results[4].data, invalid = results[7].data, restored = results[10].data;
    assert.deepEqual(valid.summary, { pass: 1, fail: 2, unknown: 0, hard_failing: 0 });
    assert.deepEqual(invalid.summary, { pass: 2, fail: 1, unknown: 0, hard_failing: 1 });
    assert.deepEqual(results[5].data.facts.bbox, { min: [0, 0, 0], max: [10, 10, 5] });
    assert.deepEqual(results[8].data.facts.bbox, { min: [0, 0, 0], max: [20, 20, 5] });
    assert.deepEqual(valid.policy.rounds_without_progress, { Sx: 2, Sy: 2 });
    assert.match(valid.policy.hint, /no progress on Sx, Sy/);
    assert.equal(invalid.policy.best.model_hash, repro ? invalid.model_hash : valid.model_hash);
    assert.match(restored.did, new RegExp(invalid.policy.best.model_hash));
    assert.equal(results[11].data.model_hash, invalid.policy.best.model_hash);
    assert.equal(reportDoc.history?.length, 1);
    const [entry] = reportDoc.history;
    assert.equal(entry.kind, 'prompt');
    assert.equal(entry.prompt, 'script ' + JSON.stringify({ calls }));
    assert.equal(entry.model_hash, invalid.policy.best.model_hash);
    if (!repro) {
      assert.equal(valid.policy.best.hard_fulfilled, true);
      assert.equal(invalid.policy.best.hard_fulfilled, true);
      assert.match(valid.policy.hint, /hard requirements fulfilled/);
      assert.match(restored.did, /hard requirements fulfilled/);
    }
    f.report.observations.push({ valid: valid.policy, invalid: invalid.policy, restored: restored.did });

    await snapshot('02-restored', reportDoc);
    await f.undo();
    await snapshot('03-first-undo', base);
    await f.redo();
    await snapshot('04-first-redo', reportDoc);

    f.phase = 'native Save to browser project';
    const project = 'D579 best snapshot', file = 'D579-saved.bcad';
    await f.page.locator('.doc-tab input').fill('D579-saved');
    await button('Project and versions').click();
    const panel = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
    await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
    await panel.getByRole('button', { name: 'Project in this browser', exact: true }).click();
    await panel.getByLabel('Project', { exact: true }).waitFor();
    await button('Save').click();
    await panel.getByRole('list', { name: 'Project documents', exact: true }).getByText(file, { exact: true }).waitFor();
    const saved = await f.page.evaluate(async ({ project, file }) => {
      const root = await navigator.storage.getDirectory();
      const projects = await root.getDirectoryHandle('projects');
      const folder = await projects.getDirectoryHandle(project);
      return (await (await folder.getFileHandle(file)).getFile()).text();
    }, { project, file });
    assert.deepEqual(JSON.parse(saved), reportDoc);
    f.report.files.push({ file, sha256: sha256(saved), semanticEquality: true, destination: 'OPFS' });
    await f.newPage();
    await open('D579-saved', Buffer.from(saved), reportDoc);
    await snapshot('05-fresh-open', reportDoc);
    const reset = await turn([best]);
    const refusal = reset.find(event => event.type === 'tool');
    assert.ok(refusal.isError);
    assert.match(refusal.summary, /No checked snapshot yet/);
    await f.same(reportDoc);
    const next = await f.setParameter('W', 9, '06-reedit-accepted');
    assert.deepEqual(next.doc, { ...reportDoc, parameters: { W: 9 } });
    await snapshot('07-reedit-settled', next.doc);
    assert.deepEqual(f.report.downloads, []);
  } finally {
    if (chat.exitCode === null && chat.signalCode === null) chat.kill('SIGTERM');
    const [code, signal] = await closed;
    f.report.chatExit = { code, signal, stderr };
  }
});
