# Sketch, extrude, cut and keep an editable model

Build a convex pentagonal part, remove a through-slab, widen the cut and reopen the authored model. Then chamfer one original edge of the uncut part. These are public CAD API operations at the separate adopted source profile `31b3033f9db55cab3aa61e3a15e755546d49823a`; they do not change the older quickstart or playground profiles. A package's public export configuration does not establish npm availability.

## Run the complete example

From a repository checkout containing this guide and its Git history, use Node 22 and the workspace's existing dependencies:

```sh
node apps/library-docs/scripts/run-exact-prism-modeling.mjs
```

The runner reads and verifies the fixed CAD manifest/source Git blobs, bundles the standalone public-import sample and executes one bounded CPU flow. It never silently replaces the provider with current `develop`, an installed npm version or a package `dist`. The sample lives at `apps/library-docs/scripts/snippets/exact-prism-modeling.mjs`; the sections below include that actual executed source.

Expected results use millimetres and exact rational cubic millimetres:

- Original pentagonal prism: 7168 mm³, height 8 mm
- Slab cut with X supports at 8 and 16: 5120 mm³ remaining
- Edit the upper X support to 24: 3328 mm³ remaining
- Authored v0 model after that edit: 3641 UTF-8 bytes in this fixture, then rebuilt on parse
- Separate front/top-edge chamfer on the original prism: distance 2 retains 7104 mm³; distance 1 retains 7152 mm³

The byte count belongs to this exact document, IDs and codec. It is not a general model-size guarantee. Source API execution is separate from compiled-package, editor, OS file-picker, browser and GPU acceptance. This guide does not claim those interactions have run.

## 1. Author the sketches and feature recipes

<<< ../../../scripts/snippets/exact-prism-modeling.mjs#imports{js}

The document has exactly five ordered roles: parent sketch, tool sketch, parent prism, tool prism and subtraction. Each sketch below owns its point/segment IDs and fixed affine constraints. The pentagon includes a diagonal side; the cutting rectangle extends beyond the parent in Y. Both prisms use +Z height 8.

<<< ../../../scripts/snippets/exact-prism-modeling.mjs#recipe{js}

The explicit cap charts are part of the input, not an automatic repair hint. `orderedSegmentIds` must describe one complete simple strictly convex cycle of 3–8 original line segments. Positive height is at most 10000 mm; declared chart coordinates/spans have bounded finite values and positive spans. Unsupported closure, concavity, degeneracy or nonrepresentable native chart binding is refused instead of being welded or approximated.

To construct a prism separately, the public call is `buildXYAffineSketchPrism(buildXYAffineSketch(sketch.document), { ...prism.options, sourceId: sketch.sourceId, sourceRevision: sketch.revision })`. Here `sketch` and `prism` are the matching pair produced by `sketchAndPrism`. Retain the returned complete request, Solid and lineage together. A successful exact-affine sketch is not by itself a Solid certificate.

## 2. Cut, edit and reopen

<<< ../../../scripts/snippets/exact-prism-modeling.mjs#edit{js}

The subtraction recipe names the tool's original `s3` and `s1` walls through source ID, sketch ID, source revision and segment ID. The underlying `subtractConvexPlanarSlab(parent, tool, options)` requires two opposite parallel tool supports with a positive gap, and proves that the other tool supports cover the entire parent. It yields fixed `first` and `second` outside-component roles, each with `solid` or `empty` outcome. It does not implement arbitrary subtraction, cavities, curved cutters or a union of the output components.

For the width edit, the candidate retains the parent sketch/prism and rebuilds the tool sketch/prism and subtraction. Read `transaction.transaction.report.actions` to inspect those decisions. The update first performs a full validation of the prior result: `report.validation` and `report.candidate` are separate work records. Selective recomputation never means that prior-result validation is skipped. Only replace your accepted host state after the operation succeeds; stale revisions, forged prior results or inadequate tool coverage must leave it available.

Serialize `updated.document`, not the evaluated result, cached geometry, certificate or transaction. The codec stores bounded authored sketches, literal-mm parameter bindings and feature recipes; parse returns a newly evaluated result. The exact version-zero schema allows no extra derived fields, preserves numeric negative zero and rejects duplicate JSON keys. Its authored-text ceiling is 262144 UTF-16/UTF-8 units. It is a source-only codec: writing a local file, opening it through a picker, history and editor recovery remain host responsibilities. There is no chamfer node in this v0 document.

## 3. Chamfer a genuine original edge

