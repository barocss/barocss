import test from 'node:test';
import assert from 'node:assert/strict';
import * as cad from '../dist/index.js';
import { BarocssError as FacadeError } from '../dist/api/index.js';
import { KernelError } from '../dist/core/barocss-error.js';

test('R7.3a: every error class the kernel exports is a BarocssError, the facade\'s class the same one', () => {
  assert.equal(FacadeError, cad.BarocssError);
  const classes = Object.entries(cad).filter(([name, v]) => typeof v === 'function' && /Error$/.test(name) && v.prototype instanceof Error);
  assert.ok(classes.length > 90, `${classes.length} error classes`); // (100 after R7.3d retired the legacy files' classes)
  for (const [name, C] of classes) assert.ok(C === cad.BarocssError || C.prototype instanceof cad.BarocssError, `${name} is a BarocssError`);
});

test('R7.3a batch 1: a kernel error keeps its name, code, message and cause as written before', () => {
  const e = new cad.CadPartError('GEOMETRY', 'n3', 'the result is not a manifold solid');
  assert.ok(e instanceof cad.BarocssError && e instanceof Error);
  assert.equal(e.name, 'CadPartError'); assert.equal(e.code, 'GEOMETRY'); assert.equal(e.feature, 'n3');
  assert.equal(e.message, 'n3: the result is not a manifold solid');
  assert.match(e.stack.split('\n')[0], /^CadPartError: n3: the result is not a manifold solid$/);
  const inner = new Error('inner'), b = new cad.BrepError('TOPOLOGY', 'open shell');
  assert.equal(b.message, 'B-rep: open shell'); assert.equal(b.name, 'BrepError');
  const k = new KernelError('text', { cause: inner });
  assert.equal(k.cause, inner); assert.equal(k.name, 'Error'); assert.equal(k.message, 'text');
  assert.equal(Object.hasOwn(new KernelError('text'), 'cause'), false);
  // (A class that had no code takes one named for it; a cut list's code is its message's own.)
  assert.equal(new cad.CutListError('[NO_MEMBERS] nothing to cut').code, 'NO_MEMBERS');
  assert.equal(new cad.CutListError('nothing to cut').code, 'CUT_LIST');
  // (A refusal thrown by the part model is caught as one.)
  assert.throws(() => cad.evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [{ id: 'a', kind: 'extrude', sketch: 'nope', height: 1 }] }),
    x => x instanceof cad.BarocssError && x.name === 'CadPartError' && x.code === 'REFERENCE' && x.message === 'a: sketch: no earlier feature nope');
});
