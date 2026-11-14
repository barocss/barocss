import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2];
assert.ok(output && relative(resolve(import.meta.dirname, '../../..'), resolve(output)).startsWith('../'));
const fixture = 'apps/cad-studio/test/fixtures/assembly-cut.bcad';
const pins = [
  fixture, 'apps/cad-studio/test/drawing-stack-agent-browser.mjs', 'apps/cad-studio/scripts/cad-mcp.mjs',
  'apps/cad-studio/server/cadMcp.ts', 'apps/cad-studio/server/cadDoc.ts',
  'apps/cad-studio/src/ui/drawing/ToleranceStack.tsx',
];
const f = await createFlow({
  name: 'drawing-stack-agent', output, envFrozen: 'D1257_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: 'Current drawing dimension discovery and tolerance stack match actual Studio through local stdio MCP.',
  limits: ['Real local MCP. The same-origin chat transport substitutes deterministic tool calls for the live LLM.'],
  inspectorSource: `
import { summarize } from './server/chatServer';
const [name, text, isError] = process.argv.slice(3).map(s => JSON.parse(s));
console.log(JSON.stringify({ summary: summarize(name, text, isError) }));
`,
  oracleSource: `
from decimal import Decimal as D
from itertools import product
import json, sys
d = json.load(sys.stdin)
signs = (1, -1, -1)
sizes = tuple(map(D, ('90', '60', '20')))
limits = tuple(tuple(map(D, pair)) for pair in (('-0.1','0.2'), ('-0.05','0.05'), ('-0.02','0.08')))
corners = [sum(s * (x + y) for s, x, y in zip(signs, sizes, side)) for side in product(*limits)]
wanted = (sum(s * x for s, x in zip(signs, sizes)), min(corners), max(corners))
for surface in ('studio', 'mcp'):
    assert tuple(D(d[surface][k]) for k in ('nominal', 'minimum', 'maximum')) == wanted, d
print(json.dumps({'status':'PASS', 'endpointCombinations':len(corners), 'unit':'mm', 'values':list(map(str,wanted))}))
`,
});

async function withMcp(doc, label, action) {
  const path = join(f.output, label + '.bcad'), bytes = JSON.stringify(doc);
  await writeFile(path, bytes, { flag: 'wx' });
  const child = spawn(process.execPath, [join(f.app, 'scripts/cad-mcp.mjs'), '--doc', path, '--autonomy', '1'], { stdio: ['pipe', 'pipe', 'inherit'] });
  const closed = once(child, 'close');
  const lines = createInterface({ input: child.stdout });
  const replies = lines[Symbol.asyncIterator]();
  let id = 0;
  const request = async (method, params) => {
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) + '\n');
    let timer;
    try {
      const answer = await Promise.race([replies.next(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('MCP response timed out')), 15000); })]);
      assert.equal(answer.done, false);
      const result = JSON.parse(answer.value);
      assert.equal(result.id, id);
      assert.equal(result.error, undefined);
      return result.result;
    } finally { clearTimeout(timer); }
  };
  const call = (name, args) => request('tools/call', { name, arguments: args });
  try {
    const hello = await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'D1257', version: '1' } });
    assert.equal(hello.serverInfo.version, 'barocss-cad-tools-v2');
    return await action(request, call);
  } finally {
    child.stdin.end();
    lines.close();
    let timer;
    try {
      const [code] = await Promise.race([closed, new Promise((_, reject) => {
        timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('MCP did not exit')); }, 5000);
      })]);
      assert.equal(code, 0);
    } finally { clearTimeout(timer); }
    assert.equal(await readFile(path, 'utf8'), bytes, 'MCP drawing reads left the native file intact');
    f.report.observations.push({ label, mcpExited: true, fileSHA256: sha256(bytes), fileUnchanged: true });
  }
}
function success(answer) {
  assert.equal(answer.isError, false, JSON.stringify(answer));
  const payload = JSON.parse(answer.content[0].text);
  assert.deepEqual(answer.structuredContent, payload);
  return payload;
}
function refusal(answer, why) {
  assert.equal(answer.isError, true, JSON.stringify(answer));
  const payload = JSON.parse(answer.content[0].text);
  assert.match(payload.error, why);
  assert.equal(payload.nominal, undefined);
  assert.equal(answer.structuredContent, undefined);
}
const terms = [{ id: 'set_material', sign: 1 }, { id: 'insert', sign: -1 }, { id: 'shim', sign: -1 }];
const button = (name, within = f.page) => within.getByRole('button', { name, exact: true });

