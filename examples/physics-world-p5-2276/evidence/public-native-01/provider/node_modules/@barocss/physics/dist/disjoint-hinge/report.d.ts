import { type Joint, type Vec3 } from '../internal-types.js';
import type { BodyCorrection, HingeMotorJointReport, PairBodies, ReportCap } from './types.js';
/** DATA helper used by the physical flow. Finite report validation does not enforce the cap. */
export declare function validateHingeMotorReport(value: unknown, identity: {
    id: string;
    aId: string;
    bId: string;
}): HingeMotorJointReport;
/** The only reaction cap is the original fixed .01 N*m*s, with strict greater-than. */
export declare function enforceHingeMotorReactionCap(jointId: string, angularImpulseNms: Vec3): void;
export declare function bodyCorrections(free: PairBodies, projected: PairBodies): [BodyCorrection, BodyCorrection];
export declare function makeReport(joint: Joint, free: PairBodies, projected: PairBodies, targetAngleRad: number, motorImpulseNms: number): {
    jointReport: HingeMotorJointReport;
    bodyCorrections: [BodyCorrection, BodyCorrection];
    reportCap: ReportCap;
};
/** Internal admitted/constructed data only. Each occurrence gets its own copy. */
export declare function copyData<T>(value: T): T;
/** Guard inputs use descriptors. No accessor is invoked. Reflection errors remain unknown. */
export declare function ownData(value: unknown, keys: readonly string[]): Record<string, unknown> | null;
export declare function denseNumbers(value: unknown, length: number): number[] | null;
