---
work_id: P2-enclosure-checkpoint
artifact_type: gap-register
status: product-incomplete
owner_role: API lane
source_request: 2026-10-24 owner handover
last_updated: 2026-10-24
---

# P2 open checks

- **PG-11, owner input:** no person-supplied connector rows. The 9.0 × 3.2 mm USB-C opening is a stand-in. `checkEnclosure` returns `P2_CONNECTOR_ROWS_REQUIRED`. No supplier compatibility claim follows.
- **PG-12, owner input:** the shipped fastener sample has no M3 length 5. The board screws use explicit unthreaded example solids. They need person-supplied rows before fastener acceptance. The native intersection detects four overlaps with the lower case's standoff pilot bores. A thread-forming fit is not accepted from this geometry alone.
- **Materials missing:** the board and cell have no assigned material. Their volumes remain measurable; their masses remain unknown. The current BOM core supplies an assumed mass for them. `outputs:bom-mass` fails with `P2_MATERIAL_REQUIRED`; its exported total is not an accepted product mass. Outer owns `bom/core.ts` and the analysis mass policy.
- **Manufacturing not accepted:** both housing halves have failing undercut rules, undrafted features, wall-uniformity and other warnings. A 2 mm nominal wall and 1° outer-wall draft do not establish mouldability of the complete feature set. The heat sink has a tall-fin warning and incomplete drawing notes. The shop stock list is absent; its CAM package stays refused with `STOCK_NONE_LOADED`.
- **Drawings not accepted:** native drawing issues report errors on the lower case and cover. The files are exported for inspection, but file generation does not clear those errors. Drawing layout core belongs to its owner lane; this checkpoint does not silently remove dimensions or relax the issue checks.
- **Geometry boundary:** exact supporting planes check the four straight walls and one cap of each half. Eight outer-wall normals check the signed 1° draft. Four straight rim gaps, one axial gap and four coaxial cylindrical corner gaps check the 0.1 mm lip fit. These are scoped exact measurements. Full-feature wall and draft findings remain in the process reports, whose wall sampling is based on the display mesh.
- **Interference boundary:** all pairs of evaluated exact bodies are checked. Positive-weight control-point hulls can prove zero-volume separation or tangency; every remaining pair goes to the native analytic intersection, including fully contained solids with positive surface clearance. The existing core's `1e-6` mm³ overlap threshold is unchanged. No refusal or positive-volume pair is waived as a designed contact. A successful Boolean is native evidence, not an independent general proof of the Boolean implementation.
- **Stand-ins:** the cell, board and inserts have example dimensions only. Shipped fastener sample rows establish fixture behavior only. No agent-authored rows are added.

The checker exports manufacturing reports, SVG/DXF/PDF part drawings, drawing issues, the BOM and purchase CSV. It checks coverage and flags unknown material mass. It checks file structure and native drawing issues, not a human print review. Supplier procurement, snap-fit mechanics, a tooling design, shop CAM qualification, Studio/browser acceptance and release remain open.

P3/P4 follow verified P2. R7.7d remains a separate coordinated window after the kernel and outer contracts land. The API lane owns cad/src/api and cad-model/src/api adapters, facade tests and product examples. The docs lane owns documentation consumers. No breaking kernel merge is part of this checkpoint.
