import test from 'node:test';
import assert from 'node:assert/strict';
import { fitLimits } from '@barocss/cad';
import { rectanglePart } from '../src/engine/doc';
import { editFitTables } from '../src/engine/fits';
import { editBearingRows } from '../src/engine/bearings';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { evaluatePart } from '../src/engine/evaluate';
import { fitView } from '../src/chat/part/query';
import { dispatchTool } from '../src/chat/tools';
import { outputSchemaOf, validate } from '../src/chat/contract';

const table = { id: 'physical-fixture', sources: [{ id: 'fixture', label: 'Synthetic unit test row', url: 'https://example.invalid/tolerance-fixture', read: '2026-10-25' }], rows: [
  { class: 'H7', over: 10, upTo: 18, upper: 0.018, lower: 0, source: 'fixture' },
  { class: 'g6', over: 10, upTo: 18, upper: -0.006, lower: -0.017, source: 'fixture' },
] };
const bearing = { id: 'fixture-6204', bore: 20, outside: 47, width: 14, chamfer: 1, boreDeviation: [0, -0.01] as [number, number], outsideDeviation: [0, -0.011] as [number, number], source: 'Synthetic unit test row' };
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) <= 1e-12, `${actual} vs ${expected}`);

test('fit public producer and real tool preserve 18 µm and 6–35 µm as .018 and .006–.035 mm, once', async () => {
  const limits = fitLimits([table], 'H7', 'g6', 12), projected = fitView(limits);
  assert.equal(projected.hole.upper, 0.018); assert.equal(projected.hole.lower, 0);
  near(projected.clearanceMin, 0.006); near(projected.clearanceMax, 0.035);
  near(projected.hole.max, 12.018); near(projected.shaft.min, 11.983); near(projected.shaft.max, 11.994);
  assert.equal(projected.kind, 'clearance'); assert.equal(projected.estimate, false); assert.equal(projected.hole.source, 'fixture');
  assert.deepEqual(validate(outputSchemaOf('fit_clearance')!, projected), []);
  const loaded = editFitTables(rectanglePart(10, 10, 10), [table]); assert.ok('doc' in loaded);
  const result = await dispatchTool({ doc: loaded.doc, bodies: [] }, 'fit_clearance', { hole_class: 'H7', shaft_class: 'g6', size: 12 }, async d => evaluatePart(d, 1));
  assert.ok(!result.isError, result.content); assert.deepEqual(JSON.parse(result.content), projected);
  for (const old of ['upperUM', 'lowerUM', 'clearanceMinUM', 'clearanceMaxUM']) assert.ok(!JSON.stringify(projected).includes(`"${old}"`));
});

test('latest fit and bearing rows survive .bcad save/open with source metadata and estimate status intact; old fields are refused', async () => {
  const fit = editFitTables(rectanglePart(10, 10, 10), [table]); assert.ok('doc' in fit);
  const loaded = editBearingRows(fit.doc, [bearing]); assert.ok('doc' in loaded);
  const read = await readStudioFile(encodeStudioFile(loaded.doc)); assert.ok('doc' in read);
  assert.deepEqual(read.doc.fits, loaded.doc.fits); assert.deepEqual(read.doc.bearings, loaded.doc.bearings);
  assert.deepEqual(read.doc.fits!.tables![0].sources, table.sources);
  assert.equal(read.doc.fits!.tables![0].rows[0].estimate, undefined);
  assert.deepEqual(read.doc.bearings!.rows![0].boreDeviation, [0, -0.01]);
  assert.deepEqual(read.doc.bearings!.rows![0].outsideDeviation, [0, -0.011]);
  // Deliberately invalid legacy fields prove that no accepted alias remains.
  const oldFit = editFitTables(read.doc, [{ ...table, id: 'legacy-invalid', rows: [{ ...table.rows[0], upperUM: 18 }] }]);
  assert.ok('error' in oldFit); assert.match(oldFit.error, /unknown field upperUM/);
  const oldBearing = editBearingRows(read.doc, [{ ...bearing, id: 'legacy-invalid', boreDeviationUM: [0, -10] }]);
  assert.ok('error' in oldBearing); assert.match(oldBearing.error, /unknown field boreDeviationUM/);
});
