import type { BooleanExtrusionFeatureGraphV0, BooleanExtrusionFeatureGraphOptions, BooleanExtrusionFeatureGraphResult } from './boolean-extrusion-feature-graph.js';
/** Serialize only admitted authored intent. Native evaluations and caller budgets are not wire fields. */
export declare function serializeBooleanExtrusionFeatureGraph(document: BooleanExtrusionFeatureGraphV0, options: BooleanExtrusionFeatureGraphOptions): string;
/** Original strict JSON grammar, followed by actual current graph admission and native reconstruction. */
export declare function parseBooleanExtrusionFeatureGraph(text: string, options: BooleanExtrusionFeatureGraphOptions): BooleanExtrusionFeatureGraphResult;
