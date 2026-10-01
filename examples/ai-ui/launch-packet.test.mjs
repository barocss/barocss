import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { preparePacket, validatePacket, digest, DECLARATION_DIGEST, OUTER_SCHEMA, buildArgv } from './launch-packet.mjs';
import { createCodexTransport, buildPrompt } from './codex-transport.mjs';
import { SCREEN_DECLARATIONS, REQUEST_CONTRACT, requestScreen, checkRequestScreen } from './scenario.mjs';
const { validateSpec } = await import('../../packages/barocss-render/dist/index.js');
const packet = preparePacket({ candidateSha: '1'.repeat(40), cliPath: '/authored/codex', nodeBin: '/authored/bin', root: '/tmp/private-491-prepared' });
test('fixed packet cannot silently raise limits, change model or inherit a spent approval', () => {
  assert.equal(packet.maxReservations, 5); assert.equal(packet.retries, 0);
  assert.equal(packet.perTurnTimeoutMs, 180_000); assert.equal(packet.totalTimeoutMs, 900_000);
  for (const mutate of [(value) => { value.maxReservations = 6; }, (value) => { value.cli.model = 'other'; },
    (value) => { value.declarationsDigest = 'old-profile'; }, (value) => { value.retries = 1; }]) {
    const changed = structuredClone(packet); mutate(changed); assert.throws(() => validatePacket(changed), /differs/);
  }
  assert.throws(() => createCodexTransport({ packet }), /Fresh packet approval/);
  assert.throws(() => createCodexTransport({ packet, approval: { kind: 'fake-test', packetDigest: validatePacket(packet), candidateSha: packet.candidateSha,
    runId: '11111111-2222-4333-8444-555555555555' } }), /Fresh packet approval/);
});
test('prompt declarations and stage templates match actual configured validation', () => {
  assert.equal(digest(SCREEN_DECLARATIONS), DECLARATION_DIGEST);
  assert.equal(packet.schemaDigest, digest(OUTER_SCHEMA));
  const input = { draft: { name: '민지', topic: '차 두 잔' } };
  for (const target of ['form', 'review', 'confirmed']) {
    const spec = requestScreen(target, input);
    assert.equal(validateSpec(spec, REQUEST_CONTRACT).ok, true); checkRequestScreen(spec, target, input);
    const prompt = JSON.parse(buildPrompt({ kind: 'initial', sessionId: '11111111-2222-4333-8444-555555555555', requestId: 'fixture', revision: 0,
      target, action: null, input, screenRequest: '사용자 요청 "quotes" \n --model=other', contract: REQUEST_CONTRACT }));
    assert.deepEqual(prompt.declarations.permissions, REQUEST_CONTRACT); assert.deepEqual(prompt.requiredStageTemplate, spec);
    for (const columns of SCREEN_DECLARATIONS.components.Layout.props.columns)
      for (const gap of SCREEN_DECLARATIONS.components.Layout.props.gap) {
        const choice = structuredClone(spec); choice.elements.layout.props.columns = columns; choice.elements.layout.props.gap = gap;
        assert.equal(validateSpec(choice, REQUEST_CONTRACT).ok, true);
      }
    for (const padding of SCREEN_DECLARATIONS.components.Card.props.padding)
      for (const tone of SCREEN_DECLARATIONS.components.Card.props.tone) {
        const choice = structuredClone(spec); choice.elements.card.props.padding = padding; choice.elements.card.props.tone = tone;
        assert.equal(validateSpec(choice, REQUEST_CONTRACT).ok, true);
      }
  }
});
test('installed initial/resume help accepts the exact proposed syntax without a model call', () => {
  const cli = process.env.CLI_BIN ?? 'codex';
  assert.equal(execFileSync(cli, ['--version'], { encoding: 'utf8' }).trim(), 'codex-cli 0.156.1');
  for (const codexId of [undefined, 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee']) {
    const argv = buildArgv(packet, { codexId, finalPath: '/tmp/private-491-prepared/final.txt' });
    assert(!argv.includes('--last')); assert(!argv.includes('--ephemeral')); assert(!argv.includes('--dangerously-bypass-approvals-and-sandbox'));
    assert.match(execFileSync(cli, [...argv, '--help'], { encoding: 'utf8' }), /Usage: codex exec/);
  }
});
