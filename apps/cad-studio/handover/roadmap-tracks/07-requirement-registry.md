# Registered CAD requirements — 129 IDs in 15 epics

[Current roadmap](../roadmap.md) · [Issue reconciliation](06-github-issues.md) · [First product baseline](04-product-baseline.md)

Snapshot:2026-11-04. These exact IDs and descriptions come from the REQUIRED FEATURES sections of open epics #528–#542. They preserve the existing registered target; they are not129 newly missing features or a new claim of exhaustive CAD scope. Epic checkboxes and old next/READY text are historical issue data, not implementation evidence or current execution authority.

Coverage of these129 requirements is **NOT_ADJUDICATED**. Each needs links to current implementation, supported/refused input family, eligible decision evidence, actual consumer and remaining breadth/HOLD before an accepted count can be reported. Many are already implemented at bounded scopes; no unchecked box is treated as absent. Neither129 IDs nor85 open CAD-title issues are a percentage denominator for all CAD. Later proposals may add requirements only with explicit versioned reconciliation and deduplication.

The first B01–B10 baseline covers selected practical tasks across this registry. It does not close a whole requirement whenever one case passes. P0 fixes can unblock several IDs without counting as new independent features. Global/core readiness remains NOT_MEASURED.

## Preserved gates

CAN-06/DOC-07/COMP-08 include version/compatibility concerns: validation and existing compatibility remain relevant, while schema5/migration is held. QA-08 includes mobile in the original target; mobile is outside current execution and must stay NOT_RUN. QA-09 includes release; package consumer preparation does not authorize publication. SURF and general BREP/DETAIL requirements preserve fitter/thicken/NURBS/widening HOLDs. An active subset never closes its held or unqualified remainder.

## Full registry

