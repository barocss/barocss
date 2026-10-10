import type { Body, BoxShape, Vec3 } from '../../packages/barocss-physics/src/types.js';
import { add, sub, dot, scale, rotate } from '../../packages/barocss-physics/src/math.js';
import { error } from '../../packages/barocss-physics/src/validation.js';
import type { WitnessPoint } from './contact-types.js';
export const WITNESS_MESSAGE = 'private feature contact requires valid box witnesses';
export const WITNESS_TOLERANCE_M = 1e-12;
export const DUPLICATE_TOLERANCE_M = 1e-12;
export const basis = (b: Body): Vec3[] => ([[1,0,0],[0,1,0],[0,0,1]] as Vec3[]).map(v=>rotate(b.orientation,v));
export const extents = (b: Body): Vec3 => (b.shape as BoxShape).halfExtentsM;
export function unit(v: Vec3): Vec3 {
  const n=Math.hypot(...v); if(!Number.isFinite(n)||n<1e-12) error('NUMERIC_LIMIT',WITNESS_MESSAGE);
  return scale(v,1/n);
}
export function point(key: string,a: Vec3,b: Vec3,n: Vec3): WitnessPoint {
  const gap=dot(sub(b,a),n);
  const result={key,witnessAM:[...a] as Vec3,witnessBM:[...b] as Vec3,
    midpointM:scale(add(a,b),.5),normalGapM:gap,pointPenetrationM:Math.max(0,-gap)};
  if(![...a,...b,...result.midpointM,gap,result.pointPenetrationM].every(Number.isFinite)
      || gap>WITNESS_TOLERANCE_M) error('NUMERIC_LIMIT',WITNESS_MESSAGE);
  return result;
}
