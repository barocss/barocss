# Sample SVG draft applicability (#1567)

The SVG arc consumer's **Check sample draft refusals** button only checks its
three original fixed replacement recipes. It is not a general SVG validator.
After active-session and source-provenance checks, it builds all three drafts.
If any replacement leaves the source unchanged, it reports `UNSUPPORTED_FEATURE`
before reading a frame or snapshot, parsing/importing another SVG, or changing
counters, refusal rows, or the accepted session.

The original recipes and importer budget are unchanged. For applicable source,
all actual outcomes remain in the refusal rows. The operation requires the
historically recorded `INVALID_SCENE`, `INVALID_SCENE`, `SCENE_LIMIT` sequence;
an unexpected outcome throws after retaining those rows, so it cannot report
success. Those codes come from the original #1451 receipt and source review,
not a new runtime execution of the old applicable branch.

## Verification boundary

Cloud implementation parent: `ec487e31b83da8715bff6de55b24b66dfab08ea2`.
The native issue contract's historical parent and nine-path allowance are not
rewritten. This bounded cloud change uses five of its allowed paths. The #1566
SVG download files, importer/kernel/schema, and historical #1451/#1548/#1558
receipts are unchanged.

Focused JavaScript syntax, host bundle, narrow TypeScript and deterministic
source/API checks passed. The new `evidence/svg-draft-applicability/source.svg`
contains a supported path named `Polygon`, distinct from earlier fixtures.
The deterministic check uses the real source importer and existing display-tree
bridge with an XML Element adapter, then the actual refusal and run functions
with instrumented dependencies. It confirms early refusal, retained accepted
identities/source/counters/rows, and the final failure status. This is not a
physical file upload, a real DOM event, or native frame evidence.

Genuine browser acceptance is **UNRUN**: the cloud browser's localhost route was
reported connection-refused. No browser-observations, document-snapshot or
screenshot is supplied as though that flow ran. The old applicable branch also
remains runtime **UNRUN**. Full-workspace CI, current #1254/#674 integrated
acceptance and release are separate.

The pending native flow remains exactly one physical Polygon SVG input followed
by the sample-check button, with whole accepted Scene/source/IDs/frame/fields,
identities and refusal entries retained and no operation-triggered second
parse/import, renderer candidate, native draw/read/allocation. The expected two
GL contexts, 18 callback identities and two public subscriptions remain
hypotheses pending observation. Take an actual screenshot before terminal
teardown; do not replay old producers or use Save/Open/download as acceptance.

Narrow type check: `node node_modules/typescript/bin/tsc -p
packages/barocss-canvas2d/consumer/tsconfig.svg-draft-applicability.json`.
