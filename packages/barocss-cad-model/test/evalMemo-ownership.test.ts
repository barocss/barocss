import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import type { EvalResult } from '../src/engine/evaluate';
import { rememberedEvaluate, type Evaluate } from '../src/engine/evalMemo';

const document = (owner: number, index = 0): StudioDoc => ({ ...emptyDoc(), parameters: { memoOwner: owner, index } });
const success = (revision: number): EvalResult => ({ ok: true, revision, bodies: [], wallTime: 0 });
const refusal: EvalResult = { ok: false, revision: -1, error: { title: 'Controlled refusal', hint: '', detail: '' }, wallTime: 0 };
function deferred() {
  let resolve!: (value: EvalResult | null) => void, reject!: (error: Error) => void;
  const promise = new Promise<EvalResult | null>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
// Each case has a distinct document-content marker. A/B deliberately share content inside the same case.
test('distinct evaluator callbacks each compute and retain their own successful result for the same Doc', async () => {
  const doc = document(1), resultA = success(101), resultB = success(102); let callsA = 0, callsB = 0;
  const a = rememberedEvaluate(async () => { callsA++; return resultA; }), b = rememberedEvaluate(async () => { callsB++; return resultB; });
  const firstA = a(doc); assert.equal(await firstA, resultA);
  const firstB = b(structuredClone(doc)); assert.equal(await firstB, resultB);
  assert.equal(callsA, 1); assert.equal(callsB, 1); assert.notEqual(firstA, firstB);
  assert.equal(a(structuredClone(doc)), firstA); assert.equal(b(doc), firstB);
});
test('distinct evaluators do not borrow each other pending promise or its completion', async () => {
  const doc = document(2), jobA = deferred(), jobB = deferred(), resultA = success(201), resultB = success(202);
  let callsA = 0, callsB = 0;
  const a = rememberedEvaluate(() => { callsA++; return jobA.promise; }), b = rememberedEvaluate(() => { callsB++; return jobB.promise; });
  const pendingA = a(doc), pendingB = b(structuredClone(doc));
  jobA.resolve(resultA); jobB.resolve(resultB);
  const [outA, outB] = await Promise.all([pendingA, pendingB]);
  assert.equal(callsA, 1); assert.equal(callsB, 1); assert.notEqual(pendingA, pendingB);
  assert.equal(outA, resultA); assert.equal(outB, resultB);
});
test('the same evaluator reuses one pending and successful promise for content-equivalent Docs', async () => {
  const doc = document(3), job = deferred(), result = success(301); let calls = 0;
  const memo = rememberedEvaluate(() => { calls++; return job.promise; });
  const pending = memo(doc); assert.equal(memo(structuredClone(doc)), pending); assert.equal(calls, 1);
  job.resolve(result); assert.equal(await pending, result);
  assert.equal(memo(structuredClone(doc)), pending); assert.equal(calls, 1);
});
test('remembered wrappers are stable for each callback and wrapping a wrapper is idempotent', () => {
  const evaluate: Evaluate = async () => success(401), other: Evaluate = async () => success(402);
  const memo = rememberedEvaluate(evaluate);
  assert.equal(rememberedEvaluate(evaluate), memo); assert.equal(rememberedEvaluate(memo), memo);
  assert.notEqual(rememberedEvaluate(other), memo);
});
for (const [offset, kind] of (['refused', 'null', 'rejected'] as const).entries()) {
  test(`same-evaluator ${kind} completion is evicted and the later successful result remains cached`, async () => {
    const doc = document(10 + offset), result = success(500 + offset); let calls = 0;
    const memo = rememberedEvaluate(async () => {
      if (++calls > 1) return result;
      if (kind === 'rejected') throw new Error('Controlled rejected evaluation');
      return kind === 'null' ? null : refusal;
    });
    const first = memo(doc);
    if (kind === 'rejected') await assert.rejects(first, /Controlled rejected evaluation/);
    else assert.equal(await first, kind === 'null' ? null : refusal);
    const second = memo(structuredClone(doc)); assert.equal(await second, result);
    assert.notEqual(first, second); assert.equal(memo(doc), second); assert.equal(calls, 2);
  });
  test(`evaluator A late ${kind} completion cannot become or evict evaluator B success`, async () => {
    const doc = document(20 + offset), old = deferred(), result = success(600 + offset); let callsB = 0;
    const a = rememberedEvaluate(() => old.promise), b = rememberedEvaluate(async () => { callsB++; return result; });
    const pendingA = a(doc), pendingB = b(structuredClone(doc));
    // Attach both outcome handlers before settling A. Even the unsafe baseline cannot strand the test.
    const outcomes = Promise.allSettled([pendingA, pendingB]);
    if (kind === 'rejected') old.reject(new Error('Old evaluator rejected'));
    else old.resolve(kind === 'null' ? null : refusal);
    const [outA, outB] = await outcomes;
    assert.equal(callsB, 1); assert.equal(outB.status, 'fulfilled');
    if (outB.status === 'fulfilled') assert.equal(outB.value, result);
    assert.equal(outA.status, kind === 'rejected' ? 'rejected' : 'fulfilled');
    assert.equal(b(doc), pendingB); assert.equal(await b(doc), result); assert.equal(callsB, 1);
  });
}
test('a failed pending result evicted by LRU cannot remove a newer same-key success in the same evaluator', async () => {
  const doc = document(30), old = deferred(), result = success(700); let firstCalls = 0;
  const memo = rememberedEvaluate(async current => {
    if (current.parameters.index === 0 && ++firstCalls === 1) return old.promise;
    return result;
  });
  const first = memo(doc), failed = assert.rejects(first, /Evicted old evaluation/);
  for (let index = 1; index <= 16; index++) await memo(document(30, index));
  const replacement = memo(structuredClone(doc)); assert.equal(await replacement, result); assert.equal(firstCalls, 2);
  old.reject(new Error('Evicted old evaluation')); await failed;
  assert.equal(memo(doc), replacement); assert.equal(firstCalls, 2);
});
test('each evaluator retains the existing sixteen-entry LRU and refreshes a reused entry', async () => {
  const calls = new Map<number, number>(), memo = rememberedEvaluate(async doc => {
    const index = doc.parameters.index; calls.set(index, (calls.get(index) ?? 0) + 1); return success(index);
  });
  const saved: Promise<EvalResult | null>[] = [];
  for (let index = 0; index < 16; index++) { saved[index] = memo(document(31, index)); await saved[index]; }
  assert.equal(memo(document(31, 0)), saved[0]);
  await memo(document(31, 16));
  assert.equal(memo(document(31, 0)), saved[0]);
  const remade = memo(document(31, 1)); await remade;
  assert.notEqual(remade, saved[1]); assert.equal(calls.get(0), 1); assert.equal(calls.get(1), 2); assert.equal(calls.get(16), 1);
});
test('another evaluator filling its own LRU cannot evict this evaluator successful result', async () => {
  const doc = document(32), result = success(800); let callsA = 0;
  const a = rememberedEvaluate(async () => { callsA++; return result; });
  const b = rememberedEvaluate(async () => success(801));
  const first = a(doc); await first;
  for (let index = 1; index <= 17; index++) await b(document(32, index));
  assert.equal(a(structuredClone(doc)), first); assert.equal(callsA, 1);
});
