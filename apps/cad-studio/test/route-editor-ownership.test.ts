import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server.edge';
import { emptyDoc, withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { emptyDirect, geometryOf, importSource } from '@barocss/cad-model/engine/direct';
import { createRouteBundle, routeBundleDocumentIdentity } from '@barocss/cad-model/engine/routeBundle';
import type { EvalResult } from '@barocss/cad-model/engine/evaluate';
import type { EngineClient } from '../src/engine/client';
import type { RouteBundleSession } from '../src/app/routeSession';
import { useRouteBundleEditor } from '../src/state/useRouteBundleEditor';

// Real Model fixture construction; no Kernel evaluation or numeric geometry acceptance is claimed.
function routeDoc(): StudioDoc {
  const direct = importSource(emptyDirect(), `@model route_owner_fixture { version: 0; length-unit: mm;
    @curve #a { type: nurbs; degree: 3; knots: [0,0,0,0,1,1,1,1]; control-points: [[-2,0,0],[-2,0,10],[-2,0,20],[-2,0,30]]; weights: [1,1,1,1]; }
    @curve #b { type: nurbs; degree: 3; knots: [0,0,0,0,1,1,1,1]; control-points: [[2,0,0],[2,0,10],[2,0,20],[2,0,30]]; weights: [1,1,1,1]; }
  }`, 'routes');
  const a = direct.objects.find(object => object.geometry === 'a'), b = direct.objects.find(object => object.geometry === 'b');
  assert.ok(a && b);
  let doc: StudioDoc = { ...emptyDoc(), direct };
  for (const [index, object] of [a, b].entries()) {
    const curve = geometryOf(direct, object); assert.equal(curve.kind, 'curve'); assert.ok(curve.kind === 'curve');
    doc = withNode(doc, { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 0.5 });
    doc = withNode(doc, { kind: 'sweep-curve', sketch: 2 * index, name: `route ${index}`, path: {
      degree: curve.degree, knots: [...curve.knots], controlPoints: curve.controlPoints.map(point => [...point] as [number, number, number]), weights: [...curve.weights],
    } });
  }
  return createRouteBundle(doc, { id: 'bundle1', tieId: 'tie1', anchorMM: [0, 0, 10],
    members: [{ id: 'memberA', curveObjectId: a.id, handleKey: '1', sweepFeatureId: 'n1', profileFeatureId: 'n0' },
      { id: 'memberB', curveObjectId: b.id, handleKey: '1', sweepFeatureId: 'n3', profileFeatureId: 'n2' }],
    expectedDocumentIdentity: routeBundleDocumentIdentity(doc) });
}

type Ready = NonNullable<RouteBundleSession['ready']>;
type Success = Extract<EvalResult, { ok: true }>;
interface Call {
  kind: 'preview' | 'final';
  doc: StudioDoc;
  revision: number;
  reply: Success;
  resolve(): void;
}

/** Actual React SSR hook actions/refs with deferred worker transport only; no rerendered UI-state proof. */
function fixture() {
  const source = routeDoc(), docNow = { current: source }, blocked = { current: { blocked: false } };
  const calls: Call[] = [], accepted: Ready[] = [];
  let commandActive = false, revision = 1, api!: ReturnType<typeof useRouteBundleEditor>;
  const dispatch = (kind: Call['kind'], doc: StudioDoc, revision: number): Promise<EvalResult> => {
    let release!: (reply: EvalResult) => void;
    const promise = new Promise<EvalResult>(resolve => { release = resolve; });
    const reply: Success = { ok: true, revision, bodies: [], wallTime: 0 };
    calls.push({ kind, doc, revision, reply, resolve: () => release(reply) }); return promise;
  };
  const transport = {
    preview: (doc: StudioDoc, revision: number) => dispatch('preview', doc, revision),
    evaluate: (doc: StudioDoc, revision: number) => dispatch('final', doc, revision),
  } satisfies Pick<EngineClient, 'preview' | 'evaluate'>;
  function Probe() {
    api = useRouteBundleEditor({ owner: { docNow, blocked, commandActive: () => commandActive },
      // Other EngineClient methods are not invoked: only worker response timing is replaced.
      worker: { engine: transport as unknown as EngineClient, nextRevision: () => revision++ },
      acceptValidated: ready => {
        accepted.push(ready);
        // Match App's acceptance seam: invalidate the draft before installing its exact validated pointer.
        api.discardRoute(); docNow.current = ready.candidate; return true;
      }, onNotice: () => {} });
    return null;
  }
  renderToString(createElement(Probe));
  const open = () => { api.open([]); api.previewRoute(); assert.equal(calls.length, 1); assert.equal(calls[0].kind, 'preview'); };
  const replyPreview = async () => { calls[0].resolve(); await setImmediate(); };
  const replyFinal = async () => { assert.equal(calls.length, 2); assert.equal(calls[1].kind, 'final'); calls[1].resolve(); await setImmediate(); };
  const cleanup = async () => { api.dispose(); for (const call of calls) call.resolve(); await setImmediate(); };
  return { source, docNow, blocked, calls, accepted, api, open, replyPreview, replyFinal, cleanup, setCommandActive: (value: boolean) => { commandActive = value; } };
}

test('route editor hands off only the exact final validated candidate once', async () => {
  const f = fixture();
  try {
    f.open(); assert.equal(f.docNow.current, f.source); assert.equal(f.accepted.length, 0);
    await f.replyPreview(); assert.equal(f.calls.length, 2); assert.equal(f.docNow.current, f.source); assert.equal(f.accepted.length, 0);
    await f.replyFinal(); assert.equal(f.docNow.current, f.source); assert.equal(f.accepted.length, 0, 'worker validation must not itself adopt the draft');
    f.api.applyRoute(); assert.equal(f.accepted.length, 1);
    const ready = f.accepted[0]; assert.equal(ready.result, f.calls[1].reply, 'handoff retains the actual final response pointer');
    assert.equal(f.docNow.current, ready.candidate); assert.notEqual(ready.candidate, f.source); assert.deepEqual(ready.candidate, f.source, 'the initial zero-transform draft preserves the authored route document');
    f.api.applyRoute(); await setImmediate(); assert.equal(f.accepted.length, 1); assert.equal(f.calls.length, 2, 'Apply does not start an unvalidated replacement evaluation');
  } finally { await f.cleanup(); }
});

test('route editor discard while preview waits rejects its reply before final evaluation', async () => {
  const f = fixture();
  try {
    f.open(); f.api.discardRoute(); await f.replyPreview(); f.api.applyRoute();
    assert.equal(f.calls.length, 1); assert.equal(f.accepted.length, 0); assert.equal(f.docNow.current, f.source);
  } finally { await f.cleanup(); }
});

test('route editor discard while final validation waits rejects the old ready handoff', async () => {
  const f = fixture();
  try {
    f.open(); await f.replyPreview(); f.api.discardRoute(); await f.replyFinal(); f.api.applyRoute();
    assert.equal(f.calls.length, 2); assert.equal(f.accepted.length, 0); assert.equal(f.docNow.current, f.source);
  } finally { await f.cleanup(); }
});

test('route editor rejects a final reply after same-value document identity replacement', async () => {
  const f = fixture();
  try {
    f.open(); await f.replyPreview(); const replacement = structuredClone(f.source); assert.deepEqual(replacement, f.source); f.docNow.current = replacement;
    await f.replyFinal(); f.api.applyRoute();
    assert.equal(f.calls.length, 2); assert.equal(f.accepted.length, 0); assert.equal(f.docNow.current, replacement);
  } finally { await f.cleanup(); }
});

test('route editor blocked owner rejects held preview before final evaluation', async () => {
  const f = fixture();
  try {
    f.open(); f.blocked.current.blocked = true; await f.replyPreview(); f.api.applyRoute();
    assert.equal(f.calls.length, 1); assert.equal(f.accepted.length, 0); assert.equal(f.docNow.current, f.source);
  } finally { await f.cleanup(); }
});

test('route editor active command rejects held final response without adopting the candidate', async () => {
  const f = fixture();
  try {
    f.open(); await f.replyPreview(); f.setCommandActive(true); await f.replyFinal(); f.api.applyRoute();
    assert.equal(f.calls.length, 2); assert.equal(f.accepted.length, 0); assert.equal(f.docNow.current, f.source);
  } finally { await f.cleanup(); }
});
