# D385 — 21b: the placed shapes move from the top bar into the tool rail

Tier: **small**, a layout move: the same buttons, clicks, drags and shortcuts. The user asked on 2026-10-31 whether the top bar's shapes could go now that the sidebar has Create; it was done after ②a. [Qualification](qualification.json).

## What changed

- The 15 placed shapes, Box, Cylinder and the rest, are now the rail's first group, **SHAPES**.
- The top bar has no shapes strip.
- The rail may grow to 8 columns, so a short window hides none of them.

## Checks

- **Tests:** tool columns 5/5; Studio 573/573.
- **Sidebar driver:** PASS at four sizes, with no scroll, nothing hidden and no overlap.

| Window | Rail width |
| --- | --- |
| 1440 × 900 | 200 px |
| 1920 × 1080 | 188 px |
| 1024 × 700 | 248 px |

- **Browser-flow steps that use the shapes:** the rewritten rail check, placing and dragging, and the cylinder on a face all pass.

## Retained failure

The three fastener steps fail at the Hole HUD. The same failure happens on HEAD without this change, so it is recorded as a follow-up.

CI and release NOT_RUN.
