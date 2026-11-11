import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server.edge';
import { rectanglePart, withNode } from '@barocss/cad-model/engine/doc';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { bodyKeyFor } from '@barocss/cad-model/engine/ids';
import { checkInterferencePairs } from '../src/app/checkInterference';
import type { VolumeReply } from '../src/engine/client';
import { InterferenceInspector, type InterferenceResult } from '../src/ui/MeasurementInspector';

function setup() {
  let doc = rectanglePart(10, 10, 10);
  for (const x of [5, 12]) {
    const sketch = doc.nodes.length;
    doc = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [x, 0], max: [x + 10, 10] });
    doc = withNode(doc, { kind: 'extrude', sketch, height: 10 });
  }
  doc = { ...doc, bodies: { b1: { name: 'Repeated' }, b3: { name: 'Repeated' } } };
  const evaluated = evaluateDoc(doc, 1);
  assert.ok(evaluated.ok);
  return { doc, bodies: evaluated.bodies };
}

test('only explicit empty or finite nonnegative volumes can count as checked', async () => {
  const { doc, bodies } = setup();
  const unchanged = structuredClone(doc);
  const fail = { title: 'Refused', hint: 'Unsupported pair', detail: 'No current Boolean', code: 'CAPABILITY', feature: 'n6' };
  const cases: [VolumeReply, string | null][] = [
    [{ ok: false, error: fail }, fail.detail],
    [{ ok: false, error: 'stopped' }, 'The worker stopped.'],
    [{ ok: true, volumes: [] }, 'Intersection output is missing.'],
    [{ ok: true, volumes: [], emptyIntersection: 'other' }, 'Intersection output is missing.'],
    [{ ok: true, volumes: [{ key: 'other', volume: 50 }], emptyIntersection: 'b6' }, null],
    [{ ok: true, volumes: [{ key: 'b6', volume: null }] }, 'Intersection volume is unavailable.'],
    [{ ok: true, volumes: [{ key: 'b6', volume: NaN }] }, 'Intersection volume is invalid.'],
    [{ ok: true, volumes: [{ key: 'b6', volume: Infinity }] }, 'Intersection volume is invalid.'],
    [{ ok: true, volumes: [{ key: 'b6', volume: -1 }] }, 'Intersection volume is invalid.'],
    [{ ok: true, volumes: [{ key: 'b6', volume: 0 }] }, null],
    [{ ok: true, volumes: [{ key: 'b6', volume: 1e-6 }] }, null],
  ];
  for (const [reply, error] of cases) {
    const result = await checkInterferencePairs(doc, bodies.slice(0, 2), async () => reply);
    assert.ok(result);
    assert.deepEqual(result.clashes, []);
    assert.equal(result.pairs, 1);
    assert.equal(result.failures[0]?.error.detail ?? null, error);
    if (reply.ok === false && typeof reply.error !== 'string') assert.deepEqual(result.failures[0].error, fail);
  }
  assert.deepEqual(doc, unchanged);
});

test('aggregation keeps the independently successful pair when another probe refuses', async () => {
  const { doc, bodies } = setup();
  let probes = 0;
  const result = await checkInterferencePairs(doc, bodies, async probe => {
    probes++;
    if (probes === 2) throw new Error('Second probe did not complete');
    return { ok: true, volumes: [{ key: bodyKeyFor(probe.nodes, probe.nodes.length - 1), volume: 500 }] };
  });
  assert.ok(result);
  assert.equal(probes, 2);
  assert.equal(result.pairs, 3);
  assert.deepEqual(result.clashes, [{ a: 'b1', b: 'b3', volume: 500 }]);
  assert.equal(result.failures.length, 1);
  assert.deepEqual([result.failures[0].a, result.failures[0].b], ['b3', 'b5']);
  assert.match(result.failures[0].error.detail, /Second probe did not complete/);
  const markup = (clashes: InterferenceResult) => renderToStaticMarkup(createElement(InterferenceInspector, {
    doc, bodies, clashes, setClashes() {}, setSelection() {},
  }));
  assert.match(markup('busy'), /Checking…/);
  assert.match(markup({ pairs: 1, clashes: [], failures: [] }), /No bodies overlap\./);
  const partial = markup(result);
  assert.match(partial, /Interference check incomplete\. 1 pair could not be checked/);
  assert.match(partial, /Repeated \(b1\) ∩ Repeated \(b3\)/);
  assert.match(partial, /500 mm³/);
  assert.match(partial, /Second probe did not complete/);
  assert.doesNotMatch(partial, /No bodies overlap\./);
  assert.match(markup({ pairs: 1, clashes: [], failures: result.failures }), /Interference check failed/);
});

test('a retired inspection drops each reply shape and does not submit the next pair', async () => {
  const { doc, bodies } = setup();
  for (const reply of [
    { ok: true, volumes: [{ key: 'b6', volume: 500 }] },
    { ok: true, volumes: [], emptyIntersection: 'b6' },
    { ok: false, error: 'stopped' },
  ] satisfies VolumeReply[]) {
    let current = true, probes = 0;
    let resolve!: (reply: VolumeReply) => void;
    const response = new Promise<VolumeReply>(done => { resolve = done; });
    const pending = checkInterferencePairs(doc, bodies, () => {
      probes++;
      return response;
    }, () => current);
    assert.equal(probes, 1);
    current = false;
    resolve(reply);
    assert.equal(await pending, null);
    assert.equal(probes, 1);
  }
  const obsolete = await checkInterferencePairs(doc, bodies, async () => assert.fail('unexpected probe'), () => false);
  assert.equal(obsolete, null);
});
