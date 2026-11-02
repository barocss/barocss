import type { Vec3 } from '../internal-types.js';
import type { PairInput } from './types.js';
/** ONE declared pose-only law; v/omega are never assigned or compensated. */
export declare function projectCoupledHinge(input: PairInput): {
    bodies: import("../internal-types.js").Body[];
    poseReport: {
        jointId: string;
        finalAngleRad: number;
        targetAngleRad: number;
    };
    diagnostics: {
        before: {
            centerOfMassM: Vec3;
            linearMomentumVectorKgMps: Vec3;
            orbitalAngularMomentumVectorKgM2ps: Vec3;
            spinAngularMomentumVectorKgM2ps: Vec3;
            angularMomentumVectorKgM2ps: Vec3;
            energyJ: number;
            relativeAngleRad: number;
            anchorAM: Vec3;
            anchorBM: Vec3;
            anchorGapM: number;
            axisDeviationRad: number;
            quaternionNormError: number;
            limitExcessRad: number;
        };
        after: {
            centerOfMassM: Vec3;
            linearMomentumVectorKgMps: Vec3;
            orbitalAngularMomentumVectorKgM2ps: Vec3;
            spinAngularMomentumVectorKgM2ps: Vec3;
            angularMomentumVectorKgM2ps: Vec3;
            energyJ: number;
            relativeAngleRad: number;
            anchorAM: Vec3;
            anchorBM: Vec3;
            anchorGapM: number;
            axisDeviationRad: number;
            quaternionNormError: number;
            limitExcessRad: number;
        };
        targetAngleRad: number;
        angleCorrectionsRad: number[];
        translationCorrectionsM: Vec3[];
        sourceStepIndex: number;
        sourceTimeSeconds: number;
        velocityBitsUnchanged: boolean;
        angularVelocityBitsUnchanged: boolean;
        lawEvaluations: number;
    };
};
