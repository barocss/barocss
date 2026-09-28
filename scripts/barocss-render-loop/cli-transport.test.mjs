import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { createCliGenerator } from './cli-transport.mjs';
import { PRIVATE_ROOT } from './cli-profile.mjs';
import { INITIAL } from '../barocss-render-prototype/fixture.mjs';

const threadId = '11111111-2222-4333-8444-555555555555';
const nodeBin = '/Users/user/Library/pnpm/nodejs/22.19.0/bin';

test('fake process proves fixed initial/resume argv, two-call ceiling and private success lineage', async () => {
  const cwd = fs.mkdtempSync(path.join(PRIVATE_ROOT, 'agent-scratch-460-test-'));
  const codexHome = fs.mkdtempSync(path.join(PRIVATE_ROOT, '.codex-home-460-test-'));
  const outputDir = fs.mkdtempSync(path.join(PRIVATE_ROOT, 'private-460-test-'));
  const home = path.join(cwd, 'home');
  const schemaPath = path.join(cwd, 'schema.json');
  const calls = [];
  fs.mkdirSync(home);
  fs.copyFileSync(path.join(import.meta.dirname, 'output.schema.json'), schemaPath);
  function fakeSpawn(cliPath, argv, options) {
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
    child.kill = () => { child.stdout.end(); child.stderr.end(); setImmediate(() => child.emit('close', null)); };
    const finalPath = argv[argv.indexOf('--output-last-message') + 1];
    let prompt = '';
    child.stdin.on('data', (chunk) => { prompt += chunk; });
    child.stdin.on('finish', () => {
      calls.push({ cliPath, argv, options, prompt });
      const final = JSON.stringify({ specJson: JSON.stringify(INITIAL) });
      fs.writeFileSync(finalPath, `${final}\n`);
      child.stdout.end([JSON.stringify({ type: 'thread.started', thread_id: threadId }),
        JSON.stringify({ type: 'turn.started' }),
        JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: final } }),
        JSON.stringify({ type: 'turn.completed' }), ''].join('\n'));
      child.stderr.end('diagnostic without credentials\n');
      setImmediate(() => child.emit('close', 0));
    });
    return child;
  }
  try {
    const generate = createCliGenerator({ cliPath: `${nodeBin}/codex`, cwd, home, codexHome,
      nodeBin, schemaPath, outputDir, spawnProcess: fakeSpawn });
    const first = await generate({ kind: 'initial', prompt: 'Profile form' });
    assert.equal(first.threadId, threadId);
    const next = await generate({ kind: 'next', threadId, action: 'save', revision: 1,
      input: { name: 'Bea' } });
    assert.equal(next.threadId, threadId);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].argv[0], 'exec');
    assert.deepEqual(calls[1].argv.slice(0, 2), ['exec', 'resume']);
    assert.equal(calls[1].argv.at(-2), threadId);
    assert.equal(calls[1].options.cwd, cwd);
    assert.equal(calls[1].options.env.CODEX_HOME, codexHome);
    assert.equal(Object.hasOwn(calls[1].options.env, 'OPENAI_API_KEY'), false);
    assert.deepEqual(JSON.parse(calls[1].prompt).input, { name: 'Bea' });
    for (const kind of ['initial', 'next']) {
      const dispatch = JSON.parse(fs.readFileSync(path.join(outputDir, `${kind}-dispatch.json`)));
      const result = JSON.parse(fs.readFileSync(path.join(outputDir, `${kind}-result.json`)));
      assert.equal(dispatch.dispatchNumber, kind === 'initial' ? 1 : 2);
      assert.equal(result.exitCode, 0);
      assert.equal(result.threadId, threadId);
      assert.match(fs.readFileSync(path.join(outputDir, `${kind}-stdout.jsonl`), 'utf8'), /thread.started/);
      assert.match(fs.readFileSync(path.join(outputDir, `${kind}-stderr.txt`), 'utf8'), /diagnostic/);
    }
    await assert.rejects(() => generate({ kind: 'initial', prompt: 'Retry' }), /dispatch ceiling/);
    assert.equal(calls.length, 2);
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.rmSync(codexHome, { recursive: true, force: true });
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('unexpected CLI tool is stopped and its failure evidence stays private', async () => {
  const cwd = fs.mkdtempSync(path.join(PRIVATE_ROOT, 'agent-scratch-460-test-'));
  const codexHome = fs.mkdtempSync(path.join(PRIVATE_ROOT, '.codex-home-460-test-'));
  const outputDir = fs.mkdtempSync(path.join(PRIVATE_ROOT, 'private-460-test-'));
  const home = path.join(cwd, 'home');
  const schemaPath = path.join(cwd, 'schema.json');
  fs.mkdirSync(home);
  fs.copyFileSync(path.join(import.meta.dirname, 'output.schema.json'), schemaPath);
  let spawns = 0;
  function fakeSpawn() {
    spawns++;
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
    child.kill = () => { child.stdout.end(); child.stderr.end(); setImmediate(() => child.emit('close', null)); };
    child.stdin.on('finish', () => child.stdout.write(`${JSON.stringify({ type: 'item.started',
      item: { type: 'command_execution', command: 'echo forbidden' } })}\n`));
    return child;
  }
  try {
    const generate = createCliGenerator({ cliPath: `${nodeBin}/codex`, cwd, home, codexHome,
      nodeBin, schemaPath, outputDir, spawnProcess: fakeSpawn });
    await assert.rejects(() => generate({ kind: 'initial', prompt: 'Profile form' }), /unexpected-cli-tool/);
    assert.equal(spawns, 1);
    const result = JSON.parse(fs.readFileSync(path.join(outputDir, 'initial-result.json')));
    assert.equal(result.stopReason, 'unexpected-cli-tool');
    assert.match(fs.readFileSync(path.join(outputDir, 'initial-stdout.jsonl'), 'utf8'), /command_execution/);
    await assert.rejects(() => generate({ kind: 'initial', prompt: 'Retry' }), /Invalid CLI turn order/);
    assert.equal(spawns, 1);
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.rmSync(codexHome, { recursive: true, force: true });
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
