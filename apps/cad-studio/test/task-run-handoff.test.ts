import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import test from 'node:test';
import { encodeStudioFile } from '@barocss/cad-model/engine/container';
import { digestOf, sha256Hex } from '@barocss/cad-model/util/digest';
import { cliMain } from '../server/cadCli';
import { deriveLocalRunPlan } from '../server/taskRun/localPlan';
import { readTaskRunOffer } from '../src/chat/taskRunOffer';
import { TurnChunker } from '../src/chat/transport';
import { encodeTaskRunHandoff, readTaskRunHandoff } from '../src/files/taskRunHandoff';
import { planWorkingTaskReplacement } from '../src/files/workingTaskReplacement';
import { fixtureDoc, holeDiameterDocs } from './task-run-fixture';

function fixture() {
  const doc = fixtureDoc(), native = encodeStudioFile(doc), occurrences = ['p1', 'p2'];
  const plan = deriveLocalRunPlan(doc, 'housing.bcad', sha256Hex(native), occurrences);
  const offer = readTaskRunOffer({ revision: digestOf(doc), occurrences, targets: plan.targets });
  assert.ok(offer);
  return { doc, native, offer };
}

test('D646 replan requires a changed diameter criterion rather than a different name for the same face', () => {
  const { source } = holeDiameterDocs(), working = structuredClone(source);
  const pin = { occurrence: 'p1', feature: 'n2', field: 'diameter' as const, attemptId: '1:1:p1' };
  const check = working.instances![0].doc.requirements![0].check;
  check.query = { fn: 'hole_diameter', face: 'n2.side0' };
  assert.throws(() => planWorkingTaskReplacement(source, working, pin), /changed stated dimension/);
  check.value = 8;
  assert.deepEqual(planWorkingTaskReplacement(source, working, pin).targets,
    [{ id: 'p1', requirementId: 'bore', toleranceMm: 0.001, currentDiameterMm: 4, diameterMm: 8 }]);
});

test('D618 preserves exact native bytes and carries only the selected plan', async () => {
  const { doc, native, offer } = fixture();
  const bytes = await encodeTaskRunHandoff(offer, native);
  const prefix = 12, length = new DataView(bytes.buffer).getUint32(8, true);
  assert.deepEqual(bytes.subarray(prefix + length), native);
  const read = await readTaskRunHandoff(Buffer.from(bytes));
  assert.deepEqual(read, { doc, offer, sourceSHA256: sha256Hex(native) });
  await assert.rejects(encodeTaskRunHandoff({ ...offer, revision: '0'.repeat(64) }, native), /saved model differs/);
  const blocked = fixtureDoc();
  blocked.instances![1].doc.requirements![0].basis = 'ambiguous';
  await assert.rejects(encodeTaskRunHandoff({ ...offer, revision: digestOf(blocked) }, encodeStudioFile(blocked)), /executable local plan/);
});

test('D618 rejects changed source and rechecksummed targets before creating a run directory', async () => {
  const { native, offer } = fixture(), original = Buffer.from(await encodeTaskRunHandoff(offer, native));
  const prefix = 12, length = original.readUInt32LE(8);
  const envelope = JSON.parse(original.subarray(prefix, prefix + length).toString('utf8'));
  envelope.receipt.offer.targets[0].heightMm = 7;
  envelope.digest = digestOf(envelope.receipt);
  const header = Buffer.from(JSON.stringify(envelope)), marker = Buffer.from(original.subarray(0, prefix));
  marker.writeUInt32LE(header.length, 8);
  const forged = Buffer.concat([marker, header, original.subarray(prefix + length)]);
  const changed = Buffer.concat([original, Buffer.from('\n')]);
  const root = mkdtempSync(join(tmpdir(), 'barocss-run-handoff-'));
  try {
    const path = join(root, 'handoff.bcad-task'), run = join(root, 'run');
    for (const [bytes, error] of [[forged, /reviewed targets do not match/], [changed, /saved source does not match/]] as const) {
      writeFileSync(path, bytes);
      let stderr = '';
      const exit = await cliMain(['task-run', 'start', run, '--handoff', path], {
        stdout: new Writable({ write(_chunk, _encoding, done) { done(); } }),
        stderr: new Writable({ write(chunk, _encoding, done) { stderr += chunk.toString(); done(); } }),
      });
      assert.equal(exit, 1, stderr);
      assert.match(stderr, error);
      assert.equal(existsSync(run), false);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('D618 the transport binds a ready offer to its browser source and omits failed and unowned offers', () => {
  const { offer } = fixture();
  const event = { type: 'tool' as const, name: 'requirements', input: { action: 'plan_tasks', occurrences: offer.occurrences },
    summary: '2 local height targets ready', isError: false, taskRunOffer: offer };
  const action = new TurnChunker('captured-source').chunks(event).at(-1);
  assert.deepEqual(action?.type === 'tool-output-available' ? action.output : undefined,
    { summary: event.summary, taskRun: { offer, sourceKey: 'captured-source' } });
  const unsaved = new TurnChunker().chunks(event).at(-1);
  assert.deepEqual(unsaved?.type === 'tool-output-available' ? unsaved.output : undefined, { summary: event.summary });
  assert.equal(new TurnChunker('captured-source').chunks({ ...event, isError: true }).at(-1)?.type, 'tool-output-error');
});
