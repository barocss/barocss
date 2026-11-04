---
work_id: D500
artifact_type: ordinary-counterbore-workflow
status: done
owner_role: executor
source_request: "Continue main CAD with one bounded existing ordinary counterbore lifecycle"
last_updated: 2026-11-04
---

# Existing ordinary counterbore lifecycle

All seven declared desktop groups pass in the first integrated run. The case covers public creation, counterbore depth and upstream source edits, first Undo/Redo, two invalid-value refusals, project Open and a post-Open depth edit. No product defect was reproduced. No product implementation or command was added. Final High saved-data audit passes 12,755 saved-evidence checks, separate from 11 fresh and 12 reused product tests. Exact commands, hashes and limits are in [qualification.json](qualification.json).

## Retained scope and public recipe

The source audit first reviewed D148/O80 and D148b named-face tests, [D331 drawing location ownership](../drawing-location-ownership-2026-10-29/README.md), [D451 Through circle placement](../circular-hole-workflow-2026-11-03/README.md), [D498 plain blind Hole](../ordinary-blind-hole-workflow-2026-11-04/README.md) and the legacy CNC2 chat create/report source. They establish distinct delivered scopes. None of those reviewed records establishes this compound depth/source/history/refusal/project loop. The source-audit manifest SHA256 is `161286e1d9d0fd5bd3a7ff45b594fd6d0cc936be8f32e558428ef62ebd49e187`.

Use the exact retained D447 stock: 80 × 40 × 10 mm, bounds [-20,-20,0]..[60,20,10], 1089 bytes, SHA256 `0c602dc99f33ab44ec37fd84a5fd70adb4ee6b23c9e2d61fd71eebde6ffffd0d`. Public Top, Frame all, face filter and a real pointer select its current top. Hole Type is **Counterbored**, with main Diameter 4, Counterbore Ø 8, Counterbore depth 3, Centre X 20/Y 0 and Copies One hole.

The accepted recipe has two ordinary Hole nodes. Through n2 has radius 2, no depth and parent n1. Dependent n3 has radius 4, depth 3 and parent n2. Both keep face n1.top and centre [20,0], with axis/side omitted defaults. Each remains a separate history/editor owner. The n3 editor exposes **Diameter** and **Depth**; holeGroup joins only the region overlay. All edits retain the through pilot, both parents/face names, centres and radii.

| Group | Accepted result |
| --- | --- |
| Public counterbore creation | A: source H10 / child depth 3 |
| n3 Depth 3→4 | B: H10 / child depth 4 |
| Original Extrude Distance 10→12 | C: H12 / child depth 4 |
| FIRST Undo / Redo | Exact B / exact C |
| n3 Diameter 0 Apply, then n3 Depth 0 Apply | Two separate refusals; accepted C and history retained each time |
| Own Save / Close / reload / Open | Exact C in the same browser context; selection clears |
| Post-Open n3 Depth 4→2 | D: H12 / child depth 2 |

The direct NodeEditor does not replay the creation command's wider-than-pilot guard. The two zero-value tests use existing native positive-dimension validation. No too-small positive-diameter or arbitrary-depth refusal is inferred. Hole labels do not include depth, so actual Doc identity and settled current Worker establish completion.

## Physical and current-consumer evidence

Four original native captures and five exact-whole-Doc subproof reuses bind nine fresh current Worker observations. Reuse requires exact Doc bytes/SHA and unchanged native producer pins. Original JS BRep JSON bytes and SHA remain the transport authority. One captured native massPropertiesOf result is bound to that BRep and checked against independent analytical references plus raw support/trim proof. A separate brepMass integration result is not captured or claimed. Current Worker supplies volume, centroid, freshness and mass readiness; it does not supply root native bounds.

Each accepted state is one strict closed genus-1 solid: an R2 through pilot and an R4 upper recess, with an outward +Z annular shoulder and four current circular rims. The declared volume is V = (3200 − 4π)H − 12πd. Source H10→12 at fixed child depth 4 moves the shoulder from Z6 to Z8; the post-Open depth 2 shoulder is Z10. The High contract keeps 1e-9 relative volume and 1e-9 mm absolute centroid/bounds/carrier budgets. Maximum observed native volume-relative error is 2.097e-15, centroid error 5.685e-14 mm and bounds error 0. Finite rational witnesses plus complete native topology/carrier traversal do not constitute a full-domain theorem.

The original compiled D498 pick-map executable is reused after all 1944 native producer pins and 463 metafile inputs match. It runs once for fresh display name/index/centroid mapping. No new map build runs. The seed has zero strict physical captures, zero physical oracles and no physical PASS. Native checks after creation validate the actual n3/b3 compound result. Rounded UI values and display meshes are not physical oracles.

## Checks, custody and limits

Eleven fresh existing Model feature-handles tests pass in 0.726 s. Receipt SHA256 `7e6401edbfe77fa20f1ba769788a9c8ff29afe79d135b500d082ad828d3ffead`. D498's 12 tests are reused after 1845 current source pins match. D494 semantic CAD build, CAD lint, Studio types and final Model types retain their exact 1841-pin source closure. No duplicate test, new build/type/lint or full-kernel campaign is claimed. There are no product or test edits.

Actual receipt SHA256 `8518c295119ce5c1e8f811644aff9f49c627025aaeed68a62da5bcc4acde032b`; root review SHA256 `e0b4fed96163e203965b1e661ad8ee9732cc28d619e1915b9a5ff2c7f81f4c9c`; config SHA256 `520df0bf534a641d6c935865eaf9583956106552c5bf4fe3a66b0d60db646dc8`. Root reviewed nine images, including both refusals. All 2617 wrapper, 2618 helper and 1944 native producer pins match through cleanup and the root's current check. Own OPFS namespace is removed and verified absent; context, browser and server close; wrapper PID 52242 is absent. Page errors, console errors and downloads are zero. The original flow's visual-review placeholder remains immutable; the separate root review records the nine completed reviews. Routine work used GPT-6.1 Sol Medium; difficult geometry and saved-data review use GPT-6.1 Sol High. Raw artifacts stay in /tmp.

Final High review SHA256 `f70dc3fb725e7f5653875bb63156975caa90b85156c3090cce278f9c7f07613c` confirms the nine selected bindings. The saved-only command is `python3 -I /tmp/barocss-d500-high-final01/audit-saved02.py`, script SHA256 `bba9762795dd6ab2be9bd001da779352cbc0fb1cf02d5c0cef2129c9411c08f6`. Auditor01 stopped on an old root PASS label and root-count layout. Corrected02 binds the exact D500 status and count layout; physical, Doc, source and budget criteria are unchanged. The original auditor stop remains preserved. No product/native/oracle/build/test/browser rerun occurred.

The palette partly occludes stock. Full-fit, raster quality and inertia are NOT_MEASURED. This one case does not qualify other axes, types, patterns, general clearance or manufacturing. PDF, mobile and release remain excluded. Root's live #536 read remains OPEN with all eight broad required feature checkboxes unchecked; no comment or issue closure follows. Core readiness remains NOT_MEASURED; legacy 43% and all HOLDs remain unchanged. Next provisional main D501 audits existing ordinary countersink source/evidence before any new run. Parallel D499 has 43 PASS / 1 FAIL in its first package check: a duplicate fixture key reaches DUPLICATE_KEY before the intended CARDINALITY guard. Its correction is TMP-only; the original ten WIP source pins remain exact. Types, API types, lint and actual qualification are NOT_RUN.
