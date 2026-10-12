import {
  cad, evaluateXYAffinePrismFeatureDocumentV2, updateXYAffinePrismFeatureDocumentV2,
  parseXYAffinePrismFeatureDocumentV2, serializeXYAffinePrismFeatureDocumentV2,
  validateXYAffinePrismFeatureDocumentV2, validateXYAffinePrismFeatureDocumentUpdateV2,
  type XYAffinePrismFeatureDocumentV1, type XYAffinePrismFeatureDocumentV2,
  type XYAffinePrismFeatureResultV1, type XYAffinePrismFeatureResultV2,
  type XYAffinePrismFeatureUpdateV2,
} from '@barocss/cad';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
const { prismV1, prismV2 } = cad.document;
export type Evaluate = Assert<Equal<typeof prismV2.evaluate, typeof evaluateXYAffinePrismFeatureDocumentV2>>;
export type Update = Assert<Equal<typeof prismV2.update, typeof updateXYAffinePrismFeatureDocumentV2>>;
export type Parse = Assert<Equal<typeof prismV2.parse, typeof parseXYAffinePrismFeatureDocumentV2>>;
export type Serialize = Assert<Equal<typeof prismV2.serialize, typeof serializeXYAffinePrismFeatureDocumentV2>>;
export type Validate = Assert<Equal<typeof prismV2.validate, typeof validateXYAffinePrismFeatureDocumentV2>>;
export type ValidateUpdate = Assert<Equal<typeof prismV2.validateUpdate, typeof validateXYAffinePrismFeatureDocumentUpdateV2>>;
export type V1Return = Assert<Equal<ReturnType<typeof prismV1.parse>, XYAffinePrismFeatureResultV1>>;
export type V2Return = Assert<Equal<ReturnType<typeof prismV2.parse>, XYAffinePrismFeatureResultV2>>;

declare const v1: XYAffinePrismFeatureDocumentV1;
declare const v2: XYAffinePrismFeatureDocumentV2;
declare const v1Result: XYAffinePrismFeatureResultV1;
declare const v2Result: XYAffinePrismFeatureResultV2;
declare const v2Update: XYAffinePrismFeatureUpdateV2;
// These expressions are checked with noEmit and are never run.
// @ts-expect-error A v1 document cannot opt into serial-part semantics implicitly.
prismV2.evaluate(v1);
// @ts-expect-error A v2 document cannot use the original-parent sibling profile.
prismV1.evaluate(v2);
// @ts-expect-error v2 updates require the complete original v2 result.
prismV2.update(v1Result, { expectedRevision: 0, revision: 1, parameterEdits: [] });
// @ts-expect-error Serialization accepts authored v2 state, not its derived result.
prismV2.serialize(v2Result);
// @ts-expect-error Complete update records use the matching transaction validator.
prismV2.validate(v2Update);
// @ts-expect-error Whole result validation is not update transaction validation.
prismV2.validateUpdate(v2Result);
// @ts-expect-error Namespace properties remain readonly.
prismV2.evaluate = evaluateXYAffinePrismFeatureDocumentV2;
// @ts-expect-error Profile namespace properties remain readonly.
cad.document.prismV2 = prismV2;
