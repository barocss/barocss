import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { curveDomain, evaluateCurve, evaluateCurveD1 } from '@barocss/cad';
import { parseBaroCadSource } from '../dist/native.js';
import { BaroCADLoader } from '../dist/three.js';
import { createCurveOperationCases, displayOptions } from './curve-operations-fixture.mjs';

assert.equal(process.argv.length, 3, 'Usage: node curve-operations-verify.mjs <evidence-directory>');
const evidence = resolve(process.argv[2]);
const loader = new BaroCADLoader(displayOptions);
const summary = [];
for (const item of createCurveOperationCases()) {
  const saved = JSON.parse(readFileSync(resolve(evidence, `${item.key}.owned-result.json`), 'utf8'));
  const originalSource = readFileSync(resolve(evidence, `${item.key}.original.barocad`), 'utf8');
  const outputSource = readFileSync(resolve(evidence, `${item.key}.output.barocad`), 'utf8');
  const servedSource = readFileSync(new URL(`./curve-operations-data/${item.key}.barocad`, import.meta.url), 'utf8');
  assert.deepEqual(saved, item.result);
  item.validate(saved);
  assert.equal(originalSource, saved.originalSource);
  assert.equal(outputSource, saved.source);
  assert.equal(servedSource, saved.source);
  assert.equal(parseBaroCadSource(originalSource, displayOptions).model.objects[0].id, saved.original.id);
  const neutral = parseBaroCadSource(outputSource, displayOptions);
  assert.deepEqual(neutral.model.objects[0], saved.curve);
  assert.equal(neutral.curves.length, 1);
  const three = loader.parse(outputSource);
  assert.equal(three.group.children.length, 1);
  assert.equal(three.group.children[0].type, 'Line');
  assert.deepEqual(three.group.children[0].userData.barocss.nativeParameters, neutral.curves[0].sample.parameters);
  assert.deepEqual(Array.from(three.group.children[0].geometry.getAttribute('position').array),
    Array.from(neutral.curves[0].positions));
  assert.deepEqual(curveDomain(saved.curve), item.key === 'interval' ? [-1, 4] :
    item.key === 'refined' ? [-0, 26] : [-3, 7]);
  for (const t of neutral.curves[0].sample.parameters.slice(0, 3)) {
    assert.deepEqual(evaluateCurve(saved.curve, t), evaluateCurve(neutral.model.objects[0], t));
  }
  if (item.key === 'reversed') {
    const t = 0;
    const mapped = -3 + (7 - t);
    const d1 = evaluateCurveD1(saved.original, mapped);
    const reversed = evaluateCurveD1(saved.curve, t);
    assert.ok(Math.hypot(...reversed.derivative.map((value, axis) => value + d1.derivative[axis])) < 1e-7);
    assert.equal(saved.provenance.decreasingParameterMap.d1Factor, -1);
  }
  if (item.key === 'interval') {
    assert.deepEqual(evaluateCurve(saved.original, 0), evaluateCurve(saved.curve, 0));
    assert.throws(() => evaluateCurveD1(saved.original, 1));
  }
  if (item.key === 'refined') {
    assert.equal(saved.provenance.operations.length, 11);
    assert.deepEqual(evaluateCurve(saved.original, 12), evaluateCurve(saved.curve, 12));
    assert.ok(Object.is(saved.original.controlPoints[0][0], -0));
  }
  summary.push({ key: item.key, originalId: saved.original.id, outputId: saved.curve.id,
    originalPoles: saved.original.controlPoints.length, outputPoles: saved.curve.controlPoints.length,
    samples: neutral.curves[0].sample.pointsMM.length, threeLines: 1, sourceBytes: Buffer.byteLength(outputSource) });
  three.dispose();
  three.dispose();
}
const validSource = readFileSync(resolve(evidence, 'reversed.output.barocad'), 'utf8');
assert.throws(() => new BaroCADLoader({ ...displayOptions, sourceVersion: 1 }).parse(validSource));
assert.throws(() => new BaroCADLoader({ ...displayOptions, curveDisplay: { ...displayOptions.curveDisplay, version: 2 } }).parse(validSource));
assert.throws(() => new BaroCADLoader({ ...displayOptions, curveDisplay: { ...displayOptions.curveDisplay, maxSegments: 4093 } }).parse(validSource));
assert.throws(() => loader.parse('@model invalid {}'));
console.log(JSON.stringify(summary));
