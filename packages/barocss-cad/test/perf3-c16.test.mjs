import test from 'node:test';
import assert from 'node:assert/strict';
import { brepMassProperties, brepSurfaceArea, evaluateCadPart, exportStep, importStep } from '../dist/index.js';

// PERF3 C16 (D82): work done once that was done twice, with the same answers.
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const box = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, { id: 'e', kind: 'extrude', sketch: 's', height: 10 }];
const filleted = () => { const edges = evaluateCadPart(D(box)).outputs[0].brep.edges.map(e => e.name); return evaluateCadPart(D([...box, { id: 'f', kind: 'fillet', target: 'e', edges, radius: 2 }])).outputs[0].brep; };

test('C16 quadrature: mass and area of one B-rep share one run — the same values as on B-reps of their own, the second far quicker', () => {
  const a = filleted(), b = filleted(), c = filleted();
  let t0 = performance.now(); const m = brepMassProperties(a, 1000); const first = performance.now() - t0;
  t0 = performance.now(); const area = brepSurfaceArea(a); const second = performance.now() - t0;
  assert.deepEqual(m, brepMassProperties(b, 1000)); assert.equal(area, brepSurfaceArea(c));
  assert.ok(second < 0.2 * first, `${second.toFixed(1)} ms area after ${first.toFixed(1)} ms mass`);
});

test('C16 imports: an edit beside a long STEP text reuses its import (the text is not written into the key again); another text is read anew', () => {
  const step = exportStep([filleted()], { name: 'f' }), pad = `${step.slice(0, step.indexOf('DATA;'))}/* ${'x'.repeat(70000)} */\n${step.slice(step.indexOf('DATA;'))}`;
  const doc = (w, text) => D([{ id: 'i', kind: 'import', step: text }, { id: 's', kind: 'sketch', profile: 'rectangle', min: [100, 0], max: [100 + w, 10] }, { id: 'e', kind: 'extrude', sketch: 's', height: 5 }]);
  let snap = evaluateCadPart(doc(10, pad));
  const v0 = snap.outputs[0].massProperties(1000).volumeMM3;
  snap = snap.withDocument(doc(11, pad));
  assert.equal(snap.outputs[0].massProperties(1000).volumeMM3, v0);
  // A text that differs (the box without its fillet): imported again, its own volume.
  const plain = exportStep([evaluateCadPart(D(box)).outputs[0].brep], { name: 'b' }), padded = `${plain.slice(0, plain.indexOf('DATA;'))}/* ${'y'.repeat(70000)} */\n${plain.slice(plain.indexOf('DATA;'))}`;
  snap = snap.withDocument(doc(11, padded));
  assert.ok(Math.abs(snap.outputs[0].massProperties(1000).volumeMM3 - 12000) < 1e-6, String(snap.outputs[0].massProperties(1000).volumeMM3));
});

test('C16 STEP tokens: comments, a doubled quote, a non-breaking space among the tokens read as before', () => {
  const step = exportStep([evaluateCadPart(D(box)).outputs[0].brep], { name: "it''s" }).replace('DATA;', 'DATA; /* a /* comment */\n');
  const b = importStep(step, { id: 'r' });
  assert.equal(b.faces.length, 6);
  assert.throws(() => importStep("ISO-10303-21;\nDATA;\n#1=PRODUCT('open);\nENDSEC;\nEND-ISO-10303-21;", { id: 'r' }), /unterminated string/);
});
