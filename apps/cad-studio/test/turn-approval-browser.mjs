import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2), repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.ok(mode === '--baseline' || mode === '--fixed');
const fixture = 'apps/cad-studio/test/fixtures/scripted-claude.mjs';
const pins = [fixture, ...(mode === '--fixed' ? ['apps/cad-studio/server/turnAutonomy.ts'] : []), 'apps/cad-studio/server/chatServer.ts', 'apps/cad-studio/server/cadMcp.ts',
  'apps/cad-studio/scripts/chat-server.mjs', 'packages/barocss-cad-model/src/chat/tools.ts',
  'packages/barocss-cad-model/src/chat/part/proposals.ts', 'packages/barocss-cad-model/src/chat/groups.ts'];
const f = await createFlow({ name: 'turn-approval', envFrozen: 'D669_APPROVAL_SOURCE_FROZEN', output, initialFiles: pins,
  requiredFrozen: pins, qualification: 'Approval before a controlled L2 model edit in desktop Studio' });
const base = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 4,
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 40], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 8, id: 'n1' },
    { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [10, 20], radius: 3, axis: 'z', id: 'n2' },
    { kind: 'hole', parent: { node: 2, side: 'solid' }, center: [50, 20], radius: 3, axis: 'z', id: 'n3' },
  ], outputs: { b3: { node: 3, side: 'solid' } },
};
const edit = { tool: 'features', args: { action: 'edit', index: 2, values: { dia: 8 } } };
const propose = { tool: 'proposals', args: { action: 'propose', title: 'Left bore at (10, 20) from Ø6 to Ø8', ops: [edit] } };
const protectedRequest = '현재 선택한 홀 하나의 지름을 6 mm에서 8 mm로 바꾸는 제안을 보여줘. 반대편 홀의 지름과 두 홀의 위치, 판의 외형과 두께는 유지해줘. 내가 승인하기 전까지 현재 작업본에 적용하지 마.';
const button = name => f.page.getByRole('button', { name, exact: true });
const message = () => f.page.getByRole('textbox', { name: 'Chat message', exact: true });
const proposal = id => f.page.getByRole('listitem', { name: 'Proposal ' + id, exact: true });
const modelHistory = () => f.page.locator('.history .hs').evaluateAll(items => items.map(item => item.getAttribute('aria-label')));
const features = nodes => nodes.map(node => Object.fromEntries(Object.entries(node).filter(([key]) => !['sigs', 'rematched', 'held'].includes(key))));

async function assertShape(diameter) {
  await f.ready();
  const doc = await f.doc(), { bodies } = await f.bodies();
  assert.deepEqual(features(doc.nodes), features(base.nodes).map((node, i) => i === 2 ? { ...node, radius: diameter / 2 } : node));
  assert.deepEqual(doc.outputs, base.outputs);
  assert.equal(bodies.length, 1);
  const volume = 60 * 40 * 8 - Math.PI * ((diameter / 2) ** 2 + 9) * 8;
  assert.ok(Math.abs(bodies[0].volume - volume) <= 1, 'Expected volume ' + volume + ', observed ' + bodies[0].volume);
  return { doc, volume: bodies[0].volume };
}

async function turn(text, calls, expectedFace) {
  const payload = text + '\n\nscript ' + JSON.stringify({ calls });
  await message().fill(payload);
  const [response] = await Promise.all([
    f.page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/chat/turn'),
    message().press('Enter'),
  ]);
  assert.equal(response.status(), 200);
  const events = (await response.text()).split('\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)));
  assert.equal(events.at(-1)?.type, 'done');
  assert.equal(events.at(-1).end, 'done');
  await f.page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled);
  const submitted = JSON.parse(response.request().postData()).text;
  assert.equal(submitted.includes(text), true);
  if (expectedFace) assert.ok(submitted.includes('[Selected in the viewport: face ' + expectedFace + ']'), submitted);
  return events.filter(event => event.type === 'tool');
}