The following selection resolves the original pentagon's front segment through prism lineage, finds its top edge in the qualified parent graph and passes both complete incident source-use references. It does not select a mesh edge by screen position or guess the edge from a generated array index.

<<< ../../../scripts/snippets/exact-prism-modeling.mjs#chamfer{js}

This chamfer runs on the original **uncut** prism. Each distance edit uses the same parent and same complete selection. The negative split side is the retained part and the positive side is the removed wedge. The distance is an equal physical setback on both adjacent planes, not the diagonal width of the new face. The example removes 64 mm³ at distance 2 and 16 mm³ at distance 1.

The supported subset is one straight cardinal edge whose adjacent outward supports are perpendicular signed world-axis planes, with valence-three endpoints and end supports perpendicular to the edge. Only the selected endpoints may be removed; all other original vertices must lie strictly beyond the cut. A non-axis-aligned face elsewhere on the parent is allowed, as this pentagon shows. A diagonal selected support, nonperpendicular end support, nonlocal/touching cut or nonexact UV binding is refused. This is not arbitrary-angle chamfer, multi-edge chamfer, fillet or repeated chamfer of a changed parent.

## Reference and error policy

- Own IDs identify source contexts as well as geometric entities. Keep distinct source/sketch/node/Solid IDs and producer prefixes; do not recycle a selection from a different parent
- `resolveXYAffineSketchPrismWall(prism, reference)` reports `preserved`, `deleted` or `stale`. Its reference includes the current explicit caller revision. The v0 feature update refreshes its own references after its supported edits; arbitrary host edits must resolve again
- Chamfer needs `parentSolidId` and two complete references: `sourceId`, `faceId`, `surfaceId`, `loopId`, `useId`, `curveId`, `pcurveId`. A naked graph edge ID is insufficient
- Stored binary64 data is treated exactly within admitted rational/native construction limits. This does not promise arbitrary mathematical coordinates, approximate repair or manufacturing tolerance
- `XYAffinePrismFeatureError` supplies `code`, `stage` and `nodeId`; examples include `REVISION`, `DEPENDENCY`, `REFERENCE`, `PARAMETER`, `OWNED`, `CODEC` and `BUDGET`
- `ConvexPlanarSolidChamferError` supplies `code`, `stage` and `entity`; examples include `SELECTION`, `METRIC`, `LOCALITY`, `BINDING`, `OWNED` and `BUDGET`
- The source example checks stale-document revision and zero-distance refusal while retaining the accepted input. Do not treat a validator's whole-result self-consistency check as proof of historical authenticity or general persistent topology naming

## Other adopted operations and evidence

For a plane split, `splitConvexPlanarSolid(parent, cutter, options)` retains complete original source/model context for the cutter and yields qualified negative/positive sides or explicit empty outcomes, section and lineage. [Plane split #1591](https://github.com/barocss/barocss/issues/1591) and [sketch→prism→split composition #1593](https://github.com/barocss/barocss/issues/1593) preserve the exact selected fixtures; this page's runnable flow uses slab subtraction instead.

`intersectConvexPlanarSolids(left, right, options)` handles two admitted convex planar Solids, including qualified volumetric output or empty/lower-dimensional contact. [Intersection #1594](https://github.com/barocss/barocss/issues/1594#issuecomment-6121567867) records a separate 2176→1408 mm³ edited fixture. It is not the volume of this guide's slab example and does not establish general Boolean support.

[Sketch prism #1592](https://github.com/barocss/barocss/issues/1592#issuecomment-6121113729) · [Through-slab subtraction #1595](https://github.com/barocss/barocss/issues/1595) · [Authored v0 model #1596](https://github.com/barocss/barocss/issues/1596) · [Source-edge chamfer #1597](https://github.com/barocss/barocss/issues/1597) · [Guide execution #1600](https://github.com/barocss/barocss/issues/1600)

The wider [CAD requirements](https://github.com/barocss/barocss/issues/503), [constraint roadmap](https://github.com/barocss/barocss/issues/532), [feature roadmap](https://github.com/barocss/barocss/issues/534) and [Boolean roadmap](https://github.com/barocss/barocss/issues/535) and [detailing roadmap](https://github.com/barocss/barocss/issues/536) remain open beyond these exact subsets. This executed recipe retains its original source pin. For newer adopted v1/chamfer and mass-property profiles, separate consumer stages and known counterexamples, use the [capability map](./capabilities).

[CAD guides](./guides) · [Examples](./examples) · [Limits](./limits)
