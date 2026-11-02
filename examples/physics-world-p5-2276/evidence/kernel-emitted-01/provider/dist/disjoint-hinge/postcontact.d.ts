import type { Body, PhysicsBodyState } from '../internal-types.js';
import type { ParsedPair, BodyCorrection, HingeMotorJointReport, ReportCap } from './types.js';
/** Already parsed internal phase. No public admission, World, motor, FREE or contact work. */
export declare function projectDisjointPostContact(input: {
    bodies: readonly Body[];
    pairs: readonly [ParsedPair, ParsedPair];
    motorImpulsesNms: readonly [number, number];
    sourceStepIndex: number;
    sourceTimeSeconds: number;
}): {
    projectedBodies: PhysicsBodyState[];
    projectedRawHex: string;
    jointReports: HingeMotorJointReport[];
    bodyCorrections: [BodyCorrection, BodyCorrection][];
    reportCaps: ReportCap[];
    calls: {
        projectionCalls: number;
        reportCalls: number;
    };
};