| ID | Existing registered requirement | Parent epic | Current track | Stable rows | Baseline relationship |
| --- | --- | --- | --- | --- | --- |
| CAN-01 | Current original geometry/construction/topology contract and exporter boundary | [#528](https://github.com/barocss/barocss/issues/528) | P0/P4 | 04/12/16 | B07/B08/B09 |
| CAN-02 | Versioned product document with bodies, features and stable IDs | [#528](https://github.com/barocss/barocss/issues/528) | P0/P4 | 04/12/16 | B07/B08/B09 |
| CAN-03 | Explicit units, coordinate frames and transform semantics | [#528](https://github.com/barocss/barocss/issues/528) | P0/P4 | 04/12/16 | B07/B08/B09 |
| CAN-04 | Owned native geometry/topology references and persistent identity | [#528](https://github.com/barocss/barocss/issues/528) | P0/P4 | 04/12/16 | B07/B08/B09 |
| CAN-05 | Feature/constraint/parameter records separate from derived caches | [#528](https://github.com/barocss/barocss/issues/528) | P0/P4 | 04/12/16 | B07/B08/B09 |
| CAN-06 | Schema validation, migration and backward compatibility | [#528](https://github.com/barocss/barocss/issues/528) | P0/P4 | 04/12/16 | B07/B08/B09 |
| CAN-07 | Exporter capability/loss/diagnostic and source-ID mapping contract | [#528](https://github.com/barocss/barocss/issues/528) | P0/P4 | 04/12/16 | B07/B08/B09 |
| CAN-08 | Canonical saved source versus computed geometry versus preview distinction | [#528](https://github.com/barocss/barocss/issues/528) | P0/P4 | 04/12/16 | B07/B08/B09 |
| UI-01 | Viewport-first workspace and accepted versus staged state | [#529](https://github.com/barocss/barocss/issues/529) | P0/P4 | 05/06/15/20/21/32 | B01/B10 |
| UI-02 | Orbit, pan, zoom and explicit frame selection | [#529](https://github.com/barocss/barocss/issues/529) | P0/P4 | 05/06/15/20/21/32 | B01/B10 |
| UI-03 | Screen picking and body/face/edge/vertex selection | [#529](https://github.com/barocss/barocss/issues/529) | P0/P4 | 05/06/15/20/21/32 | B01/B10 |
| UI-04 | Multi-selection and selection filters | [#529](https://github.com/barocss/barocss/issues/529) | P0/P4 | 05/06/15/20/21/32 | B01/B10 |
| UI-05 | Object/part/feature tree and properties | [#529](https://github.com/barocss/barocss/issues/529) | P0/P4 | 05/06/15/20/21/32 | B01/B10 |
| UI-06 | Workplane/grid/axes and snapping feedback | [#529](https://github.com/barocss/barocss/issues/529) | P0/P4 | 05/06/15/20/21/32 | B01/B10 |
| UI-07 | Direct manipulation handles and precise numerical input | [#529](https://github.com/barocss/barocss/issues/529) | P0/P4 | 05/06/15/20/21/32 | B01/B10 |
| UI-08 | Keyboard shortcuts, contextual tools and readable errors | [#529](https://github.com/barocss/barocss/issues/529) | P0/P4 | 05/06/15/20/21/32 | B01/B10 |
| DOC-01 | New/open/save and accepted local project round trip | [#530](https://github.com/barocss/barocss/issues/530) | P0/P1 | 12/16 | B01/B08 |
| DOC-02 | Atomic modelling Undo/Redo with primitive editability | [#530](https://github.com/barocss/barocss/issues/530) | P0/P1 | 12/16 | B01/B08 |
| DOC-03 | Multiple bodies and named objects with stable references | [#530](https://github.com/barocss/barocss/issues/530) | P0/P1 | 12/16 | B01/B08 |
| DOC-04 | Whole-box and later multi-part document encoding | [#530](https://github.com/barocss/barocss/issues/530) | P0/P1 | 12/16 | B01/B08 |
| DOC-05 | Autosave, crash recovery and explicit unsaved changes | [#530](https://github.com/barocss/barocss/issues/530) | P0/P1 | 12/16 | B01/B08 |
| DOC-06 | Copy/duplicate/delete and dependent-feature diagnostics | [#530](https://github.com/barocss/barocss/issues/530) | P0/P1 | 12/16 | B01/B08 |
| DOC-07 | Document version migration and imported-data provenance | [#530](https://github.com/barocss/barocss/issues/530) | P0/P1 | 12/16 | B01/B08 |
| DOC-08 | Reusable templates and repeatable example/gallery files | [#530](https://github.com/barocss/barocss/issues/530) | P0/P1 | 12/16 | B01/B08 |
| SK-01 | XY workplane sketch document and native curve identity | [#531](https://github.com/barocss/barocss/issues/531) | P1 | 09 | B01/B02 |
| SK-02 | Line, polyline and rectangle profile tools | [#531](https://github.com/barocss/barocss/issues/531) | P1 | 09 | B01/B02 |
| SK-03 | Circle and arc profile tools | [#531](https://github.com/barocss/barocss/issues/531) | P1 | 09 | B01/B02 |
| SK-04 | Bezier/NURBS sketch curve tool | [#531](https://github.com/barocss/barocss/issues/531) | P1 | 09 | B01/B02 |
| SK-05 | Endpoint/midpoint/centre/grid snapping | [#531](https://github.com/barocss/barocss/issues/531) | P1 | 09 | B01/B02 |
| SK-06 | Trim/extend/split and closed-profile detection | [#531](https://github.com/barocss/barocss/issues/531) | P1 | 09 | B01/B02 |
| SK-07 | Construction geometry and sketch layers | [#531](https://github.com/barocss/barocss/issues/531) | P1 | 09 | B01/B02 |
| SK-08 | Profile selection, edit/commit and part-feature handoff | [#531](https://github.com/barocss/barocss/issues/531) | P1 | 09 | B01/B02 |
| CON-01 | Driving linear dimensions | [#532](https://github.com/barocss/barocss/issues/532) | P1/P0 | 09/16 | B01/B02 |
| CON-02 | Radius/diameter and angular dimensions | [#532](https://github.com/barocss/barocss/issues/532) | P1/P0 | 09/16 | B01/B02 |
| CON-03 | Coincident, horizontal, vertical and fixed constraints | [#532](https://github.com/barocss/barocss/issues/532) | P1/P0 | 09/16 | B01/B02 |
| CON-04 | Parallel/perpendicular and equal-length constraints | [#532](https://github.com/barocss/barocss/issues/532) | P1/P0 | 09/16 | B01/B02 |
| CON-05 | Tangent, concentric and symmetry constraints | [#532](https://github.com/barocss/barocss/issues/532) | P1/P0 | 09/16 | B01/B02 |
| CON-06 | Under/over/fully constrained diagnostics | [#532](https://github.com/barocss/barocss/issues/532) | P1/P0 | 09/16 | B01/B02 |
| CON-07 | Bounded solve, degeneracy and contradiction detection | [#532](https://github.com/barocss/barocss/issues/532) | P1/P0 | 09/16 | B01/B02 |
| CON-08 | Interactive drag with accepted-state rollback | [#532](https://github.com/barocss/barocss/issues/532) | P1/P0 | 09/16 | B01/B02 |
| CON-09 | Constraint selection/edit/delete and source provenance | [#532](https://github.com/barocss/barocss/issues/532) | P1/P0 | 09/16 | B01/B02 |
| CON-10 | Solver tolerances, residuals and deterministic regression corpus | [#532](https://github.com/barocss/barocss/issues/532) | P1/P0 | 09/16 | B01/B02 |
| PAR-01 | Named parameter table and dimensional units | [#533](https://github.com/barocss/barocss/issues/533) | P1/P0 | 07/09/12/16 | B01/B02/B08/B09 |
| PAR-02 | Bounded original expression parser with no eval | [#533](https://github.com/barocss/barocss/issues/533) | P1/P0 | 07/09/12/16 | B01/B02/B08/B09 |
| PAR-03 | Dependency/cycle detection and deterministic recomputation | [#533](https://github.com/barocss/barocss/issues/533) | P1/P0 | 07/09/12/16 | B01/B02/B08/B09 |
| PAR-04 | Editable feature tree and construction provenance | [#533](https://github.com/barocss/barocss/issues/533) | P1/P0 | 07/09/12/16 | B01/B02/B08/B09 |
| PAR-05 | Suppression, reorder and dependent-feature handling | [#533](https://github.com/barocss/barocss/issues/533) | P1/P0 | 07/09/12/16 | B01/B02/B08/B09 |
| PAR-06 | Stable topology references after parameter changes | [#533](https://github.com/barocss/barocss/issues/533) | P1/P0 | 07/09/12/16 | B01/B02/B08/B09 |
| PAR-07 | Configuration/parameter sets and selective rebuild | [#533](https://github.com/barocss/barocss/issues/533) | P1/P0 | 07/09/12/16 | B01/B02/B08/B09 |
| PAR-08 | Atomic failed-feature recovery with Undo/project compatibility | [#533](https://github.com/barocss/barocss/issues/533) | P1/P0 | 07/09/12/16 | B01/B02/B08/B09 |
| PART-01 | Practical closed-box create/update and native preview | [#534](https://github.com/barocss/barocss/issues/534) | P1 | 03/07/08 | B01/B02/B03/B04 |
| PART-02 | Solid profile extrusion with explicit cap/validity subset | [#534](https://github.com/barocss/barocss/issues/534) | P1 | 03/07/08 | B01/B02/B03/B04 |
| PART-03 | Revolve feature | [#534](https://github.com/barocss/barocss/issues/534) | P1 | 03/07/08 | B01/B02/B03/B04 |
| PART-04 | Sweep feature | [#534](https://github.com/barocss/barocss/issues/534) | P1 | 03/07/08 | B01/B02/B03/B04 |
| PART-05 | Loft feature | [#534](https://github.com/barocss/barocss/issues/534) | P1 | 03/07/08 | B01/B02/B03/B04 |
| PART-06 | Additive/subtractive profile operations | [#534](https://github.com/barocss/barocss/issues/534) | P1 | 03/07/08 | B01/B02/B03/B04 |
| PART-07 | Linear/circular feature patterns | [#534](https://github.com/barocss/barocss/issues/534) | P1 | 03/07/08 | B01/B02/B03/B04 |
| PART-08 | Mirror and transformed feature copies | [#534](https://github.com/barocss/barocss/issues/534) | P1 | 03/07/08 | B01/B02/B03/B04 |
| PART-09 | Reusable primitive/feature presets | [#534](https://github.com/barocss/barocss/issues/534) | P1 | 03/07/08 | B01/B02/B03/B04 |
| PART-10 | Multi-body feature results with identity and rebuild | [#534](https://github.com/barocss/barocss/issues/534) | P1 | 03/07/08 | B01/B02/B03/B04 |
| BREP-01 | General native edge/face/loop/shell/body representation | [#535](https://github.com/barocss/barocss/issues/535) | P1 blockers/P5 breadth | 07/08/16/30 | B01/B02/B03/B04/B07 |
| BREP-02 | Curve-curve and curve-surface intersections | [#535](https://github.com/barocss/barocss/issues/535) | P1 blockers/P5 breadth | 07/08/16/30 | B01/B02/B03/B04/B07 |
| BREP-03 | Surface-surface intersection and trim curves | [#535](https://github.com/barocss/barocss/issues/535) | P1 blockers/P5 breadth | 07/08/16/30 | B01/B02/B03/B04/B07 |
| BREP-04 | Trimmed-face/pcurve ownership and orientation | [#535](https://github.com/barocss/barocss/issues/535) | P1 blockers/P5 breadth | 07/08/16/30 | B01/B02/B03/B04/B07 |
| BREP-05 | Solid union/subtraction/intersection | [#535](https://github.com/barocss/barocss/issues/535) | P1 blockers/P5 breadth | 07/08/16/30 | B01/B02/B03/B04/B07 |
| BREP-06 | Topology sewing/join with explicit policy | [#535](https://github.com/barocss/barocss/issues/535) | P1 blockers/P5 breadth | 07/08/16/30 | B01/B02/B03/B04/B07 |
| BREP-07 | Manifold, self-intersection and degeneracy validation | [#535](https://github.com/barocss/barocss/issues/535) | P1 blockers/P5 breadth | 07/08/16/30 | B01/B02/B03/B04/B07 |
| BREP-08 | Persistent edge/face naming and geometric matching | [#535](https://github.com/barocss/barocss/issues/535) | P1 blockers/P5 breadth | 07/08/16/30 | B01/B02/B03/B04/B07 |
| BREP-09 | Tolerance policy and hard failure/unsupported diagnostics | [#535](https://github.com/barocss/barocss/issues/535) | P1 blockers/P5 breadth | 07/08/16/30 | B01/B02/B03/B04/B07 |
| DETAIL-01 | Fillet on supported edges | [#536](https://github.com/barocss/barocss/issues/536) | P1/P5 | 07/08/16/31 | B02/B03 |
| DETAIL-02 | Chamfer | [#536](https://github.com/barocss/barocss/issues/536) | P1/P5 | 07/08/16/31 | B02/B03 |
| DETAIL-03 | Holes and bounded countersink/counterbore features | [#536](https://github.com/barocss/barocss/issues/536) | P1/P5 | 07/08/16/31 | B02/B03 |
| DETAIL-04 | Shell/thickness/offset | [#536](https://github.com/barocss/barocss/issues/536) | P1/P5 | 07/08/16/31 | B02/B03 |
| DETAIL-05 | Draft on supported faces | [#536](https://github.com/barocss/barocss/issues/536) | P1/P5 | 07/08/16/31 | B02/B03 |
| DETAIL-06 | Face move/offset and direct-edit semantics | [#536](https://github.com/barocss/barocss/issues/536) | P1/P5 | 07/08/16/31 | B02/B03 |
| DETAIL-07 | Split body and section-derived features | [#536](https://github.com/barocss/barocss/issues/536) | P1/P5 | 07/08/16/31 | B02/B03 |
| DETAIL-08 | Feature failure limits and editable dimension history | [#536](https://github.com/barocss/barocss/issues/536) | P1/P5 | 07/08/16/31 | B02/B03 |
| SURF-01 | Control-point and rational-weight editing | [#537](https://github.com/barocss/barocss/issues/537) | P5 | 07/08/24/30 | Beyond first baseline |
| SURF-02 | Knot insertion/removal and degree operations | [#537](https://github.com/barocss/barocss/issues/537) | P5 | 07/08/24/30 | Beyond first baseline |
| SURF-03 | Curve interpolation/fit with explicit error controls | [#537](https://github.com/barocss/barocss/issues/537) | P5 | 07/08/24/30 | Beyond first baseline |
| SURF-04 | Ruled/lofted/swept/revolved surfaces | [#537](https://github.com/barocss/barocss/issues/537) | P5 | 07/08/24/30 | Beyond first baseline |
| SURF-05 | Surface control net editing and local selection | [#537](https://github.com/barocss/barocss/issues/537) | P5 | 07/08/24/30 | Beyond first baseline |
| SURF-06 | G0/G1/G2 continuity and derivative inspection | [#537](https://github.com/barocss/barocss/issues/537) | P5 | 07/08/24/30 | Beyond first baseline |
| SURF-07 | Trim/join/extend/fill supported surface boundaries | [#537](https://github.com/barocss/barocss/issues/537) | P5 | 07/08/24/30 | Beyond first baseline |
| SURF-08 | Iso-curves, curvature and surface-analysis displays | [#537](https://github.com/barocss/barocss/issues/537) | P5 | 07/08/24/30 | Beyond first baseline |
| SURF-09 | Freeform surface to supported closed body | [#537](https://github.com/barocss/barocss/issues/537) | P5 | 07/08/24/30 | Beyond first baseline |
| SURF-10 | Native accuracy/continuity/singularity and exchange regression | [#537](https://github.com/barocss/barocss/issues/537) | P5 | 07/08/24/30 | Beyond first baseline |
| ASM-01 | Part instances and shared versus copied geometry | [#538](https://github.com/barocss/barocss/issues/538) | P3/P4 | 10/23 | B05/B07 |
| ASM-02 | Transform and coordinate-frame hierarchy | [#538](https://github.com/barocss/barocss/issues/538) | P3/P4 | 10/23 | B05/B07 |
| ASM-03 | Assembly document save/reopen and external part references | [#538](https://github.com/barocss/barocss/issues/538) | P3/P4 | 10/23 | B05/B07 |
| ASM-04 | Bounded align/coincident/concentric mates | [#538](https://github.com/barocss/barocss/issues/538) | P3/P4 | 10/23 | B05/B07 |
| ASM-05 | Mate degrees-of-freedom and contradiction diagnostics | [#538](https://github.com/barocss/barocss/issues/538) | P3/P4 | 10/23 | B05/B07 |
| ASM-06 | Multi-part selection/edit and dependency refresh | [#538](https://github.com/barocss/barocss/issues/538) | P3/P4 | 10/23 | B05/B07 |
| ASM-07 | Exploded/section views and visibility controls | [#538](https://github.com/barocss/barocss/issues/538) | P3/P4 | 10/23 | B05/B07 |
| ASM-08 | Assembly scale/performance and identity regression | [#538](https://github.com/barocss/barocss/issues/538) | P3/P4 | 10/23 | B05/B07 |
| XCHG-01 | Select export target independently of native modelling spec | [#539](https://github.com/barocss/barocss/issues/539) | P2/P6 | 13/26/28 | B07 |
| XCHG-02 | Original bounded solid STEP export | [#539](https://github.com/barocss/barocss/issues/539) | P2/P6 | 13/26/28 | B07 |
| XCHG-03 | Supported STEP geometry/topology import | [#539](https://github.com/barocss/barocss/issues/539) | P2/P6 | 13/26/28 | B07 |
| XCHG-04 | Retained NURBS curve/surface IGES export | [#539](https://github.com/barocss/barocss/issues/539) | P2/P6 | 13/26/28 | B07 |
| XCHG-05 | Supported IGES import | [#539](https://github.com/barocss/barocss/issues/539) | P2/P6 | 13/26/28 | B07 |
| XCHG-06 | Mesh export such as STL with approximation reporting | [#539](https://github.com/barocss/barocss/issues/539) | P2/P6 | 13/26/28 | B07 |
| XCHG-07 | Planar drawing/profile export such as DXF/SVG | [#539](https://github.com/barocss/barocss/issues/539) | P2/P6 | 13/26/28 | B07 |
| XCHG-08 | Per-format capability, loss, unit and entity-ID reports | [#539](https://github.com/barocss/barocss/issues/539) | P2/P6 | 13/26/28 | B07 |
| XCHG-09 | Round-trip, corrupt-file and schema/reader regression | [#539](https://github.com/barocss/barocss/issues/539) | P2/P6 | 13/26/28 | B07 |
| ENG-01 | Native distance/angle/radius measurements | [#540](https://github.com/barocss/barocss/issues/540) | P2/P3 | 01/02/10/11/16 | B05/B06 |
| ENG-02 | Area, volume, bounds and centre-of-mass properties | [#540](https://github.com/barocss/barocss/issues/540) | P2/P3 | 01/02/10/11/16 | B05/B06 |
| ENG-03 | Material density and mass/inertia with unit semantics | [#540](https://github.com/barocss/barocss/issues/540) | P2/P3 | 01/02/10/11/16 | B05/B06 |
| ENG-04 | Section planes and native section curves | [#540](https://github.com/barocss/barocss/issues/540) | P2/P3 | 01/02/10/11/16 | B05/B06 |
| ENG-05 | Orthographic and isometric drawing views | [#540](https://github.com/barocss/barocss/issues/540) | P2/P3 | 01/02/10/11/16 | B05/B06 |
| ENG-06 | Dimensions, annotations and drawing sheets | [#540](https://github.com/barocss/barocss/issues/540) | P2/P3 | 01/02/10/11/16 | B05/B06 |
| ENG-07 | Supported PDF/SVG/drawing export | [#540](https://github.com/barocss/barocss/issues/540) | P2/P3 | 01/02/10/11/16 | B05/B06 |
| ENG-08 | Measurement accuracy and source-geometry identity checks | [#540](https://github.com/barocss/barocss/issues/540) | P2/P3 | 01/02/10/11/16 | B05/B06 |
| QA-01 | Explicit supported/unsupported capability matrix | [#541](https://github.com/barocss/barocss/issues/541) | P0/P4 | 12/15/16/20/22/23/27/32/33 | Cross-cutting B01-B10 |
| QA-02 | Native math/solver/topology regression and negative controls | [#541](https://github.com/barocss/barocss/issues/541) | P0/P4 | 12/15/16/20/22/23/27/32/33 | Cross-cutting B01-B10 |
| QA-03 | Real user-task UI/project/export regression corpus | [#541](https://github.com/barocss/barocss/issues/541) | P0/P4 | 12/15/16/20/22/23/27/32/33 | Cross-cutting B01-B10 |
| QA-04 | Accepted-state failure recovery and resource lifetime | [#541](https://github.com/barocss/barocss/issues/541) | P0/P4 | 12/15/16/20/22/23/27/32/33 | Cross-cutting B01-B10 |
| QA-05 | File migration and long-session recovery | [#541](https://github.com/barocss/barocss/issues/541) | P0/P4 | 12/15/16/20/22/23/27/32/33 | Cross-cutting B01-B10 |
| QA-06 | Adaptive preview/LOD with honest approximation bounds | [#541](https://github.com/barocss/barocss/issues/541) | P0/P4 | 12/15/16/20/22/23/27/32/33 | Cross-cutting B01-B10 |
| QA-07 | Large-part/assembly timing and memory comparisons | [#541](https://github.com/barocss/barocss/issues/541) | P0/P4 | 12/15/16/20/22/23/27/32/33 | Cross-cutting B01-B10 |
| QA-08 | Desktop/mobile/keyboard usability and accessible labels | [#541](https://github.com/barocss/barocss/issues/541) | P0/P4 | 12/15/16/20/22/23/27/32/33 | Cross-cutting B01-B10 |
| QA-09 | Packed consumers, docs and separately authorized release gates | [#541](https://github.com/barocss/barocss/issues/541) | P0/P4 | 12/15/16/20/22/23/27/32/33 | Cross-cutting B01-B10 |
| COMP-01 | Reusable lexical/parser AST with source ranges | [#542](https://github.com/barocss/barocss/issues/542) | P0/P4/automation | 04/12/16 | B09/B10 |
| COMP-02 | Explicit semantic symbol, kind and unit checking | [#542](https://github.com/barocss/barocss/issues/542) | P0/P4/automation | 04/12/16 | B09/B10 |
| COMP-03 | Versioned own model IR and original native lowering | [#542](https://github.com/barocss/barocss/issues/542) | P0/P4/automation | 04/12/16 | B09/B10 |
| COMP-04 | Compatible legacy source-v0/v1 front ends | [#542](https://github.com/barocss/barocss/issues/542) | P0/P4/automation | 04/12/16 | B09/B10 |
| COMP-05 | Typed parameters and bounded expression language | [#542](https://github.com/barocss/barocss/issues/542) | P0/P4/automation | 04/12/16 | B09/B10 |
| COMP-06 | Feature-node registry and dependency diagnostics | [#542](https://github.com/barocss/barocss/issues/542) | P0/P4/automation | 04/12/16 | B09/B10 |
| COMP-07 | Structured diagnostic/source-map/compiler tooling | [#542](https://github.com/barocss/barocss/issues/542) | P0/P4/automation | 04/12/16 | B09/B10 |
| COMP-08 | Document/module version and deterministic compile caching policy | [#542](https://github.com/barocss/barocss/issues/542) | P0/P4/automation | 04/12/16 | B09/B10 |

## Adjudication procedure

For each ID, keep its exact target text and add implementation availability, relevant producer/consumer, bounded PASS/FAIL/NOT_RUN, source eligibility, selected task and remaining acceptance. A source implementation can be available while its full registered target stays open. An epic stays open until all its declared requirements and quality gates are met; do not derive closure from this map or from a feature count.

The live intake and primary destinations are in06-github-issues.md. No issue, checkbox, assignee, label, milestone or comment was edited by this registry. No product test, Studio execution, independent geometry or release acceptance follows.