async function waitDiameter(dia) {
  await f.page.waitForFunction(d => window.__studioDoc.nodes[2]?.radius === d / 2, dia);
  return assertShape(dia);
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
  const env = { ...process.env, CAD_STUDIO_CLAUDE: resolve(repo, fixture), CAD_STUDIO_CHAT_ORIGINS: origin };
  for (const key of ['CAD_SCRIPTED_COST_USD', 'CAD_SCRIPTED_SLEEP_MS', 'CAD_SCRIPTED_MARK', 'CAD_AB_LOG']) delete env[key];
  const chat = spawn(process.execPath, [resolve(f.app, 'scripts/chat-server.mjs')], { cwd: f.app, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const closed = once(chat, 'close');
  let stdout = '', stderr = '';
  chat.stderr.on('data', chunk => { stderr += chunk; });
  try {
    f.phase = 'start the owned chat server and scripted MCP client';
    const started = new Promise(resolve => chat.stdout.on('data', chunk => {
      stdout += chunk;
      if (stdout.includes('chat server on')) resolve(true);
    }));
    assert.equal(await Promise.race([started, closed.then(() => false), new Promise(resolve => setTimeout(() => resolve(false), 15000).unref())]), true, stderr);
    await f.newPage();
    await f.page.setViewportSize({ width: 1440, height: 900 });
    await f.page.getByLabel('Model file', { exact: true }).setInputFiles({ name: 'approval-plate.bcad',
      mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(base)) });
    const initial = await waitDiameter(6);

    f.phase = 'select the left bore in the viewport and send an approval-required L2 turn';
    await f.page.getByTitle('Frame all (F)', { exact: true }).click();
    await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    const canvas = f.page.locator('canvas.vp-canvas'), bounds = await canvas.boundingBox();
    const point = await f.page.evaluate(() => window.__studioProject([10, 23, 6]));
    assert.ok(bounds);
    await f.page.mouse.click(bounds.x + point[0], bounds.y + point[1]);
    await f.page.locator('.topbar').getByRole('button', { name: 'Chat', exact: true }).click();
    const autonomy = f.page.getByRole('combobox', { name: 'Autonomy', exact: true });
    await f.page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled);
    assert.equal(await autonomy.inputValue(), '2');
    const preTurn = await f.doc(), preHistory = await modelHistory();
    const [direct] = await turn(protectedRequest, [edit], 'n2.side0');

    if (mode === '--baseline') {
      assert.equal(direct.isError, false);
      const edited = await waitDiameter(8);
      assert.equal((edited.doc.proposals ?? []).filter(p => p.status === 'open').length, 0);
      await f.snapshot('01-before-approval-direct-edit');
      await f.page.locator('.topbar').getByRole('button', { name: 'Undo', exact: true }).click();
      const restored = await waitDiameter(6);
      assert.deepEqual(restored.doc, preTurn);
      f.report.observations.push({ beforeVolume: initial.volume, unauthorizedVolume: edited.volume, restoredVolume: restored.volume });
      return;
    }

    assert.equal(direct.isError, true);
    assert.match(direct.summary, /propos/i);
    await f.same(preTurn);
    assert.deepEqual(await modelHistory(), preHistory);
    assert.equal(await autonomy.inputValue(), '2');
    await f.snapshot('01-protected-direct-edit-refused');
    f.phase = 'review and reject the first proposal without a geometry change';
    const [first] = await turn(protectedRequest, [propose]);
    assert.equal(first.isError, false);
    const proposed = (await waitDiameter(6)).doc;
    await autonomy.selectOption('4');
    const [autoAccept] = await turn('Do not apply changes until I approve.', [
      { tool: 'proposals', args: { action: 'accept', id: 'P1' } },
    ]);
    assert.equal(autoAccept.isError, true);
    await f.same(proposed);
    await autonomy.selectOption('2');
    await proposal('P1').getByRole('button', { name: 'Preview', exact: true }).click();
    const comparison = proposal('P1').getByRole('button', { name: 'Before or after', exact: true });
    await comparison.waitFor();
    const initialView = await comparison.textContent();
    await assertShape(6);
    await comparison.click();
    assert.notEqual(await comparison.textContent(), initialView);
    await assertShape(6);
    assert.deepEqual(await modelHistory(), preHistory);
    await proposal('P1').getByRole('button', { name: 'Reject', exact: true }).click();
    await f.page.waitForFunction(() => window.__studioDoc.proposals?.some(p => p.id === 'P1' && p.status === 'rejected'));
    await assertShape(6);

    f.phase = 'accept only the second proposal and undo once';
    const [second] = await turn(protectedRequest, [propose]);
    assert.equal(second.isError, false);
    const waiting = (await waitDiameter(6)).doc;
    assert.deepEqual(waiting.proposals.map(p => p.status), ['rejected', 'open']);
    await proposal('P2').getByRole('button', { name: 'Accept', exact: true }).click();
    const accepted = await waitDiameter(8);
    assert.deepEqual(accepted.doc.proposals.filter(p => p.status === 'accepted').map(p => [p.id, p.decided.by]), [['P2', 'user']]);
    assert.deepEqual(accepted.doc.history.filter(entry => entry.kind === 'accept').map(entry => [entry.proposal, entry.by.agent]), [['P2', 'user']]);
    await f.snapshot('02-explicit-approval-changed-left-bore');
    await f.page.locator('.topbar').getByRole('button', { name: 'Undo', exact: true }).click();
    assert.deepEqual((await waitDiameter(6)).doc, waiting);
    assert.deepEqual(await modelHistory(), preHistory);

    f.phase = 'verify L1 refusal, unprotected L2 edit, and unprotected L2 first build';
    await autonomy.selectOption('1');
    const [atL1] = await turn('Change the left bore to 8 mm.', [edit]);
    assert.equal(atL1.isError, true);
    assert.deepEqual((await waitDiameter(6)).doc, waiting);
    await autonomy.selectOption('2');
    const [ordinary] = await turn('Change the left bore to 8 mm.', [edit]);
    assert.equal(ordinary.isError, false);
    assert.equal((await waitDiameter(8)).doc.nodes[3].radius, 3);
    await button('New part').click();
    await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
    await f.ready();
    const box = { tool: 'features', args: { action: 'command', command: 'box', values: { w: 10, d: 10, h: 10, x: 0, y: 0, z: 0 } } };
    const [protectedBuild] = await turn("Create a small box. Don't apply it without my approval.", [box]);
    assert.equal(protectedBuild.isError, true);
    assert.equal((await f.doc()).nodes.length, 0);
    const [firstBuild] = await turn('Create a small box.', [box]);
    assert.equal(firstBuild.isError, false);
    await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 2);
    await f.ready();
    assert.ok(Math.abs((await f.bodies()).bodies[0].volume - 1000) < 1e-9);
    f.report.observations.push({ beforeVolume: initial.volume, approvedVolume: accepted.volume,
      directRefused: true, previewAndRejectionPreservedGeometry: true, acceptedOneProposal: true, undoExact: true,
      l1Refused: true, protectedL4AcceptRefused: true, protectedL2FirstBuildRefused: true, ordinaryL2Edit: true, ordinaryL2FirstBuild: true });
    assert.deepEqual(f.report.downloads, []);
  } finally {
    if (chat.exitCode === null && chat.signalCode === null) chat.kill('SIGTERM');
    await closed;
  }
});
