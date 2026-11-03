---
work_id: D486
artifact_type: two-sheet-revision-workflow
status: qualified
owner_role: executor
source_request: "Measure the existing two-sheet Drawing revision workflow"
last_updated: 2026-11-04
---

# D486 — Measure one existing two-sheet revision workflow

SMALL existing C3 workflow measurement for rows11/12/16, with no product changes. Six actual groups and twelve fresh sheet observations pass on parent `5ed3c32636aab1e0b6f21c21de63aa2e08e9f1cc`. Category checks are **39 PASS / 1 retained owner-deferred PDF FAIL**, not ALL_TESTS_PASS. [Qualification](qualification.json) records the separate evidence. High accepts **ACCEPT_D486_RETAINED_TWO_SHEET_ISSUED_REVISION_HEIGHT_HISTORY_PROJECT_SIX_BINDINGS_TWELVE_SHEETS**, SHA`55f15353bb0e7db72c6ebaff78f12cbec272e7654cd2e0e5d2ae65e9ae68e18c`. This audit reads saved data only and adds no product or oracle run.

## Retained input and public lifecycle

The input is the exact D398 run03 `05-fresh-open` Doc:1059 bytes, SHA`9962d4fe41afea65cfb6ebd58493fc26af1d831012e8d7353fdb44883ff922eb`, retained at `/tmp/barocss-d486-input01/retained-two-sheets.bcad`. Provenance identifies `apps/cad-studio/handover/notes/drawing-sheets-2026-11-01/run03/receipt.json`, SHA`3a06b239255f5a2f58474c5c0981c7f381cd73c5fc2200dc2be74cc49659c64e`. This measurement does not replay part construction, view moves, drawing construction, export or PDF production.

From Sheet2, public Next issues A and its common model stamp on both sheets. Public n1 Distance6→8 retains stale A and its earlier stamp on both sheets while dimensions use current native geometry: d3=8 and d2=30 on Sheet1; d1=12 on Sheet2. Public Next on Sheet2 issues B with the common current stamp. FIRST Undo restores the exact stale-A state; Redo restores B; own OPFS Save/Close/same-context reload/Open restores B on both sheets. These are the six actual groups. Actual issue prints are A=`d03e0626` and B=`3336e060`.

The ordinary eight-hex issue print and sixteen-hex current model SRC have different roles. The issue print is not a geometry or integrity oracle. Only independently checked a.sig/b.sig caches may enrich during current Open or source capture; authored edge/near/place/ID/auto/sheet fields remain exact. Once accepted, each actual opened/A/stale-A/B Doc becomes an exact history/reuse/Open baseline. Next B changes only revision/revisedModel from exact stale A. The old d3 near hint atZ6 does not define the new expected height8.

The actual source-H8 transition changes only height and six caches; all six retain original H6 native metadata. In particular, d3.b cache pZ6 remains exact while independent current native pZ8, endpoint8 and dimension8 agree. Next B changes only the common revision/stamp; both derived layouts and sheet groups remain exact to stale A. Initial A's current SRC is `1d7c0ab5f6a3527c`; H8 uses `edefbfd7b7cb9971` even while A's issue print remains `d03e0626`. B's issue print is `3336e060`. These distinct fingerprints are not substituted for one another.

## Checks and retained PDF failure

Root runs `bash /tmp/barocss-d486-root/run-checks01.sh`. Model drawing-sheets tests report26 PASS /1 ASME PDF golden FAIL, with the same expected/actual hash mismatch retained from D478. Receipt SHA is `95937b470b55a74e032eec2834556227a22f766613c9db8b14f0cd444e07e46c`. The owner-deferred PDF is not investigated, edited or rerun. Root then runs only the previously unrun Studio revision checks and diff via `bash /tmp/barocss-d486-root/run-checks02.sh`:13 PASS plus diff PASS, receipt SHA`1a259568c70b35a6fd4187677210574aca07a1a85884e6a37f8e7a2be5955477`.

Final category status is **QUALIFIED_CATEGORY_CHECKS_WITH_RETAINED_OWNER_DEFERRED_PDF_FAIL**, SHA`c92e70764eb107dd28c3475b3058732e96e29600f1e3f87c7505b23d9dc31a25`. D484's semantic CAD build and final Model/Studio types are reused at identical source. Full kernel is NOT_RUN for D486; D482's separate evidence remains retained. These checks do not become an all-green test claim.

