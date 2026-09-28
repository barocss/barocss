import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { buildCliArgv, buildCliPrompt, BUTTON_EXAMPLE, CLI_VERSION, MAX_DISPATCHES,
  PROMPT_VERSION, PROMPT_CONTRACT_SHA256,
  PER_CALL_TIMEOUT_MS, TOTAL_TIMEOUT_MS } from './cli-profile.mjs';
import { validateSpec } from '../../packages/barocss-render/src/contract.mjs';
import { INITIAL } from '../barocss-render-prototype/fixture.mjs';

const cwd = '/Users/user/.barocss-ai/v3/agent-scratch-460-example';
const schemaPath = `${cwd}/schema.json`;
const outputDir = '/Users/user/.barocss-ai/v3/private-460-example';
const threadId = '11111111-2222-4333-8444-555555555555';

test('initial and resumed CLI arguments keep the same isolated boundary', () => {
  const initial = buildCliArgv({ kind: 'initial', cwd, schemaPath, finalPath: `${outputDir}/initial-final.txt` });
  const next = buildCliArgv({ kind: 'next', cwd, schemaPath, finalPath: `${outputDir}/next-final.txt`, threadId });
  assert.equal(CLI_VERSION, '0.156.1');
  assert.equal(MAX_DISPATCHES, 2);
  assert.equal(PER_CALL_TIMEOUT_MS, 180_000);
  assert.equal(TOTAL_TIMEOUT_MS, 360_000);
  assert.equal(initial[0], 'exec');
  assert.equal(next.slice(0, 2).join(' '), 'exec resume');
  for (const args of [initial, next]) {
    assert(args.includes('--ignore-user-config'));
    assert(args.includes('--strict-config'));
    assert(args.includes('--json'));
    assert(args.includes('--output-schema'));
    assert(args.includes(schemaPath));
    assert(args.includes('mcp_servers={}'));
    assert(args.includes('web_search="disabled"'));
    assert(args.includes('shell_environment_policy.inherit=none'));
    assert(args.includes('suppress_unstable_features_warning=true'));
    assert(args.some((arg) => arg.endsWith('.network.enabled=false')));
    assert.equal(args.includes('--ephemeral'), false);
    assert.equal(args.at(-1), '-');
  }
  assert(initial.includes('--cd'));
  assert.equal(next.includes('--cd'), false);
  assert.equal(next.at(-2), threadId);
});

test('browser input cannot change CLI arguments or output locations', () => {
  assert.throws(() => buildCliArgv({ kind: 'next', cwd, schemaPath,
    finalPath: `${outputDir}/next-final.txt`, threadId: '../../other-session' }), /session ID/);
  assert.throws(() => buildCliArgv({ kind: 'initial', cwd: '/tmp/agent-scratch-460-bad',
    schemaPath, finalPath: `${outputDir}/initial-final.txt` }), /scratch location/);
  assert.throws(() => buildCliArgv({ kind: 'initial', cwd, schemaPath,
    finalPath: '/tmp/output.txt' }), /private V3/);
  const initialPrompt = buildCliPrompt({ kind: 'initial', prompt: 'Show a profile form' });
  const instruction = JSON.parse(initialPrompt).contract;
  assert.equal(JSON.parse(initialPrompt).contractVersion, PROMPT_VERSION);
  assert.match(PROMPT_CONTRACT_SHA256, /^[0-9a-f]{64}$/);
  assert.match(instruction, /Button\.on is a sibling of props and children, never inside props/);
  assert(instruction.includes(JSON.stringify(BUTTON_EXAMPLE)));
  const validExample = structuredClone(INITIAL);
  validExample.elements.save = BUTTON_EXAMPLE;
  assert.equal(validateSpec(validExample).ok, true);
  const nextPrompt = buildCliPrompt({ kind: 'next', action: 'save', revision: 1, input: { name: 'Bea' } });
  assert.equal(JSON.parse(initialPrompt).request, 'Show a profile form');
  assert.deepEqual(JSON.parse(nextPrompt).input, { name: 'Bea' });
  assert.throws(() => buildCliPrompt({ kind: 'next', action: 'fetch', revision: 1,
    input: { name: 'Bea' } }), /Invalid CLI prompt input/);
});

test('installed CLI parses the exact initial and resume options without dispatching a model', () => {
  const cliPath = '/Users/user/Library/pnpm/nodejs/22.19.0/bin/codex';
  assert.equal(execFileSync(cliPath, ['--version'], { encoding: 'utf8' }).trim(), `codex-cli ${CLI_VERSION}`);
  for (const kind of ['initial', 'next']) {
    const args = buildCliArgv({ kind, cwd, schemaPath, finalPath: `${outputDir}/${kind}-final.txt`,
      ...(kind === 'next' ? { threadId } : {}) });
    const help = execFileSync(cliPath, [...args.slice(0, -1), '--help'], { encoding: 'utf8' });
    assert.match(help, kind === 'initial' ? /Run Codex non-interactively/ : /Resume a previous session/);
    assert.match(help, /--output-schema/);
  }
});
