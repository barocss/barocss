# D334: fixed-orientation path cut pattern

One bounded roadmap08 profile is qualified across retained native prefixes and a resumed tail. The first two invocations remain FAIL. The resumed tail is PASS. There is no clean whole-flow PASS and no whole08 completion.

See [qualification.json](qualification.json) for the contract, exact source commits, checks and limits. [artifact-manifest.json](artifact-manifest.json) records stored file sizes and SHA256 values, excluding itself. [source-provenance.json](source-provenance.json) records original and stored hashes for compressed evidence.

## Supported profile

The feature repeats the original CUT tool along an open polyline. It retains the original CUT and uses translation `point(k*spacing)-pathStart`. It does not rotate the tool. Accept raw degree1 unit-weight paths, or degree2 unit-weight C0 straight spans with exact midpoint controls. Native paths have at most64 control points. Count is1..64 including the original. Spacing is positive and at most10000 mm. No extrapolation is admitted. Model spacing can bind to a parameter; count binding refuses `PARAMETER_UNBINDABLE`.

Kernel admits raw paths and refuses object references with typed `CAPABILITY`. Model also admits stable `{objectId}` references in the base document. It resolves current direct geometry at each evaluation. Consumed-source edits use the existing candidate Worker before commit. Placed, flatten, copy and revision helpers preflight before source loss. No dependency, schema or WASM change is required.

## Retained execution evidence

| Check | Result and scope |
|---|---|
| Kernel whole suite | 2218PASS,0FAIL,6existingSKIP,2224total before final endpoint repair. Pre-repair helper is retained in root/endpoint-before/kernel.ts. |
| Kernel final endpoint | Final rebuild and focused7PASS. The earlier whole suite is not a final-same-bytes claim. |
| Model | Affected36PASS, positive edits5PASS and Studio chat23PASS are separate overlapping runs. Root review fixes14PASS; final Model typesPASS after retained TS4104 repair. No full Model suite. |
| Studio | Initial55PASS/types/build/lint before context repair. Context-fix focused7PASS/types/build/lint after repair. |
| Independent review | Four findings SOURCE_RESOLVED. Reviewer runtime NOT_RUN. |
| API/tools | Six-rule SCOPED_PASS; agent-tools and refusals each exit0. Root and driver lint have0errors and1consolewarning. |

The raw API inventory contains390 changed rows. Reviewed evidence has17 added exposure rows,0removed and12 actual API changes. VerifierView only changes property order. Other raw changes come from TypeScript internal well-known-symbol allocation IDs and union order. Keep this instability in the existing16/R7 intake. The inventory check does not establish whole API acceptance.

## Native profile

- **First FAIL, product defect:** public Make curves creates the exact five-pole L path, but stale evaluated memo leaves Path choices empty. Source bytes stay fixed during the invocation. Commit eabb827b9 repairs the semantic live-geometry key and current-command direct context. The unrelated/display fast path remains.
- **Retake FAIL, driver defect:** the first10 states pass: seed23920, public path creation, preview/count6 distance refusal, Cancel/retry, Apply23600, Undo/Redo, Save/fresh Open, count4=23680 and Save/fresh Open. Actual Move succeeds, then the decoder incorrectly expects one curve in a source that contains two. The decoder now uses public compileCadModel and selects object.geometry. Its separate probe passes.
- **Live tail PASS:** resume edited.bcad at count4. Move[3,4,0] preserves volume and centroid through Undo/Redo. Delete of the consumed path refuses before accepted-state or Undo mutation. Valid Move[-2,1,0] retries and supports Undo/Redo. Stretch[2,1,1] preserves23680 volume while moving the four holes to [8,8],[16,8],[24,8],[32,8] and changing the independent centroid. Undo/Redo and Save/fresh Open pass.

Independent stock-minus-prisms volume and centroid checks use1e-7 tolerance. Root viewed the retake applied five-hole and tail fresh-open four-hole captures. All three receipts record zero page errors, console errors and source changes. All contexts/browser/server close. One browser runs serial contexts.

## Source and proof boundary

Feature/API source is10a2b99b6; Studio context repair iseabb827b9; current-geometry decoder and resume driver are053897880. Full SHAs are in qualification.json.

First and retake capsules match all30 listed inputs before/after. The live-tail pre-launch commit/capsule command failed because app cwd and repository-relative filenames were mixed; no commit occurred. A planned driver header differs from the previous capsule (29/30 match). The startup capsule captures actual30 during the run; the final capsule matches30/30. No source edits occur during flows. The driver is committed after the tail. Final listed inputs match Git30/30. These capsules cover listed inputs, not the full served graph. Hashes establish integrity, not geometry correctness.

Retain the first TS2352 build failure, TS4104 repair, command-path MODULE_NOT_FOUND failures, fixture-label and test boolean-widening failures. These have distinct causes. The native-first receipt records a product defect; the native-retake receipt records a decoder defect.

Real native Boolean failure, stale/Stop full browser matrix, full final suites, GPU/Viewer, performance, remote CI, release and commercial acceptance remain unproven. Existing failure/Cancel/Stop/Open ownership is reused; this profile does not qualify its whole matrix. Continue remaining08 before09. Electron15 remains queued without implementation.