function width(id, occurrence, y, nominal, z, tol) {
  const edge = occurrence + 'n1.side0|n1.top';
  return { id, kind: 'linear', view: 'top', orient: 'horizontal', place: [nominal / 2, y - 4],
    a: { edge, at: 'end', near: [0, y, z] }, b: { edge, at: 'end', near: [nominal, y, z] }, tol };
}

await f.run(async () => {
  const source = JSON.parse(await readFile(join(f.repo, fixture), 'utf8'));
  Object.assign(source.nodes[0], { min: [0, -22], max: [90, -2] });
  source.nodes[1].height = 4;
  source.instances[0].position = [0, 10, 0];
  const shim = source.instances[1];
  Object.assign(shim, { position: [0, 55, 0], rotation: [0, 0, 0], part: { id: 'shim', rev: 'A' } });
  shim.doc.nodes[0].max = [20, 30];
  source.drawing = { title: 'Agent clearance stack', sheet: 'A3', scale: 1, scope: { kind: 'assembly' }, units: 'inch',
    projection: 'third', views: ['front', 'top'], hidden: false, dimensions: [
      width('set_material', '', -22, 90, 4, { kind: 'deviation', lower: -0.1, upper: 0.2 }),
      width('insert', 'p1/', 10, 60, 5, { kind: 'symmetric', value: 0.05 }),
      width('shim', 'p2/', 55, 20, 5, { kind: 'deviation', lower: -0.02, upper: 0.08 }),
    ] };

  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  let controlled, turnError;
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) return route.abort();
      if (url.pathname === '/api/chat/status') return route.fulfill({ json: { enabled: true, model: 'D1257 offline tool replay' } });
      if (url.pathname !== '/api/chat/turn') return route.continue();
      let events;
      try {
        const input = route.request().postDataJSON();
        assert.deepEqual(input.doc, controlled.doc);
        assert.equal(Number(input.autonomy), 1);
        events = controlled.events;
      } catch (error) {
        turnError = error;
        events = [{ type: 'done', end: 'error', error: 'Offline tool replay failed' }];
      }
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body: events.map(e => 'data: ' + JSON.stringify(e) + '\n\n').join('') });
    });
    return context;
  };

  f.phase = 'Open assembly and read the actual Studio tolerance stack';
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'agent-clearance.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.page.waitForFunction(() => window.__studioDoc?.drawing?.title === 'Agent clearance stack');
  await f.ready();
  const doc = await f.doc();
  await button('Drawing', f.page.locator('.mode')).click();
  await f.page.waitForFunction(() => window.__studioDrawing?.()?.dimensions.length === 3);
  const stack = f.page.locator('details[aria-label="Tolerance stack"]');
  await stack.locator('summary').click();
  await stack.getByRole('combobox', { name: 'Stack dimension 1' }).selectOption('set_material');
  await stack.getByRole('combobox', { name: 'Stack dimension 2' }).selectOption('insert');
  await button('Add term', stack).click();
  await stack.getByRole('combobox', { name: 'Stack dimension 3' }).selectOption('shim');
  const studio = await stack.locator('[data-stack-value]').evaluateAll(nodes =>
    Object.fromEntries(nodes.map(node => [node.dataset.stackValue, node.textContent.replace(/ mm$/, '')])));
  await f.snapshot('01-studio');

  f.phase = 'Discover and calculate in real MCP, then reject stale revisions';
  const { discovery, computed, wrong } = await withMcp(doc, 'accepted-mcp-input', async (request, call) => {
    const { tools } = await request('tools/list');
    assert.equal(tools.length, 13);
    for (const action of ['dimensions', 'stack']) {
      assert.ok(tools.find(tool => tool.name === 'drawing').inputSchema.properties.action.enum.includes(action));
    }
    const discovery = await call('drawing', { action: 'dimensions', sheet: 1 });
    const read = success(discovery);
    assert.deepEqual(read.dimensions.map(d => [d.id, d.value]), [['set_material', 90], ['insert', 60], ['shim', 20]]);
    assert.equal(read.dimensions[0].view, 'top');
    assert.equal(read.printUnit, 'inch');
    assert.match(read.dimensions[0].printed, /3\.54/);
    const args = { action: 'stack', sheet: 1, expectedRevision: read.revision, terms };
    const computed = await call('drawing', args);
    const accepted = success(computed);
    assert.deepEqual([accepted.revision, accepted.unit, accepted.method], [read.revision, 'mm', 'worst-case']);
    assert.deepEqual(accepted.terms.map(t => [t.id, t.sign, t.authoredTolerance]), terms.map((t, i) => [t.id, t.sign, doc.drawing.dimensions[i].tol]));
    const wrong = await call('drawing', { ...args, expectedRevision: '0'.repeat(64) });
    refusal(wrong, /changed/);
    return { discovery, computed, wrong };
  });
  const computedResult = success(computed);
  const edited = structuredClone(doc);
  edited.drawing.dimensions[2].tol = undefined;
  await withMcp(edited, 'missing-tolerance-mcp-input', async (_, call) => {
    const old = await call('drawing', { action: 'stack', sheet: 1, terms, expectedRevision: computedResult.revision });
    refusal(old, /changed/);
    const fresh = success(await call('drawing', { action: 'dimensions' }));
    assert.notEqual(fresh.revision, computedResult.revision);
    refusal(await call('drawing', { action: 'stack', sheet: 1, terms, expectedRevision: fresh.revision }), /explicit numeric tolerance/);
  });
  await f.runOracle({ studio, mcp: computedResult }, 'studio-mcp-clearance');

  f.phase = 'Show the real tool responses through the desktop Chat panel';
  const actions = [
    ['dimensions', { sheet: 1 }, 'get_drawing_dimensions', discovery],
    ['stack', { sheet: 1, terms, expectedRevision: computedResult.revision }, 'calculate_drawing_tolerance_stack', computed],
    ['stack', { sheet: 1, terms, expectedRevision: '0'.repeat(64) }, 'calculate_drawing_tolerance_stack', wrong],
  ];
  const events = [];
  for (const [action, args, handler, response] of actions) {
    const { summary } = await f.inspect('chat-' + handler + (response.isError ? '-error' : ''), doc, handler, response.content[0].text, response.isError);
    events.push({ type: 'tool', name: 'drawing', input: { action, ...args }, summary, isError: response.isError });
  }
  controlled = { doc, events: [...events, { type: 'done', end: 'done' }] };
  await button('Model', f.page.locator('.mode')).click();
  await button('Open chat').click();
  const chat = f.page.getByRole('complementary', { name: 'Chat', exact: true });
  await chat.getByLabel('Autonomy', { exact: true }).selectOption('1');
  await chat.getByLabel('Chat message', { exact: true }).fill('Read the current opening minus insert and shim tolerance stack.');
  await button('Send', chat).click();
  await chat.getByText('Nominal 10 mm · worst case 9.77 to 10.27 mm', { exact: true }).waitFor();
  await chat.getByText(/selected sheet changed/).or(chat.getByText('Offline tool replay failed', { exact: true })).waitFor();
  assert.ifError(turnError);
  assert.deepEqual(await chat.locator('[data-slot="tool"] .mono').allInnerTexts(), ['drawing.dimensions', 'drawing.stack', 'drawing.stack']);
  await f.same(doc);
  assert.equal(await f.page.getByLabel('Unsaved changes', { exact: true }).isVisible(), false);
  for (const card of await chat.locator('[data-slot="tool"] summary').all()) await card.click();
  await f.snapshot('02-chat');
  assert.deepEqual(f.report.downloads, []);
  f.report.observations.push({ label: 'clearance', revision: computedResult.revision, studio, agentTerms: computedResult.terms, results: events.map(e => e.summary) });
});
