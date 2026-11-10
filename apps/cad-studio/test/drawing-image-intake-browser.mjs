import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, scenario] = process.argv.slice(2), repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.ok(scenario === undefined || scenario === '--capacity');
const capacity = scenario === '--capacity';
const app = join(repo, 'apps/cad-studio');
const drawingPath = 'apps/cad-studio/test/fixtures/dimensioned-angle-bracket.svg';
const scripted = 'apps/cad-studio/test/fixtures/scripted-claude.mjs';
const pins = [drawingPath, scripted, 'apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/src/ui/ChatPanel.tsx', 'apps/cad-studio/src/chat/images.ts'];
const bundled = await build({
  entryPoints: { server: join(app, 'server/chatServer.ts'), mcp: join(app, 'server/cadMcp.ts') },
  absWorkingDir: repo, outdir: output, outExtension: { '.js': '.mjs' }, platform: 'node', target: 'node22', format: 'esm',
  bundle: true, metafile: true, write: false, logLevel: 'warning',
});
const dependencies = Object.keys(bundled.metafile.inputs);
const f = await createFlow({
  output, name: 'drawing-image-intake', envFrozen: capacity ? 'D599_SOURCE_FROZEN' : 'D598_SOURCE_FROZEN', initialFiles: [...pins, ...dependencies],
  requiredFrozen: pins, qualification: 'Desktop image attachment through the real local Chat server and read-only MCP calls',
  limits: ['The CLI fixture records provider input and calls the real MCP tools. Live model interpretation is outside this control.'],
});
for (const file of bundled.outputFiles) await writeFile(file.path, file.contents);
const { createChatServer } = await import(pathToFileURL(join(output, 'server.mjs')).href);
const capture = join(output, 'capture.jsonl'), wrapper = join(output, 'record-scripted-claude.mjs');
const wrapperSource = `#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { appendFileSync, readFileSync } from 'node:fs';
const args = process.argv.slice(2), data = [];
for await (const chunk of process.stdin) data.push(chunk);
const bytes = Buffer.concat(data);
if (args[0] !== '--version') {
  const statePath = JSON.parse(args[args.indexOf('--mcp-config') + 1]).mcpServers.cad.env.CAD_CHAT_STATE;
  const { images, turns } = JSON.parse(readFileSync(statePath, 'utf8'));
  appendFileSync(${JSON.stringify(capture)}, JSON.stringify({ input: JSON.parse(bytes), images, turns, resume: args.includes('--resume') ? args[args.indexOf('--resume') + 1] : null }) + '\\n');
}
const child = spawn(process.execPath, [${JSON.stringify(join(repo, scripted))}, ...args], { stdio: ['pipe', 'pipe', 'inherit'] });
const closed = once(child, 'close');
process.on('SIGTERM', () => child.kill('SIGTERM'));
child.stdin.end(bytes);
const result = [];
for await (const chunk of child.stdout) { result.push(chunk); process.stdout.write(chunk); }
const [code] = await closed;
if (args[0] !== '--version') appendFileSync(${JSON.stringify(capture)}, JSON.stringify({ output: Buffer.concat(result).toString().trim().split('\\n').map(line => JSON.parse(line)) }) + '\\n');
process.exitCode = code ?? 1;
`;
await writeFile(wrapper, wrapperSource, { mode: 0o700, flag: 'wx' });

const server = createServer();
server.listen(0, '127.0.0.1');
await once(server, 'listening');
process.env.CAD_STUDIO_CHAT_PORT = String(server.address().port);
for (const key of ['CAD_SCRIPTED_COST_USD', 'CAD_SCRIPTED_SLEEP_MS', 'CAD_SCRIPTED_MARK', 'CAD_AB_LOG', 'CAD_STUDIO_TEAM_LIBRARIES']) delete process.env[key];
const drawingA = await readFile(join(repo, drawingPath), 'utf8');
const drawingB = drawingA.replace('Rev A', 'Rev B').replace('REV A', 'REV B').replace('The 6 mm through', 'The 8 mm through')
  .replace('Ø6 mm THRU', 'Ø8 mm THRU').replace('r="15"', 'r="20"').replace('M245 192V212 M275 192V212', 'M240 192V212 M280 192V212');

