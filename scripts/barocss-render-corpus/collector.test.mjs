import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { collectRows, inspectTurn } from './collector.mjs';
import { SCENARIOS } from './plan.mjs';
import { generateMockScreen } from '../barocss-render-loop/mock.mjs';

const session = '00000000-0000-4000-8000-000000000460';
const calibration = { id: '01', initial: { status: 'valid', outputDir: '/private/calibration' },
  next: { status: 'valid', outputDir: '/private/calibration' } };

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'barocss-corpus-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return { dir, manifestFile: path.join(dir, 'corpus.json') };
}

test('valid initial and next screens keep the exact session and name', async () => {
  const initial = await generateMockScreen({ kind: 'initial' });
  const next = await generateMockScreen({ kind: 'next', input: { name: 'Zoë' } });
  assert.equal(inspectTurn(initial, 'initial', 'Zoë').status, 'valid');
  assert.equal(inspectTurn(next, 'next', 'Zoë', session).status, 'valid');
  assert.deepEqual(inspectTurn(next, 'next', 'Zoë', 'different'),
    { status: 'failed', reason: 'provenance-loss' });
  assert.equal(inspectTurn(next, 'next', 'Bea', session).reason, 'next-name-contract');
});

test('four charged calibration dispatches leave sixteen and skip row ten at the ceiling', async (t) => {
  const { dir, manifestFile } = fixture(t);
  const reservations = [];
  const manifest = await collectRows({ manifestFile, calibration,
    reserve: (item) => reservations.push(item),
    outputDirectory: (id) => path.join(dir, id),
    sessionFactory: () => generateMockScreen });
  assert.equal(manifest.priorDispatches, 4);
  assert.equal(manifest.newReservations, 16);
  assert.equal(reservations.length, 16);
  assert.deepEqual(reservations.map((item) => item.ordinal), Array.from({ length: 16 }, (_, i) => i + 5));
  assert.equal(manifest.rows[8].next.status, 'valid');
  assert.equal(manifest.rows[9].initial.status, 'ceiling');
  assert.equal(manifest.rows[9].next.status, 'ceiling');
  assert.equal(JSON.parse(fs.readFileSync(manifestFile, 'utf8')).newReservations, 16);
  await assert.rejects(() => collectRows({ manifestFile, calibration, reserve() {},
    outputDirectory() {}, sessionFactory() {} }), /already exists/);
});

test('an invalid initial screen retains its slot and never dispatches its next turn', async (t) => {
  const { dir, manifestFile } = fixture(t);
  const reservations = [];
  const manifest = await collectRows({ manifestFile, calibration,
    reserve: (item) => reservations.push(item),
    outputDirectory: (id) => path.join(dir, id),
    sessionFactory: (row) => row.id === '02'
      ? async ({ kind }) => kind === 'initial'
        ? { threadId: session, specJson: '{broken' }
        : assert.fail('invalid initial must not dispatch next')
      : generateMockScreen });
  assert.equal(manifest.rows[1].initial.status, 'invalid');
  assert.equal(manifest.rows[1].next.status, 'unattempted');
  assert.equal(manifest.rows[1].next.reason, 'invalid-or-failed-initial');
  assert.equal(manifest.newReservations, 16);
  assert.equal(manifest.rows[9].initial.status, 'valid');
  assert.equal(manifest.rows[9].next.status, 'ceiling');
  assert.equal(reservations.filter((item) => item.rowId === '02').length, 1);
});

test('ambiguous completion stops all later rows without a retry', async (t) => {
  const { dir, manifestFile } = fixture(t);
  const reservations = [];
  const manifest = await collectRows({ manifestFile, calibration, scenarios: SCENARIOS,
    reserve: (item) => reservations.push(item),
    outputDirectory: (id) => path.join(dir, id),
    sessionFactory: () => async () => { throw Object.assign(new Error('CLI turn failed: unknown'),
      { validationCode: 'transport-incomplete' }); } });
  assert.equal(reservations.length, 1);
  assert.equal(manifest.stopReason, 'ambiguous-completion');
  assert.equal(manifest.rows[1].initial.status, 'failed');
  assert.equal(manifest.rows[1].next.status, 'unattempted');
  assert.equal(manifest.rows[2].initial.status, 'unattempted');
});
