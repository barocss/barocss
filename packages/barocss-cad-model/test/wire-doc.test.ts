import { evaluateCurve, type Curve } from '@barocss/cad';
import { evaluatePreview } from '../src/engine/evaluate';
import { createRouteBundle, moveRouteBundle, routeBundleDocumentIdentity } from '../src/engine/routeBundle';
import test from 'node:test';
import assert from 'node:assert/strict';
import { WireReceiver, WireSender } from '../src/engine/wireDoc';
import { rectanglePart, withNode, type StudioDoc } from '../src/engine/doc';

test('wire documents: each node crosses once, the worker rebuilds the document, both sides forget alike', () => {
  const send = new WireSender(), recv = new WireReceiver();
  let doc: StudioDoc = { ...rectanglePart(40, 30, 5), render: { lights: [] } as never, direct: { sources: { a: 'x'.repeat(1000) }, objects: [] } };
  const first = send.pack(doc);
  assert.equal(first.added.length, 2);
  assert.equal(first.doc.render, undefined, 'render settings stay behind');
  assert.equal(first.doc.direct, undefined, 'direct geometry stays behind');
  assert.deepEqual(recv.unpack(first).nodes, doc.nodes);
  // A new hole: only it crosses; the unchanged nodes are named.
  doc = withNode(doc, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [10, 10], radius: 2 });
  const second = send.pack(doc);
  assert.deepEqual(second.added.map(([, n]) => n.kind), ['hole']);
  assert.deepEqual(recv.unpack(second).nodes, doc.nodes);
  // Hundreds of requests later (each a fresh edit of the hole), the old holes are forgotten on both sides,
  // and the document still rebuilds.
  for (let k = 0; k < 600; k++) {
    doc = { ...doc, nodes: doc.nodes.map((n, i) => i === 2 && n.kind === 'hole' ? { ...n, radius: 1 + k / 1000 } : n) };
    assert.deepEqual(recv.unpack(send.pack(doc)).nodes, doc.nodes);
  }
  assert.ok((recv as unknown as { nodes: Map<number, unknown> }).nodes.size < 400, 'the table does not grow with every edit');
});

// Fixed authored browser baseline: two clamped cubic paths, radius 0.5 mm and side tag e1.
// No external evidence path is read by this test.
const routeFixture = (): StudioDoc => JSON.parse(String.raw`{
  "format": "barocss-cad-model",
  "schema": 3,
  "units": "mm",
  "parameters": {},
  "nodes": [
    {
      "kind": "sketch",
      "profile": "circle",
      "center": [
        0,
        0
      ],
      "radius": 0.5,
      "sideTags": {
        "outer": [
          "e1"
        ]
      },
      "id": "n0"
    },
    {
      "kind": "sweep-curve",
      "sketch": 0,
      "name": "bundle · A",
      "path": {
        "degree": 3,
        "knots": [
          0,
          0,
          0,
          0,
          1,
          1,
          1,
          1
        ],
        "controlPoints": [
          [
            -2,
            0,
            0
          ],
          [
            -2,
            0,
            10
          ],
          [
            -2,
            0,
            20
          ],
          [
            -2,
            0,
            30
          ]
        ],
        "weights": [
          1,
          1,
          1,
          1
        ]
      },
      "id": "n1"
    },
    {
      "kind": "sketch",
      "profile": "circle",
      "center": [
        0,
        0
      ],
      "radius": 0.5,
      "sideTags": {
        "outer": [
          "e1"
        ]
      },
      "id": "n2"
    },
    {
      "kind": "sweep-curve",
      "sketch": 2,
      "name": "bundle · B",
      "path": {
        "degree": 3,
        "knots": [
          0,
          0,
          0,
          0,
          1,
          1,
          1,
          1
        ],
        "controlPoints": [
          [
            2,
            0,
            0
          ],
          [
            2,
            0,
            10
          ],
          [
            2,
            0,
            20
          ],
          [
            2,
            0,
            30
          ]
        ],
        "weights": [
          1,
          1,
          1,
          1
        ]
      },
      "id": "n3"
    }
  ],
  "outputs": {
    "b1": {
      "node": 1,
      "side": "solid"
    },
    "b3": {
      "node": 3,
      "side": "solid"
    }
  },
  "nextId": 4,
  "direct": {
    "sources": {
      "src_1": "@model bundle {\n  version: 0;\n  length-unit: mm;\n  @curve #A { type: nurbs; degree: 3; knots: [0,0,0,0,1,1,1,1]; control-points: [[-2,0,0],[-2,0,10],[-2,0,20],[-2,0,30]]; weights: [1,1,1,1]; }\n  @curve #B { type: nurbs; degree: 3; knots: [0,0,0,0,1,1,1,1]; control-points: [[2,0,0],[2,0,10],[2,0,20],[2,0,30]]; weights: [1,1,1,1]; }\n}"
    },
    "objects": [
      {
        "id": "obj_1",
        "name": "bundle · A",
        "source": "src_1",
        "geometry": "A"
      },
      {
        "id": "obj_2",
        "name": "bundle · B",
        "source": "src_1",
        "geometry": "B"
      }
    ]
  }
}`) as StudioDoc;

