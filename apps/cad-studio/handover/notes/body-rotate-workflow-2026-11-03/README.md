---
work_id: D464
artifact_type: body-rotate-workflow
status: qualified
owner_role: executor
source_request: "Continue the core CAD roadmap, one bounded category at a time"
last_updated: 2026-11-03
---

# D464 — Ordinary BODY Rotate quarter turns

One existing C2 workflow, rows07/08/12/16, passes eight groups. Baseline `54c6fb5de215d1bb957ba365b2b1a74184d19c69`. No product or test changes. [Qualification](qualification.json) records commands, hashes, counts and limits. #534 remains open: full PART08/10 is not met.

## Existing operation and source

The exact retained D462 source-authored seed is a rectangle min[10,20], max[30,50], height10, n0/n1, stable e1–e4, nextId2 and outputb1. Its428 bytes have SHA256 `e2b20d76b42a2ac4bc575a8958f11e791fda12a8aca5dfd1bc964a23e9330c1c`. No fresh public construction or native seed baseline is claimed. D462 Mirror and earlier45° gizmo proof are not replayed.

The public route uses a real body-row selection and existing Rotate. HUD Axis is Z, Angle90 and PivotX/Y/Z explicitly0; the default pivot is the body's center. Stored n2 has parentn1solid, axisz, angle90 and pivot[0,0,0]. Outputb2 contains one transformed native solid. The source is consumed, with no kept original or copy.

Existing NodeEditor Angle changes90→180; original Extrude Distance changes10→12. After project Open, Angle returns90 at height12. Source/node/parent/output identities remain exact. Rotate Angle0 is a valid identity and is not a refusal control.

## Actual eight-group acceptance

All eight groups pass: public Rotate90, Angle180 edit, source height12 edit, exact Undo, exact Redo, source Height0 refusal retention, own OPFS roundtrip and post-Open90 edit. Typed PARAMETER reports “height must not be zero”. Accepted document, history and native output remain unchanged. Refusal precedes the first Undo, which reaches180/height10; Redo restores180/height12. No phantom refusal entry is hidden.

Save/Close/reload/Open retains the complete document in the same browser context. Post-Open Angle90 changes geometry. Eight native bindings pass: four new captures and four exact-whole-document reuses, each with a fresh independent Python oracle and raw current Worker volume/centroid comparison. Worker binding error is0. Reuse requires whole-document/product-pin equality. Worker values establish consumer consistency; native B-rep and the independent oracle establish physical truth.

Exact Z90 maps[x,y,z] to[−y,x,z]; Z180 maps to[−x,−y,z]. Independent Python uses Fraction coordinates and separately declared integer matrices. Volume is6000 at height10 and7200 at height12. Z90 centroid is[−35,20,h/2], bounds[−50,10,0]..[−20,30,h]. Z180 centroid is[−20,−35,h/2], bounds[−30,−50,0]..[−10,−20,h]. Native and actual-B-rep mass agree. Worst volume error is0; centroid error is3.55e-15mm.

Limits remain1e-9 relative volume and absolute centroid/bounds/corner/face pins and outward-normal components. One strict closed solid, eight vertices, six planar faces and twelve straight edges are separate checks. All transformed corners and current n1.bottom/top/e1–e4 face witnesses pass. Native boundaries and bounds supply physical truth, not rounded display meshes.

## Verification and limits

Native preflight passes four states plus Height0 guard, with747 pins equal after cleanup/current verification. Actual run01 has no executed SUT or preparation failure. It records24 states/images; root viewed seven: preview, accepted90, height12, refusal, Undo, projectOpen and post-Open90.

The preview image shows AxisZ/Angle90/Pivot0 controls and preview status, but transformed geometry lies outside the initial view. The driver does not Frame before Apply. Accepted states use public Frame all and show the correct model. Preview visibility, pending public Fit and automatic framing remain unmeasured; this observation establishes no product defect or UI redesign authority.

Source prehash2383/full frozen2384 count pinned paths, including a private inspector alias to the same physical file. Frozen/after/cleanup/current match before documentation writes. Page/console errors, downloads and watched changes are0. Own namespace D464-body-rotate-run01 is removed and absent; context/browser/server close, PID19760 is absent and its lease releases.

New tests/build/types/full kernel are NOT_RUN; unchanged source retains D461's28 focused groups, lint and Studio/final Model types. No arbitrary angle/axis/pivot, gizmo performance, affine inertia, broad downstream matching, export, browser restart or standards proof follows. Core readiness stays NOT_MEASURED, legacy43% frozen and all HOLDs unchanged. Next D465 measures current line–arc Round support/feasibility for#2282, reading D461/D460 and current guards before any new admission. No automatic implementation or HOLD lift follows.
