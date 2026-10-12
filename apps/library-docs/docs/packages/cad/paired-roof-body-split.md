# Split a paired-roof Body into two closed Bodies

Use `splitPairedRoofDifferenceBody` when a qualified paired-roof difference Body needs an intermediate native roof. It returns two newly constructed closed, restricted Solid Bodies and an exact composition proof. The lower output occupies lower-to-middle; the upper output occupies middle-to-upper. The cut is shared native geometry with opposite effective uses, so each output has its own closed boundary.

## Availability and complete inputs

This guide describes the public `@barocss/cad` root exports at source commit `e7629701c61a8a878f7a742aab2af37a570f21e5` ([implementation](https://github.com/barocss/barocss/blob/e7629701c61a8a878f7a742aab2af37a570f21e5/packages/barocss-cad/src/paired-roof-body-split.ts)). This is a source checkpoint, not a claim about an npm release. The [native campaign receipt](https://github.com/barocss/barocss/issues/1575#issuecomment-6116691027) records the completed native verification; this Manual page does not rerun it.

Supply complete results, not Body IDs, meshes, extracted reports or fabricated certificates:

- `whole: PairedRoofDifferenceBodyResult` is the complete result of `buildPairedRoofDifferenceBody(lower, upper, options)`. Retain its request, geometry, vertices, edges, faces, shell, body, proof, observations and report
- `middle: PairedSurfaceMaterialBodyResult` is the complete result of `buildPairedSurfaceMaterialBody(a, b, options)`. Its request retains the genuine A/B UV split-Face results and their complete original section/source/model data
- Both parents retain the same original B source identity, source spelling, selected support and model siblings. A native domains, original U interval, B UV map (unit scale), footprint, physical low bounds and admitted unit-positive XYZ axes agree. Source models use version 0 and millimetres; native UV is dimensionless
- The middle roof must lie strictly between the whole's floor and roof throughout the admitted footprint. The construction requires strictly positive complete gap Bernstein hulls; an unsupported candidate can refuse even if a few sampled points look valid

The complete fixture preparation is in the existing [native demonstration](https://github.com/barocss/barocss/blob/e7629701c61a8a878f7a742aab2af37a570f21e5/examples/cad-nurbs/paired-roof-body-split-demo.mjs). Opening this link only reads its source. It is not a playground action or an automatic execution path.

## Typed application boundary

This function accepts already prepared complete parents. It does not invent or shorten their geometry. The maintained documentation check type-checks this exact block without emitting or executing it.

```ts
import {
  splitPairedRoofDifferenceBody,
  validatePairedRoofBodySplit,
  type PairedRoofDifferenceBodyResult,
  type PairedSurfaceMaterialBodyResult,
  type PairedRoofBodySplitOptions,
  type PairedRoofBodySplitRequest,
  type PairedRoofBodySplitResult,
  type PairedRoofBodySplitReport,
} from '@barocss/cad';

export function splitPreparedParents(
  whole: PairedRoofDifferenceBodyResult,
  middle: PairedSurfaceMaterialBodyResult,
): PairedRoofBodySplitResult {
  const options = {
    evaluationId: 'split_eval',
    certificateId: 'split_cert',
    maximumOutputBodies: 2,
    lowerOptions: {
      evaluationId: 'split_lower', resultIdPrefix: 'cutlo',
      maximumClosures: 3, maximumFaces: 6,
      maximumEdgePairs: 12, maximumObservations: 24,
    },
    upperOptions: {
      evaluationId: 'split_upper', resultIdPrefix: 'cuthi',
      maximumClosures: 3, maximumFaces: 6,
      maximumEdgePairs: 12, maximumObservations: 24,
    },
  } satisfies PairedRoofBodySplitOptions;
  const request = { whole, middle, options } satisfies PairedRoofBodySplitRequest;
  return splitPairedRoofDifferenceBody(request);
}

// An explicit, expensive ingestion boundary; do not call on every render.
export function validateRetainedSplit(input: unknown): PairedRoofBodySplitReport {
  return validatePairedRoofBodySplit(input);
}
```

The example identities must be fresh relative to both complete parents. Identities are bounded ASCII (`[A-Za-z_][A-Za-z0-9_-]*`, at most 48 characters); child prefixes allow at most 8 characters. Reservation covers 256 distinct wrapper/output roles, including 127 for each child. Choose different names if any generated role collides. The literal caps are fixed admission values, not tuning knobs: exactly two outputs and child limits 3 closures / 6 Faces / 12 Edge pairs / 24 observations each.

## Read the partition, not just the volume

The tuple order is stable: `outputs[0]` is lower-to-middle, `outputs[1]` is middle-to-upper. Each retains a full genuine difference result, including a closed oriented shell and a restricted Solid certificate.

`proof.authority` binds the common original geometry. `proof.regions` compares complete floor, middle, roof and gap-sum coefficients. Strict positive gaps and a common injective footprint establish pointwise closed cover and disjoint interiors: the two interiors do not overlap, their union covers the whole occupied region, and their intersection is exactly the middle roof. Equal total volume alone would not prove that partition.

`proof.interface` binds the middle native Face, original domains, complete UV/world-image residuals and four boundary pairs. Its orientations are `['forward', 'reverse']` and import reversals `[false, true]`; these certify opposite effective cut uses. Shared native geometry does not mean shared mutable JavaScript objects. `proof.lineage` connects the original Body, middle Face, output Bodies and outer Face bindings.

The recorded campaign fixture has output volumes **9/128 + 9/128 = 9/64 mm³**, with exact zero conservation residual. Those equal halves belong to that fixture; arbitrary admitted roofs are not promised equal volumes. Read `report.outputVolumesMM3`, `report.exactVolumeMM3`, `report.conservationResidual` and `report.minimumGaps` as exact numerator/denominator strings for the actual request.

## Ownership, refusals and cost

Inputs are snapshotted as bounded, acyclic plain own data. Getters, symbols, hidden fields, sparse arrays, extra array fields and unsupported prototypes refuse. The returned request, outputs, proof and report are independent copies; mutating an accepted result does not update its proof. Keep the previously accepted result when a new candidate throws. Failure is atomic: no partial split is returned.

Catch `PairedRoofBodySplitError` and inspect its bounded `code`, `context.phase`, `context.outputIndex` and `context.directCounts`. Input/identity errors use `INPUT` or `IDENTITY`; full-parent rejection uses `PARENT`; authority or construction failures use `PROFILE` or `CONSTRUCTION`; proof failures use `BINDING`, `PARTITION` or `ORIENTATION`; bounded arithmetic/data failures use `BUDGET` or `REPRESENTABILITY`. Complete retained-result rejection uses `OWNED`. Preserve a nested `cause` for diagnosis rather than treating the wrapper code as the entire failure reason.

`validatePairedRoofBodySplit(input: unknown)` reconstructs once from the retained request and compares every retained field, including proof, counts and bounds. It is not a cheap flag check or a public file codec. A successful split directly validates one whole parent and one middle parent, then builds two differences (four direct delegations). The wrapper's direct D0/D1, source compilation and rational-to-float counts are zero; inherited parent validation and child construction still perform substantial work. Inspect `inheritedCounts` separately. Validation repeats that construction cost; budget it at an explicit ingestion boundary.

The full request JSON envelope is **8,388,608 (8 MiB)** and the full result envelope **16,777,216 (16 MiB)**. Both UTF-8 byte count and UTF-16 code-unit count must fit their respective numeric cap, including the measured trailing newline. These are retained-data limits, not peak RAM estimates. Additional limits include 4,194,304 own values, depth 64, 8,192 array elements, 64 record fields, 5,000 fraction-integer characters, 200,000 rational operations, 200,000 GCD steps and 8,192 rational integer bits. `report.sizes`, `report.ownValues`, `report.limits` and `report.rationalCounts` expose the measurements. Size accounting must settle within eight passes.

## Qualification boundary

This operation covers the admitted paired-roof profile. It does not provide general Boolean/split operations, manufacturing-tolerance certification or a global binary64 evaluation-error certificate. It adds no Editor UI, Save/Open codec, GPU display packet or Loader qualification. A display or file ingestion workflow needs its own supported contract; this guide claims only the native partition API and its documented source checkpoint.

[CAD API](./api) · [CAD examples](./examples) · [Body and topology](./body-1301)
