import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { capture } from './capture.mjs';
import { stubTransport } from './stub.mjs';
import { verifyFrozen } from './freeze.mjs';
import { verifyAgentFrozen } from './agent-freeze.mjs';
import { verifyCapture } from './provenance.mjs';
import { buildAgentArgv } from './agent-profile.mjs';
import { verifyAgentCapture } from './agent-provenance.mjs';
import { scoreAgentSaved } from './agent-consumers.mjs';
import { agentLiveTransport } from './agent-live.mjs';
import { CLI_VERSION, MAX_ATTEMPTS } from './plan.mjs';

const sha = (value) => createHash('sha256').update(value).digest('hex');
const privateRoot = '/Users/user/.barocss-ai/v3/private-458';

test('CLI agent route verifies all saved commands, launch settings, and 24 stub cells', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'baro-458-agent-route-'));
  const outputDir = path.join(root, 'capture');
  const cwd = '/Users/user/.barocss-ai/v3/agent-scratch-458-synthetic';
  const schemaPath = path.join(cwd, 'schema.json');
  const stub = stubTransport('valid');
  try {
    const transport = async (request) => {
      const result = await stub(request);
      const events = [
        { type: 'thread.started', threadId: 'stub' },
        { type: 'item.completed', itemType: 'command_execution', command: 'pwd', exitCode: 0, outputBytes: 8, outputSha256: sha('/scratch') },
        { type: 'item.completed', itemType: 'agent_message', textSha256: sha(result.rawFinal), textBytes: Buffer.byteLength(result.rawFinal) },
        { type: 'turn.completed', usage: result.usage },
      ];
      fs.writeFileSync(path.join(request.attemptDir, 'events.jsonl'), events.map((event) => JSON.stringify(event)).join('\n') + '\n');
      return { ...result, cliVersion: CLI_VERSION, reasoningRequested: 'high', eventCount: events.length,
        argv: buildAgentArgv({ cwd, schemaPath, finalPath: path.join(request.attemptDir, 'raw-final.txt') }),
        environmentKeys: ['CODEX_HOME', 'HOME', 'LANG', 'NO_COLOR', 'PATH', 'TERM'] };
    };
    const rows = await capture({ outputDir, transport, planHash: verifyFrozen(), synthetic: false });
    assert.equal(rows.length, MAX_ATTEMPTS);
    fs.writeFileSync(path.join(outputDir, 'agent-route.json'), JSON.stringify({ kind: 'barocss-458-cli-agent',
      agentPlanSha256: verifyAgentFrozen(), basePlanSha256: verifyFrozen(), scheduled: MAX_ATTEMPTS, attempted: MAX_ATTEMPTS }) + '\n');
    const verified = verifyAgentCapture(outputDir);
    assert.equal(Object.values(verified.toolUse).reduce((sum, count) => sum + count, 0), MAX_ATTEMPTS);
    assert.equal(scoreAgentSaved(outputDir).scoring.length, MAX_ATTEMPTS);
    const transportPath = path.join(outputDir, 'attempt-00', 'transport.json');
    const saved = fs.readFileSync(transportPath);
    const altered = JSON.parse(saved);
    altered.argv[altered.argv.indexOf('default_permissions="baro-458-isolated"')] = 'default_permissions="wrong"';
    fs.writeFileSync(transportPath, JSON.stringify(altered));
    assert.equal(verifyCapture(outputDir).rows.length, MAX_ATTEMPTS);
    assert.throws(() => scoreAgentSaved(outputDir), /CLI agent launch drift/);
    fs.writeFileSync(transportPath, saved);
    const eventPath = path.join(outputDir, 'attempt-00', 'events.jsonl');
    fs.chmodSync(eventPath, 0o600);
    fs.writeFileSync(eventPath, fs.readFileSync(eventPath, 'utf8').replace('command_execution', 'file_change'));
    assert.throws(() => verifyAgentCapture(outputDir), /Unknown agent item/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('live CLI route rejects missing Review acceptance before any claim or output', () => {
  const existed = fs.existsSync(privateRoot);
  if (!existed) fs.mkdirSync(privateRoot, { mode: 0o700 });
  const outputDir = path.join(privateRoot, `cli-run-test-${process.pid}`);
  const claim = path.join(privateRoot, `.claim-${path.basename(outputDir)}`);
  try {
    assert.throws(() => agentLiveTransport({ approvalPath: path.join(privateRoot, 'no-review.json'),
      outputDir, agentPlanHash: verifyAgentFrozen() }), /Review ACCEPT file required/);
    assert.equal(fs.existsSync(outputDir), false);
    assert.equal(fs.existsSync(claim), false);
  } finally { if (!existed) fs.rmdirSync(privateRoot); }
});
