import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server.edge';
import type { MeasurePick, MeasureResult } from '@barocss/cad-model/app/measure';
import { rectanglePart } from '@barocss/cad-model/engine/doc';
import { evaluateDoc, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import { MeasurementInspector } from '../src/ui/MeasurementInspector';
import { measureQuantityText } from '../src/ui/quantityText';

function inspector(measured: MeasureResult, bodies: BodyResult[] = []) {
  const picks: MeasurePick[] = bodies.length ? [{ body: 0, edge: 0 }, { body: 0, face: 0 }] : [];
  const targets = picks.map(pick => ({ pick, body: bodies[0].key, label: 'Test body', mesh: bodies[0].mesh }));
  return renderToStaticMarkup(createElement(MeasurementInspector, {
    targets, items: targets.map(({ pick, mesh }) => ({ pick, mesh })), measured, onClose() {},
  }));
}

test('Measure passes every scalar to the existing nonzero display policy before adding units', () => {
  const evaluated = evaluateDoc(rectanglePart(10, 10, 10), 1);
  assert.ok(evaluated.ok);
  const [body] = evaluated.bodies, mesh = body.mesh;
  const synthetic = { ...body, mesh: {
    ...mesh, edgeLines: Float64Array.of(0, 0, 0, 0.004, 0, 0), edgeOfSegment: Float32Array.of(0, 0),
    edges: [{ ...mesh.edges[0], straight: true }],
    faces: [{ ...mesh.faces[0], kind: 'curved' as const, area: 0.0004, radius: 0.0004 }],
  } };
  const measured: MeasureResult = {
    distance: 0.004, normalDistance: 0.0004, angle: 0.004,
    a: [0, 0, 0], b: [-0.004, 0.004, -0],
    axes: { angle: 0.0004, offset: 0.004, coaxial: false },
  };
  const before = structuredClone(measured), html = inspector(measured, [synthetic]);
  assert.match(html, /Length <b>4\.00e-3 mm<\/b>/);
  assert.match(html, /Area <b>4\.00e-4 mm² \(mesh\)<\/b>/);
  assert.match(html, /Radius <b>4\.00e-4 mm<\/b>/);
  assert.match(html, /Distance <b>4\.00e-3 mm<\/b>/);
  assert.match(html, /Normal distance <b>4\.00e-4 mm<\/b>/);
  assert.match(html, /Angle <b>4\.00e-3°<\/b>/);
  assert.match(html, /Axes <b>4\.00e-4° apart, 4\.00e-3 mm off.*mesh fit.*<\/b>/);
  assert.match(html, /ΔX ΔY ΔZ <b>-4\.00e-3, 4\.00e-3, 0<\/b>/);
  assert.deepEqual(measured, before);

  const native = { ...synthetic, mesh: { ...synthetic.mesh,
    faces: [{ ...synthetic.mesh.faces[0], nativeArea: 0.0005 }],
  } };
  assert.match(inspector(measured, [native]), /Area <b>5\.00e-4 mm²<\/b>/);
});

test('Measure keeps exact zeros, ordinary values, missing values and the coaxial decision', () => {
  const ordinary = inspector({
    distance: 1.234, a: [0, 0, 0], b: [0, -0, 1.234], axes: { angle: 0.0004, offset: 0.0004, coaxial: true },
  });
  assert.match(ordinary, /Distance <b>1\.23 mm<\/b>/);
  assert.match(ordinary, /Axes <b>coaxial.*mesh fit.*<\/b>/);
  assert.match(ordinary, /ΔX ΔY ΔZ <b>0, 0, 1\.23<\/b>/);
  assert.doesNotMatch(ordinary, /Normal distance|Angle <b>/);
  const zero = inspector({ distance: -0, normalDistance: 0, angle: -0, a: [0, 0, 0], b: [0, -0, 0] });
  assert.match(zero, /Distance <b>0 mm<\/b>/);
  assert.match(zero, /Normal distance <b>0 mm<\/b>/);
  assert.match(zero, /Angle <b>0°<\/b>/);
  const exceptional = inspector({ distance: Infinity, normalDistance: NaN, a: [0, 0, 0], b: [Number.MIN_VALUE, 0, 0] });
  assert.match(exceptional, /Distance <b>Infinity mm<\/b>/);
  assert.match(exceptional, /Normal distance <b>NaN mm<\/b>/);
  assert.match(exceptional, /ΔX ΔY ΔZ <b>4\.94e-324, 0, 0<\/b>/);
});

test('the two Measure label precisions retain their existing nonzero rounding', () => {
  assert.equal(measureQuantityText(0.0049, 3), '0.01');
  assert.equal(measureQuantityText(0.0049, 2), '4.90e-3');
  assert.equal(measureQuantityText(-0.004, 2), '-4.00e-3');
  assert.equal(measureQuantityText(1.234, 2), '1.23');
  assert.equal(measureQuantityText(-0, 2), '0');
});
