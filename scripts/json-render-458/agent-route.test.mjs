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
import { SCRATCH_PARENT } from './agent-profile.mjs';
import { verifyAgentCapture } from './agent-provenance.mjs';
import { runAgentCodex } from './agent-transport.mjs';
import { verifyAgentDiagnostics } from './agent-diagnostics.mjs';
import { captureOneAgentDiagnostic, runReviewedAgentDiagnostic } from './agent-diagnostic.mjs';
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
    const rows = await capture({ outputDir, transport, planHash: verifyFrozen(), synthetic: true });
    assert.equal(rows.length, MAX_ATTEMPTS);
    fs.writeFileSync(path.join(outputDir, 'agent-route.json'), JSON.stringify({ kind: 'barocss-458-cli-agent-synthetic',
      agentPlanSha256: verifyAgentFrozen(), basePlanSha256: verifyFrozen(), scheduled: MAX_ATTEMPTS, attempted: MAX_ATTEMPTS }) + '\n');
    const verified = verifyAgentCapture(outputDir);
    assert.equal(verified.manifest.synthetic, true);
    assert.equal(Object.values(verified.toolUse).reduce((sum, count) => sum + count, 0), MAX_ATTEMPTS);
    assert.equal(scoreAgentSaved(outputDir).scoring.length, MAX_ATTEMPTS);
    assert.equal(scoreAgentSaved(outputDir).synthetic, true);
    const routePath = path.join(outputDir, 'agent-route.json');
    const manifestPath = path.join(outputDir, 'manifest.json');
    const savedRoute = fs.readFileSync(routePath), savedManifest = fs.readFileSync(manifestPath);
    fs.writeFileSync(routePath, JSON.stringify({ ...JSON.parse(savedRoute), kind: 'barocss-458-cli-agent-live', maxCliInvocations: 24 }));
    fs.writeFileSync(manifestPath, JSON.stringify({ ...JSON.parse(savedManifest), synthetic: false }));
    assert.throws(() => verifyAgentCapture(outputDir), /Live CLI route outside private root/);
    fs.writeFileSync(routePath, savedRoute);
    fs.writeFileSync(manifestPath, savedManifest);
    const liveDir = path.join(privateRoot, `cli-run-test-no-claim-${process.pid}`);
    const privateRootExisted = fs.existsSync(privateRoot);
    if (!privateRootExisted) fs.mkdirSync(privateRoot, { mode: 0o700 });
    try {
      fs.cpSync(outputDir, liveDir, { recursive: true, errorOnExist: true, force: false });
      fs.writeFileSync(path.join(liveDir, 'manifest.json'), JSON.stringify({ ...JSON.parse(savedManifest), synthetic: false }));
      fs.writeFileSync(path.join(liveDir, 'agent-route.json'), JSON.stringify({ ...JSON.parse(savedRoute),
        kind: 'barocss-458-cli-agent-live', maxCliInvocations: 24, claimSha256: '0'.repeat(64),
        approvalFile: 'review-test.json', approvalSha256: '0'.repeat(64),
        reviewedCommit: '0'.repeat(40), reviewUrl: 'https://github.com/barocss/barocss/issues/458#issuecomment-1' }));
      assert.throws(() => verifyAgentCapture(liveDir), /ENOENT/);
    } finally {
      fs.rmSync(liveDir, { recursive: true, force: true });
      if (!privateRootExisted) fs.rmdirSync(privateRoot);
    }
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

