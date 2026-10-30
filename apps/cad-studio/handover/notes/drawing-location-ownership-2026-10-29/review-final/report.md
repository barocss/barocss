# DA-DUP-1 final independent source review

Verdict: NO REQUIRED FINDINGS within the requested repair contract and reviewed frozen files.

The exact nine reviewed source/test files are recorded in source-hashes.json. profile-comparison.json verifies that these bytes match the root's final-source/profile.json and remained unchanged during the lightweight controls. This is a bounded source/helper verdict, not a full runtime or product PASS.

## Cleared findings

1. Counted same-owner endpoints now resolve actual 3D points and compare their coordinate on the measured model axis. Reversing a counted same-owner end/end measurement fails the direct dependency match; uncounted reversed measurements still match. auto.sameAs now checks count and preserves ordered references whenever either measurement is counted. The same-owner reversal, repeated same direction, differing count and generated-overall/manual-count controls are present in the new test source.

2. Rendered CBORE/CSK text is no longer an identity source. samePointDependency accepts an explicit locationOwner callback instead. calloutSource is shared by the formatter and canonical owner resolver, and verifies the actual preceding inner-hole parent/center/radius relationship and valid wider-cut depth. Canonical owners retain authored stable IDs and copy suffixes. Coaxial geometry remains necessary. Independently authored stacks with identical formatted callouts receive n2 versus n6 ownership; inner/outer members of the actual first stack both receive n2.

3. The initial Studio root-node callback was stale during early reread. The frozen final useDrawingSheet now imports holeCalloutOwnerOf and memoizes the document-aware callback with [doc]. The callback resolves placedDoc for the matching exact instance prefix. Hidden, unknown and mixed instance prefixes return null. This avoids using colliding root feature IDs for placed instance relationships. Model drawingInputs uses the same document-aware resolver.

## Integration source checks

DrawingWorkspace forwards locationOwner through issue detection, tolerance/accept input contexts, single fixes, repeated Fix-all input construction and autoLayout. It includes the callback in the relevant memo/effect dependencies. IssueContext keeps it through rebuilds; applyFix passes it into autoDimensions; autoLayout and the chat auto_dimension direct path forward it as well. Existing callers that omit the optional callback remain conservative for cross-owner compound relationships.

The helper's ancestry parsing retains instance path prefixes and preserves explicit pattern copy identity. No new nested per-element closure was found in the changed loop bodies. Callback construction occurs per drawing input or memo construction. placedDoc itself rebuilds an instance recipe when ownership is requested; assembly performance was not benchmarked in this bounded review.

The change to callout.ts adds a runtime import of existing placedDoc from engine/doc. Direct import inspection and successful in-memory bundle/import execution did not reveal an initialization-cycle error. This is not a general dependency-cycle audit.

## Independently executed controls

Only reproduce.mjs ran. It bundles source in memory and constructs real authored StudioDoc node recipes with rectanglePart/withNode. It does not evaluate B-rep geometry. Its projection circles are explicitly synthetic, as documented in the script.

- Counted same-owner forward/reverse dependency: different.
- Same-direction counted repeat dependency: same.
- Uncounted reversed same-owner dependency: same.
- Actual authored counterbore inner/outer ownership and helper match: same.
- Independent compound stack with identical rendered text and coaxial synthetic geometry: different.
- No owner callback for distinct compound author nodes: conservative false.
- Instance/base-node ID collision, left/right instance distinction, hidden/unknown/mixed-prefix rejection: expected results.
- Source hashes before/after helper controls: unchanged.

Raw stdout and stderr are saved beside the script. stderr is empty. command.txt provides the exact reproduction command. All controls passed on the recorded bytes.

## Remaining proof boundary

I did not run full Model/Studio tests, type checks, lint, kernel evaluation, browser flows, Save/Open or layout acceptance. Those results must come from the designated verification owner. The prior review's two bugs are cleared at the source/helper level. The final square-grid count/layout and explicit pattern/count/PCD contracts were reviewed against the changed source and tests, without claiming unlimited geometric coverage. Public export inventory and generated API artifacts remain root-owned review scope.

All writes by this reviewer are confined to /tmp/d331/review and /tmp/d331/review-final. No repository edits or commit were made.
