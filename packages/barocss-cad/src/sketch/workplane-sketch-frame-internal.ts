import type { WorkplaneSketchFrame } from './workplane-sketch-document.js';
import type { CadAffineMatrix3x4 } from '../features/affine-geometry-transform.js';
import type { Point } from '../types.js';
export type WorkplaneSketchFrameReport = { norms: { u: number; v: number; normal: number }; unitNormErrors: { u: number; v: number; normal: number }; dotProducts: { uv: number; un: number; vn: number }; determinant: number; determinantError: number; maximumNormError: number; maximumOrthogonalityError: number; tolerance: 0.000000001; accepted: true };
/** Shared original numerical frame gate; wrappers own the data and supply their unchanged error family. */
export function admitWorkplaneSketchFrame(input: WorkplaneSketchFrame, fail: (code: 'INPUT' | 'IDENTITY' | 'FRAME', detail: string) => never): { plane: WorkplaneSketchFrame; report: WorkplaneSketchFrameReport; matrix: CadAffineMatrix3x4 } {
  function check(condition: boolean, code: 'INPUT' | 'IDENTITY' | 'FRAME', detail: string): asserts condition { if (!condition) fail(code, detail); }
  check(input !== null && typeof input === 'object' && !Array.isArray(input), 'INPUT', 'An own record is required'); const data = input as unknown as Record<string, unknown>, fields = ['id', 'originMM', 'uAxis', 'vAxis', 'normalAxis'];
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), 'INPUT', 'Exact own fields are required');
  check(typeof data.id === 'string' && data.id.length <= 64 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(data.id), 'IDENTITY', 'A bounded ASCII identifier is required');
  for (const key of ['originMM', 'uAxis', 'vAxis', 'normalAxis']) check(Array.isArray(data[key]) && data[key].length === 3 && (data[key] as unknown[]).every(n => typeof n === 'number' && Number.isFinite(n)), 'FRAME', 'Finite original frame triples are required');
  const plane = data as unknown as WorkplaneSketchFrame; check(plane.originMM.every(n => Math.abs(n) <= 10000), 'FRAME', 'Frame origin must remain within10000mm');
  const u = plane.uAxis, v = plane.vAxis, n = plane.normalAxis, dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norms = { u: Math.hypot(...u), v: Math.hypot(...v), normal: Math.hypot(...n) }, unitNormErrors = { u: Math.abs(norms.u - 1), v: Math.abs(norms.v - 1), normal: Math.abs(norms.normal - 1) }, dotProducts = { uv: dot(u, v), un: dot(u, n), vn: dot(v, n) };
  const determinant = dot(u, [v[1] * n[2] - v[2] * n[1], v[2] * n[0] - v[0] * n[2], v[0] * n[1] - v[1] * n[0]]), determinantError = Math.abs(determinant - 1), maximumNormError = Math.max(...Object.values(unitNormErrors)), maximumOrthogonalityError = Math.max(...Object.values(dotProducts).map(Math.abs));
  check([...Object.values(norms), ...Object.values(unitNormErrors), ...Object.values(dotProducts), determinant, determinantError, maximumNormError, maximumOrthogonalityError].every(Number.isFinite) && maximumNormError <= 1e-9 && maximumOrthogonalityError <= 1e-9 && determinant > 0 && determinantError <= 1e-9, 'FRAME', 'Original frame must be numerically unit, orthogonal and proper within1e-9');
  const matrix: CadAffineMatrix3x4 = [u[0], v[0], n[0], plane.originMM[0], u[1], v[1], n[1], plane.originMM[1], u[2], v[2], n[2], plane.originMM[2]];
  return { plane, matrix, report: { norms, unitNormErrors, dotProducts, determinant, determinantError, maximumNormError, maximumOrthogonalityError, tolerance: 0.000000001, accepted: true } };
}
