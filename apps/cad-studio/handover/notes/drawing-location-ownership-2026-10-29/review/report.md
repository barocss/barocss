# DA-DUP-1 independent read-only review

Reviewed source candidate in `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`, baseline `2084eeb99`. Source hashes for the reproduced candidate are in `stdout.txt`. No repository source edits, kernel evaluation, heavy test, browser run, or commit were performed by this reviewer. Evidence writes are confined to `/tmp/d331/review`.

## Required findings

1. [P2] Counted end-to-end reversal loses orientation.

`packages/barocss-cad-model/src/drawing/measurement.ts:67-74` compares end references using feature-owner sets only. Reversing ends at X=0 and X=10 on the same stock owner therefore still satisfies `direct`. `sameLinearDependency` returns true although `count:3` extends in the opposite direction. The issue detector can offer removal for distinct counted measurements. The existing new reversal test uses end-to-center, so it misses this case. In addition, the earlier `auto.ts:375-378` sameAs shortcut disregards count and reference order, allowing suppression before the new guard runs.

Minimal controls: same-owner end/end counted forward versus reverse must differ; same direction repeat must match; different counts must not suppress auto; ordinary uncounted reversed endpoints must still match; manual repeat preference must remain.

2. [P2] Equal CBORE/CSK text does not prove compound target ownership.

`packages/barocss-cad-model/src/drawing/measurement.ts:57-61` accepts coaxial centers with equal rendered CBORE/CSK text despite distinct feature owners. Independent blind-bore stacks on one stock can be coaxial and have identical specifications. The synthetic case uses n0.face|n2.side0 and n0.face|n5.side0, centers [10,20,0] and [10,20,20], normal Z and equal CBORE text. The helper returns true. A common datum endpoint then lets both linear measurements match. This is a helper-level synthetic proof, not a kernel-generated physical-model proof.

Minimal controls: independently authored coaxial stacks with equal CBORE text must differ; actual inner/outer rims mapped by the authored compound relationship must match; opposite rims of one hole must still match; equal printed callout text alone must not grant membership.

## Minimal ownership contract advice

`drawing/callout.ts` already reads actual doc.nodes to find the hole that owns an edge. Its formatter maps an outer hole to the prior inner hole only when the actual nodes satisfy its counterbore relation: hole kinds, prior-node parent reference, same sketch center, and strictly greater outer radius. It then requires valid outer depth when emitting CBORE. Reuse that structural identification to supply a canonical compound-owner key (or explicit pair predicate) alongside the text callback. The key must retain any placed-instance prefix. Only an actual valid compound relation may canonicalize distinct authored hole IDs. Keep the existing geometry/coaxial check. A same-owner CSK already belongs to the same authored hole. Do not infer identity from equal strings, shared stock, neighboring numeric IDs or intersecting owner sets. Share the relation reader with the formatter so the two cannot drift.

An optional companion callback through drawingInputs, SheetInputs, IssueContext and auto-dimension calls is compatible with current text rendering; a property on an agreed callable type is another small option. Create such a callback once per input construction, not per dimension/edge iteration. Tests using plain string callbacks must not receive compound identity merely because their text matches.

## Other inspected areas and limits

Independent-target bucket retention and same-view square-grid fixture count increases agree with the stated contract. The browser driver changes application state through public UI and uses hooks for observations. It records grid placement issues independently and does not claim whole-drawing acceptance. No new per-element nested closure was found in the changed hot loops. Existing closure sites were not rewritten.

No full test/type/lint/browser PASS is claimed by this review. Explicit authored pattern copies may relate across rows as specified by the parent contract; matching axis/count range remains required. Potential broader geometric and section-ownership cases were not independently executed.

## Reproduction

Run the exact command in `command.txt`. `reproduce.mjs` bundles current helper sources in memory. The expected pre-fix raw output in `stdout.txt` includes:

```
counted_reversed_same_owner_dependency true
independent_coaxial_equal_cbore_dependency true
```

`stderr.txt` is empty for this run. These booleans demonstrate the two erroneous helper decisions on the explicitly synthetic inputs in the script.
