# C2D-12 orthogonal Boolean observation

2026-10-08. Native parent `52c14628` (locally integrated #705 and #706), branch `codex/canvas2d-709`. This is an authored integer-orthogonal polygon adapter, not arbitrary polygon or CAD B-Rep Boolean. It does not mutate a renderer. The example uses a fresh canvas for each accepted result and preserves the old canvas when validation fails. No package publication or merged-head claim.

## Bounded contract and deterministic check

- `booleanOrthogonalPolygons(left,right,operation)` accepts two operands with ID-bearing, simple, non-touching, alternately horizontal/vertical integer rings in `[-4096,4096]`, positive screen-space outer and negative holes. Proper crossings between operands are admitted. Zero tolerance; curves, diagonals, fractional input, contacts, coincident edges and ambiguous output topology refuse. Limits: 1–8 input rings per operand, 4–128 vertices per ring, 240 combined input/output vertices, 16,384 cells, 8 output rings and 4,096 raw output boundary edges. The result records operation, input IDs and each output ring's deterministic ID, orientation, contributing source IDs and authored integer vertices.
- Node 22.22.0 affected `pnpm --dir packages/barocss-canvas2d build:library` exited 0 using the preexisting Integration `node_modules/.bin` tools; bundle 74.1 KiB. `node examples/canvas2d-scene/boolean-probe.mjs` exited 0. The probe independently checks point membership for a concave pair and hole across union/intersection/difference, output ring counts/orientations/source IDs, deterministic repeat, output-ID collision avoidance, Scene v5 JSON, no operand mutation, nested contained hole, and touching/diagonal/sparse/unknown-operation refusal. `git diff --check` exited 0. First attempts used system Node 18.10.0 (pnpm version gate) and then lacked local `tsc` in the fresh worktree; pointing PATH to Node 22.22.0 and existing Integration build tools resolved both without dependency installation.

## Actual Chromium flow

- URL: `http://127.0.0.1:57009/examples/canvas2d-scene/boolean-v5.html`. Union showed two contours: `Result1` outer from `LeftOuter` and `RightOuter`, `Result2` hole from `LeftHole`. At `(30,30)`, `(105,60)`, `(200,80)`, the union pixel was `[31,117,214,255]` and hit `BooleanFill`. Hole `(60,120)` and outside `(230,210)` were white and hit `Background`.
- Intersection showed one outer contour from `LeftOuter` and `RightOuter`. `(105,60)` and `(105,120)` were blue/`BooleanFill`; `(30,30)`, `(60,120)` and `(200,80)` were white/`Background`.
- Difference showed outer and hole contours, retaining `LeftHole` lineage. `(30,30)` was blue/`BooleanFill`; `(60,120)`, `(105,60)`, `(105,120)` and `(200,80)` were white/`Background`. [Screenshot](difference-after-reopen.png) shows the visible result.
- A touching input reported `UNSUPPORTED_FEATURE: LeftOuter and Touching touch or overlap`. The exact old canvas object, operation `difference`, blue pixel `[31,117,214,255]` and hit at `(30,30)` remained unchanged.
- Browser Save downloaded the actual [904-byte result JSON](difference-result.json). After switching to union, Open of that downloaded file recomputed and compared the stored result, then restored difference, its two contour lineage records, blue `(30,30)`, white `(105,60)` and `Background` hit. The result file is an example-host record; Scene JSON alone has no lineage fields.
- Browser console had only the unrelated missing `favicon.ico` request.

The observation covers one Chromium browser, one concave pair with a hole, the committed probe and stated refusal cases. It does not establish arbitrary-angle polygons, curved geometry, CAD topology, huge scenes or other browsers/devices.
