import type { Vec3 } from '../../packages/barocss-physics/src/types.js';
import type { SATFeatureSelection } from './sat-feature.js';
export interface WitnessPoint {
  key: string; witnessAM: Vec3; witnessBM: Vec3; midpointM: Vec3;
  normalGapM: number; pointPenetrationM: number;
}
export interface FaceReference {
  body: 'a' | 'b'; axis: number; side: number; incidentAxis: number; incidentSide: number;
}
export interface EdgeReference {
  axisA: number; axisB: number; sidesA: Vec3; sidesB: Vec3; parameterA: number; parameterB: number;
}
export interface ContactGeometry {
  selection: SATFeatureSelection; family: 'face' | 'edge'; planeNormalAtoB: Vec3;
  reference?: FaceReference; edges?: EdgeReference; points: WitnessPoint[];
  conditioning: Record<string, number | boolean | string>;
}
