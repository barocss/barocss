import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, CadPartError, exportStep, importStep } from '../dist/index.js';
import { KernelError, kernelRefusal } from '../dist/core/barocss-error.js';
import { boundaryBindingRefusal } from '../dist/part/part-boundary-refusal-internal.js';
import { baselineBox, withTentStep } from './brep-boundary-binding-fixtures.mjs';

const source = 'brep-boundary-binding';
const partOf = step => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [{ id: 'n0', kind: 'import', step }] });
function thrown(run) {
  try { run(); } catch (error) { return error; }
  assert.fail('Expected a refusal');
}
function baseStep() {
  return exportStep(baselineBox(), { timestamp: '2026-11-01T00:00:00Z' });
}
/** High's repeated-incidence resource witness, not a valid-solid geometry fixture. All production guards stay on. */
function budgetStep(step) {
  const entities = new Map([...step.matchAll(/^#(\d+)=(.*);$/gm)].map(match => [match[1], match[2]]));
  const top = [...entities.values()].filter(value => value.startsWith("ADVANCED_FACE('top',"));
  assert.equal(top.length, 1);
  const bound = /^ADVANCED_FACE\('top',\(#(\d+)\),#\d+,\.[TF]\.\)$/.exec(top[0]);
  assert.ok(bound);
  const loop = /^FACE_OUTER_BOUND\('',#(\d+),\.[TF]\.\)$/.exec(entities.get(bound[1]));
  assert.ok(loop);
  const definition = entities.get(loop[1]);
  const uses = [...definition.matchAll(/#(\d+)/g)].map(match => match[1]);
  const point = vertex => {
    const reference = /^VERTEX_POINT\('',#(\d+)\)$/.exec(entities.get(vertex));
    assert.ok(reference);
    const coordinates = /^CARTESIAN_POINT\('',\(([^)]+)\)\)$/.exec(entities.get(reference[1]));
    assert.ok(coordinates);
    return coordinates[1].split(',').map(Number);
  };
  const extrusionEdges = uses.filter(use => {
    const oriented = /^ORIENTED_EDGE\('',\*,\*,#(\d+),\.[TF]\.\)$/.exec(entities.get(use));
    assert.ok(oriented);
    const curve = /^EDGE_CURVE\('[^']*',#(\d+),#(\d+),/.exec(entities.get(oriented[1]));
    assert.ok(curve);
    const points = [point(curve[1]), point(curve[2])];
    return points.every(p => p[0] === 0 && p[2] === 1) && points.map(p => p[1]).sort().join(',') === '0,1';
  });
  assert.equal(extrusionEdges.length, 1);
  const replacement = `EDGE_LOOP('',(${Array(4097).fill('#' + extrusionEdges[0]).join(',')}))`;
  return step.replace(`#${loop[1]}=${definition};`, `#${loop[1]}=${replacement};`);
}
function assertPartRefusal(step, code) {
  const raw = thrown(() => importStep(step, { id: 'n0' }));
  assert.ok(raw instanceof KernelError);
  assert.equal(raw.code, code);
  assert.equal(raw.details.source, source);
  const doc = partOf(step), before = structuredClone(doc);
  const error = thrown(() => evaluateCadPart(doc));
  assert.ok(error instanceof CadPartError);
  assert.equal(error.code, code);
  assert.equal(error.details.category, code);
  assert.equal(error.feature, 'n0');
  assert.equal(error.message, 'n0: ' + raw.message);
  assert.doesNotMatch(error.message, /unexpected kernel failure/);
  assert.deepEqual(doc, before);
  return raw;
}

test('part import preserves the actual proved-boundary GEOMETRY refusal and exact words', () => {
  const error = assertPartRefusal(withTentStep(baseStep()), 'GEOMETRY');
  assert.match(error.message, /edge is separated from its face surface/);
});
test('part import preserves the real incident-work CAPABILITY refusal instead of mislabelling geometry', () => {
  const error = assertPartRefusal(budgetStep(withTentStep(baseStep())), 'CAPABILITY');
  assert.equal(error.message, 'B-rep: boundary binding proof unavailable: incident edge work limit 4096 exceeded');
});
for (const code of ['GEOMETRY', 'CAPABILITY']) {
  test(`private adapter returns only the owned real ${code} refusal unchanged`, () => {
    const error = kernelRefusal(source, code, 'literal reason');
    assert.equal(boundaryBindingRefusal(error), error);
  });
}
test('ordinary Errors and structural source/code/message spoofs remain outside the typed adapter', () => {
  const detail = { code: 'GEOMETRY', details: { source }, message: 'edge is separated from its face surface' };
  const cases = [null, undefined, 'literal', new Error(detail.message), Object.assign(new Error(detail.message), detail), detail];
  for (const value of cases) assert.equal(boundaryBindingRefusal(value), null);
});
test('foreign typed sources, bare KernelError and unrecognized owned codes retain their prior path', () => {
  const cases = [new KernelError('literal'), kernelRefusal('other-source', 'GEOMETRY', 'literal'), kernelRefusal(source, 'INPUT', 'literal'), kernelRefusal(source, 'BUDGET', 'literal')];
  for (const value of cases) assert.equal(boundaryBindingRefusal(value), null);
});
test('existing legacy STEP syntax refusal retains its INPUT category and plain reason', () => {
  const error = thrown(() => evaluateCadPart(partOf('not STEP')));
  assert.ok(error instanceof CadPartError);
  assert.equal(error.code, 'INPUT');
  assert.equal(error.details.category, 'INPUT');
  assert.equal(error.message, 'n0: no DATA section');
});
