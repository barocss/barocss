import { PhysicsError, type Body, type Vec3 } from '../../packages/barocss-physics/src/types.js';
import { add } from '../../packages/barocss-physics/src/math.js';
import { error } from '../../packages/barocss-physics/src/validation.js';
import { featureContact } from '../physics-rigid-feature-geometry/geometry.js';

export const FEATURE_WITNESS_MESSAGE = 'private feature contact requires valid box witnesses';

export interface VelocityGeometryPoint {
  id: string;
  pointM: Vec3;
  witnessAM: Vec3;
  witnessBM: Vec3;
  normalGapM: number;
  pointPenetrationM: number;
}

export interface AdaptedContactGeometry {
  family: 'face' | 'edge';
  /** Geometry plane normal used by the unchanged velocity point law. */
  normal: Vec3;
  /** Original SAT metadata stays separate from per-point witness depths. */
  satNormalAtoB: Vec3;
  satPenetrationM: number;
  points: VelocityGeometryPoint[];
  meanPointM: Vec3;
}

export function adaptContactGeometry(a: Body, b: Body): AdaptedContactGeometry | null {
  let geometry: ReturnType<typeof featureContact>;
  try {
    geometry = featureContact(a, b);
  } catch (caught) {
    if (caught instanceof PhysicsError && (caught.code === 'INVALID_CONFIG' || caught.code === 'NUMERIC_LIMIT')) {
      // Inputs are the world's unaccepted working bodies, not caller config.
      error('NUMERIC_LIMIT', FEATURE_WITNESS_MESSAGE);
    }
    throw caught;
  }
  if (!geometry) return null;
  const points = geometry.points.map(point => ({
    id: point.key, pointM: [...point.midpointM] as Vec3,
    witnessAM: [...point.witnessAM] as Vec3, witnessBM: [...point.witnessBM] as Vec3,
    normalGapM: point.normalGapM, pointPenetrationM: point.pointPenetrationM,
  }));
  const sum = points.reduce((value, point) => add(value, point.pointM), [0, 0, 0] as Vec3);
  return {
    family: geometry.family, normal: [...geometry.planeNormalAtoB] as Vec3,
    satNormalAtoB: [...geometry.selection.hit.normal] as Vec3,
    satPenetrationM: geometry.selection.hit.penetration, points,
    meanPointM: sum.map(value => value / points.length) as Vec3,
  };
}
