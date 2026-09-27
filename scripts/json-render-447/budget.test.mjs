import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readLedger, reserveAndRun, quoteReservation } from './budget.mjs';
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'budget-447-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return { ledgerPath: join(dir, 'ledger.json'), budgetMicroUsd: 30, callId: 'first', model: 'stub',
    inputTokensBound: 10, maxOutputTokens: 10, rates: { inputMicroUsdPerToken: 1, outputMicroUsdPerToken: 2 } };
}
const response = (inputTokens = 10, outputTokens = 10) => ({ usage: { inputTokens, outputTokens } });
test('equality dispatches once; one microUSD over fails before dispatch', async t => {
  const options = await fixture(t); let calls = 0;
  await assert.rejects(reserveAndRun({ ...options, budgetMicroUsd: 29 }, () => { calls++; }), /Budget exceeded/);
  await reserveAndRun(options, async () => { calls++; return response(); });
  assert.equal(calls, 1);
  assert.equal((await readLedger(options.ledgerPath)).calls[0].chargedMicroUsd, 30);
  await assert.rejects(reserveAndRun({ ...options, callId: 'next' }, async () => response()), /Budget exceeded/);
});
test('known actual usage releases unused reservation; duplicate and changed budget reject', async t => {
  const options = await fixture(t);
  await reserveAndRun(options, async () => response(0, 0));
  await assert.rejects(reserveAndRun(options, async () => response()), /Duplicate/);
  await assert.rejects(reserveAndRun({ ...options, callId: 'second', budgetMicroUsd: 31 }, async () => response()), /Budget changed/);
  await reserveAndRun({ ...options, callId: 'second' }, async () => response());
});
test('concurrent dispatch is rejected while durable pending reservation exists', async t => {
  const options = await fixture(t); let release; let started;
  const ready = new Promise(resolve => { started = resolve; });
  const first = reserveAndRun(options, async () => { started(); await new Promise(resolve => { release = resolve; }); return response(); });
  await ready;
  assert.equal((await readLedger(options.ledgerPath)).calls[0].status, 'pending');
  await assert.rejects(reserveAndRun({ ...options, callId: 'parallel' }, async () => response()), { code: 'EEXIST' });
  release(); await first;
});
for (const kind of ['missing', 'provider', 'over-input', 'over-output']) test(`${kind} retains full reservation across restart`, async t => {
  const options = await fixture(t);
  await assert.rejects(reserveAndRun(options, async () => {
    if (kind === 'provider') throw new Error('provider failed');
    if (kind === 'missing') return {};
    return kind === 'over-input' ? response(11, 0) : response(0, 11);
  }));
  const ledger = await readLedger(options.ledgerPath);
  assert.equal(ledger.calls[0].status, 'blocked'); assert.equal(ledger.calls[0].chargedMicroUsd, 30);
  await assert.rejects(reserveAndRun({ ...options, callId: 'restart' }, async () => response()), /Unreconciled/);
});
test('crash lock is never stolen; persisted pending also blocks without lock', async t => {
  const options = await fixture(t);
  await writeFile(`${options.ledgerPath}.lock`, 'crashed');
  await assert.rejects(reserveAndRun(options, async () => response()), { code: 'EEXIST' });
  await rm(`${options.ledgerPath}.lock`);
  await writeFile(options.ledgerPath, JSON.stringify({ version: 1, budgetMicroUsd: 30, calls: [{ ...options, reservedMicroUsd: 30, chargedMicroUsd: 30, status: 'pending' }] }));
  await assert.rejects(reserveAndRun({ ...options, callId: 'restart' }, async () => response()), /Unreconciled/);
});
test('unknown rates, unsafe arithmetic and malformed ledger fail closed', async t => {
  const options = await fixture(t);
  assert.throws(() => quoteReservation({ ...options, rates: {} }), /Unknown/);
  assert.throws(() => quoteReservation({ ...options, inputTokensBound: Number.MAX_SAFE_INTEGER }), /arithmetic/);
  await writeFile(options.ledgerPath, '{}');
  await assert.rejects(reserveAndRun(options, async () => response()), /Invalid ledger/);
});
