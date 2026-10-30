# next08 / D333 independent source review

Worktree: `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`
Base: `92256f0df`
Verdict on the current observed candidate: ONE REQUIRED FINDING. Kernel operation logic has no additional required finding from this bounded inspection.

## Required finding

[P2] Valid rectangular feature nodes are rejected by the actual raw/chat admission path.

The current `packages/barocss-cad-model/src/chat/features.ts` lacks the rectangular-feature-pattern SPECS entry and its rectangularFeaturePatternProblem branch/import. `checkNode` therefore returns an unknown-kind error before the dedicated validator can run. This prevents the requested raw/chat feature append/edit path despite the new ModelNode type, saved-file admission, command registry and facade verb existing. The new API test imports checkNode and expects a valid node to return null, so this is also an existing intended gate failure.

Minimal reproduction: `chat-admission-repro.mjs` builds the actual checkNode source in memory and calls it with a valid five-node stock/tool/difference prefix and a 3 by 2 rectangular recipe. No geometry is evaluated. Raw output in `chat-admission-stdout.txt` is:

```
valid_rectangular_checkNode_actual "Unknown feature kind \"rectangular-feature-pattern\". Kinds: ..."
```

Observed file SHA256: `30dec3fbb9ab0f15ff3a105c3065a7e0100183834b935e6bbbffe13c0ed51643`.

Minimum repair: restore the SPECS entry (both axes; both spacings as dim; counts allowing literal 1), import the dedicated validator, and return its result after common field validation. Retest valid literal and parameter spacings, count-one reductions, product overflow, same axes, invalid spacing/count and stale/suppressed/non-difference parents through checkNode itself. The dedicated helper alone passing does not prove the chat consumer is wired.

The initial diff read did include that wiring. It disappeared before the lightweight source-hash snapshot. This review made no repository writes. Root was notified immediately, before this report.

## Core and representation inspection

`part-model.ts:1901-1921` validates distinct global axes, finite signed nonzero core spacings through the existing dim helper, per-axis integer counts 1..64, and a safe product at most 64 before creating the operation. cutSource resolves the original active unsuppressed direct-difference result, verifies one nonempty solid body, and tracks seed/base/tool dependencies through the existing resolver. The operation starts from the already-cut seed and translates only the joined original tool. It skips (0,0), so the original cut is included exactly once. A one-cell pattern or empty tool returns the seed. Count-one rows/columns remain legitimate.

The nested loops write offsets on two distinct axes and use the stable string suffix `@i,j`. No per-cell rename closure was introduced. Tool parts are combined by existing unionAll before translation; no stock solid is copied. The source mechanism permits a tool outside the stock at the original cell to enter it at a later signed core offset, consistent with the existing linear policy. No new tolerance constant or Boolean algorithm was added.

The affine helper forwards the string through both upright and general B-rep paths. transformBrep and transformPrismatic retain function callback support and append the string suffix consistently to named faces/edges or tagged sides/caps. Small representation controls show suffix and callback results are deeply equal and leave inputs unchanged. Those fixtures do not establish B-rep geometric validity.

The new rectangular test source checks geometric volume/bounds/corners, stable cell names, parameter changes, save/read, one row/column/cell, signed core spacing, axis swaps, B-rep transform paths, outside/empty tools, count cap and typed refusals. I did not execute those geometry tests. Multi-part-tool name/collision behavior was inspected through source but was not independently evaluated.

## Model consumer inspection

The new document helper checks public positive spacings at most 10000, literal safe integer counts and product <=64, distinct axes, a solid parent reference and a current unsuppressed difference. Saved/nested validation visits instance and pending-part documents and uses each node's prior prefix. Model buildPartDocument calls it before evaluation; active rectangular patterns are sent to kernel source admission even if an ancestor disappears. Suppressing the pattern itself follows the existing parent pass-through policy.

The command registry builds one node and uses current cut-body selection checks. The kernel and Studio API binding maps bind spacing and spacing2 to their actual stored fields, while leaving both counts unbindable. Edit fields expose both axes, spacings and counts, with count binding explicitly disabled. The model adapter emits all six fields and the actual body reference. Existing generic body/ref, feature-label and public command mechanisms carry the new kind. The separate checkNode consumer remains the required missing link described above.

## Public surface inventory

Expected changes include:

- CadPartFeature and ModelNode rectangular-feature-pattern variants.
- FeatureSpec command variant and Part.rectangularFeaturePattern method.
- RectangularFeaturePatternOptions type in cad/api, re-exported by cad-model/api.
- rectangularFeaturePatternSpec export in cad/api.
- Existing public transformBrep rename parameter broadened to function | string.
- Existing public transformPrismatic retag property broadened to function | string.
- New exported Model helpers rectangularFeaturePatternProblem and rectangularPatternDocumentProblem, reachable through the package's module wildcard.
- Studio command, editor fields, chat command documentation and README description.

The generated API inventory/review is root-owned. This report does not claim those generated artifacts are complete.

## Independently executed proof and limits

`reproduce.mjs` ran lightweight in-memory checks only:

- Public Model literals and parameter spacings, invalid axes/counts/product/spacings, valid count-one reductions and 64-cell cap.
- Saved/nested admission, pending parts, stale and suppressed sources.
- Public spec distinct-axis/positive-spacing/safe-integer guards.
- String-suffix/function-callback transform equivalence and input immutability.

These controls passed. Source hashes for the 20 changed/new files at that point are in source-hashes.json. No files in that snapshot changed while those controls ran. The separately reproduced missing checkNode wiring is recorded by its own exact hash and stdout. This is why the successful helper controls do not yield an overall PASS.

No Boolean evaluation, evaluateCadPart/evaluateDoc, whole Kernel/Model tests, build, browser, Save/Open product flow, commit or repository mutation was performed by this reviewer. All evidence writes are confined to `/tmp/d333-review`. D332 color scope and incoming evalMemo work were not reviewed.
