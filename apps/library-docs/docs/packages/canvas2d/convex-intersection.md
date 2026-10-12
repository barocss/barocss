# Intersect two convex polygons

Compute the shared positive-area contour of a diamond and triangle with public `intersectConvexPolygons`. This is a copied CPU geometry operation: no canvas, renderer or DOM is needed. Use the result to prepare your own scene admission or inspect its points before displaying it.

This recipe uses the local workspace `@barocss/canvas2d` version `0.0.0-experimental` at source commit `23e6615a8e2c4ad9c9299184a6be5ff2735358b5`. The source public entry and a freshly built release-configured `dist/index.js` plus declarations are checked. This is not an npm publication claim. Existing interactive examples keep their historical source profiles.

## Run the copied inputs

In a matching workspace, save this as a TypeScript module and run it through a TypeScript-capable bundler targeting ES2022 or newer. Both operands must already use the same coordinate frame; the helper does not apply display transforms or units. The maintained repository consumer runs with `node apps/library-docs/scripts/check-convex-intersection.mjs` from the repository root using its existing dependencies. It checks the exact code below against source and freshly emitted entries.

```ts
import {
  intersectConvexPolygons, Canvas2DError,
  type PolygonContour, type PolygonBooleanResult,
} from '@barocss/canvas2d';

// Ordinary records and dense arrays in one caller-chosen coordinate frame.
const left: PolygonContour = {
  id: 'LeftOperand',
  points: [{ x: 40, y: 80 }, { x: 80, y: 40 },
    { x: 120, y: 80 }, { x: 80, y: 120 }],
};
const right: PolygonContour = {
  id: 'RightOperand',
  points: [{ x: 65, y: 51 }, { x: 155, y: 57 }, { x: 65, y: 141 }],
};
const original = JSON.stringify([left, right]);
const result: PolygonBooleanResult = intersectConvexPolygons(left, right);
const disjoint = intersectConvexPolygons(left, {
  id: 'Far',
  points: [{ x: 400, y: 300 }, { x: 500, y: 300 }, { x: 400, y: 400 }],
});
let contactCode: string | undefined;
try {
  intersectConvexPolygons(left, {
    id: 'Touch',
    points: [{ x: 80, y: 40 }, { x: 155, y: 57 }, { x: 65, y: 141 }],
  });
} catch (error) {
  if (!(error instanceof Canvas2DError)) throw error;
  contactCode = error.code;
}
const inputsUnchanged = JSON.stringify([left, right]) === original;
// Later caller edits cannot rewrite this already-computed result.
left.points[0].x = 41;
export { result, disjoint, contactCode, inputsUnchanged };
```

## Read the canonical result

`result.operation` is `intersection`. Its `inputIds` is `{ left: ['LeftOperand'], right: ['RightOperand'] }`. There is one contour:

- `id`: `ResultContour1`
- `orientation`: `outer`
- `sourceIds`: `['LeftOperand', 'RightOperand']`, preserving caller operand order
- `points`, in order: `(65,55)`, `(275/4,205/4)`, `(650/7,370/7)`, `(120,80)`, `(80,120)`, `(65,105)`

These fractions describe the expected coordinates; the returned values are ordinary JavaScript `number`s. Canonical order has positive signed area in the supplied numeric coordinate frame and starts at the lexicographically smallest exact point (X first, then Y). Do not infer a screen-clockwise convention from that sign. Either input winding is accepted.

`sourceIds` is operation provenance, not per-edge lineage. `ResultContour1` is an operation-local label, not an automatically reserved display-tree ID. The application owns fresh display IDs, paint, scene construction and renderer admission. The helper neither inserts a node nor paints pixels.

Inputs and output are copied: the call leaves the two inputs unchanged, and the later edit to `left` in the snippet does not change `result`. A disjoint pair succeeds with `contours: []`; it does not synthesize a zero-area path. In the third call, the triangle shares the diamond's `(80,40)` vertex, so `contactCode` is `UNSUPPORTED_FEATURE`. Contact is a refusal, not an empty success.

## Stay within the admitted profile

Each operand is one simple, strictly convex contour with 3–32 distinct vertices. Supply ordinary records with exactly `id` and `points`; points are ordinary records with exactly `x` and `y`. Use a dense ordinary array without extra properties or accessors. Omit a duplicate closing vertex: closure is implicit.

IDs must be distinct between operands and match `[A-Za-z][A-Za-z0-9_-]{0,63}`. Coordinates must be finite integer JavaScript numbers in the inclusive range `[-4096,4096]`; negative zero is refused. Fractional inputs, holes, concave or self-crossing contours, repeated vertices, zero-length edges and collinear vertices are outside this profile.

Proper crossings, strict containment and disjoint contours are supported. Any endpoint on the other operand's edge, shared endpoint or overlapping boundary edge refuses, including touching-only intersections. Identical boundaries therefore refuse too. This API supplies intersection only; it does not extend the separate orthogonal polygon boolean helper to general unions or differences.

Exact BigInt/rational predicates and intersections are used internally. At output, each rational coordinate is converted with `Number(numerator) / Number(denominator)` to binary64. Non-finite results or non-positive consecutive turns after conversion refuse with `UNSUPPORTED_FEATURE`. Returned fractional coordinates are not exact rational objects, and need not qualify as integer inputs for another call.

The operation admits at most 64 output vertices, 2,048 clipping point visits and 512-bit bounded rational arithmetic intermediates. Exceeding a vertex/work/arithmetic limit raises `Canvas2DError` with `SCENE_LIMIT`; invalid geometry/data and contact raise `UNSUPPORTED_FEATURE`. These budgets do not expand the supported geometry domain. No epsilon, snapping or automatic contact repair is supplied.

## Next steps

For an editable curve instead of polygon clipping, [split an authored path segment](./path-subdivision). For scene ownership and painting, follow [the retained-object recipe](./examples#create-and-submit-a-retained-object) and [public API tasks](./api).

The diamond/triangle fixture and native algorithm evidence come from [the convex-intersection example at the same source commit](https://github.com/barocss/barocss/blob/23e6615a8e2c4ad9c9299184a6be5ff2735358b5/examples/canvas2d-scene/evidence/convex-intersection/probe.mjs). This guide's consumer checks copied inputs, all six canonical output points, disjoint output and contact refusal on both public entries. It makes no new browser, render, Save/Open or whole-package correctness claim.
