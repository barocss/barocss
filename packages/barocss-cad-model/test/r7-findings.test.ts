import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, exportStudioStep } from '../src/engine/evaluate';
import { friendly } from '../src/engine/errors';
import { rectanglePart, withNode, type ModelNode } from '../src/engine/doc';

// R7's findings (api-facade-design.md): a refusal's kernel code reaches FriendlyError — its bracketed code as `code`
// and the start of `detail`, else the thrown error's kind — with the title and hint as before; and exportStudioStep takes a
// fixed timestamp, so the same part writes the same bytes.

test('R7: FriendlyError carries the kernel code; the person-facing title and hint unchanged', () => {
  const coded = friendly('n3: PARAMETER: [RADIUS_EXCEEDS_FACE] edge e1: fillet 9 mm is too large', 'PARAMETER');
  assert.equal(coded.code, 'RADIUS_EXCEEDS_FACE');
  assert.equal(coded.detail, '[RADIUS_EXCEEDS_FACE] PARAMETER: edge e1: fillet 9 mm is too large');
  assert.equal(coded.title, 'The chamfer or fillet is too large', 'the rule matches the message as before');
  const kindOnly = friendly('n1: edge n1.side0|n1.side3: fillet 40 mm is too large for walls of 32 and 64 mm', 'PARAMETER');
  assert.equal(kindOnly.code, 'PARAMETER');
  assert.equal(kindOnly.detail, 'edge n1.side0|n1.side3: fillet 40 mm is too large for walls of 32 and 64 mm', 'no bracketed code: the detail as before');
  assert.equal(friendly('something odd').code, undefined);
  // (Through evaluateDoc: the thrown CadPartError's kind at least.)
  const r = evaluateDoc(withNode(rectanglePart(64, 32, 8), { kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: ['n1.side0|n1.side3'], radius: 40 } as ModelNode), 1);
  assert.ok(!r.ok); assert.ok(r.error.code, JSON.stringify(r.error));
});

test('R7: exportStudioStep with a fixed timestamp writes the same bytes; without one, the time is now', () => {
  const doc = rectanglePart(20, 10, 4), at = '2026-01-02T03:04:05';
  const a = exportStudioStep(doc, { name: 'plate', timestamp: at }), b = exportStudioStep(doc, { name: 'plate', timestamp: at });
  assert.equal(a.text, b.text);
  assert.ok(a.text.includes(`'${at}'`), 'the header names the time given');
  const now = exportStudioStep(doc, { name: 'plate' }); assert.ok(!now.text.includes(`'${at}'`));
});
