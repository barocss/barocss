// Regression source only; runtime verification is deferred.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BarocssError } from '../src/api';
import { materialOf } from '../src/api/core';
import { lockDoc } from '../src/api/assemblyCore';
import { emptyDoc } from '../src/engine/doc';

test('unknown body material lookup refuses before an absent look can hide the missing body', () => {
  for (const withLooks of [false, true]) {
    const doc = emptyDoc();
    if (withLooks) doc.bodies = {};
    const before = structuredClone(doc);
    for (const key of ['b999', Symbol('missing body')]) {
      assert.throws(() => materialOf(doc, key as string),
        (error: unknown) => error instanceof BarocssError && error.code === 'NO_BODY');
    }
    assert.deepEqual(doc, before);
  }
});

test('lock adapter refuses unknown child and target ids before relative placement or solving', () => {
  const doc = emptyDoc();
  doc.instances = [{ id: 'p1', name: 'part', doc: emptyDoc(), position: [1, 2, 3], rotation: [0, 0, 0] }];
  const before = structuredClone(doc);
  for (const [part, to] of [['missing', 'base'], ['p1', 'missing'], ['missing', 'also-missing']]) {
    assert.throws(() => lockDoc(doc, part, to),
      (error: unknown) => error instanceof BarocssError && error.code === 'NO_PART' && error.message.includes('missing'));
    assert.deepEqual(doc, before);
  }
  for (const [part, to] of [[Symbol('missing child'), 'base'], ['p1', Symbol('missing target')]]) {
    assert.throws(() => lockDoc(doc, part as string, to as string),
      (error: unknown) => error instanceof BarocssError && error.code === 'NO_PART');
    assert.deepEqual(doc, before);
  }
  const locked = lockDoc(doc, 'p1', 'base');
  assert.equal(locked.doc.mates!.length, 1);
  assert.equal(locked.doc.mates![0].a.part, 'base');
  assert.equal(locked.doc.mates![0].b.part, 'p1');
  assert.deepEqual(doc, before);
});
