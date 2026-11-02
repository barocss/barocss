import type { BooleanExtrusionFeatureGraphResult, BooleanExtrusionLengthParameter, BooleanExtrusionLengthDefinition } from './boolean-extrusion-feature-graph.js';
export type BooleanExtrusionParameterOperation = {
    kind: 'upsert';
    parameter: BooleanExtrusionLengthParameter;
} | {
    kind: 'remove';
    parameterId: string;
};
export interface BooleanExtrusionParameterTransaction {
    expectedRevision: number;
    revision: number;
    parameterOperations: BooleanExtrusionParameterOperation[];
    distanceEdits: {
        featureId: string;
        definition: BooleanExtrusionLengthDefinition;
    }[];
}
/** One complete prior validation and one final native evaluation; no per-operation geometry staging. */
export declare function transactBooleanExtrusionFeatureGraphParameters(previousInput: BooleanExtrusionFeatureGraphResult, transactionInput: BooleanExtrusionParameterTransaction): BooleanExtrusionFeatureGraphResult;