test('wire documents: route creation and total move preserve exact bindings through structured clone and preview', () => {
  const send = new WireSender(), recv = new WireReceiver();
  const baseline = routeFixture(), baselineBefore = structuredClone(baseline);
  // Build from the fixed baseline itself, including both circular profile side tags and A/B source.
  const linked = createRouteBundle(baseline, {
    id: 'bundle1', tieId: 'tie1', anchorMM: [0, 0, 10],
    members: [
      { id: 'memberA', curveObjectId: 'obj_1', handleKey: '1', sweepFeatureId: 'n1', profileFeatureId: 'n0' },
      { id: 'memberB', curveObjectId: 'obj_2', handleKey: '1', sweepFeatureId: 'n3', profileFeatureId: 'n2' },
    ],
    expectedDocumentIdentity: routeBundleDocumentIdentity(baseline),
  });
  const linkedBefore = structuredClone(linked);
  const moved = moveRouteBundle(linked, 'bundle1', [5, -3, 4], routeBundleDocumentIdentity(linked));
  const movedBefore = structuredClone(moved);
  assert.deepEqual(moved.routeBundles![0].tie.anchorMM, [5, -3, 14]);
  assert.notDeepEqual(moved.routeBundles, linked.routeBundles);
  assert.notDeepEqual(moved.direct, linked.direct);
  for (const [revision, doc] of [linked, moved].entries()) {
    const before = structuredClone(doc), packed = send.pack(doc);
    assert.deepEqual(packed.doc.routeBundles, doc.routeBundles);
    assert.deepEqual(packed.doc.direct, doc.direct);
    const received = recv.unpack(structuredClone(packed));
    assert.equal(received.schema, 4);
    assert.deepEqual(received.routeBundles, doc.routeBundles);
    assert.deepEqual(received.direct, doc.direct);
    assert.notEqual(received.direct, doc.direct, 'structured clone supplies independent direct input');
    assert.deepEqual(received.nodes, doc.nodes, 'copied paths, profile side tags and bundle markers cross exactly');
    assert.deepEqual(received.outputs, doc.outputs);
    const receivedBefore = structuredClone(received), result = evaluatePreview(received, revision + 1, 8, 'preview');
    assert.ok(result.ok, result.ok ? '' : result.error.detail);
    assert.deepEqual(result.bodies.map(body => body.key).sort(), ['b1', 'b3']);
    const midpoint = revision === 0 ? [[-2, 0, 15], [2, 0, 15]] : [[-0.125, -1.125, 16.5], [3.875, -1.125, 16.5]];
    for (const [i, node] of received.nodes.filter(node => node.kind === 'sweep-curve').entries()) {
      assert.ok(node.kind === 'sweep-curve');
      const actual = evaluateCurve({ kind: 'curve', id: `wire-route-${i}`, ...node.path } as Curve, 0.5);
      // Independent Bernstein coefficients at 1/2: [1,3,3,1]/8; existing absolute boundary in mm.
      assert.ok(Math.hypot(...actual.map((value, axis) => value - midpoint[i][axis])) <= 1e-7);
    }
    assert.deepEqual(doc, before); assert.deepEqual(received, receivedBefore); assert.deepEqual(received.nodes, doc.nodes);
    assert.deepEqual(received.routeBundles, doc.routeBundles); assert.deepEqual(received.direct, doc.direct);
  }
  // Keep invalid recipe/direct values and their own-property presence intact for strict admission.
  for (const mutate of [
    (doc: StudioDoc) => { Reflect.deleteProperty(doc, 'routeBundles'); },
    (doc: StudioDoc) => { Reflect.set(doc, 'routeBundles', undefined); },
    (doc: StudioDoc) => { Reflect.set(doc, 'routeBundles', null); },
    (doc: StudioDoc) => { Reflect.set(doc, 'routeBundles', []); },
    (doc: StudioDoc) => { Reflect.deleteProperty(doc, 'direct'); },
    (doc: StudioDoc) => { Reflect.set(doc, 'direct', undefined); },
    (doc: StudioDoc) => { Reflect.set(doc, 'direct', null); },
    (doc: StudioDoc) => { Reflect.set(doc, 'direct', { sources: {}, objects: [] }); },
    (doc: StudioDoc) => { doc.schema = 3; },
  ]) {
    const bad = structuredClone(linked); mutate(bad); const badBefore = structuredClone(bad);
    const packed = send.pack(bad), received = recv.unpack(structuredClone(packed));
    for (const field of ['routeBundles', 'direct'] as const) {
      assert.equal(Object.hasOwn(packed.doc, field), Object.hasOwn(bad, field));
      assert.equal(Object.hasOwn(received, field), Object.hasOwn(bad, field));
      assert.deepEqual(packed.doc[field], bad[field]); assert.deepEqual(received[field], bad[field]);
    }
    assert.equal(received.schema, bad.schema); assert.deepEqual(received.nodes, bad.nodes);
    const receivedBefore = structuredClone(received), result = evaluatePreview(received, 10, 8, 'preview');
    assert.equal(result.ok, false);
    if (result.ok) assert.fail('invalid route input must not produce a preview');
    assert.equal(result.error.code, 'BAD_REFERENCE'); assert.match(result.error.detail, /Route bundle:/);
    assert.deepEqual(bad, badBefore); assert.deepEqual(received, receivedBefore);
  }
  assert.deepEqual(baseline, baselineBefore); assert.deepEqual(linked, linkedBefore); assert.deepEqual(moved, movedBefore);
  // This exercises the synchronous worker wire format, not an actual Worker or browser interaction.
});
