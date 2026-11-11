import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { build } from 'esbuild';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2), repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.ok(mode === '--baseline' || mode === '--fixed');
const pins = ['apps/cad-studio/server/cadMcp.ts', 'apps/cad-studio/server/cadDoc.ts', 'apps/cad-studio/server/turnAutonomy.ts',
  'apps/cad-studio/scripts/cad-mcp.mjs', 'packages/barocss-cad-model/src/chat/tools.ts',
  'packages/barocss-cad-model/src/chat/toolKit.ts', 'packages/barocss-cad-model/src/chat/part/proposals.ts'];
const f = await createFlow({ name: 'state-backed-approval', envFrozen: 'D670_SOURCE_FROZEN', output, initialFiles: pins,
  requiredFrozen: pins, qualification: 'Approval for a CAD MCP turn without Studio Chat, with a Studio proposal handoff' });

const model = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 4,
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 40], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 8, id: 'n1' },
    { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [10, 20], radius: 3, axis: 'z', id: 'n2' },
    { kind: 'hole', parent: { node: 2, side: 'solid' }, center: [50, 20], radius: 3, axis: 'z', id: 'n3' },
  ], outputs: { b3: { node: 3, side: 'solid' } },
};
const protectedTurn = '왼쪽 홀을 8 mm로 바꾸는 제안을 보여줘. 내가 승인하기 전까지 현재 작업본에 적용하지 마.';
const ordinaryTurn = 'Change the left bore to 8 mm.';
const edit = { name: 'features', arguments: { action: 'edit', index: 2, values: { dia: 8 } } };
const offer = { name: 'proposals', arguments: { action: 'propose', title: 'Left bore Ø6 to Ø8', ops: [{ tool: edit.name, args: edit.arguments }] } };
const accept = { name: 'proposals', arguments: { action: 'accept', id: 'P1' } };
const summary = { name: 'query', arguments: { action: 'summary', response_format: 'concise' } };
const authored = nodes => nodes.map(node => Object.fromEntries(Object.entries(node).filter(([key]) => !['sigs', 'rematched', 'held'].includes(key))));
const volume = diameter => 60 * 40 * 8 - Math.PI * ((diameter / 2) ** 2 + 9) * 8;

function assertGeometry(doc, diameter) {
  assert.deepEqual(authored(doc.nodes), authored(model.nodes).map((node, i) => i === 2 ? { ...node, radius: diameter / 2 } : node));
  assert.deepEqual(doc.outputs, model.outputs);
}