const filename = 'angle-bracket.png';
const button = name => f.page.getByRole('button', { name, exact: true });
const pending = () => f.page.locator('[aria-label="Attached images"] img');
const imageLayers = image => ({ tool: 'image', args: { action: 'layers', ...(image === undefined ? {} : { image }) } });

async function raster(svg) {
  const encoded = await f.page.evaluate(async svg => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 480;
      canvas.height = 440;
      canvas.getContext('2d').drawImage(image, 0, 0, 480, 440);
      return canvas.toDataURL('image/png').split(',')[1];
    } finally { URL.revokeObjectURL(url); }
  }, svg);
  return Buffer.from(encoded, 'base64');
}

async function attachFiles(files) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Attach image').click()]);
  await chooser.setFiles(files.map(({ name, buffer }) => ({ name, mimeType: 'image/png', buffer })));
}

async function attach(buffer, name = filename) {
  await attachFiles([{ name, buffer }]);
}

const promptFor = (description, calls) => description + ' script ' + JSON.stringify({ calls });
const chatInput = () => f.page.getByRole('textbox', { name: 'Chat message', exact: true });
const isTurn = response => new URL(response.url()).pathname === '/api/chat/turn' && response.request().method() === 'POST';

async function requestTurn(prompt) {
  await chatInput().fill(prompt);
  const [response] = await Promise.all([f.page.waitForResponse(isTurn), button('Send').click()]);
  return response;
}

async function turn(description, calls) {
  const prompt = promptFor(description, calls);
  return readTurn(await requestTurn(prompt), description, calls);
}

