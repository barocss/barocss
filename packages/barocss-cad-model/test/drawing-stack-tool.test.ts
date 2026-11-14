import test from 'node:test';
import assert from 'node:assert/strict';
import { annotationsOf, outputSchemaOf, validate } from '../src/chat/contract';
import { v2Result } from '../src/chat/groups';
import { BATCHABLE_TOOLS, runTool } from '../src/chat/tools';
import type { StudioDoc } from '../src/engine/doc';
import type { Tolerance } from '../src/drawing/types';
import { stackStock, stackTerms } from './helpers/drawing-stack';

const call = (doc: StudioDoc, action: string, args: Record<string, unknown> = {}) => runTool(
  { doc, bodies: [], approvalRequired: true }, 'drawing', { action, ...args },
  async () => { throw new Error('A drawing read must not request a document commit.'); },
);
const read = async (doc: StudioDoc, action: string, args?: Record<string, unknown>) => {
  const before = structuredClone(doc);
  const out = await call(doc, action, args);
  assert.equal(out.changed, false);
  assert.equal(out.state.doc, doc);
  assert.deepEqual(doc, before);
  return { ...out, result: JSON.parse(out.content) };
};

test('discover the current dimensions and calculate actual signed limits in read-only mode', async () => {
  const doc = stackStock();
  const { isError, result } = await read(doc, 'dimensions');
  assert.equal(isError, false);
  assert.match(result.revision, /^[a-f0-9]{64}$/);
  assert.deepEqual([result.sheet, result.scope, result.unit, result.printUnit], [1, { kind: 'assembly' }, 'mm', 'inch']);
  assert.deepEqual(result.dimensions.map((d: { id: string; value: number }) => [d.id, d.value]), [['set_material', 30], ['insert', 20]]);
  assert.match(result.dimensions[0].printed, /1\.18/);
  const calculated = await read(doc, 'stack', { expectedRevision: result.revision, terms: stackTerms });
  assert.equal(calculated.isError, false, calculated.content);
  assert.deepEqual([calculated.result.nominal, calculated.result.minimum, calculated.result.maximum], ['10', '9.85', '10.25']);
  assert.deepEqual(calculated.result.terms.map((d: { authoredTolerance: Tolerance; sign: number }) => [d.authoredTolerance, d.sign]),
    [[{ kind: 'deviation', lower: -0.1, upper: 0.2 }, 1], [{ kind: 'symmetric', value: 0.05 }, -1]]);
  for (const [name, content] of [['get_drawing_dimensions', JSON.stringify(result)], ['calculate_drawing_tolerance_stack', calculated.content]]) {
    assert.deepEqual(validate(outputSchemaOf(name)!, JSON.parse(content)), []);
    assert.equal(annotationsOf(name).readOnlyHint, true);
    assert.equal(BATCHABLE_TOOLS.has(name), false);
    assert.equal(JSON.parse(v2Result(content, name))[name === 'get_drawing_dimensions' ? 'dimensions' : 'terms'][0].id, 'set_material');
  }
});

test('a revision binds the authored document and selected sheet', async () => {
  const doc = stackStock();
  doc.drawing!.sheets = [{ id: 'Top', name: 'Top dimensions', views: ['top'] }];
  const first = await read(doc, 'dimensions');
  const second = await read(doc, 'dimensions', { sheet: 2 });
  assert.deepEqual(first.result.dimensions, []);
  assert.equal(second.result.sheetName, 'Top dimensions');
  assert.equal(second.result.dimensions.length, 2);
  assert.notEqual(first.result.revision, second.result.revision);
  const wrong = await read(doc, 'stack', { expectedRevision: second.result.revision, terms: stackTerms });
  assert.equal(wrong.isError, true);
  assert.match(wrong.result.error, /selected sheet changed/);
  const args = { sheet: 2, expectedRevision: second.result.revision, terms: stackTerms };
  assert.equal((await read(doc, 'stack', args)).isError, false);
  for (const changed of [
    { ...doc, drawing: { ...doc.drawing!, dimensions: doc.drawing!.dimensions.map(d => ({ ...d, tol: { kind: 'symmetric' as const, value: 0.2 } })) } },
    { ...doc, instances: doc.instances!.map(i => ({ ...i, hidden: true })) },
  ]) {
    const refused = await read(changed, 'stack', args);
    assert.equal(refused.isError, true);
    assert.match(refused.result.error, /changed/);
    assert.equal(refused.result.minimum, undefined);
  }
});

test('invalid inputs and unavailable tolerances never return a partial range', async () => {
  const doc = stackStock();
  const { result } = await read(doc, 'dimensions');
  const revision = result.revision;
  for (const [args, why] of [
    [{ terms: stackTerms }, /expectedRevision/],
    [{ sheet: 2, terms: stackTerms, expectedRevision: revision }, /from 1 to 1/],
    [{ terms: [stackTerms[0], { id: 'insert', sign: 0 }], expectedRevision: revision }, /sign of 1 or -1/],
    [{ terms: [stackTerms[0], { ...stackTerms[1], value: 20 }], expectedRevision: revision }, /sign of 1 or -1/],
    [{ terms: [stackTerms[0], stackTerms[0]], expectedRevision: revision }, /only once/],
    [{ terms: [stackTerms[0], { id: 'missing', sign: -1 }], expectedRevision: revision }, /missing from/],
  ] as const) {
    const refused = await read(doc, 'stack', args);
    assert.equal(refused.isError, true);
    assert.match(refused.result.error, why);
    assert.equal(refused.result.maximum, undefined);
  }
  for (const [changed, why] of [
    [{ ...doc, instances: [] }, /cannot resolve/],
    [{ ...doc, drawing: { ...doc.drawing!, dimensions: doc.drawing!.dimensions.map(d => ({ ...d, tol: undefined })) } }, /explicit numeric tolerance/],
    [{ ...doc, drawing: { ...doc.drawing!, dimensions: doc.drawing!.dimensions.map(d => ({ ...d, tol: { kind: 'fit' as const, code: 'h7' } })) } }, /uses a fit/],
  ] satisfies [StudioDoc, RegExp][]) {
    const list = await read(changed, 'dimensions');
    assert.equal(list.isError, false);
    const refused = await read(changed, 'stack', { expectedRevision: list.result.revision, terms: stackTerms });
    assert.equal(refused.isError, true);
    assert.match(refused.result.error, why);
    assert.equal(refused.result.nominal, undefined);
  }
});