test('one stdout chunk with two error items stops at the first and verifies saved provenance', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'baro-458-first-error-'));
  const cwd = fs.mkdtempSync(path.join(SCRATCH_PARENT, 'agent-scratch-458-'));
  const home = path.join(cwd, 'home');
  const schemaPath = path.join(cwd, 'schema.json');
  const outputDir = path.join(root, 'capture');
  try {
    fs.mkdirSync(home);
    fs.writeFileSync(schemaPath, '{}');
    const cliPath = path.join(root, 'fake-codex.mjs');
    fs.writeFileSync(cliPath, `#!${process.execPath}\n` +
      `process.stdout.write([` +
      `${JSON.stringify(JSON.stringify({ type: 'item.started', item: { type: 'error', id: 'same', message: 'first failure' } }))},` +
      `${JSON.stringify(JSON.stringify({ type: 'item.completed', item: { type: 'error', id: 'same', message: 'authentication failure' } }))}` +
      `].join('\\n') + '\\n');\nsetTimeout(() => process.exit(0), 20);\n`, { mode: 0o700 });
    const transport = ({ prompt, attemptDir, timeoutMs }) => runAgentCodex({ cliPath, cwd, home,
      codexHome: path.join(os.homedir(), '.codex'), nodeBin: path.dirname(process.execPath),
      schemaPath, attemptDir, prompt, timeoutMs });
    const rows = await capture({ outputDir, transport, planHash: verifyFrozen(), synthetic: true });
    assert.equal(rows.filter((row) => row.attempted).length, 1);
    assert.equal(rows[0].stopReason, 'error-item:other');
    fs.writeFileSync(path.join(outputDir, 'agent-route.json'), JSON.stringify({ kind: 'barocss-458-cli-agent-synthetic',
      agentPlanSha256: verifyAgentFrozen(), basePlanSha256: verifyFrozen(),
      scheduled: MAX_ATTEMPTS, attempted: 1 }) + '\n');
    const verified = verifyAgentCapture(outputDir);
    assert.equal(verified.toolUse[rows[0].id], 0);
    const events = fs.readFileSync(path.join(outputDir, 'attempt-00', 'events.jsonl'), 'utf8').trim().split('\n');
    assert.equal(events.length, 1);
    assert.equal(JSON.parse(events[0]).errorClass, 'other');
    assert.equal(verifyAgentDiagnostics(path.join(outputDir, 'attempt-00')).summary.errorItemClass, 'other');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('one-invocation diagnostic keeps valid JSON and leaves 23 cells unattempted', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'baro-458-one-invocation-'));
  const outputDir = path.join(root, 'capture');
  const cwd = '/Users/user/.barocss-ai/v3/agent-scratch-458-synthetic';
  const schemaPath = path.join(cwd, 'schema.json');
  let calls = 0;
  try {
    const stub = stubTransport('valid');
    const transport = async (request) => {
      calls++;
      const response = await stub(request);
      const events = [
        { type: 'thread.started', threadId: 'stub' },
        { type: 'item.completed', itemType: 'agent_message', textSha256: sha(response.rawFinal), textBytes: Buffer.byteLength(response.rawFinal) },
        { type: 'turn.completed', usage: response.usage },
      ];
      fs.writeFileSync(path.join(request.attemptDir, 'events.jsonl'), events.map((event) => JSON.stringify(event)).join('\n') + '\n');
      return { ...response, cliVersion: CLI_VERSION, reasoningRequested: 'high', eventCount: events.length,
        argv: buildAgentArgv({ cwd, schemaPath, finalPath: path.join(request.attemptDir, 'raw-final.txt') }),
        environmentKeys: ['CODEX_HOME', 'HOME', 'LANG', 'NO_COLOR', 'PATH', 'TERM'] };
    };
    const rows = await captureOneAgentDiagnostic({ outputDir, transport, planHash: verifyFrozen(), synthetic: true });
    assert.equal(calls, 1);
    assert.equal(rows.length, MAX_ATTEMPTS);
    assert.equal(rows[0].status, 'valid');
    assert.equal(rows.slice(1).every((row) => !row.attempted && row.reason === 'one-invocation-diagnostic-limit'), true);
    fs.writeFileSync(path.join(outputDir, 'agent-route.json'), JSON.stringify({
      kind: 'barocss-458-cli-agent-diagnostic-synthetic', agentPlanSha256: verifyAgentFrozen(),
      basePlanSha256: verifyFrozen(), scheduled: MAX_ATTEMPTS, attempted: 1, maxCliInvocations: 1 }) + '\n');
    assert.equal(verifyAgentCapture(outputDir).rows[0].status, 'valid');
    assert.equal(scoreAgentSaved(outputDir).scoring.length, MAX_ATTEMPTS);
    const raw = fs.readFileSync(path.join(outputDir, 'attempt-00', 'raw-final.txt'), 'utf8');
    assert.equal(typeof JSON.parse(raw).specJson, 'string');
    const rowsPath = path.join(outputDir, 'rows.json');
    const changed = JSON.parse(fs.readFileSync(rowsPath));
    changed[1].reason = 'other';
    fs.writeFileSync(rowsPath, JSON.stringify(changed));
    assert.throws(() => verifyAgentCapture(outputDir), /diagnostic invocation limit drift/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('one-invocation diagnostic keeps a failed attempt and private error evidence', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'baro-458-one-failure-'));
  const cwd = fs.mkdtempSync(path.join(SCRATCH_PARENT, 'agent-scratch-458-'));
  const home = path.join(cwd, 'home');
  const schemaPath = path.join(cwd, 'schema.json');
  const outputDir = path.join(root, 'capture');
  try {
    fs.mkdirSync(home);
    fs.writeFileSync(schemaPath, '{}');
    const cliPath = path.join(root, 'fake-codex.mjs');
    fs.writeFileSync(cliPath, `#!${process.execPath}\n` +
      `process.stdout.write(${JSON.stringify(JSON.stringify({ type: 'item.completed', item: { type: 'error', message: 'safe diagnostic marker' } }) + '\n')});\n` +
      `process.stderr.write('safe stderr marker\\n');\nsetTimeout(() => process.exit(0), 20);\n`, { mode: 0o700 });
    let calls = 0;
    const transport = ({ prompt, attemptDir, timeoutMs }) => {
      calls++;
      return runAgentCodex({ cliPath, cwd, home, codexHome: path.join(os.homedir(), '.codex'),
        nodeBin: path.dirname(process.execPath), schemaPath, attemptDir, prompt, timeoutMs });
    };
    const rows = await captureOneAgentDiagnostic({ outputDir, transport, planHash: verifyFrozen(), synthetic: true });
    assert.equal(calls, 1);
    assert.equal(rows[0].status, 'error-item:other');
    fs.writeFileSync(path.join(outputDir, 'agent-route.json'), JSON.stringify({
      kind: 'barocss-458-cli-agent-diagnostic-synthetic', agentPlanSha256: verifyAgentFrozen(),
      basePlanSha256: verifyFrozen(), scheduled: MAX_ATTEMPTS, attempted: 1, maxCliInvocations: 1 }) + '\n');
    assert.equal(verifyAgentCapture(outputDir).rows[0].status, 'error-item:other');
    assert.equal(verifyAgentDiagnostics(path.join(outputDir, 'attempt-00')).summary.errorItemClass, 'other');
    assert.equal(fs.readFileSync(path.join(outputDir, 'attempt-00', 'stderr.txt'), 'utf8'), 'safe stderr marker\n');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('one-invocation live command rejects absent approval before output', async () => {
  const existed = fs.existsSync(privateRoot);
  if (!existed) fs.mkdirSync(privateRoot, { mode: 0o700 });
  const outputDir = path.join(privateRoot, `cli-run-one-test-${process.pid}`);
  try {
    await assert.rejects(runReviewedAgentDiagnostic({ outputDir,
      approvalPath: path.join(privateRoot, 'no-one-run-review.json') }), /Review ACCEPT file required/);
    assert.equal(fs.existsSync(outputDir), false);
  } finally { if (!existed) fs.rmdirSync(privateRoot); }
});

test('full-pilot approval cannot launch the one-invocation diagnostic', async () => {
  const existed = fs.existsSync(privateRoot);
  if (!existed) fs.mkdirSync(privateRoot, { mode: 0o700 });
  const outputDir = path.join(privateRoot, `cli-run-kind-test-${process.pid}`);
  const approvalPath = path.join(privateRoot, `approval-kind-test-${process.pid}.json`);
  try {
    fs.writeFileSync(approvalPath, JSON.stringify({ issue: 458, decision: 'ACCEPT',
      agentPlanSha256: verifyAgentFrozen(), outputDir,
      reviewUrl: 'https://github.com/barocss/barocss/issues/458#issuecomment-1',
      runKind: 'full-pilot', maxCliInvocations: 24, ownerDecisionRef: 'synthetic-test-only' }),
    { flag: 'wx', mode: 0o600 });
    await assert.rejects(runReviewedAgentDiagnostic({ outputDir, approvalPath }), /Approval must bind Review/);
    assert.equal(fs.existsSync(outputDir), false);
    assert.equal(fs.existsSync(path.join(privateRoot, `.claim-${path.basename(outputDir)}`)), false);
  } finally {
    fs.rmSync(approvalPath, { force: true });
    if (!existed) fs.rmdirSync(privateRoot);
  }
});
