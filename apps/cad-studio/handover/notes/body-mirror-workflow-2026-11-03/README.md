---
work_id: D462
artifact_type: body-mirror-workflow
status: qualified
owner_role: executor
source_request: "Continue the core CAD roadmap, one bounded category at a time"
last_updated: 2026-11-03
---

# D462 — Ordinary BODY Mirror workflow

One bounded C2 workflow, rows 07/08/12/16. Baseline `d631a85ce3d96762d571ffc614725a0f3a3b85e3`. Verification of existing behavior only: no product or test changes. [Qualification](qualification.json) records commands, hashes, numbers and limits. #534 remains open because its full PART08/10 criteria are not met.

## Existing operation and exact scope

The source-authored fixture is a 20×30×10 prism at min[10,20], max[30,50], with n0 sketch, n1 Extrude and stable e1–e4 sides. Its 428 bytes have SHA256 `e2b20d76b42a2ac4bc575a8958f11e791fda12a8aca5dfd1bc964a23e9330c1c`. It is publicly Opened; no public seed sketch construction is claimed.

Public BODY Mirror is distinct from SubD Mirror. The driver selects the body row, sets Plane YZ and Plane at0 explicitly, then Applies. Native conversion keeps the original and adds its reflection (`keep:true`). Result n2/outputb2 is one UI row containing two disjoint strict native solids, not one connected solid or reflection-only copy. The ordinary Plane editor then changes YZ to XZ; the upstream original Extrude changes height 10→12. After project reopen Plane changes back toYZ at height 12. Sketch/side IDs, parent and output remain exact.

## Actual eight-group acceptance

All eight groups pass: public MirrorYZ0 creation; existing PlaneXZ edit; upstream height 12; exact Undo; exact Redo; height0 refusal retention; own OPFS Save/Close/same-context reload/Open; post-Open Plane YZ edit. The actual sequence attempts height0 before Undo. Native PARAMETER reports “height must not be zero”; accepted document, history and native result remain unchanged. The first Undo reaches XZ/height 10 and Redo restores XZ/height 12, proving no phantom refusal Undo entry.

Eight native/consumer bindings pass: four new captures and four exact-whole-document reuses, with eight independent Python oracles and eight raw current Worker volume/centroid comparisons. Reuse requires the entire native input and original product pins to match; current oracle and consumer checks still run. Worker values bind the actual accepted consumer, while physical authority remains native B-rep plus the independent Fraction/diagonal-reflection oracle.

At height 10 total volume is 12000; at height 12 it is 14400. Aggregate centroid is [0,35,h/2] for YZ and[20,0,h/2] for XZ. Exact per-component and aggregate bounds, selected original n1/reflected@m face names, corner pins and physical outward normals agree. Relative volume and absolute centroid/bounds/pin budgets remain 1e-9; outward unit-normal components use 1e-9. Worst native centroid error is 3.55e-15mm; raw Worker binding errors are 0. No rounded display mesh supplies geometry truth.

## Verification, cleanup and limits

Native preflight passed four new states plus the existing height0 guard, with 746 pins equal after cleanup/current. Actual run01 passes without an executed SUT failure. Root's first launcher seal-reader used the wrong JSON key; it was corrected before any wrapper or runtime, so that preparation attempt is NOT_RUN, not a product or executed harness failure.

The run has 24 states/images; root viewed seven: preview, YZ accepted, height 12, refusal, Undo, reopened and post-OpenYZ. Source prehash 2387 and full frozen 2388 are pinned-path counts, including a private /tmp inspector alias to the same physical file. Frozen/after/cleanup/current agree before documentation writes. Errors, console errors, downloads and watched changes are0. Namespace D462-body-mirror-run01 is removed and verified absent; context/browser/server close, own PID 95396 is absent and its lease releases.

D461's 28 focused groups, lint, Studio types and final Model types remain valid because source/tests did not change. New tests/build/types/full kernel are NOT_RUN. No broad contact/overlap Mirror, nonzero Plane-at lowering, picked-face precision, assemblies, downstream matching, exports, cold browser restart or standards acceptance follows. Raw evidence remains outside the repository.

After actual cleanup, the checkout was externally deleted. Root restored the same path/head/branch with ordinary worktree add, preserved stale admin data and left main HEAD/index unchanged. All 2388 frozen paths matched again. Existing actual evidence remains valid; no replay was required. Existing dependencies were restored only from cache with `pnpm install --offline --frozen-lockfile --ignore-scripts --reporter=append-only`:805 added,778 reused,0 downloaded,7.2s. Package/workspace/lock hashes stayed unchanged; this is environment recovery, not new product qualification.

Core readiness stays NOT_MEASURED and legacy 43% stays frozen. Existing HOLDs remain. Next D463 inventories one ordinary partial Revolve Angle/edit/history/project profile after reading retained D448 full 360° and current C2 evidence; no automatic feature start or HOLD lift.
