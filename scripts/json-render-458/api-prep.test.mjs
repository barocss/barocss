import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { apiRequest, inspectApiResponse, chargeForUsage, stubApiTransport,
  reserveApiCharge, API_CEILING_MICRO_USD, API_RESERVATION_MICRO_USD, API_MAX_OUTPUT_TOKENS } from './api-prep.mjs';
import { capture } from './capture.mjs';
import { stubTransport } from './stub.mjs';
import { verifyFrozen } from './freeze.mjs';
import { verifyCapture } from './provenance.mjs';
import { verifyApiCapture } from './api-provenance.mjs';
import { verifyApiFrozen } from './api-frozen.mjs';
import { liveApiTransport, claimApprovedRun } from './api-live.mjs';
import { scoreApiSaved, bindApiReport, verifyApiReport, createApiViewer, replayApiSaved } from './api-consumers.mjs';

const fresh = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'baro-458-api-')), 'run');
const usage = (input = 100, output = 50, cached = 0, write = 0, reasoning = 20) => ({ input_tokens: input,
  input_tokens_details: { cached_tokens: cached, cache_write_tokens: write }, output_tokens: output,
  output_tokens_details: { reasoning_tokens: reasoning }, total_tokens: input + output });
const response = (text = '{"specJson":"{}","cannotExpress":false}') => ({ object: 'response', id: 'resp_stub', status: 'completed',
  model: 'gpt-6-sol', service_tier: 'default', usage: usage(), output: [{ type: 'reasoning', summary: [] },
    { type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text, annotations: [] }] }] });

