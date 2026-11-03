---
work_id: D465
artifact_type: line-arc-round-support
status: measured
owner_role: executor
source_request: "Measure current line–arc Round support and finite feasibility before any new admission"
last_updated: 2026-11-03
---

# D465 — Current line–arc Round support and feasibility

Six current-support groups pass. Primary rows09/16; related kernel07 and file12. Baseline `c0d6c0222750cd14dd76eed79e6e226c53b22442`. No product or test changes. [Qualification](qualification.json) separates actual current behavior from theoretical candidates. Decision: **DEFER_PRODUCT_ADMISSION_ADOPT_BOUNDED_INTEGRATION_SPEC**. #2282 stays an open research epic; line–arc Round remains unimplemented.

## Existing behavior and finite profile

Current Round supports line–line corners. Its explicit adjacent-arc guard refuses the selected line–arc corner. Safe refusal is not a defect. The public alert is “Round corners between two straight edges (this one has an arc).” No new admission, solver, schema or UI control is added.

The source-authored outline has P0[0,0], P1[40,20], P2[20,40], P3[0,40], followed by Extrude height10. Original e2/index1 is a counterclockwise R20 quarter arc centered[20,20]. Metadata has radius1:20, tangent2 and H2/V3. This is not public seed construction or a replay of D461's simple L-profile.

The driver picks non-tangent P1 through the real canvas, types Corner radius3 in Round the corner, then clicks Round the corner. Exact current refusal preserves local authored fields, locks, constraints, accepted whole document and accessible history. Escape cancels; no-op Finish is not used as cancellation.

The supported control picks P3[0,40], where incident edges are straight, on the same arc-bearing outline. Round radius2 adds e5/index3 centered[2,38] and preserves original e2/R20. Metadata becomes radii1:20/3:2, tangents2/3/4 and H2/V4. This is initial unchanged valid geometry, not a future underconstrained radius-edit guarantee.

## Six actual groups

All six pass: public seed Open/current native binding; first P1 line–arc refusal/retention/cancel; P3 line–line R2 control/Finish/native; first exact Undo to seed and Redo to control; own OPFS Save/Close/same-context reload/Open; post-Open P1 refusal/retention/cancel. No new radius-edit or export acceptance is counted.

Seven bindings pass: two new native captures and five exact-whole-document reuses, with seven fresh independent Python oracles and raw current Worker volume/centroid bindings. Worker binding error is0. Reuse requires entire document/product-pin equality; fresh consumer/oracle checks still run. Current native B-rep mass, bounds, strict validity and original/new arc witnesses establish physical truth with the independent oracle. Worker values establish current consumer consistency. Worst native volume error is3.64e-12 and centroid error2.13e-14mm. Original e2 circle preservation meets the native1e-9 budget; maximum linear error is0 and angular error2.22e-16. Native limits stay1e-9 relative volume and absolute centroid/bounds/circle/pins in mm. Returned solver constraints keep1e-7mm linear and1e-9rad angular limits. No display mesh is physical authority.

Actual run01 has25 images; root viewed seven covering accepted seed, first refusal, control before Finish, accepted control, Undo, projectOpen and post-Open refusal. Prehash2378/full frozen2379 count pinned paths including aliases. Frozen/after/cleanup/current match before documentation writes. Errors, downloads and watched changes are0. Namespace D465-round-support-run01 is removed and absent; owned context/browser/server close, PID56370 is absent and the gate is free. Native preflight has749 equal pins and PID53496 absent. No executed SUT or preparation failure occurred. Root corrected post-run reader cwd/JSON-shape reads outside the SUT; no rerun was needed.

## Integration boundary and next work

Separate R3/R4 theoretical calculations each find one declared finite branch, with productImports0/nativeProducerCalls0. They are THEORETICAL_NOT_PRODUCT_ADMISSION. Existing points/bulges/radius/tangent/ID types can represent candidates; this proves neither a producer nor settled accuracy. Trimming requires a new remaining source-arc bulge. Removed sharp-point rules and trimmed-line length locks need explicit refusal or explanation, never silent reassociation.

D466 next measures two source-authored R3/R4 candidates through existing settleShape(candidate,seed). It is an isolated initial-settle measurement, not a Round producer or repair. Measure source-circle preservation, finite branch and constraints before any admission; current roundCorner line–arc guard stays unchanged. New tests/types/build/full kernel are NOT_RUN; D461's28 groups, lint and Studio/final Model types remain retained. Core readiness stays NOT_MEASURED, legacy43% frozen and all HOLDs unchanged. No broad curve theorem, feature delivery, new approval or HOLD lift follows.
