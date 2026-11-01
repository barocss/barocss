import test from 'node:test';
import assert from 'node:assert/strict';
import { PhysicsError } from '@barocss/physics';
import { admitCadSurfaceProxy, cadProxyPose, type CadProxyBodyState, type CadSurfaceProxyRequest } from '@barocss/physics/cad-proxy';

// Frozen before execution: units-contract.md. Source adapter only; no World or UI.
const M_TOL = 1e-9;
const MM_TOL = 1e-6;
const source = `@model units_fixture {
  version: 0;
  length-unit: mm;
  @surface #asymmetric_panel {
    type: nurbs;
    degree-u: 1;
    degree-v: 1;
    knots-u: [0,0,1,1];
    knots-v: [0,0,1,1];
    control-points: [[[20,-30,40],[20,-30,100]],[[120,10,40],[120,10,100]]];
    weights: [[1,1],[1,1]];
  }
}`;
const request = (): CadSurfaceProxyRequest => ({ sourceVersion: 0, sourceRevision: 'unitsRev1',
  modelId: 'units_fixture', surfaceId: 'asymmetric_panel', kind: 'dynamic', proxy: 'box', massKg: 1,
  initialOffsetM: [0.1, 0, 0] });
const near = (got: number, want: number, tol: number) =>
  assert.ok(Number.isFinite(got) && Math.abs(got - want) <= tol, `${got} vs ${want}; tolerance ${tol}`);
function vectorError(got: readonly number[], want: readonly number[], tol: number): number {
  assert.equal(got.length, want.length);
  let max = 0;
  for (let i = 0; i < got.length; i++) { near(got[i], want[i], tol); max = Math.max(max, Math.abs(got[i] - want[i])); }
  return max;
}

test('public CAD proxy: off-origin 100 mm span becomes 0.1 m with explicit approximation labels', t => {
  const input = request(), before = structuredClone(input), proxy = admitCadSurfaceProxy(source, input);
  vectorError(proxy.sourceBoundsMM.min, [20, -30, 40], MM_TOL);
  vectorError(proxy.sourceBoundsMM.max, [120, 10, 100], MM_TOL);
  vectorError(proxy.sourceCenterMM, [70, -10, 70], MM_TOL);
  assert.equal(proxy.body.shape.kind, 'box');
  if (proxy.body.shape.kind !== 'box') throw new Error('expected admitted box');
  let maxAdmissionErrorM = vectorError(proxy.body.shape.halfExtentsM, [0.05, 0.02, 0.03], M_TOL);
  maxAdmissionErrorM = Math.max(maxAdmissionErrorM, vectorError(proxy.body.positionM, [0.17, -0.01, 0.07], M_TOL));
  const spanM = proxy.body.shape.halfExtentsM[0] * 2;
  near(spanM, 0.1, M_TOL);
  near((proxy.sourceBoundsMM.max[0] - proxy.sourceBoundsMM.min[0]) / 1000, spanM, M_TOL);
  const pose = cadProxyPose(proxy, { id: proxy.bodyId, positionM: [...proxy.body.positionM], orientation: [0, 0, 0, 1] }, source, input.sourceRevision);
  const maxIdentityDisplayErrorMm = vectorError(pose.translation, [100, 0, 0], MM_TOL);
  assert.match(proxy.lossLabel, /Control-net axis-aligned box/);
  assert.match(proxy.lossLabel, /native Surface geometry is not the collision shape/);
  const sphere = admitCadSurfaceProxy(source, { ...input, proxy: 'sphere' });
  assert.equal(sphere.body.shape.kind, 'sphere');
  if (sphere.body.shape.kind !== 'sphere') throw new Error('expected admitted sphere');
  const expectedRadiusM = Math.sqrt(0.05 ** 2 + 0.02 ** 2 + 0.03 ** 2);
  const sphereRadiusErrorM = Math.abs(sphere.body.shape.radiusM - expectedRadiusM);
  near(sphere.body.shape.radiusM, expectedRadiusM, M_TOL);
  assert.match(sphere.lossLabel, /Control-net enclosing sphere/);
  assert.match(sphere.lossLabel, /native Surface geometry is not the collision shape/);
  assert.deepEqual(input, before);
  t.diagnostic(JSON.stringify({ metric: 'cad-proxy-unit-admission', sourceSpanMm: 100, admittedSpanM: spanM,
    maxAdmissionErrorM, maxIdentityDisplayErrorMm, sphereRadiusErrorM, approximateControlBounds: true }));
});

