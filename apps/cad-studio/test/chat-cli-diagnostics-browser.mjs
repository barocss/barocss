import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2), repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.ok(mode === undefined || mode === '--transcript-baseline' || mode === '--transcript');

const probe = createServer();
probe.listen(0, '127.0.0.1');
await once(probe, 'listening');
process.env.CAD_STUDIO_CHAT_PORT = String(probe.address().port);
await new Promise((done, reject) => probe.close(error => error ? reject(error) : done()));

const source = [
  'apps/cad-studio/scripts/chat-server.mjs',
  'apps/cad-studio/server/chatServer.ts',
  'apps/cad-studio/src/chat/client.ts',
  'apps/cad-studio/src/chat/transport.ts',
  'apps/cad-studio/src/chat/useStudioChat.ts',
  'apps/cad-studio/src/ui/ChatPanel.tsx',
  ...(mode === '--transcript' ? ['apps/cad-studio/src/chat/localPathDisplay.ts'] : []),
];
const f = await createFlow({
  name: 'chat-cli-diagnostics', envFrozen: 'D649_SOURCE_FROZEN', output,
  qualification: mode ? 'D649 follow-up: local paths in the desktop Studio transcript' : 'D649 path-free local CLI diagnostics',
  limits: ['The fixture supplies CLI output to the actual Studio server. No external model is called.'],
  initialFiles: source, requiredFrozen: source,
});

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };

  const marker = '/Users/studio-test/Private CAD/session/state.json';
  const windows = String.raw`C:\Users\studio-test\Private CAD\source.bcad`;
  const linux = '/home/studio-test/secret/review.json';
  const url = 'https://cad.example.com/home/docs/review.json';
  const relativeFile = 'outputs/bom.json';
  const fixture = join(output, 'scripted-cli.mjs');
  const fixtureSource = `#!/usr/bin/env node
if (process.argv.includes('--version')) {
  console.log('2.1.283 (Claude Code)');
} else {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const event = value => console.log(JSON.stringify(value));
  const marker = ${JSON.stringify(marker)};
  const windows = ${JSON.stringify(windows)};
  const linux = ${JSON.stringify(linux)};
  const url = ${JSON.stringify(url)};
  const relativeFile = ${JSON.stringify(relativeFile)};
  if (input.includes('D649-result')) {
    event({ type: 'result', subtype: 'error_during_execution', is_error: true, result: 'Could not open ' + marker });
  } else if (input.includes('D649-stderr')) {
    console.error('ENOENT: open ' + marker);
    process.exitCode = 2;
  } else if (input.includes('D649-cap')) {
    event({ type: 'result', subtype: 'error_max_turns', is_error: true });
  } else if (input.includes('D649-transcript')) {
    if (!input.includes(linux)) process.exit(3);
    const delta = value => event({ type: 'stream_event', event: { type: 'content_block_delta', delta: value } });
    delta({ type: 'thinking_delta', thinking: 'Checking "' + windows + '".' });
    delta({ type: 'text_delta', text: 'Opened ' + marker.slice(0, 14) });
    delta({ type: 'text_delta', text: marker.slice(14) + '. See ' + url + ' and ' + relativeFile + '.' });
    event({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'call-1', name: 'mcp__cad__requirements', input: { action: 'plan_tasks', files: [windows, linux, relativeFile] } }] } });
    event({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'call-1', is_error: true, content: JSON.stringify({ error: 'Open failed: ' + marker }) }] } });
    event({ type: 'result', subtype: 'success', is_error: false });
  } else {
    event({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'The bore is 6.35 mm.' } } });
    event({ type: 'result', subtype: 'success', is_error: false });
  }
}
`;
  await writeFile(fixture, fixtureSource, { mode: 0o700, flag: 'wx' });
  const button = name => f.page.getByRole('button', { name, exact: true });
  const input = () => f.page.getByRole('textbox', { name: 'Chat message', exact: true });
  const chat = () => f.page.getByRole('complementary', { name: 'Chat', exact: true });

  async function withServer(executable, body) {
    const child = spawn(process.execPath, [join(f.app, 'scripts/chat-server.mjs')], {
      cwd: f.app,
      env: { ...process.env, CAD_STUDIO_CLAUDE: executable, CAD_STUDIO_CHAT_ORIGINS: origin,
        CAD_STUDIO_TASK_RUN_DIR: join(output, 'runs') },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const closed = once(child, 'close');
    let stdout = '', stderr = '';
    const ready = new Promise(done => child.stdout.on('data', chunk => {
      stdout += chunk;
      if (stdout.includes('chat server on')) done(true);
    }));
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-8000); });
    try {
      assert.ok(await Promise.race([ready, closed.then(() => false), new Promise(done => setTimeout(() => done(false), 15000).unref())]));
      return await body();
    } finally {
      child.kill('SIGTERM');
      await closed;
      await writeFile(join(output, executable === fixture ? 'online-server.log' : 'offline-server.log'), stdout + stderr);
    }
  }

  async function openChat() {
    await f.newPage();
    if (!(await input().isVisible())) await button('Chat').first().click();
  }

  f.phase = 'show the unavailable CLI status in Studio';
  const missing = join(output, 'Private CAD', 'missing-claude');
  await withServer(missing, async () => {
    await openChat();
    await f.page.getByText('Chat is off.', { exact: true }).waitFor();
    const status = await f.page.evaluate(() => fetch('/api/chat/status').then(reply => reply.json()));
    const statusText = await chat().innerText();
    assert.equal(status.enabled, false);
    assert.match(statusText, /claude auth login/);
    assert.equal(status.reason.includes(missing), false);
    assert.equal(statusText.includes(missing), false);
    f.report.observations.push({ case: 'unavailable-cli', visiblePath: false, statusEnabled: false });
    await f.snapshot('01-cli-unavailable');
  });

  await withServer(fixture, async () => {
    await openChat();
    await input().waitFor();
    await f.page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled);
    const doc = await f.doc();
    const pending = () => f.page.waitForResponse(r => new URL(r.url()).pathname === '/api/chat/turn' && r.request().method() === 'POST');
    for (const [key, expected, label] of [
      ['result', 'Claude Code could not complete the turn. Try again or check the local chat server log.', '02-cli-result'],
      ['stderr', 'Claude Code stopped before completing the turn. Try again or check the local chat server log.', '03-cli-exit'],
      ['cap', 'Stopped after 24 steps.', '04-step-cap'],
      ['success', 'The bore is 6.35 mm.', '05-next-turn'],
    ]) {
      f.phase = label;
      const response = pending();
      await input().fill('D649-' + key);
      await input().press('Enter');
      const wire = await (await response).text();
      const done = wire.split('\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6))).at(-1);
      await chat().getByText(expected, { exact: true }).waitFor();
      assert.equal(wire.includes(marker), false);
      assert.equal((await chat().innerText()).includes(marker), false);
      assert.equal(done.end, key === 'success' ? 'done' : 'error');
      assert.equal(done.error, key === 'success' ? undefined : expected);
      await f.same(doc);
      f.report.observations.push({ case: key, turnEnd: done.end, visiblePath: false, wirePath: false, modelPreserved: true });
      await f.snapshot(label);
    }
    if (mode) {
      f.phase = 'show assistant, tool and user text with local paths';
      const response = pending();
      await input().fill('D649-transcript ' + linux);
      await input().press('Enter');
      const wire = await (await response).text();
      const wireEvents = wire.split('\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)));
      assert.equal(wireEvents.at(-1).end, 'done');
      assert.deepEqual(wireEvents.find(event => event.type === 'tool').input.files, [windows, linux, relativeFile]);
      const thinking = chat().locator('[data-slot="reasoning"]');
      const tool = chat().locator('[data-slot="tool"]');
      await thinking.locator('summary').click();
      await tool.locator('summary').click();
      const transcript = await chat().innerText();
      const hidden = !['/Users/studio-test', '/home/studio-test', 'C:\\Users', 'Private CAD', 'secret/review.json'].some(part => transcript.includes(part));
      assert.equal(hidden, mode === '--transcript');
      if (mode === '--transcript') {
        assert.match(transcript, /Opened …\/state\.json\./);
        assert.match(transcript, /Checking "…\/source\.bcad"\./);
        assert.match(transcript, /Open failed: …\/state\.json/);
        assert.match(transcript, /D649-transcript …\/review\.json/);
        assert.match(await tool.locator('code').innerText(), /\["…\/source\.bcad","…\/review\.json","outputs\/bom\.json"\]/);
      }
      assert.ok(transcript.includes(url));
      assert.ok(transcript.includes(relativeFile));
      await f.same(doc);
      f.report.observations.push({ case: 'transcript', hidden, filenamesRetained: mode === '--transcript', linksPreserved: true, originalToolInputPreserved: true, modelPreserved: true });
      await f.snapshot('06-paths-in-transcript');
    }
  });
  const localLog = await readFile(join(output, 'online-server.log'), 'utf8');
  assert.ok(localLog.includes('Could not open ' + marker));
  assert.ok(localLog.includes('ENOENT: open ' + marker));
  assert.deepEqual(f.report.downloads, []);
});
