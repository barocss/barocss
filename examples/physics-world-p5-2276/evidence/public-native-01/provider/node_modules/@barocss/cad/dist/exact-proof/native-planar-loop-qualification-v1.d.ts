export type NativePlanarLoopQualificationV1 = {
    readonly status: 'qualified';
    readonly winding: 'counterclockwise' | 'clockwise';
    readonly vertexCount: number;
    readonly method: 'exact-binary64-orientation-and-bigint-area';
} | {
    readonly status: 'refused';
    readonly reason: 'invalid-loop' | 'repeated-vertex' | 'zero-edge' | 'zero-area' | 'self-intersection' | 'non-simple-boundary';
} | {
    readonly status: 'unsupported';
    readonly reason: string;
};
/** A bounded *simple straight polygon boundary* only, not a face or material model. */
export declare function qualifyNativePlanarLoopV1(input: unknown): NativePlanarLoopQualificationV1;
