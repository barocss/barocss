import { requireCurveValue, snapshotCurveRequest, compileCurveSource } from './curve-source.js';
import { copyCadData } from './data-copy.js';
import type { Curve, Model, Point } from './types.js';
import type { XYPoint } from './xy-profile.js';

export type XYArcRequest = { kind: 'quarter-arc'; id: string; center: XYPoint; radius: number; quadrant: 0 | 1 | 2 | 3 }
  | { kind: 'circle'; id: string; center: XYPoint; radius: number };
export interface XYArcReport {
  kind: XYArcRequest['kind']; plane: 'xy'; lengthUnit: 'mm'; centerMM: XYPoint; radiusMM: number;
  startQuadrant: 0 | 1 | 2 | 3; spanCount: number; controlPointCount: number; parameterDomain: { min: number; max: number };
  endpointClosed: boolean; periodic: false; regionCertified: false; solid: false;
}
export interface XYArcResult { source: string; sourceVersion: 0; model: Model; curve: Curve; report: XYArcReport }
function check(condition: boolean, detail: string): asserts condition { requireCurveValue(condition, detail, 'XY arc'); }
function point(value: unknown): XYPoint {
  check(Array.isArray(value) && value.length === 2 && value.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 10000), 'center and poles require two finite XY coordinates within 10000 mm');
  return [value[0] as number, value[1] as number];
}

/** Original rational quadratic coefficients, actual source0, no topology proof. */
export function buildXYArc(request: XYArcRequest): XYArcResult {
  const owned = snapshotCurveRequest(request, 'XY arc');
  check(owned !== null && typeof owned === 'object' && !Array.isArray(owned), 'request record required');
  const data = owned as Record<string, unknown>, kind = data.kind;
  check(kind === 'quarter-arc' || kind === 'circle', 'unsupported arc kind');
  const fields = kind === 'circle' ? ['kind', 'id', 'center', 'radius'] : ['kind', 'id', 'center', 'radius', 'quadrant'];
  check(Object.keys(data).length === fields.length && fields.every(key => Object.hasOwn(data, key)), 'exact request fields required');
  check(typeof data.id === 'string' && data.id.length <= 128 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(data.id), 'supported ASCII ID within 128 characters required');
  const center = point(data.center), radius = data.radius;
  check(typeof radius === 'number' && radius >= .001 && radius <= 10000, 'radius must be in 0.001..10000 mm');
  const quadrant = kind === 'circle' ? 0 : data.quadrant;
  check(typeof quadrant === 'number' && Number.isInteger(quadrant) && quadrant >= 0 && quadrant <= 3, 'quadrant must be 0, 1, 2 or 3');
  const quarters: XYPoint[][] = [
    [[radius, 0], [radius, radius], [0, radius]],
    [[0, radius], [-radius, radius], [-radius, 0]],
    [[-radius, 0], [-radius, -radius], [0, -radius]],
    [[0, -radius], [radius, -radius], [radius, 0]],
  ];
  const relative = kind === 'circle' ? [...quarters[0], ...quarters[1].slice(1), ...quarters[2].slice(1), ...quarters[3].slice(1)] : quarters[quadrant];
  const poles: Point[] = relative.map(([x, y]) => { const xy = point([center[0] + x, center[1] + y]); return [xy[0], xy[1], 0]; });
  const spanCount = kind === 'circle' ? 4 : 1;
  for (let span = 0; span < spanCount; span++) {
    const first = span * 2;
    for (let i = first; i < first + 3; i++) for (let j = i + 1; j < first + 3; j++) {
      check(poles[i][0] !== poles[j][0] || poles[i][1] !== poles[j][1], 'computed local quarter poles must remain distinct');
    }
  }
  const w = Math.SQRT1_2, weights = kind === 'circle' ? [1, w, 1, w, 1, w, 1, w, 1] : [1, w, 1];
  const knots = kind === 'circle' ? [0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4] : [0, 0, 0, 1, 1, 1];
  const compiled = compileCurveSource(data.id, 2, poles, knots, weights, 'XY arc');
  return { source: compiled.source, sourceVersion: 0, model: copyCadData(compiled.model), curve: copyCadData(compiled.curve), report: {
    kind, plane: 'xy', lengthUnit: 'mm', centerMM: [...center], radiusMM: radius,
    startQuadrant: quadrant as 0 | 1 | 2 | 3, spanCount, controlPointCount: poles.length,
    parameterDomain: { min: 0, max: spanCount }, endpointClosed: kind === 'circle', periodic: false, regionCertified: false, solid: false,
  } };
}
