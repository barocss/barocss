# Complete CAD1301 Body request

`single.complete-body-request.json` is the unchanged complete input for the selected qualified translated-strip Body example. It contains all three parent results (`base`, `ends`, `volume`) and the exact caller `options`. All nested original sources, Models, sibling objects, native/UV geometry, proofs, IDs and parent flags are retained. It is not a shortened illustrative substitute.

## Run the portable public CLI

Use Node 22+ from the repository root:

```sh
node apps/library-docs/scripts/run-cad-body-1301.mjs
```

The default input is this bundled file. To select a complete request explicitly:

```sh
node apps/library-docs/scripts/run-cad-body-1301.mjs --input apps/library-docs/samples/cad-1301/single.complete-body-request.json
```

The CLI uses the actual compiled public `@barocss/cad` root from its verified app-private CAD1301 profile. It calls `buildQualifiedTranslatedStripBody(base,ends,volume,options)` and `validateQualifiedTranslatedStripBody(result)`. This profile is separate from the portal's earlier `5f5ad866205a21510ac69552e704cc162fa253b5` source snapshot, which does not provide this Body API. Do not run the donor demo or parent producers to recreate this input.

Input copying and byte/hash verification are complete. The new portable CLI passed its selected Node 22.22.0 run through the separate CAD1301 compiled public profile. It observed the topology/model/volume values below, an actual `OWNED` refusal with the accepted result retained, unchanged input bytes/hash and 813 numeric negative-zero values. Local maintenance provenance is `apps/library-docs/evidence/cad-body-1301-cli.json`. This was a compiled CPU Body API run with no drawing; it does not qualify a newer currentRoot, renderer, general Solid operation or publication. The original #1301 native flow and the helper's packaging-only audit remain separate evidence.

| Recorded selected result | Value |
| --- | --- |
| Shared topology | 8 Vertices, 12 Edges, 6 Faces, 24 Uses |
| Source Model object counts | 16 and 2, retaining all 18 geometry objects |
| Occupied volume | 92.5 mm3; exact fraction `185/2` |
| Native coordinates | Authored XYZ with no axis conversion; lengths in mm |
| Parameters and pcurves | Original native UV and qualified Face-local pcurves; dimensionless |
| Result/report family | `barocss-qualified-translated-strip-body`, version 0 |

The owned validator must also refuse a separately cloned result whose `report.quality.genericBoolean` is changed to true. The expected diagnostic is `OWNED`. The primary CLI verifies the actual refusal and checks that the accepted result and input bytes remain unchanged. The input itself is not edited to create that refusal.

## Exact bytes and signed zero

The file has **677219 bytes** and SHA-256:

```text
765db84e9b59c22be65c741ef1607bcaa0a2f31fd5333dfe43fbdb17263b3683
```

It was copied as raw bytes from the recorded native fixture. No request parse/reserialization was used to make this copy. A prior read-only Node 22 audit of the same hash found 813 numeric negative-zero values using `JSON.parse` and `Object.is(value,-0)`. It also found 40 strings containing negative-zero spelling. The raw lexical count of 1057 includes source-string text and is not a numeric-value count.

Node `JSON.parse` preserves numeric `-0`. Ordinary `JSON.stringify` changes numeric `-0` to `0`, so reading and rewriting the request would change both native bits and its hash. Preserve the original bytes instead of formatting, truncating, retuning or regenerating any parent/source. Original source strings and their signed-zero spelling are separate retained data.

The unchanged options are `evaluationId:"single_body_eval"`, `resultIdPrefix:"single"`, `maximumParents:3`, `maximumModels:2` and `maximumObservations:24`. Keep them with their actual complete same-caller parents.

## Profile and provenance

The original author-built source commit is `51821d21c7880edbdb54ad7f2688b848ae56bde2`, from parent `3ab8b83cab24a875381888b4ef8100769539bcdf`. Integration adopted it at `ded1ef68b9877de2b487721bc7228e37daed2865`. The package profile is `@barocss/cad` version `0.0.0-experimental`; public configuration and local adoption are separate from npm publication or currentRoot qualification.

Original local maintenance provenance is `/Users/user/.barocss-ai/v3/evidence-qualified-translated-strip-body-cad2/demo-output/single.complete-body-request.json`. Its recorded hash is in the sibling native `output-manifest.json`. The original path is not needed to run the bundled portable sample. Copy verification and scope are recorded in `apps/library-docs/evidence/cad-1301-input-audit.json`. Native semantics and adoption receipts are in [#1301](https://github.com/barocss/barocss/issues/1301); the bounded documentation scope is in [#1247](https://github.com/barocss/barocss/issues/1247#issuecomment-6098264266).

The result is independently copied CPU data with garbage-collection ownership. The restricted shared Body and material-boundary proof does not imply generic Boolean operations, arbitrary curved Solid parity, point-membership queries, public CAD file codecs, manufacturing, renderer output, device/global numeric certification or registry publication. The JSON request is a complete public API call input, not a new CAD exchange format.
