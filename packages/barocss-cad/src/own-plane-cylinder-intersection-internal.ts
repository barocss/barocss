import { validateXYCirclePrismShellBundle } from './xy-circle-prism-shell.js';
import type { XYCirclePrismShellBundle } from './xy-circle-prism-shell.js';
import { validateCurve, validateSurface, evaluateCurve, evaluateSurface, curveDomain } from './math.js';
import { evaluateCurveD1, evaluateSurfaceD1 } from './derivatives.js';
import type { CurveD1Result, SurfaceD1Result } from './derivatives.js';
import { compileCadModel } from './model-compiler.js';
import { curveDecimal } from './curve-source.js';
import { copyCadData } from './data-copy.js';
import type { Curve, Surface, Model, Point } from './types.js';

import type { XYCirclePrismPlaneIntersectionOptions, XYCirclePrismPlaneBindings, PlaneCylinderHomogeneousSpan, PlaneCylinderIntersectionObservation } from './own-plane-cylinder-intersection.js';

export interface OwnPlaneCylinderCandidate {
  shell: XYCirclePrismShellBundle; options: XYCirclePrismPlaneIntersectionOptions; sourceCircle: Curve;
  section: Curve; plane: Surface; wallSurface: Surface; axialControlHullMM: [number, number];
  planeSupportMM: {minXY: [number, number]; maxXY: [number, number]; representedSpansMM: [number, number]};
}
const LABEL = 'Own plane-cylinder intersection';
export function check(condition: boolean, detail: string): asserts condition { if (!condition) throw new Error((LABEL + ': ' + detail).slice(0, 1024)); }
export function snapshot(input: unknown): unknown {
  let remaining = 131072;
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 24, 'bounded own-data budget exceeded');
    if (typeof value === 'number') { check(Number.isFinite(value), 'finite numbers required'); return value; }
    if (typeof value === 'string') { check(value.length <= 262144, 'bounded source string required'); return value; }
    if (typeof value === 'boolean') return value;
    check(value !== null && typeof value === 'object', 'plain owned data required');
    const array = Array.isArray(value), proto = Object.getPrototypeOf(value), keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    check(array ? proto === Array.prototype : proto === Object.prototype || proto === null, 'foreign prototype');
    check(keys.length <= (array ? 1025 : 32) && keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable)), 'getter/symbol/hidden/excess fields');
    if (array) { const n = descriptors.length.value as number; check(Number.isInteger(n) && n >= 0 && n <= 1024 && keys.length === n + 1, 'dense bounded arrays required'); return Array.from({ length: n }, (_, i) => { check(Object.hasOwn(descriptors, String(i)), 'sparse array'); return copy(descriptors[String(i)].value, depth + 1); }); }
    return Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
  }; return copy(input, 0);
}
function record(input: unknown, fields: string[]): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), 'record required'); const r = input as Record<string, unknown>;
  check(Object.keys(r).length === fields.length && fields.every(key => Object.hasOwn(r, key)), 'exact fields required: ' + fields.join(',')); return r;
}
export function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => same(v, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object') { const x = a as Record<string, unknown>, y = b as Record<string, unknown>; return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(key => Object.hasOwn(y, key) && same(x[key], y[key])); } return Object.is(a, b);
}
function admitOptions(input: unknown, shell: XYCirclePrismShellBundle): XYCirclePrismPlaneIntersectionOptions {
  const r = record(input, ['curveId','planeId','planePcurveId','wallPcurveId','evaluationId','slopeX','slopeY','zInterceptMM']);
  for (const key of ['curveId','planeId','planePcurveId','wallPcurveId','evaluationId']) check(typeof r[key] === 'string' && (r[key] as string).length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(r[key] as string), 'ASCII IDs1..48 required');
  const ids = [r.curveId,r.planeId,r.planePcurveId,r.wallPcurveId,r.evaluationId]; check(new Set(ids).size === 5, 'explicit identities must be distinct');
  const original = [shell.geometry.name, shell.construction.profile.id, ...shell.geometry.objects.map(o => o.id), shell.topology.id,
    ...shell.topology.vertices.map(o => o.id), ...shell.topology.edges.map(o => o.id), ...shell.topology.faces.map(o => o.id),
    ...shell.topology.loops.flatMap(l => [l.id, ...l.uses.flatMap(u => [u.id,u.pcurve.curve.id])])];
  check(ids.every(id => !original.includes(id as string)), 'explicit identity collides with original native shell');
  check([r.slopeX,r.slopeY].every(n => typeof n === 'number' && Math.abs(n) <= 1), 'finite slopes[-1,1] required');
  check(typeof r.zInterceptMM === 'number' && Math.abs(r.zInterceptMM) <= 10000, 'finite intercept[-10000,10000] mm required'); return r as unknown as XYCirclePrismPlaneIntersectionOptions;
}
function finite(n: number): number { check(Number.isFinite(n), 'native homogeneous/affine arithmetic unsafe'); return n; }
export function adopt(model: Model): { source: string; model: Model } {
  const dec = (n: number) => curveDecimal(n, LABEL), list = (a: number[]) => '[' + a.map(dec).join(',') + ']', poles = (a: Point[]) => '[' + a.map(list).join(',') + ']';
  const text = model.objects.map(o => o.kind === 'curve' ? '@curve #' + o.id + ' { type:nurbs; degree:' + dec(o.degree) + '; knots:' + list(o.knots) + '; control-points:' + poles(o.controlPoints) + '; weights:' + list(o.weights) + '; }'
    : '@surface #' + o.id + ' { type:nurbs; degree-u:' + dec(o.degreeU) + '; degree-v:' + dec(o.degreeV) + '; knots-u:' + list(o.knotsU) + '; knots-v:' + list(o.knotsV) + '; control-points:[' + o.controlPoints.map(poles).join(',') + ']; weights:[' + o.weights.map(list).join(',') + ']; }').join(' ');
  const source = '@model ' + model.name + ' { version:0; length-unit:mm; ' + text + ' }\n', compiled = compileCadModel(source, { sourceVersion: 0 });
  check(compiled.ok, 'actual source0 geometry compilation required'); check(same(compiled.model, model), 'source0 complete geometry IDs/order/coefficients/signs must agree'); return { source, model: compiled.model };
}
/** Multiply original quadratic rational denominator by linear native t; elevate its other homogeneous coordinates. */
function wallPcurve(circle: Curve, section: Curve, height: number, id: string): { curve: Curve; spans: PlaneCylinderHomogeneousSpan[] } {
  check(circle.degree === 2 && circle.controlPoints.length === 9 && same(circle.knots, [0,0,0,1,1,2,2,3,3,4,4,4]), 'original four rational quadratic circle spans required');
  const points: Point[] = [], weights: number[] = [], spans: PlaneCylinderHomogeneousSpan[] = [];
  for (let q = 0; q < 4; q++) {
    const w = circle.weights.slice(q * 2, q * 2 + 3), z = section.controlPoints.slice(q * 2, q * 2 + 3).map(p => p[2]);
    const denominator: number[] = [], un: number[] = [], vn: number[] = [];
    for (let i = 0; i <= 3; i++) {
      const right = i < 3 ? finite((3 - i) / 3 * w[i]) : 0, left = i > 0 ? finite(i / 3 * w[i - 1]) : 0;
      const W = i === 0 ? w[0] : i === 3 ? w[2] : finite(right + left);
      const U = finite(q * W + left), Z = i === 0 ? finite(w[0] * z[0]) : i === 3 ? finite(w[2] * z[2]) : finite(finite(right * z[i]) + finite(left * z[i - 1])), V = finite(Z / height);
      check(W > 0, 'positive original elevated denominator required'); denominator.push(W); un.push(U); vn.push(V);
      const point: Point = i === 0 ? [q, finite(z[0] / height), 0] : i === 3 ? [q + 1, finite(z[2] / height), 0] : [finite(U / W), finite(V / W), 0];
      if (q > 0 && i === 0) check(same(point, points.at(-1)) && Object.is(W, weights.at(-1)), 'exact shared homogeneous quarter endpoint required');
      else { points.push(point); weights.push(W); }
    }
    spans.push({ domain: [q,q+1], originalPoleIndices: [q*2,q*2+1,q*2+2], outputPoleIndices: [q*3,q*3+1,q*3+2,q*3+3], denominatorCoefficients: denominator, uNumeratorCoefficients: un, vNumeratorCoefficients: vn });
  }
  const curve: Curve = { kind: 'curve', id, degree: 3, knots: [0,0,0,0,1,1,1,2,2,2,3,3,3,4,4,4,4], controlPoints: points, weights }; validateCurve(curve); return { curve, spans };
}
const residual = (a: Point, b: Point) => finite(Math.hypot(...a.map((v,i) => v-b[i])));
function attempt<T>(action: () => T): { status: 'evaluated'; value: T } | { status: 'native-refused'; reason: string } {
  try { return { status: 'evaluated', value: action() }; } catch (error) { check(error instanceof Error, 'native evaluator Error required'); return { status: 'native-refused', reason: error.message.slice(0,1024) }; }
}
function tangent(surface: SurfaceD1Result, curve: CurveD1Result): Point { return surface.du.map((v,i) => finite(v * curve.derivative[0] + surface.dv[i] * curve.derivative[1])) as Point; }
export function observe(curve: Curve, plane: Surface, wall: Surface, bindings: XYCirclePrismPlaneBindings): PlaneCylinderIntersectionObservation[] {
  return Array.from({ length: 17 }, (_, i) => {
    const t = i/4, point = evaluateCurve(curve,t), puv = evaluateCurve(bindings.plane.curve,t), wuv = evaluateCurve(bindings.wall.curve,t);
    check(puv[2] === 0 && wuv[2] === 0, 'genuine UV curve coordinate required');
    const pp = evaluateSurface(plane,puv[0],puv[1]), wp = evaluateSurface(wall,wuv[0],wuv[1]);
    const pr = residual(point,pp), wr = residual(point,wp), ur = finite(Math.abs(wuv[0]-t)); check(pr <= 1e-7 && wr <= 1e-7 && ur <= 1e-12, 'actual dual-surface/pcurve native observation exceeds local comparison');
    const d1: PlaneCylinderIntersectionObservation['d1'] = { section: attempt(() => evaluateCurveD1(curve,t)), planePcurve: attempt(() => evaluateCurveD1(bindings.plane.curve,t)), wallPcurve: attempt(() => evaluateCurveD1(bindings.wall.curve,t)), planeSurface: attempt(() => evaluateSurfaceD1(plane,puv[0],puv[1])), wallSurface: attempt(() => evaluateSurfaceD1(wall,wuv[0],wuv[1])) };
    if (d1.section.status === 'evaluated' && d1.planePcurve.status === 'evaluated' && d1.planeSurface.status === 'evaluated') { d1.mappedPlaneTangent = tangent(d1.planeSurface.value,d1.planePcurve.value); d1.planeTangentResidual = residual(d1.section.value.derivative,d1.mappedPlaneTangent); check(d1.planeTangentResidual <= 1e-7,'actual plane tangent chain observation failed'); }
    if (d1.section.status === 'evaluated' && d1.wallPcurve.status === 'evaluated' && d1.wallSurface.status === 'evaluated') { d1.mappedWallTangent = tangent(d1.wallSurface.value,d1.wallPcurve.value); d1.wallTangentResidual = residual(d1.section.value.derivative,d1.mappedWallTangent); check(d1.wallTangentResidual <= 1e-7,'actual wall tangent chain observation failed'); }
    return { parameter: t, pointMM: point, planeUV: puv, wallUV: wuv, planePointMM: pp, wallPointMM: wp, planeResidualMM: pr, wallResidualMM: wr, wallParameterResidual: ur, d1 };
  });
}
/** Unrestricted derived support section, not admitted finite-wall intersection. */
export function constructPlaneCylinderCandidate(input: XYCirclePrismShellBundle, inputOptions: XYCirclePrismPlaneIntersectionOptions): OwnPlaneCylinderCandidate {
  const shell = snapshot(input) as XYCirclePrismShellBundle; validateXYCirclePrismShellBundle(shell); const opt = admitOptions(snapshot(inputOptions),shell);
  const sourceCircle = shell.geometry.objects.find(o => o.id === shell.topology.sourceCurveId) as Curve, wallFace = shell.topology.faces.find(f => f.role === 'wall')!;
  const wall = copyCadData(shell.geometry.objects.find(o => o.id === wallFace.surfaceId) as Surface), bottomFace = shell.topology.faces.find(f => f.role === 'bottom-cap')!, support = shell.geometry.objects.find(o => o.id === bottomFace.surfaceId) as Surface;
  const a = support.controlPoints[0][0], b = support.controlPoints[1][1], sx = finite(b[0]-a[0]), sy = finite(b[1]-a[1]), h = shell.construction.heightMM;
  check(sx > 0 && sy > 0, 'positive represented original support spans required');
  const lift = (p: Point): Point => [p[0],p[1],finite(finite(opt.slopeX*p[0])+finite(opt.slopeY*p[1])+opt.zInterceptMM)];
  const section: Curve = { ...copyCadData(sourceCircle), id: opt.curveId, controlPoints: sourceCircle.controlPoints.map(lift) }; validateCurve(section);
  const plane: Surface = { kind: 'surface', id: opt.planeId, degreeU: 1, degreeV: 1, knotsU: [0,0,1,1], knotsV: [0,0,1,1], controlPoints: [[lift([a[0],a[1],0]),lift([a[0],b[1],0])],[lift([b[0],a[1],0]),lift([b[0],b[1],0])]], weights: [[1,1],[1,1]] }; validateSurface(plane);
  const min = Math.min(...section.controlPoints.map(p => p[2])), max = Math.max(...section.controlPoints.map(p => p[2]));
  return {shell,options:opt,sourceCircle,section,plane,wallSurface:wall,axialControlHullMM:[min,max],planeSupportMM:{minXY:[a[0],a[1]],maxXY:[b[0],b[1]],representedSpansMM:[sx,sy]}};
}
export function constructPlaneCylinderBindings(candidate: OwnPlaneCylinderCandidate): {bindings: XYCirclePrismPlaneBindings; homogeneousSpans: PlaneCylinderHomogeneousSpan[]} {
  const {sourceCircle,section,plane,wallSurface:wall,options:opt,shell,planeSupportMM:support}=candidate;
  const [sx,sy]=support.representedSpansMM,a=support.minXY,h=shell.construction.heightMM;
  const pc: Curve = { ...copyCadData(sourceCircle), id: opt.planePcurveId, controlPoints: sourceCircle.controlPoints.map(p => [finite((p[0]-a[0])/sx),finite((p[1]-a[1])/sy),0]) }; validateCurve(pc);
  const wc = wallPcurve(sourceCircle,section,h,opt.wallPcurveId), bindings: XYCirclePrismPlaneBindings = { coordinateSystem: 'uv', domain: curveDomain(sourceCircle), evaluationId: opt.evaluationId, plane: { surfaceId: plane.id, curve: pc }, wall: { surfaceId: wall.id, curve: wc.curve } };
  return {bindings,homogeneousSpans:wc.spans};
}
