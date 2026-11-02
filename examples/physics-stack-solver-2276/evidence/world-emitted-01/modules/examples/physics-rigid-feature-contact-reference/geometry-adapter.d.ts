import { type Body, type Vec3 } from '../../packages/barocss-physics/src/types.js';
export declare const FEATURE_WITNESS_MESSAGE = "private feature contact requires valid box witnesses";
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
export declare function adaptContactGeometry(a: Body, b: Body): AdaptedContactGeometry | null;
