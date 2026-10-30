import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, exportStudioStep } from '../src/engine/evaluate';
import { evaluateCadPart } from '@barocss/cad';
import { friendly, friendlyCause } from '../src/engine/errors';
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

test('R7: a fillet of more than 64 edges names its own limit, not "no edges"; an empty list keeps the old title', () => {
  const edges = Array.from({ length: 65 }, (_, i) => `e1.side${i}|e1.top`);
  const part = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] }, { id: 'e1', kind: 'extrude', sketch: 's', height: 5 }, { id: 'f', kind: 'fillet', target: 'e1', edges, radius: 1 }] };
  let cause: unknown;
  try { evaluateCadPart(part as never); } catch (e) { cause = e; }
  assert.ok(cause, 'the kernel refuses');
  const fe = friendlyCause(cause);
  assert.equal(fe.title, 'Too many edges in one finish');
  assert.equal(fe.code, 'FINISH_EDGES_LIMIT');
  assert.ok(fe.detail?.startsWith('[FINISH_EDGES_LIMIT] f: a fillet takes at most 64 edges'), fe.detail);
  assert.equal(friendly('n2: edges must list 1 to 64 edge names').title, 'This chamfer has no edges');
});