test('production API route denies before network without owner approval and project credentials', () => {
  const outputDir = `/Users/user/.barocss-ai/v3/private-458/never-created-test-${process.pid}`;
  const approvalPath = '/Users/user/.barocss-ai/v3/private-458/missing-approval.json';
  assert.throws(() => liveApiTransport({ approvalPath, outputDir, env: {} }), /Explicit project-scoped API environment/);
  assert.throws(() => liveApiTransport({ approvalPath, outputDir,
    env: { OPENAI_API_KEY: 'fake', OPENAI_ORG_ID: 'org-test', OPENAI_PROJECT_ID: 'proj-test' } }), /ENOENT/);
  assert.throws(() => liveApiTransport({ approvalPath, outputDir,
    env: { OPENAI_API_KEY: 'fake', OPENAI_ORG_ID: 'org-test', OPENAI_PROJECT_ID: 'proj-test', OPENAI_BASE_URL: 'https://example.com' } }), /Alternate API base URL/);
});
test('exact request is text-only with no tools, hidden state, fallback, or background work', () => {
  const prompt = '{"transcript":[{"role":"user","content":"hello"}]}';
  const request = apiRequest(prompt);
  assert.equal(request.model, 'gpt-6-sol');
  assert.deepEqual(request.reasoning, { effort: 'high' });
  assert.deepEqual(request.input, [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }]);
  assert.deepEqual(request.tools, []);
  assert.equal(request.tool_choice, 'none');
  assert.equal(request.service_tier, 'default');
  assert.equal(request.max_output_tokens, API_MAX_OUTPUT_TOKENS);
  assert.equal(request.truncation, 'disabled');
  assert.equal(request.store, false);
  assert.equal(request.background, false);
  assert.equal(request.stream, false);
  assert.deepEqual(Object.keys(request).sort(), ['background','input','max_output_tokens','model','reasoning','service_tier','store','stream','text','tool_choice','tools','truncation'].sort());
  assert.equal(request.text.format.strict, true);
});
test('charge accounting covers cache writes, cached input, hidden reasoning, and long context', () => {
  assert.equal(chargeForUsage(usage(100, 50, 20, 30, 40)).microUsd, 679);
  assert.equal(chargeForUsage(usage(272001, 8192, 0, 272001, 8192)).microUsd, 1_482_885);
  assert.equal(API_RESERVATION_MICRO_USD, 5_372_880);
  assert.equal(API_CEILING_MICRO_USD, 10_000_000);
  assert.throws(() => chargeForUsage({ ...usage(), input_tokens_details: { cached_tokens: 0 } }), /missing or invalid/);
  assert.throws(() => chargeForUsage(usage(100, 50, 60, 50)), /inconsistent/);
  assert.throws(() => chargeForUsage(usage(100, 50, 0, 0, 51)), /inconsistent/);
});
test('strict response rejects tools, refusal, incomplete, drift, and missing usage', () => {
  assert.equal(inspectApiResponse(response()).rawFinal, '{"specJson":"{}","cannotExpress":false}');
  for (const mutation of [
    (r) => { r.output.unshift({ type: 'function_call', name: 'shell' }); },
    (r) => { r.output[1].content = [{ type: 'refusal', refusal: 'no' }]; },
    (r) => { r.status = 'incomplete'; },
    (r) => { r.model = 'gpt-6-sol-new'; },
    (r) => { r.service_tier = 'priority'; },
    (r) => { r.usage = null; },
  ]) {
    const r = response(); mutation(r);
    assert.throws(() => inspectApiResponse(r), /API pilot stopped/);
  }
});
test('durable reservations precede each stub dispatch and full histories replay through existing capture', async () => {
  const run = fresh();
  const oldStub = stubTransport('valid');
  const transport = stubApiTransport(async (request, row, attemptDir) => {
    assert.ok(fs.existsSync(path.join(attemptDir, 'api-charge-reservation.json')));
    assert.ok(fs.existsSync(path.join(attemptDir, 'api-request.json')));
    const old = await oldStub({ row, attemptDir });
    return response(old.rawFinal);
  });
  const rows = await capture({ outputDir: run, transport, planHash: verifyFrozen(), synthetic: true });
  assert.equal(rows.length, 24);
  assert.equal(rows.filter((row) => row.attempted).length, 24);
  assert.equal(rows.filter((row) => row.status === 'valid').length, 21);
  assert.ok(rows.filter((row) => row.attempted).every((row) => Number.isSafeInteger(row.elapsedMs) && row.elapsedMs >= 0));
  assert.equal(verifyCapture(run).rows.length, 24);
  assert.equal(verifyApiCapture(run).rows.length, 24);
  const last = JSON.parse(fs.readFileSync(path.join(run, 'attempt-23/api-request.json')));
  assert.equal(JSON.parse(last.input[0].content[0].text).transcript.length, 7);
  const finalReserve = JSON.parse(fs.readFileSync(path.join(run, 'attempt-23/api-charge-reservation.json')));
  assert.ok(finalReserve.aggregateHeldAfterMicroUsd <= API_CEILING_MICRO_USD);
  assert.ok(fs.existsSync(path.join(run, 'attempt-23/api-charge-settlement.json')));
  assert.throws(() => reserveApiCharge({ runDir: run, attemptDir: path.join(run, 'attempt-23'), ordinal: 23, request: last }), /reservation ledger drift/);
});
test('timeout and missing usage retain the full reservation and stop the scheduled run', async () => {
  for (const kind of ['timeout', 'missing-usage']) {
    const run = fresh();
    const transport = stubApiTransport(async () => {
      if (kind === 'timeout') { await new Promise((resolve) => setTimeout(resolve, 15)); throw new Error('timeout after possible charge'); }
      const r = response(); delete r.usage; return r;
    });
    const rows = await capture({ outputDir: run, transport, planHash: verifyFrozen(), synthetic: true });
    assert.equal(rows.filter((row) => row.attempted).length, 1);
    assert.ok(Number.isSafeInteger(rows[0].elapsedMs) && rows[0].elapsedMs >= (kind === 'timeout' ? 10 : 0));
    assert.equal(rows.filter((row) => row.status === 'skipped-global').length, 23);
    assert.equal(JSON.parse(fs.readFileSync(path.join(run, 'attempt-00/api-charge-reservation.json'))).reservedMicroUsd, API_RESERVATION_MICRO_USD);
    assert.equal(verifyApiCapture(run).heldMicroUsd, API_RESERVATION_MICRO_USD);
  }
});