test('public CAD proxy: +pi/2 rad Z pose returns the literal center-pivot display transform', t => {
  const input = request(), proxy = admitCadSurfaceProxy(source, input);
  const angleRad = Math.PI / 2;
  const body: CadProxyBodyState = { id: proxy.bodyId, positionM: [...proxy.body.positionM],
    orientation: [0, 0, Math.sin(angleRad / 2), Math.cos(angleRad / 2)] };
  const before = structuredClone(body), pose = cadProxyPose(proxy, body, source, input.sourceRevision);
  assert.equal(pose.targetId, proxy.bodyId);
  vectorError(pose.rotation, [0, 0, Math.SQRT1_2, Math.SQRT1_2], 1e-12);
  const translationErrorMm = vectorError(pose.translation, [160, -80, 0], MM_TOL);
  const points = [[20, -30, 40], [20, -30, 100], [120, 10, 40], [120, 10, 100]];
  const expected = [[190, -60, 40], [190, -60, 100], [150, 40, 40], [150, 40, 100]];
  let maxDisplayErrorMm = 0, maxInverseErrorMm = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    // Literal +90 degree Z matrix, independent of the adapter's quaternion rotate helper.
    const displayed = [-p[1] + pose.translation[0], p[0] + pose.translation[1], p[2] + pose.translation[2]];
    maxDisplayErrorMm = Math.max(maxDisplayErrorMm, vectorError(displayed, expected[i], MM_TOL));
    const recovered = [displayed[1] + 80, 160 - displayed[0], displayed[2]];
    maxInverseErrorMm = Math.max(maxInverseErrorMm, vectorError(recovered, p, MM_TOL));
  }
  const c = proxy.sourceCenterMM;
  vectorError([-c[1] + pose.translation[0], c[0] + pose.translation[1], c[2] + pose.translation[2]], [170, -10, 70], MM_TOL);
  assert.deepEqual(body, before);
  t.diagnostic(JSON.stringify({ metric: 'cad-proxy-pose-round-trip', angleRad, translationErrorMm,
    maxDisplayErrorMm, maxInverseErrorMm, sourceCenterMm: proxy.sourceCenterMM, displayTranslationMm: pose.translation }));
});

test('public CAD proxy: exact source/revision mismatch refuses without changing retained input', t => {
  const input = request(), proxy = admitCadSurfaceProxy(source, input);
  const body: CadProxyBodyState = { id: proxy.bodyId, positionM: [...proxy.body.positionM], orientation: [0, 0, 0, 1] };
  const proxyBefore = structuredClone(proxy), inputBefore = structuredClone(input), bodyBefore = structuredClone(body);
  const good = cadProxyPose(proxy, body, source, input.sourceRevision);
  for (const [currentSource, revision] of [[`${source}\n`, input.sourceRevision], [source, 'unitsRev2']]) {
    assert.throws(() => cadProxyPose(proxy, body, currentSource, revision),
      (error: unknown) => error instanceof PhysicsError && error.code === 'STALE_SOURCE');
    assert.deepEqual(proxy, proxyBefore);
    assert.deepEqual(input, inputBefore);
    assert.deepEqual(body, bodyBefore);
    assert.equal(proxy.sourceSnapshot, source);
    assert.deepEqual(cadProxyPose(proxy, body, source, input.sourceRevision), good);
  }
  t.diagnostic(JSON.stringify({ metric: 'cad-proxy-stale-retention', sourceOnlyRefused: true,
    revisionOnlyRefused: true, inputsRetained: true, originalBindingReusable: true }));
});
