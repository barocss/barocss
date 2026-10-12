# Cut a prism, chamfer the cut part and keep it editable

This guide follows one complete part: exact XY sketches → prisms → through-slab subtraction → **the actual second cut component** → a cardinal chamfer → dimension edits → authored JSON → reconstruction in a fresh process. It uses the adopted [v2 engine #1607](https://github.com/barocss/barocss/blob/2d2a31977c16c00ab30b9273e13c26b71b49ef26/packages/barocss-cad/src/xy-affine-prism-feature-document-v2.ts). Source text dialects 0–3 are a different interface; this JSON is not accepted by `compileCadModel`.

The runtime observations below come from the accepted [native serial-part verification](https://github.com/barocss/barocss/blob/2d2a31977c16c00ab30b9273e13c26b71b49ef26/examples/cad-nurbs/xy-affine-prism-serial-part-verification.json). This documentation increment checks the exact saved fixture and types without rerunning geometry. Public source adoption, package installation, editor interaction and a release are separate facts.

## 1. Start with the complete authored model

<a :href="withBase('/examples/serial-part-v2.json')" download>Download complete serial-part-v2.json</a>

The download is the original accepted `authored-base.json`: **5945 UTF-8 bytes**, SHA-256 `15672f1f44b154698759db7ed80f903081fafecd1c2683e11448d5564276aaf9`. It contains both complete constrained sketches, both prism recipes, subtraction, the original chamfer references and all 11 literal-mm parameters. It is not an illustration with missing IDs or a cached geometry result. Its signed `-0` is preserved; avoid a generic JSON stringify round trip when preserving those authored bits.

The parent footprint is `(0,0), (32,0), (32,16), (16,32), (0,32)` mm. Its height is 8 mm. The tool footprint is `(8,-16), (16,-16), (16,48), (8,48)` mm, also height 8. The parent has an oblique rear face, but the selected front/top edge still meets the restricted cardinal chamfer profile.

| Ordered role | Authored node | What it produces or selects |
| --- | --- | --- |
| 1. Parent sketch | `aa_sketch_node`, source `aa_source` | Five fixed points and original segments `s0`…`s4` |
| 2. Tool sketch | `bb_sketch_node`, source `bb_source` | Four fixed points; `s3` and `s1` supply the X=8 and X=16 supports |
| 3. Parent prism | `aa_prism_node` | Qualified `aa_solid`, prefix `aa` |
| 4. Tool prism | `bb_prism_node` | Qualified `bb_solid`, prefix `bb` |
| 5. Subtraction | `subtraction_feature` | Outside components `left_part` and `right_part` |
| 6. Chamfer | `front_detail` | Consume `right_part`; retain `detailed_part`, remove `front_wedge` |

These are exactly six fixed roles, not an arbitrary dependency graph. Both prism recipes explicitly contain `chartPolicy: { version: 1, kind: 'coordinate-span' }` and their own `capChart`. The policy changes the producer's parameter charts; it is not tolerance repair or a search for a convenient chart. A document with only new charts but no serial chamfer is not this v2 profile.

To build the primitives outside a document, use `cad.sketch.affineXY.build(sketch.document)` followed by `cad.solid.prismXY.build(sketchResult, { ...prism.options, sourceId: sketch.sourceId, sourceRevision: sketch.revision })`, where `sketch` and `prism` are the matching authored nodes. Keep the complete returned source, request, Solid and lineage. The feature evaluator performs this construction and then resolves the explicitly selected tool walls before cutting.

## 2. Choose v2 explicitly and open

<<< ../../../scripts/snippets/serial-part-v2.ts#open{ts}

[The adopted concise API #1609](https://github.com/barocss/barocss/blob/d71cb7dd79569aaeb12a8915d28293c4b9801c1c/packages/barocss-cad/CONCISE_API.md) exposes `cad.document.prismV2` with `evaluate`, `update`, `parse`, `serialize`, `validate` and `validateUpdate`. They are direct references to the corresponding `…XYAffinePrismFeatureDocumentV2` providers, with `validateUpdate` naming `validateXYAffinePrismFeatureDocumentUpdateV2`. Short names add no defaults, migration, unit conversion or weaker admission. Use `evaluate(authoredDocument)` when starting from an already typed authored object; use `parse(authoredText)` for a complete file. Both return evaluated results.

| Feature document | Select explicitly | Chamfer meaning |
| --- | --- | --- |
| v0 | `parseXYAffinePrismFeatureDocument` and matching unversioned providers | Five nodes; slab subtraction, no chamfer node |
| v1 | `cad.document.prismV1` | Five or six nodes; optional chamfer on the original prism, a **sibling** of subtraction |
| v2 | `cad.document.prismV2` | Six nodes; mandatory chamfer of the actual **second subtraction component**, explicit coordinate-span charts |

There is **no automatic migration** between these formats. Changing only the version number is insufficient. `cad.document.sourceV1` is yet another family: the native Curve/Surface asset document, not Source dialect 1 or this feature graph. The [historical v0 recipe](./exact-prism-modeling) retains its tested `31b3033f` implementation and separate uncut-prism chamfer.

## 3. Read the finished part, not its intermediate parent

<<< ../../../scripts/snippets/serial-part-v2.ts#outputs{ts}

For the downloaded base model, the unchanged first component is 2048 mm³. The second component before chamfer is 3072 mm³. The finished second component is **3064 mm³**, with an 8 mm³ removed wedge. Do not display `subtraction.second` as though it were the finished part. The first component and finished second component are separate occupied Solids; v2 does not fuse them or create an assembly.

The sixth node's authored parent is exactly:

```json
{
  "kind": "subtraction-component",
  "subtractionNodeId": "subtraction_feature",
  "componentRole": "second",
  "solidId": "right_part"
}
```

This fragment explains one field; the downloadable JSON is the complete model. Replacing `second` with `first`, supplying another Solid ID or depending directly on the original prism refuses.

### How the edge survives the cut

The authored chamfer reference identifies `aa_source`, `aa_sketch`, its current source revision, original segment `s0` and `role: 'top'`. It also stores **both complete original-prism incident uses**: `sourceId`, `faceId`, `surfaceId`, `loopId`, `useId`, `curveId` and `pcurveId`. Those complete values are in the download; they are specific to this original geometry.

The evaluator finds the original segment's top edge, follows each owning original face and its complete per-face-use lineage into the selected component, then requires exactly one qualified opposite-paired edge. `result.chamferResolution` records that newly resolved edge and source intervals. Those are derived output, not fields to save in the authored document. They are rebuilt after opening and may change after an edit. There is no nearest-edge search, generated array-index selection, automatic component switching or general persistent topology naming.

## 4. Change dimensions atomically

<<< ../../../scripts/snippets/serial-part-v2.ts#edit{ts}

`rearX` edits the parent's fixed rear-point X constraint. `parentHeight` edits its prism height. Other existing bindings include `upperX` for the two right-side tool constraints and `setback` for the chamfer's physical distance. Edit through the parameter transaction rather than changing a copied result, cached mesh or only a parameter value while leaving its bound literal inconsistent.

Every update reconstructs and checks the complete prior result before doing candidate work. The caller supplies the exact current `expectedRevision` and next `revision`. Revisions for changed sketches and their retained semantic references are updated by the supported transaction. Keep the old accepted result until the new call succeeds.

The accepted native campaign measured these exact volumes in mm³, all at setback 1:

| rearX | Parent height | Second before chamfer | Finished second | Wedge |
| --- | --- | --- | --- | --- |
| 16 | 8 | 3072 | 3064 | 8 |
| 16 | 6 | 2304 | 2296 | 8 |
| 20 | 8 | 3328 | 3320 | 8 |
| 20 | 6 | 2496 | 2488 | 8 |

At the base geometry, `setback=2` gives finished second 3040 and wedge 32. A separate `upperX=24` tool edit at `rearX=16` gives second 1280, finished 1276 and wedge 4. These are distinct measured inputs; combining arbitrary individually accepted edits is not guaranteed to succeed.

- Distance-only edit: retain both sketches/prisms and subtraction; rebuild chamfer
- Tool edit: rebuild tool sketch/prism, subtraction and dependent chamfer; retain original parent
- Parent-height edit: retain both sketches and tool prism; rebuild parent prism, subtraction and chamfer
- Same-value edit: still fully validate prior state, but no candidate native work

Read `transaction.report.actions`, `validation` and `candidate` separately. Whole-result and whole-transaction validators reconstruct their inputs too; validation is not a free read or an external authenticity certificate.

## 5. Save authored state and reconstruct in a fresh process

<<< ../../../scripts/snippets/serial-part-v2.ts#serialize{ts}

Store the returned string intact. `serialize` evaluates the authored document before emitting text. The codec admits at most **262144 UTF-16 units and UTF-8 bytes**, preserves numeric signed zero and rejects duplicate keys, extra fields and derived caches. Geometry, certificates, work reports, generated edge IDs and `chamferResolution` are not saved authority.

For a fresh-process open in a matching built workspace, use this complete Node script, saved as `serial-part-v2-cold.mjs` next to a package that resolves `@barocss/cad`:

<<< ../../../scripts/snippets/serial-part-v2-cold.mjs{js}

```sh
node serial-part-v2-cold.mjs serial-part-v2.json
```

For the original download, the finished Solid ID is `detailed_part`, selected parent ID is `right_part`, and the exact volume is `{ "numerator": "3064", "denominator": "1" }`. A re-edit starts from the returned rebuilt result and its current revision. No object from the prior process is required. The accepted campaign separately cold-opened all four complete base/height/rear/combined files; that is the runtime evidence reused here. The new documentation snippets are typechecked, not another native run.

Writing a file and invoking Node are host steps. This does not prove browser Download → OS picker Open → re-edit, recovery, GPU pixels or manufacturing readiness.

## 6. Admission limits and useful failures

The underlying prism accepts one ordered strictly convex 3–8-line XY cycle, positive +Z height up to 10000 mm, complete authored charts and exact qualified native lifting. The through-slab must have two distinct opposite parallel selected supports and a positive gap; every other tool support must cover the whole parent. It is not general subtraction or a cavity tool.

Chamfer is one straight cardinal edge, with perpendicular signed world-axis adjacent supports, valence-three endpoints and perpendicular end supports. It removes only the selected endpoints; every other vertex must remain strictly beyond the cut. Distance is the equal physical setback on both planes, not the new face's diagonal width. Curved, arbitrary-angle, multi-edge and nonlocal chamfers remain unsupported.

V2 admits at most 16 literal-mm parameters and 32 total bindings. Its exported `XYAffinePrismFeatureDocumentLimitsV2` provides authored-byte, snapshot, phase and update work ceilings. Those are conservative limits, not the expected cost of every model. Complete exact source qualification, binary64 representability and operation-specific native budgets still apply.

| Attempt from the stated accepted input | Observed refusal | What to keep |
| --- | --- | --- |
| `rearX=20`, then `upperX=24` | `NATIVE`, stage `subtraction`; derived XYZ requires non-binary64 `80/3` | Prior accepted rear-edited result |
| Base `parentHeight=10`, tool remains height 8 | `NATIVE`, stage `subtraction`; tool coverage incomplete | Prior accepted base |
| Base `frontY=2` | `NATIVE`, stage `chamfer`; selected supports are not cardinal | Prior accepted base |
| Base `setback=8` | `NATIVE`, stage `chamfer`; touching/nonlocal removal | Prior accepted base |
| Base `upperX=32` | `REFERENCE`, stage `chamfer-reference`; second component is empty | Prior accepted base |
| Base `setback=0` | `PARAMETER`, stage `update` | Prior accepted base |

`XYAffinePrismFeatureError` includes `code`, `stage`, `nodeId`, attempted work and any actual native cause. Stale revision, forged original use fields, ambiguous lineage and forged prior work/resolution also refuse. Do not catch a refusal and silently snap, pick another edge or accept a partial candidate.

The earlier normalized-chart v1 height-6 and rear-X-20 failures remain valid for **that v1 profile**. V2's explicit coordinate-span chart plus exact-affine admission supports the four measured cases above; it does not erase the `80/3` counterexample or imply arbitrary dimensions.

## Evidence and editor boundary

- [Engine source and fixed-role schema](https://github.com/barocss/barocss/blob/2d2a31977c16c00ab30b9273e13c26b71b49ef26/packages/barocss-cad/src/xy-affine-prism-feature-document-v2.ts), [actual campaign](https://github.com/barocss/barocss/blob/2d2a31977c16c00ab30b9273e13c26b71b49ef26/examples/cad-nurbs/xy-affine-prism-serial-part-demo.mjs) and [final verification](https://github.com/barocss/barocss/blob/2d2a31977c16c00ab30b9273e13c26b71b49ef26/examples/cad-nurbs/xy-affine-prism-serial-part-verification.json): source 53 stages/39 refusals, emitted 4 stages, fresh-process 4 stages, legacy 4 stages/2 refusals; all accepted exits 0. The receipt retains the earlier failed instrumentation attempt separately
- [Explicit editor v2 adoption #1608](https://github.com/barocss/barocss/blob/faea0acc7277ba903e7abeb0f6f631cddcf8235e/packages/barocss-cad-editor/README.md): explicit v2 mode, typed parameters, intermediate/final identities and trimmed final preview consumption. Scoped declarations, build, native CPU and controller evidence are separate from actual browser/GPU and OS-file interaction, which remain **UNRUN** for this increment
- The current page's JSON hash, complete-authored-input typecheck, API snippet checks and links are documentation evidence only. No native geometry campaign, full VitePress build or browser run is added by those checks

[Supported shapes and edit chains](./capabilities) · [CAD language coverage](./language) · [Historical v0 recipe](./exact-prism-modeling) · [CAD guides](./guides)

<script setup>
import { withBase } from 'vitepress'
</script>
