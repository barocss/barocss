---
work_id: D463
artifact_type: partial-revolve-workflow
status: qualified
owner_role: executor
source_request: "Continue the core CAD roadmap, one bounded category at a time"
last_updated: 2026-11-03
---

# D463 — Ordinary partial Revolve workflow

One existing C2 workflow, rows 07/08/12/16, passes eight declared groups. Baseline `222869c87157558ec150b7f3e6d1252bccdc8c77`. No product or test changes. [Qualification](qualification.json) records commands, hashes, counts and limits. Retained D448 full 360° boss/support proof was read and not replayed. #534 remains open: full PART03/10 is not met.

## Selected public operation

The 324-byte source-authored seed has one default XY rectangle n0, min[10,20], max[20,50], stable e1–e4 and no solid output. SHA256 `d2d61b8cc20966f3a8fa7d557b9f91296fe11a8d106dfd85af444b973e885dc0`. Public seed construction is not claimed.

The driver selects Outliner Sketch 1, launches Revolve, chooses Axis Sketch Y and Angle 90, then Applies. Existing NodeEditor Angle changes 90→180; original rectangle Depth changes 30→40. Stored n1 uses sketch0/axisy/angle90 or180; outputb1 references n1solid and nextId stays 2. Source/node identities survive accepted edits.

Stored Sketch Y follows the existing effective native−Y/+X convention. This positive X profile sweeps toward positive Z: p=[r cosφ,y,r sinφ], r10..20, y20..20+depth. This case adds no axis or angle admission.

## Actual eight-group acceptance

All eight groups pass: public 90 creation, Angle180 edit, Depth40 edit, exact Undo, exact Redo, Angle0 refusal retention, own OPFS roundtrip and post-Open Angle90 edit. Refusal comes before the first Undo. Typed INPUT reports “angle must be in (0, 360]”; accepted document, history and native output remain unchanged. First Undo reaches 180/depth30 and Redo restores 180/depth40, proving no phantom refusal entry.

Save/Close/reload/Open uses the same browser context and retains the complete document. The post-Open Angle90 edit changes geometry at depth40. Eight native bindings pass: four new captures and four exact-whole-document reuses. Each binding runs an independent Python oracle and fresh raw current Worker volume/centroid comparison. All eight Worker binding errors are exactly 0. Reuse requires whole-document and product-pin equality; current consumer checks still run. Worker values establish consumer consistency; native B-rep and the independent polar integral establish physical truth.

Volumes are 2250π at90/depth30, 4500π at180/depth30, 6000π at180/depth40 and 3000π at90/depth40. Quarter centroid is [280/(9π),20+depth/2,280/(9π)]; half centroid is [0,20+depth/2,280/(9π)]. Quarter bounds are [0,20,0]..[20,20+depth,20]; half bounds start at X−20. Both native mass and actual B-rep mass agree with the oracle. Worst volume error is 5.46e-11; centroid error is 4.62e-14mm.

Original budgets remain 1e-9 relative volume, absolute centroid/bounds/boundary pins and outward-normal components. Native physical boundary curves, vertices and bounds supply boundary truth. Oversized planar-carrier probes establish carrier plane/normal only, not trimmed-face membership or bounds. Display meshes do not supply physical truth.

## Verification and limits

Native preflight passes four states plus the Angle0 INPUT guard; its 746 pins remain equal after cleanup/current verification. Actual run01 has no executed SUT or preparation failure. It records25 states/images; root viewed seven covering selection, accepted90, Depth40, refusal, Undo, reopened180/40 and post-Open90/40.

Source prehash2384/full frozen2385 count pinned paths, including a private inspector alias to the same physical file. Frozen/after/cleanup/current match before these documentation writes. Page errors, console errors, downloads and watched changes are0. Own namespace D463-partial-revolve-run01 is removed and absent; context/browser/server close, own PID1097 is absent and the lease releases.

New tests/build/types/full kernel are NOT_RUN because source/tests did not change; D461's28 focused groups, lint and Studio/final Model types remain valid. No arbitrary-axis/angle, full360 generality, downstream matching, export, cold-browser persistence or standards claim follows. Core readiness stays NOT_MEASURED, legacy43% frozen and all HOLDs unchanged. Next D464 inventories ordinary public BODY Rotate quarter turns, including pivot/axis/guard contracts, before selecting a finite profile.
