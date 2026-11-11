import assert from 'node:assert/strict';
import test from 'node:test';
import { validate } from '@barocss/cad-model/chat/contract';
import { requirementEvidenceOf } from '@barocss/cad-model/chat/requirementEvidence';
import { emptyDoc, type PartInstance, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import type { Requirement } from '@barocss/cad-model/engine/schema/spec';
import { faceDiagnosisMatchesDocument, isFaceDiagnosisSelection, missingFaceDiagnosis } from '../src/chat/faceDiagnosis';
import { readSelectedFaceDiagnosis, selectedFaceDiagnosisTool, SELECTED_FACE_DIAGNOSIS } from '../server/selectedFaceDiagnosis';
import { claudeArgs } from '../server/chatServer';

const requirement: Requirement = { id: 'WIDTH', source: 'Named width is 12 mm', hard: true,
  check: { query: { fn: 'distance_between', a: 'n1.side3', b: 'n1.side1' }, op: '==', value: 12, unit: 'mm' } };
const plate = (points: [number, number][]): StudioDoc => ({ ...emptyDoc(), nextId: 2, nodes: [
  { id: 'n0', kind: 'sketch', profile: 'polygon', points },
  { id: 'n1', kind: 'extrude', sketch: 0, height: 4 },
], requirements: [requirement] });
const square = plate([[0, 0], [12, 0], [12, 8], [0, 8]]);
const triangle = plate([[0, 0], [12, 0], [12, 8]]);
const instance = (id: string, doc: StudioDoc): PartInstance => ({ id, name: id, position: [0, 0, 0], rotation: [0, 0, 0], doc });
const host = (id: string, doc: StudioDoc) => instance(id, { ...emptyDoc(), instances: [instance('p1', doc)] });
const doc: StudioDoc = { ...emptyDoc(), instances: [host('p1', triangle), host('p2', square)] };
const evaluate = async (d: StudioDoc) => evaluateDoc(d, 1);

test('a selected face diagnosis rechecks exactly its current occurrence and authored face', async () => {
  const report = await requirementEvidenceOf(doc, 'p1/p1', evaluate);
  assert.ok(!('error' in report));
  const row = report.evidence[0], pin = missingFaceDiagnosis(report, row);
  assert.ok(pin && isFaceDiagnosisSelection(pin));
  assert.equal(isFaceDiagnosisSelection({ ...pin, arbitrary: true }), false);
  assert.equal(isFaceDiagnosisSelection({ ...pin, face: 'n1.side1|n1.side3' }), false);
  assert.equal(missingFaceDiagnosis(report, { ...row, result: { ...row.result, late: true } }), undefined);
  assert.equal(missingFaceDiagnosis(report, { ...row, result: { ...row.result, part: 'p2/p1' } }), undefined);
  assert.equal(faceDiagnosisMatchesDocument(doc, { ...pin, face: 'n1.top' }), false);
  assert.equal(faceDiagnosisMatchesDocument(doc, { ...pin, criterion: '0'.repeat(64) }), false);
  assert.equal(faceDiagnosisMatchesDocument(doc, pin), true);
  const exact = await readSelectedFaceDiagnosis(pin, doc, evaluate, {});
  assert.deepEqual(validate(selectedFaceDiagnosisTool.outputSchema, exact), []);
  assert.deepEqual(exact, { revision: report.revision, definitionRevision: report.definitionRevision, part: 'p1/p1', requirement,
    face: 'n1.side3', status: 'unresolved', reason: 'no face or edge named "n1.side3"', repair: 'unsupported' });
  const other = await readSelectedFaceDiagnosis({ ...pin, part: 'p2/p1' }, doc, evaluate);
  assert.match(other.error ?? '', /could not be confirmed/);
  const unavailable = await readSelectedFaceDiagnosis(pin, doc, async () => null);
  assert.match(unavailable.error ?? '', /could not be confirmed/);
  const never = async () => assert.fail('A rejected pin or argument must not evaluate geometry.');
  const argument = await readSelectedFaceDiagnosis(pin, doc, never, { part: 'p2/p1' });
  assert.match(argument.error ?? '', /takes no arguments/);
  const restored = { ...doc, instances: [host('p1', square), host('p2', square)] };
  const stale = await readSelectedFaceDiagnosis(pin, restored, never);
  assert.match(stale.error ?? '', /does not match the current occurrence and revision/);
});

test('the selected face diagnosis tool is allowed only for a turn with its attachment', () => {
  const options = { mcpConfig: '{}', model: 'local' }, tool = 'mcp__cad__' + SELECTED_FACE_DIAGNOSIS;
  for (const enabled of [false, true]) {
    const args = claudeArgs({ ...options, selectedFaceDiagnosis: enabled });
    assert.equal(args[args.indexOf('--allowedTools') + 1].split(',').includes(tool), enabled);
  }
});
