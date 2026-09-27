import { open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';

function integer(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Unknown or invalid ${name}`);
  return value;
}
function sum(a, b) { return integer(a + b, 'cost arithmetic'); }
function cost(tokens, rate) { return integer(integer(tokens, 'tokens') * integer(rate, 'rate'), 'cost arithmetic'); }
function identifier(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Unknown ${name}`);
  return value;
}
// Rates must be conservatively rounded UP to whole microUSD per billable token.
// inputTokensBound includes system/schema/history/provider overhead. Output bounds
// include all billable reasoning tokens. Unknown provider accounting is not ready.
export function quoteReservation({ model, inputTokensBound, maxOutputTokens, rates }) {
  identifier(model, 'model');
  return sum(cost(inputTokensBound, rates?.inputMicroUsdPerToken), cost(maxOutputTokens, rates?.outputMicroUsdPerToken));
}
function validate(ledger) {
  if (ledger?.version !== 1 || !Array.isArray(ledger.calls)) throw new Error('Invalid ledger');
  integer(ledger.budgetMicroUsd, 'budget');
  const ids = new Set();
  let spent = 0;
  for (const call of ledger.calls) {
    identifier(call.callId, 'call ID');
    if (ids.has(call.callId)) throw new Error('Duplicate ledger call');
    ids.add(call.callId);
    if (!['pending', 'blocked', 'completed'].includes(call.status)) throw new Error('Unknown call state');
    if (quoteReservation(call) !== call.reservedMicroUsd) throw new Error('Invalid reservation');
    if (call.status === 'completed') {
      const { inputTokens, outputTokens } = call.usage ?? {};
      integer(inputTokens, 'input usage'); integer(outputTokens, 'output usage');
      if (inputTokens > call.inputTokensBound || outputTokens > call.maxOutputTokens) throw new Error('Usage exceeds token bounds');
      const actual = sum(cost(inputTokens, call.rates.inputMicroUsdPerToken), cost(outputTokens, call.rates.outputMicroUsdPerToken));
      if (actual !== call.chargedMicroUsd) throw new Error('Invalid charge');
    } else if (call.chargedMicroUsd !== call.reservedMicroUsd) throw new Error('Reservation was refunded');
    spent = sum(spent, call.chargedMicroUsd);
  }
  if (spent > ledger.budgetMicroUsd) throw new Error('Ledger exceeds budget');
  return ledger;
}
export async function readLedger(path) { return validate(JSON.parse(await readFile(path, 'utf8'))); }
async function persist(path, ledger) {
  validate(ledger);
  const temporary = `${path}.next`;
  const file = await open(temporary, 'wx', 0o600);
  try { await file.writeFile(`${JSON.stringify(ledger, null, 2)}\n`); await file.sync(); } finally { await file.close(); }
  await rename(temporary, path);
  const directory = await open(dirname(path), 'r');
  try { await directory.sync(); } finally { await directory.close(); }
}
export async function reserveAndRun(options, dispatch) {
  const { ledgerPath, budgetMicroUsd, callId } = options;
  identifier(ledgerPath, 'ledger path'); identifier(callId, 'call ID');
  integer(budgetMicroUsd, 'budget');
  const reservedMicroUsd = quoteReservation(options);
  if (typeof dispatch !== 'function') throw new Error('Missing dispatch');
  // Never steal a lock: a process crash or uncertain dispatch needs human reconciliation.
  const lockPath = `${ledgerPath}.lock`;
  const lock = await open(lockPath, 'wx', 0o600);
  try {
    let ledger;
    try { ledger = await readLedger(ledgerPath); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      ledger = { version: 1, budgetMicroUsd, calls: [] };
    }
    if (ledger.budgetMicroUsd !== budgetMicroUsd) throw new Error('Budget changed');
    if (ledger.calls.some(c => c.callId === callId)) throw new Error('Duplicate call ID');
    if (ledger.calls.some(c => c.status !== 'completed')) throw new Error('Unreconciled dispatch blocks further calls');
    const spent = ledger.calls.reduce((n, c) => sum(n, c.chargedMicroUsd), 0);
    if (reservedMicroUsd > budgetMicroUsd - spent) throw new Error('Budget exceeded');
    const call = { callId, model: options.model, inputTokensBound: options.inputTokensBound,
      maxOutputTokens: options.maxOutputTokens, rates: { ...options.rates }, reservedMicroUsd,
      chargedMicroUsd: reservedMicroUsd, status: 'pending' };
    ledger.calls.push(call);
    await persist(ledgerPath, ledger); // Durable reservation precedes any dispatch.
    let result;
    try {
      result = await dispatch();
      const { inputTokens, outputTokens } = result?.usage ?? {};
      integer(inputTokens, 'input usage'); integer(outputTokens, 'output usage');
      if (inputTokens > call.inputTokensBound || outputTokens > call.maxOutputTokens) throw new Error('Usage exceeds token bounds');
      call.usage = { inputTokens, outputTokens };
      call.chargedMicroUsd = sum(cost(inputTokens, call.rates.inputMicroUsdPerToken), cost(outputTokens, call.rates.outputMicroUsdPerToken));
      call.status = 'completed';
    } catch (error) {
      call.status = 'blocked'; call.chargedMicroUsd = reservedMicroUsd;
      delete call.usage;
      await persist(ledgerPath, ledger);
      throw error;
    }
    await persist(ledgerPath, ledger);
    return result;
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
}
