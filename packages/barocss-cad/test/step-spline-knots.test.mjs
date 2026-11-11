import assert from 'node:assert/strict';
import test from 'node:test';
import { BrepError, brepMassProperties, checkBrep, curveDomain, evaluateCadPart, evaluateCurve,
  evaluateSurface, exportStep, importStep, surfaceDomain } from '../dist/index.js';
import { knotBoxStep, knotCurveStep, stepSolidGraph } from './step-spline-knot-fixtures.mjs';

const part = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const authored = evaluateCadPart(part([
  { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 8] },
  { id: 'e', kind: 'extrude', sketch: 's', height: 5 },
]));
const boxStep = exportStep(authored.outputs[0].brep);
const close = (actual, expected, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} vs ${expected}`);
const closePoint = (actual, expected) => {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, k) => close(value, expected[k], 1e-10));
};
const readPart = text => evaluateCadPart(part([{ id: 'imported', kind: 'import', step: text }]));
const unitWeights = kind => kind === 'CURVE' ? [1, 1] : [[1, 1], [1, 1]];
const graphConsumer = kind => kind === 'CURVE' ? 'EDGE_CURVE(' : 'ADVANCED_FACE(';

function checkGraph({ text, target }, kind) {
  const graph = stepSolidGraph(text);
  assert.ok(graph.reached.has(target));
  assert.ok(graph.incoming(target).some(entity => entity.startsWith(graphConsumer(kind))));
}

function checkRefusal({ text, target }, detail, category, identified = true) {
  assert.throws(() => importStep(text), error => {
    assert.ok(error instanceof BrepError);
    assert.equal(error.code, 'INPUT');
    assert.match(error.message, detail);
    if (identified) assert.ok(error.message.includes('#' + target));
    return true;
  });
  assert.throws(() => readPart(text), error => {
    assert.equal(error.code, category);
    assert.equal(error.feature, 'imported');
    assert.match(error.message, detail);
    return true;
  });
}

for (const kind of ['CURVE', 'SURFACE']) {
  for (const type of ['BEZIER', 'QUASI_UNIFORM', 'UNIFORM']) {
    test(`STEP distinguishes the valid reached ${type}_${kind} capability boundary`, () => {
      const form = `${type}_${kind}`;
      const fixture = knotBoxStep(boxStep, kind, form, { weights: unitWeights(kind) });
      checkGraph(fixture, kind);
      checkRefusal(fixture, new RegExp(form + ' is not supported yet'), 'CAPABILITY');
    });
  }
  test(`STEP identifies malformed complex ${kind} knot components`, () => {
    const cases = [
      ['missing', /missing a knot-form component/],
      ['duplicate', /conflicting or duplicate knot-form components/],
      ['contradictory', /conflicting or duplicate knot-form components/],
      ['no-base', new RegExp(`missing its B_SPLINE_${kind} component`)],
      ['bad-implicit', new RegExp(`malformed QUASI_UNIFORM_${kind} component attributes`)],
    ];
    for (const [form, detail] of cases) {
      const fixture = knotBoxStep(boxStep, kind, form, { weights: unitWeights(kind) });
      checkGraph(fixture, kind);
      checkRefusal(fixture, detail, 'INPUT');
    }
    const simple = knotBoxStep(boxStep, kind, 'simple:UNIFORM_' + kind);
    checkGraph(simple, kind);
    checkRefusal(simple, new RegExp(`UNIFORM_${kind}.*not supported yet`), 'CAPABILITY', false);
  });
}

test('STEP preserves explicit polynomial and rational spline data and independent box geometry', () => {
  const analytic = importStep(boxStep);
  const faceNames = analytic.faces.map(face => face.name).sort();
  const baseVolume = brepMassProperties(analytic, 1);
  close(baseVolume.volume, 400);
  closePoint(baseVolume.centroid, [5, 4, 2.5]);
  for (const rational of [false, true]) {
    const form = rational ? 'explicit' : 'polynomial';
    const curveWeights = rational ? [1, 3] : [1, 1];
    const surfaceWeights = rational ? [[1, 2], [3, 6]] : [[1, 1], [1, 1]];
    const curve = knotBoxStep(boxStep, 'CURVE', form, { weights: rational ? curveWeights : undefined });
    const surface = knotBoxStep(curve.text, 'SURFACE', form, { weights: rational ? surfaceWeights : undefined });
    checkGraph(curve, 'CURVE');
    checkGraph(surface, 'SURFACE');
    const brep = importStep(surface.text);
    const checked = checkBrep(brep, { strict: true });
    assert.ok(checked.valid, JSON.stringify(checked.issues));
    assert.deepEqual(brep.faces.map(face => face.name).sort(), faceNames);
    const mass = brepMassProperties(brep, 1);
    close(mass.volume, 400);
    closePoint(mass.centroid, [5, 4, 2.5]);
    const edge = brep.edges.find(edge => edge.name === 'e.bottom|e.side0')?.curve;
    assert.ok(edge);
    assert.equal(edge.degree, 1);
    assert.deepEqual(curveDomain(edge), [-2, 6]);
    assert.deepEqual(edge.knots, [-2, -2, 6, 6]);
    assert.deepEqual(edge.weights, curveWeights);
    assert.deepEqual(edge.controlPoints, [[0, 0, 0], [10, 0, 0]]);
    closePoint(evaluateCurve(edge, 2), [rational ? 7.5 : 5, 0, 0]);

    const top = brep.faces.find(face => face.name === 'e.top');
    assert.equal(top.sense, 'forward');
    const patch = top.surface;
    assert.deepEqual([patch.degreeU, patch.degreeV], [1, 1]);
    assert.deepEqual(patch.knotsU, [2, 2, 6, 6]);
    assert.deepEqual(patch.knotsV, [-3, -3, 1, 1]);
    assert.deepEqual(surfaceDomain(patch), { u: [2, 6], v: [-3, 1] });
    assert.deepEqual(patch.controlPoints, [[[0, 0, 5], [0, 8, 5]], [[10, 0, 5], [10, 8, 5]]]);
    assert.deepEqual(patch.weights, surfaceWeights);
    closePoint(evaluateSurface(patch, 4, -1), [rational ? 7.5 : 5, rational ? 16 / 3 : 4, 5]);
    const [output] = readPart(surface.text).outputs;
    assert.equal(output.id, 'imported');
    assert.ok(output.brep.faces.some(face => face.name === 'imported.e.top'));
  }
});

test('STEP uses the same knot handling in a shared extrusion or revolution basis', () => {
  for (const [consumer, label, volume] of [
    ['extrusion', 'SURFACE_OF_LINEAR_EXTRUSION', 1400 / 3],
    ['revolution', 'SURFACE_OF_REVOLUTION', 666 * Math.PI / 5],
  ]) {
    const polynomial = knotCurveStep(consumer, 'polynomial');
    const accepted = knotCurveStep(consumer, 'explicit', { weights: [1, 1, 1] });
    const refused = knotCurveStep(consumer, 'BEZIER_CURVE', { weights: [1, 1, 1] });
    const graph = stepSolidGraph(refused.text);
    assert.ok(graph.reached.has(refused.target));
    assert.ok(graph.incoming(refused.target).some(entity => entity.startsWith(label + '(')));
    assert.ok(graph.incoming(refused.target).length > 1, 'the curve also supplies a reached boundary');
    checkRefusal(refused, /BEZIER_CURVE is not supported yet/, 'CAPABILITY');
    for (const { text } of [polynomial, accepted]) {
      const brep = importStep(text);
      assert.ok(checkBrep(brep, { strict: true }).valid);
      close(brepMassProperties(brep, 1).volume, volume);
    }
  }
});

test('an unused complex spline does not prevent a supported STEP solid from opening', () => {
  const malformed = knotBoxStep(boxStep, 'SURFACE', 'missing', { weights: [[1, 1], [1, 1]] });
  const row = malformed.text.match(new RegExp(`^#${malformed.target}=(.*);$`, 'm'))?.[1];
  assert.ok(row);
  const unused = boxStep.replace('ENDSEC;\nEND-ISO-10303-21;', `#900000=${row};\nENDSEC;\nEND-ISO-10303-21;`);
  assert.ok(!stepSolidGraph(unused).reached.has(900000));
  const accepted = importStep(unused);
  assert.ok(checkBrep(accepted, { strict: true }).valid);
  close(brepMassProperties(accepted, 1).volume, 400);
});