async function readTurn(response, description, calls) {
  const prompt = promptFor(description, calls);
  assert.equal(response.status(), 200);
  const events = (await response.text()).split('\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)));
  assert.equal(events.at(-1)?.end, 'done');
  assert.equal(events.at(-1)?.doc, undefined);
  assert.equal(events.filter(event => event.type === 'tool').length, calls.length);
  await button('Send').waitFor();
  const lines = (await readFile(capture, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  const [record, result] = lines.slice(-2);
  const tools = result.output.filter(event => event.type === 'user').flatMap(event => event.message.content)
    .map(({ content, is_error }) => ({ result: JSON.parse(content[0].text), error: !!is_error }));
  const request = response.request().postDataJSON();
  const sent = record.input.message.content.filter(block => block.type === 'image').map(({ source: { media_type, data } }) => ({ media_type, data }));
  assert.deepEqual(sent, request.images ?? []);
  assert.deepEqual(record.images ?? [], request.traces ?? []);
  assert.deepEqual(record.turns, request.turns);
  assert.match(record.input.message.content.at(-1).text, new RegExp(description));
  return { record, request, tools, prompt };
}

function checkAttachment(turn, data, index) {
  const image = { media_type: 'image/png', data };
  assert.deepEqual(turn.request.images, [image]);
  assert.ok(turn.request.text.includes(`image ${index} (${filename}, traced into `));
  assert.equal(turn.record.images.length, index);
}

async function checkCapacity(a, b, original) {
  f.phase = 'fill the real conversation to 16 image traces';
  const revisions = [a, b], accepted = [];
  let full, first;
  for (let start = 0; start < 16; start += 4) {
    const files = Array.from({ length: 4 }, (_, i) => {
      const index = start + i;
      return { buffer: revisions[index % 2], name: `drawing-${index + 1}.png` };
    });
    await attachFiles(files);
    await pending().nth(3).waitFor();
    const calls = start === 0 ? [imageLayers(1)] : start === 12 ? [imageLayers(1), imageLayers(16), imageLayers()] : [];
    full = await turn(`Read drawing group ${start / 4 + 1}.`, calls);
    assert.deepEqual(full.request.images, files.map(({ buffer }) => ({ media_type: 'image/png', data: buffer.toString('base64') })));
    for (const { name } of files) {
      assert.ok(full.request.text.includes(`image ${accepted.length + 1} (${name}, traced into `));
      accepted.push(name);
    }
    assert.equal(full.record.images.length, accepted.length);
    if (start === 0) first = full.tools[0];
  }
  assert.deepEqual(full.tools.map(tool => tool.error), [false, false, false]);
  assert.deepEqual(full.tools[0], first);
  assert.deepEqual(full.tools[1], full.tools[2]);
  assert.notDeepEqual(full.tools[0], full.tools[1]);
  await f.snapshot('01-sixteen-accepted');

  f.phase = 'refuse a seventeenth image without dispatch and keep the typed draft';
  const rejectedName = 'drawing-17.png', rejectedText = 'Keep this draft if the drawing is refused.';
  await attach(a, rejectedName);
  await pending().waitFor();
  const attempted = [];
  const observeAttempt = response => { if (isTurn(response)) attempted.push(response); };
  f.page.on('response', observeAttempt);
  let notice;
  try {
    await chatInput().fill(rejectedText);
    await button('Send').click();
    const message = f.page.locator('.chat-log').getByText(/image traces|16 images/i).last();
    await message.waitFor();
    notice = await message.textContent();
  } finally { f.page.off('response', observeAttempt); }
  const draft = await chatInput().inputValue();
  const stillPending = await pending().count();
  await f.snapshot('02-overflow-refusal');
  if (stillPending) await button('Remove ' + rejectedName).click();

  f.phase = 'text-only retry keeps image 1 and image 16 with the original session';
  const calls = [imageLayers(1), imageLayers(16), imageLayers(), imageLayers(17)];
  const retry = await requestTurn(promptFor(rejectedText, calls));
  const observed = {
    overflowStatus: attempted[0]?.status() ?? null,
    overflowTraceCount: attempted[0]?.request().postDataJSON().traces?.length ?? null,
    followUpStatus: retry.status(), followUpTraceCount: retry.request().postDataJSON().traces.length,
    notice, draft, stillPending,
  };
  f.report.observations.push(observed);
  await f.snapshot('03-text-after-overflow');
  assert.deepEqual(
    [observed.overflowStatus, observed.overflowTraceCount, observed.followUpStatus, observed.followUpTraceCount, draft, stillPending],
    [null, null, 200, 16, rejectedText, 1],
  );
  assert.match(notice, /start a new conversation/i);
  const follow = await readTurn(retry, rejectedText, calls);
  assert.deepEqual(follow.record.images, full.record.images);
  assert.deepEqual(follow.record.turns, [...full.record.turns, follow.prompt]);
  assert.equal(follow.record.resume, 'scripted');
  assert.equal(follow.request.images, undefined);
  assert.deepEqual(follow.tools.slice(0, 3), full.tools);
  assert.equal(follow.tools[3].error, true);

  f.phase = 'new conversation can attach an image again at index 1';
  await button('New conversation').click();
  await attach(b);
  await pending().waitFor();
  const fresh = await turn('Read the first drawing of the new conversation.', [imageLayers(1)]);
  checkAttachment(fresh, b.toString('base64'), 1);
  assert.equal(fresh.record.resume, null);
  assert.deepEqual(fresh.record.turns, [fresh.prompt]);
  assert.deepEqual(fresh.tools[0], full.tools[1]);
  await f.same(original);
  await f.snapshot('04-new-conversation');
}

try {
  await f.run(async () => {
    const origin = new URL(f.server.resolvedUrls.local[0]).origin;
    const handler = createChatServer({ claude: wrapper, mcpScript: join(output, 'mcp.mjs'), workDir: join(output, 'chat-work'), origins: [origin], model: 'offline-capture' });
    server.on('request', (request, response) => { void handler(request, response); });
    const newContext = f.browser.newContext.bind(f.browser);
    f.browser.newContext = async options => {
      const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
        return url.origin === origin ? route.continue() : route.abort();
      });
      await context.addInitScript(() => {
        const decode = window.createImageBitmap.bind(window);
        window.createImageBitmap = async (file, ...args) => {
          if (file?.name !== 'delayed-angle-bracket.png') return decode(file, ...args);
          let decoded;
          const done = new Promise(resolve => { decoded = resolve; });
          await new Promise(resume => {
            window.releaseDrawingDecode = async () => {
              resume();
              await done;
              await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            };
          });
          try { return await decode(file, ...args); }
          finally { decoded(); }
        };
      });
      return context;
    };
    await f.newPage();
    const original = await f.doc();
    await button('Chat').click();
    await f.page.waitForFunction(() => document.querySelector('[aria-label="Chat message"]')?.disabled === false);
    const a = await raster(drawingA), b = await raster(drawingB);
    assert.notEqual(sha256(a), sha256(b));
    await writeFile(join(output, 'rev-a.png'), a);
    await writeFile(join(output, 'rev-b.png'), b);
    if (capacity) {
      await checkCapacity(a, b, original);
      assert.deepEqual(f.report.downloads, []);
      return;
    }
    f.phase = 'desktop sends revision A to the local provider and trace tool';
    await attach(a);
    await pending().waitFor();
    const sourceA = (await pending().getAttribute('src')).split(',')[1];
    assert.equal(sourceA, a.toString('base64'));
    const first = await turn('Read drawing Rev A.', [imageLayers()]);
    checkAttachment(first, sourceA, 1);
    assert.equal(first.record.resume, null);
    assert.deepEqual(first.request.turns, [first.prompt]);
    assert.equal(first.tools[0].error, false);
    await f.snapshot('01-rev-a');

    f.phase = 'desktop sends revision B with the same filename and keeps both trace indexes';
    await attach(b);
    await pending().waitFor();
    const sourceB = (await pending().getAttribute('src')).split(',')[1];
    assert.equal(sourceB, b.toString('base64'));
    const second = await turn('Read drawing Rev B.', [imageLayers(), imageLayers(1), imageLayers(2)]);
    checkAttachment(second, sourceB, 2);
    assert.equal(second.record.resume, 'scripted');
    assert.deepEqual(second.request.turns, [first.prompt, second.prompt]);
    assert.deepEqual(second.record.images[0], first.record.images[0]);
    assert.notDeepEqual(second.record.images[1], first.record.images[0]);
    assert.deepEqual(second.tools.map(tool => tool.error), [false, false, false]);
    assert.deepEqual(second.tools[0], second.tools[2]);
    assert.deepEqual(second.tools[1], first.tools[0]);
    assert.notDeepEqual(second.tools[0], first.tools[0]);
    f.report.observations.push({ rasterHashes: [sha256(a), sha256(b)], traceHashes: second.record.images.map(trace => sha256(JSON.stringify(trace))), toolCalls: 4 });
    await f.snapshot('02-rev-b');

    f.phase = 'new conversation clears the prior image draft and pending decode';
    await attach(a);
    await pending().waitFor();
    await attach(b, 'delayed-angle-bracket.png');
    await f.page.waitForFunction(() => typeof window.releaseDrawingDecode === 'function');
    await f.snapshot('03-before-reset');
    await button('New conversation').click();
    const immediately = await pending().count();
    await f.page.evaluate(() => window.releaseDrawingDecode());
    // A current attachment completes after the old decode was released. The pending list must contain only the current one.
    await attach(a, 'current-angle-bracket.png');
    await pending().and(f.page.getByRole('img', { name: 'current-angle-bracket.png', exact: true })).waitFor();
    await f.snapshot('04-after-reset');
    const names = await pending().evaluateAll(images => images.map(image => image.alt));
    f.report.observations.push({ immediately, names });
    assert.deepEqual({ immediately, names }, { immediately: 0, names: ['current-angle-bracket.png'] });
    await button('Remove current-angle-bracket.png').click();
    const fresh = await turn('Read only the new conversation.', [imageLayers()]);
    assert.deepEqual(fresh.request.turns, [fresh.prompt]);
    assert.equal(fresh.record.resume, null);
    assert.equal(fresh.request.images, undefined);
    assert.equal(fresh.record.images, undefined);
    assert.equal(fresh.tools[0].error, true);
    assert.match(fresh.tools[0].result.error, /no .*image/i);
    await f.same(original);
    await f.snapshot('05-fresh-turn');
    assert.deepEqual(f.report.downloads, []);
  });
} finally {
  server.closeAllConnections();
  const stopped = once(server, 'close');
  server.close();
  await stopped;
}