test('API freeze binds the adapter, pricing, dispatcher, and independent provenance', () => {
  assert.match(verifyApiFrozen(), /^[a-f0-9]{64}$/);
  const frozen = JSON.parse(fs.readFileSync(new URL('./api-frozen.json', import.meta.url)));
  for (const name of ['api-prep.mjs', 'api-live.mjs', 'api-provenance.mjs', 'api-consumers.mjs', 'API-RUN-PACKET.md', 'frozen-plan.json']) {
    assert.match(frozen.files[name], /^[a-f0-9]{64}$/);
  }
});
test('API provenance rejects missing and mutated request, reservation, and response artifacts', async () => {
  const run = fresh();
  const oldStub = stubTransport('valid');
  const rows = await capture({ outputDir: run, planHash: verifyFrozen(), synthetic: true,
    transport: stubApiTransport(async (_request, row, dir) => response((await oldStub({ row, attemptDir: dir })).rawFinal)) });
  assert.equal(rows.length, 24);
  const baseline = verifyApiCapture(run).apiEvidenceSha256;
  for (const name of ['api-request.json', 'api-charge-reservation.json', 'api-response.json', 'api-charge-settlement.json']) {
    const file = path.join(run, 'attempt-00', name), original = fs.readFileSync(file);
    fs.writeFileSync(file, '{"changed":true}\n');
    assert.throws(() => verifyApiCapture(run));
    fs.writeFileSync(file, original);
    fs.renameSync(file, file + '.held');
    assert.throws(() => verifyApiCapture(run));
    fs.renameSync(file + '.held', file);
  }
  const rowsFile = path.join(run, 'rows.json'), rowsOriginal = fs.readFileSync(rowsFile);
  const changedRows = JSON.parse(rowsOriginal); changedRows[0].elapsedMs = null;
  fs.writeFileSync(rowsFile, JSON.stringify(changedRows));
  assert.throws(() => verifyApiCapture(run), /elapsed time drift/);
  fs.writeFileSync(rowsFile, rowsOriginal);
  assert.equal(verifyApiCapture(run).apiEvidenceSha256, baseline);
});
test('the $10 cap settles complete usage and denies the next request before responder dispatch', async () => {
  const run = fresh();
  let calls = 0;
  const oldStub = stubTransport('valid');
  const transport = stubApiTransport(async (_request, row, dir) => {
    calls++;
    const r = response((await oldStub({ row, attemptDir: dir })).rawFinal);
    r.usage = usage(1_000_000, 50, 0, 1_000_000, 20);
    return r;
  });
  const rows = await capture({ outputDir: run, transport, planHash: verifyFrozen(), synthetic: true });
  assert.equal(calls, 1);
  assert.equal(rows.length, 24);
  assert.equal(rows.filter((r) => r.attempted).length, 2); // The second is a local capture slot, never an HTTP attempt.
  assert.equal(rows.filter((r) => r.status === 'skipped-global').length, 22);
  assert.match(rows[1].stopReason, /aggregate charge ceiling/);
  assert.ok(Number.isSafeInteger(rows[1].elapsedMs) && rows[1].elapsedMs >= 0);
  assert.ok(!fs.existsSync(path.join(run, 'attempt-01/api-charge-reservation.json')));
  assert.ok(verifyApiCapture(run).heldMicroUsd <= API_CEILING_MICRO_USD);
});

test('approved run identity is claimed once, atomically, without creating an output directory', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'baro-458-claim-'));
  const outputDir = path.join(parent, 'run-abcdef12');
  const claim = claimApprovedRun(outputDir, 'a'.repeat(64), 'abcdef12');
  assert.ok(fs.existsSync(claim));
  assert.ok(!fs.existsSync(outputDir));
  assert.throws(() => claimApprovedRun(outputDir, 'a'.repeat(64), 'abcdef12'), /EEXIST/);
  assert.throws(() => claimApprovedRun(path.join(parent, 'run-otherid1'), 'a'.repeat(64), 'abcdef12'), /identity invalid/);
});

test('API score and viewer reject altered API evidence even when generic capture digest is unchanged', async () => {
  const run = fresh();
  const oldStub = stubTransport('valid');
  await capture({ outputDir: run, planHash: verifyFrozen(), synthetic: true,
    transport: stubApiTransport(async (_request, row, dir) => response((await oldStub({ row, attemptDir: dir })).rawFinal)) });
  const before = verifyApiCapture(run);
  const scored = scoreApiSaved(run);
  assert.equal(scored.scoring.length, 24);
  const replayDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baro-458-api-report-'));
  fs.writeFileSync(path.join(replayDir, 'report.json'), JSON.stringify({ captureManifestSha256: before.manifestSha256,
    captureEvidenceSha256: before.evidenceSha256, scoring: scored.scoring,
    replay: before.rows.map((row) => ({ id: row.id, status: 'skipped', screen: {}, errors: [] })) }));
  bindApiReport(run, replayDir);
  assert.equal(verifyApiReport(run, replayDir).binding.apiEvidenceSha256, before.apiEvidenceSha256);
  assert.ok(createApiViewer({ captureDir: run, replayDir }).server);
  const file = path.join(run, 'attempt-00/api-response.json'), original = fs.readFileSync(file);
  fs.writeFileSync(file, '{"changed":true}\n');
  assert.equal(verifyCapture(run).evidenceSha256, before.evidenceSha256); // The accepted generic route is unchanged.
  assert.throws(() => scoreApiSaved(run));
  await assert.rejects(replayApiSaved({ captureDir: run, outputDir: path.join(replayDir, 'new') }));
  assert.throws(() => verifyApiReport(run, replayDir));
  assert.throws(() => createApiViewer({ captureDir: run, replayDir }));
  fs.writeFileSync(file, original);
  const reportFile = path.join(replayDir, 'report.json');
  fs.appendFileSync(reportFile, ' ');
  assert.throws(() => verifyApiReport(run, replayDir), /binding drift/);
});
