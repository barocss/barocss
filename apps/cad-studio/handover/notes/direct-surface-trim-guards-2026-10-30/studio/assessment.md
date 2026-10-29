# D336 Studio source assessment — zero production delta

Source base HEAD 1fb2d11e9e4713bac3bfbc1131fc45302aa558f3. No Studio production or test changes. Temporary draft files/directExport.ts was removed by its author after root selected zero production delta. App.tsx, DirectPanel.tsx and DirectInspector.tsx SHA256 values match before/after capsules. Model owner changes in direct.ts and direct-trim-guards.test.ts were preserved.

## Existing error and ownership flow

- src/ui/DirectPanel.tsx:27-29 run calls op() inside try. A synchronous Model refusal stops before onChange(next, select?.(next)). Therefore the selection callback is not called and commitDirect is not entered. This applies to surface Reverse, Split, region, Extend and intersection.
- src/ui/DirectInspector.tsx:20 maps that refusal to {title:'The operation was refused',hint:message,detail:''}. Accepted doc, direct selection and Undo remain under the existing central commit path.
- src/App.tsx:1977-1980 already wraps await loadDirect(), directIGES and downloadBytes inside try/catch. A Model guard throw occurs before TextEncoder/download. Catch uses the existing plain notice {title:'Could not write IGES',hint:Error.message,detail:''}. No new friendly formatter, handler or disabled action is needed for D336.
- App async direct export captures doc/fileName across await loadDirect. It does not currently recheck document ownership. This is a preexisting source observation, not a reproduced stale export defect. No new stale result path is introduced by D336 Model refusal. Broader export ownership remains separate (existing 12/O9/R4 scope).

These are source-level conclusions. No UI no-download, pageerror, accepted history, selection or native file result is claimed here. Root owns actual browser verification.

## Source-verified public browser selectors

Scope selected direct inspector with .direct-panel[aria-label="Direct geometry"] (aside, not role region).

| Action/control | Public selector | Notes |
|---|---|---|
| Surface Reverse | button exact accessible name Reverse | selected one surface; same word exists for curve tools |
| Surface Split | button exact accessible name Split | selected one surface |
| Axis | label Surface direction | select value u or v |
| Split coordinate | label At u / At v | number field |
| Region | button exact accessible name Extract region | surfaceRegion; not curve-only Trim to interval |
| Region controls | labels u from, u to, v from, v to | number fields |
| Extend | button exact accessible name Extend the surface | visible text Extend |
| Extend controls | label Extend edge; label Extend by | select u-min/u-max/v-min/v-max; number field |
| Intersection | button exact accessible name Intersect the surfaces | two selected surfaces; visible text Intersection curves |
| Export | button exact accessible name Export IGES | toolbar; any visible direct object |
| Untrim | button exact accessible name Untrim | one trimmed selected surface |
| Trim producer | button exact accessible name Trim by the curve | one curve and one surface selected |
| Keep | label Trim keeps | select value outside / inside |

Source: DirectPanel.tsx:55-76,145-185; App.tsx:1977. These selectors do not make assumptions about outline/history node order or selection IDs. Outline witness selectors are owned by root's browser driver.

## Validation and source freeze

No tests, typecheck, build, browser or heavy command was run. Source-only assessment is complete; Studio source writing is stopped. source-before.json and source-after.json attest the three inspected production files only, not the whole build graph.
