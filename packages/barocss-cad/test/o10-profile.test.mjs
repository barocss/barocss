import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart } from '../dist/index.js';
import { documentOf } from '../scripts/rb/fuzz-gen.mjs';

// O10 (D228): evaluateCadPart's `profile` option — each feature's own wall time and its kernel calls, counted at the part
// model's entry points; off by default, and the same bodies either way.
const leaf = (kind, dims, move) => ({ leaf: { kind, ...dims, rot: [], move } });
const tree = { op: 'difference', a: { op: 'union', a: leaf('box', { w: 4, d: 3, h: 2 }, [0, 0, 0]), b: leaf('rbox', { w: 2, d: 2, h: 3, r: 0.4 }, [3, 1, 0]) }, b: leaf('cyl', { r: 0.8, h: 6 }, [1, 1.5, -1]) };

test('O10: profile gives every feature its wall time and kernel calls; without it there is none; the bodies are the same (D228)', () => {
  const { document, root } = documentOf(tree);
  const plain = evaluateCadPart(document), timed = evaluateCadPart(document, undefined, { profile: true });
  assert.equal(plain.profile, undefined);
  const p = timed.profile;
  assert.ok(Object.isFrozen(p));
  assert.deepEqual(Object.keys(p).sort(), document.features.map(f => f.id).sort());
  for (const [id, e] of Object.entries(p)) {
    assert.ok(Number.isFinite(e.ms) && e.ms >= 0, `${id} ms`);
    assert.ok(Object.isFrozen(e.calls) && Object.values(e.calls).every(n => Number.isInteger(n) && n >= 0), `${id} calls`);
  }
  const kind = id => document.features.find(f => f.id === id).kind, of = k => Object.entries(p).filter(([id]) => kind(id) === k).map(([, e]) => e.calls);
  assert.ok(of('union').every(c => c.booleans >= 1) && of('difference').every(c => c.booleans >= 1), 'Booleans counted');
  assert.ok(of('fillet').every(c => c.finishes >= 1), 'finishes counted');
  assert.ok(of('sketch').every(c => Object.values(c).every(n => n === 0)), 'a sketch calls nothing');
  // The same body, bit for bit.
  const a = plain.outputs.find(o => o.id === root).massProperties(1), b = timed.outputs.find(o => o.id === root).massProperties(1);
  assert.equal(b.volumeMM3, a.volumeMM3); assert.deepEqual(b.centroidMM, a.centroidMM);
  // Kept through a re-evaluation, reused features included.
  const again = timed.withDocument(document);
  assert.deepEqual(Object.keys(again.profile).sort(), Object.keys(p).sort());
});
