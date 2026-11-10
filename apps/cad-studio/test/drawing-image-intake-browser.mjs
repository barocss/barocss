import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output] = process.argv.slice(2), repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
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
  output, name: 'drawing-image-intake', envFrozen: 'D598_SOURCE_FROZEN', initialFiles: [...pins, ...dependencies],
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

async function attach(buffer, name = filename) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Attach image').click()]);
  await chooser.setFiles({ name, mimeType: 'image/png', buffer });
}

async function turn(description, calls) {
  const prompt = description + ' script ' + JSON.stringify({ calls });
  const input = f.page.getByRole('textbox', { name: 'Chat message', exact: true });
  await input.fill(prompt);
  const [response] = await Promise.all([
    f.page.waitForResponse(r => new URL(r.url()).pathname === '/api/chat/turn' && r.request().method() === 'POST'),
    button('Send').click(),
  ]);
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
