// CG1.2 bounded guide: one world-space quadratic Bezier on a conic seam or the first admitted mixed-curve seam.
// Its middle pole lies on the cap midplane, so the guide adds only transverse quadratic
// displacement. The section planes remain strictly ordered; positive conic radii stay simple.
import { BrepError } from '../brep/brep-core.js';
import { ExtrudedProfileLimits } from './extruded-profile-solid.js';
import type { loftSolid, LoftInput } from './loft.js';
import type { Point } from '../types.js';

const fail = (detail: string): never => { throw new BrepError('INPUT', `loft: quadratic guide ${detail}`); };

export function admitLoftGuide(value: unknown, start: Point, end: Point, normal: Point, endpointDetail = 'endpoints must exactly match the two cap +X seams') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('must be one explicit guide object');
  const g = value as Record<string, unknown>;
  if (Object.keys(g).length !== 2 || !Object.hasOwn(g, 'kind') || !Object.hasOwn(g, 'controlPoints') || g.kind !== 'quadratic-bezier') return fail('needs exactly kind quadratic-bezier and controlPoints');
  if (!Array.isArray(g.controlPoints) || g.controlPoints.length !== 3) return fail('needs exactly three world control points');
  const controls = g.controlPoints.map((p: unknown): Point => {
    if (!Array.isArray(p) || p.length !== 3 || !p.every(x => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= ExtrudedProfileLimits.coordinateMM)) return fail('needs finite three-component points within the existing coordinate range');
    return [...p] as Point;
  });
  if (!start.every((x, c) => x === controls[0][c]) || !end.every((x, c) => x === controls[2][c])) return fail(endpointDetail);
  const d = controls[1].map((x, c) => x - (start[c] + end[c]) / 2) as Point;
  if (normal[0] * d[0] + normal[1] * d[1] + normal[2] * d[2] !== 0) return fail('middle control must lie exactly on the cap midplane');
  return {
    /** The seam itself keeps the authored middle pole exactly; no fit or projection. */
    middle: (lo: Point, hi: Point): Point => controls[1].map((x, c) => x + ((lo[c] - start[c]) + (hi[c] - end[c])) / 2) as Point,
    /** Q(t) minus the straight seam: 2t(1-t) times its transverse middle-pole offset. */
    offset: (t: number): Point => d.map(x => 2 * t * (1 - t) * x) as Point,
  };
}

// Internal callback only: public LoftInput and loftSolid retain their existing signatures.
export type LoftGuide = ReturnType<typeof admitLoftGuide>;
export type LoftGuideFactory = (start: Point, end: Point) => LoftGuide;
export type LoftLegacyBuilder = (input: LoftInput, guide?: LoftGuideFactory) => ReturnType<typeof loftSolid>;