async function callMcp(label, argv, env, calls) {
  const methods = [['initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'd670', version: '1' } }],
    ...calls.map(call => ['tools/call', call])];
  const input = methods.map(([method, params], id) => JSON.stringify({ jsonrpc: '2.0', id, method, params })).join('\n') + '\n';
  const run = spawnSync(process.execPath, argv, { input, encoding: 'utf8', env, timeout: 45000, maxBuffer: 4 * 1024 * 1024 });
  await writeFile(join(output, label + '-mcp.jsonl'), run.stdout ?? '');
  await writeFile(join(output, label + '-stderr.txt'), run.stderr ?? '');
  assert.equal(run.error, undefined);
  assert.equal(run.status, 0, run.stderr);
  const messages = run.stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(messages.map(m => m.id), methods.map((_, id) => id));
  assert.ok(messages[0].result.serverInfo.name === 'barocss-cad');
  return messages.slice(1).map(message => {
    assert.ok(message.result, JSON.stringify(message.error));
    return { error: message.result.isError, body: JSON.parse(message.result.content[0].text) };
  });
}

async function stateCall(entry, label, data, prompt, autonomy, calls) {
  const path = join(output, label + '-state.json'), before = Buffer.from(JSON.stringify(data));
  await writeFile(path, before);
  const env = { ...process.env, CAD_CHAT_STATE: path, CAD_AUTONOMY: String(autonomy), CAD_PROMPT: prompt };
  for (const key of ['CAD_CHAT_TASK_RUN_ROOT', 'CAD_TEAM_LIBRARIES']) delete env[key];
  const replies = await callMcp(label, [entry], env, calls);
  const after = await readFile(path);
  f.report.observations.push({ label, errors: replies.map(reply => reply.error), before: sha256(before), after: sha256(after), byteExact: before.equals(after) });
  return { replies, before, after, state: JSON.parse(after) };
}
const waiting = (doc = model, turns) => ({ doc, changed: false, version: 0, ...(turns ? { turns } : {}) });

await f.run(async () => {
  const entry = join(output, 'cadMcp.mjs');
  await build({ entryPoints: [resolve(repo, 'apps/cad-studio/server/cadMcp.ts')], outfile: entry, bundle: true,
    platform: 'node', format: 'esm', target: 'node22', logLevel: 'warning' });
  f.phase = 'state-backed L2 edit with the current approval request';
  const guarded = await stateCall(entry, 'current-text', waiting(model, [ordinaryTurn, protectedTurn]), ordinaryTurn, 2, [edit, summary]);
  assert.equal(guarded.replies[1].error, false);
  if (mode === '--baseline') {
    assert.equal(guarded.replies[0].error, false);
    assert.equal(guarded.state.version, 1);
    assertGeometry(guarded.state.doc, 8);
    assert.equal((guarded.state.doc.proposals ?? []).length, 0);
    return;
  }
  assert.equal(guarded.replies[0].error, true);
  assert.deepEqual(guarded.after, guarded.before);

  f.phase = 'use the host prompt when the turn file has no authored text';
  const fallback = await stateCall(entry, 'prompt-fallback', waiting(), protectedTurn, 2, [edit]);
  assert.equal(fallback.replies[0].error, true);
  assert.deepEqual(fallback.after, fallback.before);

  f.phase = 'preserve ordinary L2 edits after a previous approval-required turn';
  const next = await stateCall(entry, 'ordinary-next-turn', waiting(model, [protectedTurn, ordinaryTurn]), protectedTurn, 2, [edit]);
  assert.equal(next.replies[0].error, false);
  assert.equal(next.state.version, 1);
  assertGeometry(next.state.doc, 8);

  f.phase = 'leave the proposal open and refuse automatic acceptance at L4';
  const proposed = await stateCall(entry, 'proposal', waiting(model, [protectedTurn]), ordinaryTurn, 4, [offer, accept, edit]);
  assert.deepEqual(proposed.replies.map(reply => reply.error), [false, true, true]);
  assert.equal(proposed.state.version, 1);
  assertGeometry(proposed.state.doc, 6);
  assert.deepEqual(proposed.state.doc.proposals.map(p => [p.id, p.status]), [['P1', 'open']]);
  const auto = await stateCall(entry, 'auto-accept', waiting(proposed.state.doc, [protectedTurn]), ordinaryTurn, 4, [accept, edit]);
  assert.deepEqual(auto.replies.map(reply => reply.error), [true, true]);
  assert.deepEqual(auto.after, auto.before);

  f.phase = 'preserve standalone document mode and its configured L2 policy';
  const localDoc = join(output, 'direct-document.bcad'), original = Buffer.from(JSON.stringify(model));
  await writeFile(localDoc, original);
  const env = { ...process.env, CAD_PROMPT: protectedTurn };
  delete env.CAD_CHAT_STATE;
  const [direct] = await callMcp('direct-document', [resolve(repo, 'apps/cad-studio/scripts/cad-mcp.mjs'), '--doc', localDoc, '--autonomy', '2'], env, [edit]);
  assert.equal(direct.error, false);
  assert.notDeepEqual(await readFile(localDoc), original);

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
  f.phase = 'open the state-backed pending proposal in desktop Studio';
  await f.newPage();
  const pending = proposed.state.doc;
  await f.page.getByLabel('Model file', { exact: true }).setInputFiles({ name: 'mcp-pending.bcad',
    mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(pending)) });
  await f.same(pending);
  const checkVolume = async diameter => {
    await f.ready();
    const { bodies } = await f.bodies();
    assert.equal(bodies.length, 1);
    assert.ok(Math.abs(bodies[0].volume - volume(diameter)) < 1);
  };
  await checkVolume(6);
  await f.page.locator('.topbar').getByRole('button', { name: 'Chat', exact: true }).click();
  const row = f.page.getByRole('listitem', { name: 'Proposal P1', exact: true });
  await row.getByRole('button', { name: 'Preview', exact: true }).click();
  await row.getByRole('button', { name: 'Before or after', exact: true }).waitFor();
  await f.same(pending);
  await f.snapshot('01-mcp-proposal-preview');

  f.phase = 'accept in Studio and undo back to the exact pending document';
  await row.getByRole('button', { name: 'Accept', exact: true }).click();
  await f.page.waitForFunction(() => window.__studioDoc.proposals?.[0]?.status === 'accepted');
  const accepted = await f.doc();
  assertGeometry(accepted, 8);
  assert.equal(accepted.proposals[0].decided.by, 'user');
  assert.deepEqual(accepted.history.filter(entry => entry.kind === 'accept').map(entry => entry.proposal), ['P1']);
  await checkVolume(8);
  await f.snapshot('02-user-accepted');
  await f.page.locator('.topbar').getByRole('button', { name: 'Undo', exact: true }).click();
  await f.same(pending);
  await checkVolume(6);
  assert.deepEqual(f.report.downloads, []);
});
