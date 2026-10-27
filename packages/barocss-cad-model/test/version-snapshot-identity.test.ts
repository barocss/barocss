import test from 'node:test';
import assert from 'node:assert/strict';
import { BarocssError } from '@barocss/cad/api';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { defaultDrawing } from '../src/drawing/types';
import { canonical, revisionOf } from '../src/util/revision';
import {
  applyMerge, headOf, idOf, makeBranch, makeVersion, makeVersions, nameVersion,
  readVersion, snapshotKeyOf, type VersionLog,
} from '../src/versions/index';

// Stored identity checks are separate from Drawing/route admission and geometry evaluation.
// FNV content keys are consistency checks, not cryptographic authentication or original-file byte hashes.
const T0 = '2026-10-27T00:00:00.000Z', T1 = '2026-10-27T00:01:00.000Z';
const document = (): StudioDoc => ({
  ...emptyDoc(),
  drawing: { ...defaultDrawing(), frames: [{ id: 'F', view: 'top', place: [12, -8], characteristic: 'position', value: 0.1, datums: [], freeState: false, tangentPlane: false }] },
});
const refuses = (action: () => unknown, detail: RegExp) => assert.throws(action, e => e instanceof BarocssError && e.code === 'VERSION_LOG' && detail.test(e.message));
type Corruption = { detail: RegExp; change: (log: VersionLog, index: number) => void };
const corruptions: Corruption[] = [
  // Drawing is outside revisionOf's fields: the whole-document snapshot key must still detect this edit.
  { detail: /the snapshot .* does not match its content/, change(log, i) { log.snapshots[log.versions[i].snapshot].drawing!.frames![0].value = 0.2; } },
  { detail: /the revision .* is not its document's/, change(log, i) { log.versions[i].revision = 'not-the-stored-revision'; } },
  { detail: /the id .* is not made from the version's content/, change(log, i) { log.versions[i].by = 'changed-author'; } },
];

test('version snapshot identity: raw reads preserve the document and mutable version labels', () => {
  const doc = document(), log = makeVersions(doc, { at: T0, by: 'fixture', name: 'Start' });
  const before = canonical(log), head = headOf(log), raw = readVersion(log, head.id);
  assert.strictEqual(raw, log.snapshots[head.snapshot], 'raw read retains the existing snapshot API');
  assert.deepEqual(raw, doc);
  assert.equal(raw.schema, 3);
  assert.equal(snapshotKeyOf(raw), head.snapshot);
  assert.equal(revisionOf(raw), head.revision);
  assert.equal(idOf(head), head.id);
  assert.equal(canonical(log), before);
  const renamed = nameVersion(log, head.id, { name: 'Renamed', note: 'Only the label changed' });
  assert.equal(renamed.versions[0].id, head.id);
  assert.deepEqual(readVersion(renamed, 'Renamed'), doc);
  assert.equal(canonical(log), before);
});

test('version snapshot identity: key, revision and version-id edits refuse without rewriting the log', () => {
  const accepted = makeVersions(document(), { at: T0, by: 'fixture' }), acceptedBefore = canonical(accepted);
  for (const { detail, change } of corruptions) {
    const bad = structuredClone(accepted);
    change(bad, 0);
    const before = canonical(bad);
    refuses(() => readVersion(bad, bad.versions[0].id), detail);
    assert.equal(canonical(bad), before);
    assert.equal(canonical(accepted), acceptedBefore);
  }
  const missing = structuredClone(accepted), id = missing.versions[0].id;
  delete missing.snapshots[missing.versions[0].snapshot];
  assert.throws(() => readVersion(missing, id), e => e instanceof BarocssError && e.code === 'VERSION_NOT_LOADED' && JSON.stringify(e.details?.ids) === JSON.stringify([id]));
  assert.throws(() => readVersion(accepted, 'missing'), e => e instanceof BarocssError && e.code === 'VERSION_UNKNOWN');
});

test('version snapshot identity: fast-forward checks the incoming raw snapshot before returning work', () => {
  const base = document();
  let log = makeBranch(makeVersions(base, { at: T0, by: 'fixture' }), 'side');
  log = makeVersion(log, { ...base, parameters: { width: 40 } }, { at: T1, by: 'fixture' }).log;
  log = { ...log, current: 'side' };
  const before = canonical(log), result = applyMerge(log, { from: 'main', working: base, at: T1 });
  assert.ok('doc' in result);
  assert.equal(result.fastForward, true);
  assert.equal(result.version, null);
  assert.equal(result.log.versions.length, log.versions.length);
  assert.equal(headOf(result.log).id, log.versions[1].id);
  assert.deepEqual(result.doc, readVersion(log, log.versions[1].id));
  assert.equal(canonical(log), before);
  for (const { detail, change } of corruptions) {
    const bad = structuredClone(log);
    change(bad, 1);
    const badBefore = canonical(bad);
    refuses(() => applyMerge(bad, { from: 'main', working: base, at: T1 }), detail);
    assert.equal(canonical(bad), badBefore);
    assert.equal(canonical(log), before);
  }
});
