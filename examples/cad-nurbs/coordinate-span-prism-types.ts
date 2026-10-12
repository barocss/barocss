import { buildXYAffineSketchPrism, validateXYAffineSketchPrism, serializeXYAffinePrismFeatureDocument } from '../../packages/barocss-cad/src/index.js';
import type { XYAffineSketchSuccess, XYAffineSketchPrismOptions, XYAffineSketchPrismCoordinateSpanOptions, XYAffineSketchPrismReport, XYAffineSketchPrismCoordinateSpanReport, XYAffinePrismNode } from '../../packages/barocss-cad/src/index.js';
declare const sketch: XYAffineSketchSuccess;
declare const oldOptions: XYAffineSketchPrismOptions;
declare const newOptions: XYAffineSketchPrismCoordinateSpanOptions;
const oldResult = buildXYAffineSketchPrism(sketch, oldOptions);
const oldReport: XYAffineSketchPrismReport = validateXYAffineSketchPrism(oldResult);
const newResult = buildXYAffineSketchPrism(sketch, newOptions);
const newReport: XYAffineSketchPrismCoordinateSpanReport = validateXYAffineSketchPrism(newResult);
const oldPolicy: 'declared-cap-chart-natural-wall-chart-exact-stored-solid-proof-no-retry' = oldReport.numericPolicy;
const newPolicy: 'explicit-coordinate-span-v1-exact-stored-solid-proof-no-retry' = newReport.numericPolicy;
const version: 1 = newResult.request.options.chartPolicy.version;
declare const node: XYAffinePrismNode;
// @ts-expect-error Versioned feature documents do not adopt the new producer policy in this leaf.
node.options.chartPolicy;
void [oldPolicy, newPolicy, version, serializeXYAffinePrismFeatureDocument];
