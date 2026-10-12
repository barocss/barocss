import { parseXYAffinePrismFeatureDocument, parseXYAffinePrismFeatureDocumentV1 } from '../../packages/barocss-cad/dist/index.js';
import type { XYAffinePrismFeatureResult, XYAffinePrismFeatureResultV1, XYAffinePrismFeatureDocumentV0 } from '../../packages/barocss-cad/dist/index.js';
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
export type V0ParserUnchanged = Assert<Equal<ReturnType<typeof parseXYAffinePrismFeatureDocument>, XYAffinePrismFeatureResult>>;
export type V1ParserExplicit = Assert<Equal<ReturnType<typeof parseXYAffinePrismFeatureDocumentV1>, XYAffinePrismFeatureResultV1>>;
export type V0FiveNodes = Assert<Equal<XYAffinePrismFeatureDocumentV0['nodes']['length'], 5>>;
export type V0WorkKeys = Assert<Equal<keyof XYAffinePrismFeatureResult['report']['coldWork'], 'sketchBuilds' | 'prismBuilds' | 'wallResolutions' | 'subtractions' | 'sourceCompilations' | 'faceCompilations' | 'bindingObservations' | 'totalD1' | 'rationalContexts' | 'rationalOperations' | 'gcdSteps'>>;
