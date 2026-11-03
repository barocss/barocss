import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleProjectOpenFit } from '../src/app/projectOpenFit';

function clock() {
  const pending: (() => void)[] = [], delays: number[] = [];
  return { delays, schedule(run: () => void, delay: number) { delays.push(delay); pending.push(run); },
    flush() { for (const run of pending.splice(0)) run(); } };
}

test('a current completed project Open fits once after the unchanged 300ms delay', () => {
  const timer = clock(), accepted = {}; let fits = 0;
  scheduleProjectOpenFit(accepted, scope => scope === accepted, () => { fits++; }, timer.schedule);
  assert.equal(fits, 0); assert.deepEqual(timer.delays, [300]);
  timer.flush(); assert.equal(fits, 1); timer.flush(); assert.equal(fits, 1);
});

for (const event of ['new Open', 'document edit', 'project Close', 'App unmount'] as const) {
  test(`a completed Open's delayed fit is dropped after ${event}`, () => {
    const timer = clock(), accepted = {}; let current = accepted, mounted = true, fits = 0;
    scheduleProjectOpenFit(accepted, scope => mounted && scope === current, () => { fits++; }, timer.schedule);
    if (event === 'App unmount') mounted = false; else current = {};
    timer.flush(); assert.equal(fits, 0); assert.deepEqual(timer.delays, [300]);
  });
}

test('an older ready Open cannot fit a newer one, whose own fit remains eligible', () => {
  const timer = clock(), first = {}, second = {}; let current = first; const fitted: object[] = [];
  scheduleProjectOpenFit(first, scope => scope === current, () => fitted.push(first), timer.schedule);
  current = second;
  scheduleProjectOpenFit(second, scope => scope === current, () => fitted.push(second), timer.schedule);
  timer.flush(); assert.deepEqual(fitted, [second]);
});
