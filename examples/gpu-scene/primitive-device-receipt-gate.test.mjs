/** Synthetic fixtures validate the receipt evaluator only, NOT GPU acceptance. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePrimitiveDeviceReceipt } from './primitive-device-receipt-gate.mjs';

function image(center = 139) {
  const a = new Uint8Array(256 * 256 * 4);
  for (let i = 0; i < a.length; i += 4) a.set([13, 18, 26, 255], i);
  for (let y = 127; y <= 129; y++) for (let x = 127; x <= 129; x++)
    a.set([center, center, center, 255], (y * 256 + x) * 4);
  return Array.from(a);
}
function sample() {
  const baseline = image(100), updated = image(139);
  return { version: 0, sourceSha: 'synthetic-only', browser: 'fake', device: 'fake',
    width: 256, height: 256, amount: 0.75, phase: 0,
    webgpu: { baseline: { generation: 1, pixels: baseline }, updated: { generation: 2, pixels: updated },
      refused: { generation: 2, pixels: updated.slice() }, refusalCode: 'INPUT' },
    webgl2: { baseline: { generation: 1, pixels: baseline.slice() }, updated: { generation: 2, pixels: updated.slice() },
      refused: { generation: 2, pixels: updated.slice() }, refusalCode: 'PROFILE' },
  };
}
test('synthetic exact-window receipt validates evaluator mechanics only', () => {
  const r = evaluatePrimitiveDeviceReceipt(sample());
  assert.equal(r.pass, true);
  assert.equal(r.parity.center.withinTolerance, true);
  assert.match(r.scope, /needs independent witness/);
});
test('failing update generation and changed refused pixels never pass', () => {
  const x = sample(); x.webgpu.updated.generation = 1;
  assert.equal(evaluatePrimitiveDeviceReceipt(x).pass, false);
  const y = sample(); y.webgl2.refused.pixels[(128 * 256 + 128) * 4] = 0;
  assert.equal(evaluatePrimitiveDeviceReceipt(y).pass, false);
});
test('center oracle and cross-backend parity distinguish error', () => {
  const x = sample(); x.webgpu.updated.pixels[(128 * 256 + 128) * 4] = 146;
  x.webgpu.refused.pixels[(128 * 256 + 128) * 4] = 146;
  const result = evaluatePrimitiveDeviceReceipt(x);
  assert.equal(result.pass, false);
  assert.equal(result.webgpu.center.pass, false);
  assert.equal(result.parity.center.withinTolerance, false);
});
test('missing actual bytes, source identity and refusal must be rejected', () => {
  const a = sample(); delete a.webgpu.refused.pixels;
  assert.throws(() => evaluatePrimitiveDeviceReceipt(a), TypeError);
  const b = sample(); b.sourceSha = '';
  assert.throws(() => evaluatePrimitiveDeviceReceipt(b), TypeError);
  const c = sample(); c.webgl2.refusalCode = 'STATE';
  assert.throws(() => evaluatePrimitiveDeviceReceipt(c), TypeError);
});