## Independent physical and actual sheet evidence

Root runs `bash /tmp/barocss-d486-root/run-reader01.sh` to establish exact input readability. Reader wrapper receipt SHA is `9220c42f0c2c9e74e34b297de09cd082162f25655f5aac8b91e24060ff0cd88b`; it has no native/projection/preflight execution and is not actual workflow proof. Root runs `bash /tmp/barocss-d486-root/run-studio01.sh` for the six public groups. Actual receipt SHA is `0ab2c9c8068fd7a924e2fbda20eeeed48fa4a7029fb8fce234656b0c708a2aee`, config SHA`4d67cdd0c140e2ef309112fa305022b81e9672313e4bca1b6ba54a6ed8b1e00b`.

Three native captures and three exact-whole-Doc reuses provide six native/Worker bindings and twelve fresh complete-sheet observations. The independent30×12×H box reference uses volume360H, centroid[15,6,H/2] and bounds0..[30,12,H]. The exact5251-byte D485 physical block is reused as a pure function, not by constructing fake Docs/targets or rerunning the old lifecycle. The pinned ARRAY10 manifest SHA is `a5630f2dde3e34e8b9413743a584fa7adbcf60826d7238e1849e9f7d3af5438a`; lifecycle oracle SHA`a782d82414359b09ea2a7372aa2a1e9fe2771a8cc19fdd558c47151b2fd96a5f`; box sidecar SHA`c221419823b38a3b4d2797518c115c6c89b4a17433e49398b0dc30d484f6c8d9`. `CONTRACT.md` separates native geometry, authored reference custody, signatures, issue print and current SRC.

Native and independent raw-polyhedron volume errors are0; raw centroid, bounds, corners, carriers, pcurve and plane-area errors are0. Maximum native mass centroid error is3.552713678800501e−15. Worker volume/centroid errors and the existing four-decimal SVG serializer residual are0. Physical budgets remain1e−9 relative volume and1e−9 absolute other native geometry checks. SVG serialization is checked separately; rounded display coordinates do not supply the physical reference.

The3891-byte owned saved file `/tmp/barocss-d486-workflow-run01/06-issued-B-H8-saved-opfs.bcad` is existing asset-free plain JSON, SHA`5416d43c65ed56c38ae5f99cbe2ab89b6d5180aff1d48fb1f84dfe6d699aff11`. It is the exact issued-B Doc, including the common stamp, sheet ownership, all three authored dimensions and six original H6 signature caches. Public Open restores that exact saved baseline.

## Root review, custody and limits

Root reviews all twelve images: both complete sheets appear at each checkpoint, Sheet1 retains front/iso and index, Sheet2 retains top, A is common, the source edit warns on both, and Next B clears those stale warnings on both. FIRST Undo returns stale A; Redo and project Open return B. Root review SHA is `ccf9e940aec30a84f79ad9e5efc749201b6769278ed94f94256f90c651cdcd90`.

Wrapper1862 pins remain equal. Helper1862 extends to frozen1864 for the `/private/tmp` alias and Vite config; all original pins remain and the frozen pins stay equal after cleanup/current. Owned project is removed and absent; context/browser/server close; PID79439 is absent. Errors, console errors, downloads and watched changes are0. No runtime failure occurs. Root corrects the preseal exact title readiness wait to `n OF 2 A4`; that preparation change is not a product fix.

Medium owns driver/source preparation; High owns native/oracle preparation and final saved audit; root owns final config/runtime/images. This proves one retained two-sheet revision workflow. It adds no API, standards claim, drawing layout feature or general drawing-family acceptance. Issue#540 and research#2243 remain open, core readiness is NOT_MEASURED, legacy43% is frozen, all owner HOLDs remain and PDF investigation stays deferred. Mobile and downloads are NOT_RUN_OWNER_RULE. Next is **D487: C4 existing assembly Through cut across an explicit linked-source thickness revision**. D392's original cut input lacks source paths, so D487 setup must be separately derived and pinned; it cannot claim retained public link creation. No broader admission or HOLD change follows.
