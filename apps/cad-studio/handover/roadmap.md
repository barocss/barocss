# CAD roadmap — current navigation

This is the single current status index. Row pages describe scope and evidence navigation, not a second status ledger.
Historical statements remain verbatim in the [through-D417 archive](roadmap-history-through-D417.md).
A bounded closeout does not close an entire feature family, format, standard or release.

## Active priority authority — D445

The [D445 core CAD priority decision](notes/core-cad-priority-2026-11-02/README.md) and [Claude handoff](notes/claude-handoff-2026-11-02/README.md) are the current continuation entry points. This owner-selected order supersedes only the former active sequence **10 → 11 → 13 → 14**. Other operating constraints, tolerances and owner gates remain unchanged. The 34 row IDs and scope links remain the scope inventory.

Sketch editing, solid modeling, feature history, native files and local-project versions already exist. An open feature family or collaboration scope does not mean those daily functions are absent. Report reproduced defects separately from unverified breadth and unsupported extensions.

| Priority | User outcome and boundary | Related rows |
| --- | --- | --- |
| C1 | Reliable everyday part workflow: sketch dimensions/constraints → extrude/revolve → union/cut/hole/fillet → upstream dimension edit/rebuild/reference retention → measure/UndoRedo/refusal retention → native/local-project Save and fresh Open. | 07, 08, 09, 12, 16, 30 |
| C2 | Frequent modeling robustness and throughput: ordinary Boolean, fillet, chamfer, hole, pattern, shell and draft within current public scopes. Kernel changes address concrete blockers; preserve #2258/#2266 boundaries. | 03, 07, 08, 20, 21 |
| C3 | Useful engineering handoff: ordinary STEP/STL/3MF units, explicit losses and independent reads; part drawing dimensions, sections and model updates. Uncommon cone/format variants wait unless a real task or C1 needs them. | 01, 02, 04, 11, 12, 13 |
| C4 | Basic assemblies: placement, mates, BOM and related drawings; no Motion activation. | 10 |
| C5 | Usability and scale: Viewer/GPU, selection, latency, large assemblies and the later owner UI discussion. Daily functional defects may move to C1/C2; no workspace/menu/icon redesign starts now. | 05, 06, 15, 20, 21, 22, 23, 32 |
| C6 | Advanced surfaces, modeling and generality. A targeted core-enabling fix may move earlier only when needed; broad NURBS/fitter and existing HOLDs remain. | 07, 08, 24, 25, 30, 31, 34 |
| C7 | Ecosystem: customer files, formats, catalogs and PDM retain owner gates. | 26, 28, 29 |
| C8 | Separately held manufacturing, paths, Motion, experiments, release and browser CI. Preserve delivered proofs without automatic activation. | 14, 17, 18, 19, 27, 33 |

Current bounded checkpoints and next work:

- **C1:** [D448 ordinary support](notes/core-part-workflow-2026-11-03/README.md),12/12 declared action groups for one case; retains the [D447 rectangle fix](notes/rectangle-driving-retention-2026-11-02/README.md).
- **C2 finishing:** [D449](notes/ordinary-finishing-2026-11-03/README.md), three declared Chamfer/Draft/Shell geometry/edit/refusal branches; fixes the measured Draft neutral plane.
- **C2 selection:** [D450](notes/preview-selection-handoff-2026-11-03/README.md), three selected name/drop cases and9actual Apply/Undo/Redo checks.
- **C2 Hole:** [D451](notes/circular-hole-workflow-2026-11-03/README.md), one current rounded-coordinate circle-placement workflow,7/7 links. Ideal-circle1e-9 placement is not qualified.
- **C2 Booleans:** [D452](notes/ordinary-booleans-2026-11-03/README.md), two ordinary Subtract/Intersect workflows,8/8 links each, plus one reverse Subtract create-only order control. The original harness failure is retained.
- **C2 body patterns:** [D453](notes/body-pattern-spread-2026-11-03/README.md), fixes new circular spread retention and qualifies two ordinary linear/partial-circle workflows,8/8 links each, plus full-circle create/edit control. Legacy intent is not inferred.
- **C3 drawing revision:** [D454](notes/drawing-parameter-revision-2026-11-03/README.md), fixes parameter-only stale revision detection and qualifies one plate drawing/revision/project workflow,8/8 groups. DOM SVG is preview; export and standards remain separate.
- **C3 sections/details:** [D455](notes/section-detail-workflow-2026-11-03/README.md), one whole bored/filleted plate workflow,8/8 groups with seven actual native/Worker/SVG bindings. No product changes or new export/standards claim.
- **C4 BOM:** [D456](notes/bom-parameter-identity-2026-11-03/README.md), fixes parameter-distinct ordinary shape grouping and qualifies one public Insert/Duplicate/Undo/project workflow,7/7 groups with nine native/oracle reads. Conservative source identity is not general geometric equivalence.
- **C4 static mate/link:** [D457](notes/static-mate-linked-update-2026-11-03/README.md), one ordinary public planar mate and explicit linked-source Keep/Check/Accept/project loop,7/7 groups with ten native bindings (four new captures, six exact-document reuses). One turn and two slides remain free.
- **C4 concentric/distance:** [D458](notes/concentric-distance-workflow-2026-11-03/README.md), one unrotated pin/bore public picker/edit/refusal/project loop,7/7 groups with eight native bindings (three captures, five exact-document reuses). Refusal adds no Undo entry.
- **C4 assembly drawing:** [D459](notes/assembly-drawing-revision-2026-11-03/README.md), fixes the private assembly issue marker and qualifies one revision/update/project workflow,8/8 groups with nine native bindings (six captures, three exact-document reuses).
- **Issue intake:** [D460](notes/github-issue-intake-2026-11-03/README.md) reconciles33 recent full bodies and82 open CAD titles. Four future profiles and four existing-contract additions are recorded; five old navigation gaps are restored. Planning only; new acceptance NOT_RUN.
- **C1 sketch Round:** [D461](notes/sketch-round-construction-2026-11-03/README.md), fixes unchanged legacy construction identity in private Studio Finish and qualifies one public line–line Round/radius/history/project workflow,8/8 groups with seven native/oracle/current-consumer bindings. Line–arc Round remains separate.
- **C2 BODY Mirror:** [D462](notes/body-mirror-workflow-2026-11-03/README.md) qualifies one existing disjoint BODY Mirror/edit/history/refusal/project workflow,8/8 groups with eight native bindings (four captures, four exact-document reuses). One UI output keeps the original and reflection as two strict native bodies; no product change.
- **C2 partial Revolve:** [D463](notes/partial-revolve-workflow-2026-11-03/README.md) qualifies one existing 90°/180° Angle/source Depth/history/refusal/project workflow,8/8 groups with eight native bindings (four captures, four exact-document reuses). No product change.
- **C2 BODY Rotate:** [D464](notes/body-rotate-workflow-2026-11-03/README.md) qualifies one Z90/180, explicit-pivot0 source/history/refusal/project workflow,8/8 groups and eight native bindings. Accepted geometry is qualified; initial preview geometry visibility remains unmeasured. No product change.
- **Sketch support measurement:** [D465](notes/line-arc-round-support-2026-11-03/README.md) measures current line–arc refusal and a distinct supported line–line control on an arc-bearing outline,6/6 groups and seven native bindings. #2282 remains open/unimplemented; theoretical R3/R4 branches are not product admission.
- **Sketch settle measurement:** [D466](notes/line-arc-settle-readiness-2026-11-03/README.md) passes four isolated transitions and four actual manual R3/R4 Open/same-value Enter/Finish groups. Initial/same-value readiness only; DEFER_NEW_ADMISSION, no Round producer.
- **C2 BODY Scale:** [D467](notes/body-scale-workflow-2026-11-03/README.md) qualifies one positive uniform explicit-origin Scale/source/history/refusal/project workflow,8/8 groups and eight native bindings. Initial preview is partly cropped; full preview fit remains unmeasured. No product change.
- **C1/C2 BODY Move:** [D468](notes/body-move-workflow-2026-11-03/README.md) qualifies one integer-grid To-minXYZ→fixed translation/edit/source/refusal/history/project workflow,8/8 groups and eight native bindings. Preview visibility remains unmeasured. No product change.
- **C1 suppression lifecycle:** [D469](notes/scale-suppression-lifecycle-2026-11-03/README.md) qualifies terminal Scale suppression/source-edit/inactive-value/refused activation/history/project/reactivation,8/8 groups and nine native bindings (four captures/five exact-document reuses). Existing identity bypass retains authored fields; active Scale0 stays refused. No product change.
- **C1 named-Version Restore supplement:** [D470](notes/named-version-restore-physical-2026-11-03/README.md) qualifies5/5 physical/Measure/re-edit groups, four native bindings (three captures/one exact-document reuse). Restore is dirty until explicit Save; no D323 generic baseline replay. No product change.
- **C1 public parameter Rename supplement:** [D471](notes/parameter-rename-binding-2026-11-03/README.md) qualifies5/5 Rename/binding/value/refusal/history/project/post-Open Measure groups,seven native bindings (three renamed bound-document captures/four reuses). No product change or expression/configuration scope.
- **C2 rectangular Pipe:** [D472](notes/rectangular-pipe-workflow-2026-11-03/README.md) qualifies8/8 existing run–90°bend–run edit/source/refusal/history/project groups,eight native bindings (four captures/four exact-document reuses). Native/annular-sector proof,not faceted Sweep-curve/newadmission.
- **C2 ordinary Loft height:** [D473](notes/ordinary-loft-height-workflow-2026-11-03/README.md) qualifies six copied-section height/refusal/history/project groups with six native bindings (three captures/three exact-document reuses). The original W snapshot remains non-live. No product change or new Loft admission.
- **C1/C2 face-picked Extrude Join:** [D474](notes/face-picked-extrude-join-2026-11-03/README.md) qualifies seven real cap-picked default Join/tool-height/refusal/history/project groups, with seven native bindings (three captures/four exact-document reuses). Integer cardinal snapshot only; no live source following or off-grid precision claim.
- **C1/C2 face Extrude accuracy:** [D475](notes/native-face-extrude-height-2026-11-03/README.md) fixes the reproduced native +Z polygon cap height loss and passes seven desktop lifecycle groups for one dyadic source height. Original native/desktop accuracy FAIL remains recorded; High native and seven selected desktop native-binding audits ACCEPT.
- **C1/C2 circular face Extrude accuracy:** [D476](notes/native-circle-face-extrude-height-2026-11-03/README.md) fixes one existing R3 circular +Z cap height-loss case. Native heights 5/8/12 and seven desktop lifecycle groups pass at original budgets; three captures/four exact actual-document reuses. Original product accuracy FAIL and the later early harness stop remain distinct.
- **Owner closeout: current known C1/C2 reproduced-defect list FIRST-PASS CLOSEOUT through D476.** Whole C1/C2 and feature-family completion are not claimed. Other cap variants, off-grid XY and general breadth are deferred follow-ups; do not start automatic variant hunting.
- **C3 drawing recovery:** [D477](notes/drawing-circle-snap-recovery-2026-11-03/README.md) corrects one visible round-circle CENTER snap identity defect and passes8/8 public loss/recovery groups with nine native/Python/Worker/SVG bindings. At D477, tests were120 PASS/1 proven pre-existing O172 failure, not121 PASS; lint/types passed. D478 below addresses that functional failure.
- **C3 shaft Drawing Fix:** [D478](notes/shaft-drawing-fix-2026-11-03/README.md) corrects canonical UI round continuation and bounded automatic plain-ruler placement. Seven checkpoints/seven native/Python/Worker/SVG bindings pass (three captures/four exact reuses), including two no-action public quiescence observations. Original failures and the parent31c/current identical ASME PDF baseline failure remain recorded; no score, golden or tolerance weakening. D479 structural maintenance is recorded below; C1/C2 closeout and all HOLDs remain.
- **Structural maintenance D479:** [Type-contract extraction](notes/part-types-extraction-2026-11-03/README.md) moves34 existing types and reduces `part-model.ts`2245→1520 lines, with750 lines in `part-types.ts`. Forty-one contracts/70 old exports and emitted runtime JavaScript match;69 tests, nine family-first imports and three unchanged-document desktop checkpoints pass. No feature/API/B-rep change or percentage increase. D480 below completes only the transform/pattern step; profile/detail moves stay separately queued. Earlier R5/D361 remain delivered.
- **Structural maintenance D480:** [Transform/pattern extraction](notes/part-transform-extraction-2026-11-03/README.md) moves ten exact cases, part-model1520→1417/new family135, with70 old exports/private state retained. Primary107 tests, bounded paired16-case parity and one selected linear eight-checkpoint actual pass. One matched strict-invalid curve-spacing6 edit is retained, not16 geometry PASS; preview fit remains unmeasured.
- **C2 contact admission D481:** [Actual spacing6 triage](notes/curve-contact-admission-2026-11-04/README.md) reproduces the exact accepted edit and two strict-native self-touch issues after a qualified Open8 antecedent. Product FAIL is retained; current Worker at the failing capture is NOT_ESTABLISHED. No correction or new scope is claimed. [D482](notes/vertical-contact-refusal-2026-11-04/README.md) now refuses that exact unsafe contact without changing IDs/tolerances/strict validation. Full kernel2167 PASS/0 FAIL/2 existing SKIP and three actual retained8 refusal/project groups pass. [D483](notes/jsx-existing-viewer-2026-11-04/README.md) completes that owner-requested parallel proof: implemented bounded Viewer input,71 Viewer tests, actual nested JSX80→100→80 changed/restored canvas and two fresh current native widths. The JSX host remains a local prototype. [D484](notes/part-prismatic-detail-extraction-2026-11-04/README.md) completes the queued three-case prismatic-detail extraction; see its structural checkpoint below.
- **Structural maintenance D484:** [Prismatic-detail extraction](notes/part-prismatic-detail-extraction-2026-11-04/README.md) moves three exact cases, part-model1417→1348/new family101, with70 old exports and private owner helpers retained. CAD41 + Model31 tests, two fresh imports and six current public A relief/history/project groups pass; four native captures/two exact-document reuses, independent original-font physical checks and High final audit accept the bounded profile. Initial map/provenance and Redo mass-readiness harness failures remain explicit. No new geometry/API or whole-family completion. **Next D485:** review the next unmet ordinary C3 engineering-handoff acceptance; reuse valid evidence before selecting its one bounded profile.
- **C5 parallel JSX/Viewer D483:** [Existing Viewer bridge](notes/jsx-existing-viewer-2026-11-04/README.md) adds copied approximate display meshes and fixes the reproduced typed-array budget bypass. Final71 Viewer tests, six bounded fault controls, actual props80→100→80/current frame ownership and two independent native widths pass. Experimental JSX host source is retained locally; no general/released cad-react package or core-CAD percentage is claimed.
- **Owner-deferred:** the parent31c ASME one-page PDF golden mismatch waits until a later explicit selection. Retain the original identical parent/current FAIL; no golden rewrite, standards/tolerance widening or further PDF investigation is started now.
- [D446/PR#2281](https://github.com/barocss/barocss/pull/2281) remains the latest develop integration. New work publishes only to local/cad-dev.

The provisional nonzero-cone D445 source-only investigation is deferred, with no code change or SUT execution. Published D445 is this priority/handoff decision. D443/D444 proofs and all held tracks remain unchanged.

## Issue intake — D460

The [canonical issue intake](notes/github-issue-intake-2026-11-03/README.md) holds all33 dispositions. Future profiles are line–arc sketch Round (09, C1/C2 task fit), edge-condition drawing annotations (11, C3), open-hem geometry (07/08, C2/C6; process stages held14), and fixed-link URDF collapse (held18, exchange links13). Explanation/evidence/observation proposals extend existing contracts. Manufacturing, Motion/Physics, later AI/BIM and optional quote-service gates remain. Rendering/World proposals retain their existing owners. All34 rows, C1–C8, scope labels, legacy43% and readiness NOT_MEASURED remain unchanged.

## Current navigation — authority

- Latest bounded exchange admission: [D444 exact-zero direct cone frustums](notes/step-cone-zero-offset-2026-11-02/README.md), QUALIFIED for actual parsed-zero provenance, unchanged legacy native output, narrow source/representation guards, independent mutations and one actual acceptance/underflow-refusal flow. General nonzero cone offsets remain open.

- Latest bounded exchange boundary measurement: [D443 direct cone zero-offset refusal](notes/step-cone-offset-boundary-2026-11-02/README.md), QUALIFIED for the current native guard, exact identity graph and one actual control/refusal-retention flow. New cone admission and nonzero offset qualification remain open.

- Latest bounded exchange loss correction: [D442 native face/edge names](notes/step-native-name-loss-2026-11-02/README.md), QUALIFIED for one truthful existing-list disclosure, unchanged output bytes/source keys, scoped tests and one actual Open/Fit/Preview/Cancel. General Unicode writing and complete name/presentation transfer remain open.

- Latest bounded exchange string correction: [D441 ASCII literal backslashes](notes/step-literal-backslash-2026-11-02/README.md), QUALIFIED for existing writer-profile literals, opaque-value preservation, unchanged producer bytes and one actual Open/Fit/Preview/Cancel with independent raw tokens. Unicode/directive interpretation and product metadata remain open.

- Latest bounded current robustness profile: [D440 original case126b](notes/fuzz-case126-current-2026-11-02/README.md), QUALIFIED for one current native result, exact existing-node representation and public Open/Fit with root visible-model review. Historical D423 denominator cause remains UNKNOWN; full-kernel authority stays D433.

- Latest bounded exchange/file correction: [D439 quoted STEP strings](notes/step-quoted-section-tokens-2026-11-02/README.md), QUALIFIED for literal supported face names, real comments, scoped tests and one actual Open/Preview/Cancel flow; no general grammar or product-name claim.

- Latest bounded exchange correction: [D438 validation-box omission](notes/step-validation-box-2026-11-02/README.md), QUALIFIED for scoped candidate checks, independent source/byte and actual-file graph reads, plus one actual Studio Preview/Cancel flow. Trimmed-mesh bounds no longer become unsupported STEP declarations; existing loss reporting shows the absence.

- Latest bounded exchange measurement: [D437 spherical native STEP round trips](notes/step-sphere-roundtrip-2026-11-02/README.md), QUALIFIED for three offline shapes and one actual far preview/Cancel/reopen flow with a separate actual-byte read. Bbox accuracy remains unqualified.
- Latest bounded exchange admission: [D436 direct spherical STEP offsets](notes/step-sphere-offset-2026-11-02/README.md), QUALIFIED for the selected direct positive-radius/CIRCLE profile with exact boundary checks, independent mutation review and one four-state Studio flow. The original centroid target failure and its explicit existing-policy correction remain recorded.
- Latest accuracy prerequisite: [D435 STEP sphere dimensional-loss refusal](notes/step-sphere-precision-2026-11-02/README.md), BOUNDED QUALIFIED: exact rank guard,96scoped tests, independent mutation/source review and one four-state Studio refusal/retention flow.
- Latest bounded GPU/native checkpoint: [D434 relative raster frame](notes/gpu-relative-frame-2026-11-02/README.md), QUALIFIED for six declared profiles through scoped actual runs and certified reuse; far render/pick, native lines and positive grid pass. Unsupported/general precision remains open.
- Latest native accuracy/full-kernel checkpoint: [D433 conditioned polyhedral inertia](notes/planar-inertia-conditioning-2026-11-02/README.md), bounded source, full-kernel and actual Model/properties qualification. D434 changes no B-rep core.
- Latest CPU camera checkpoint: [D432 relative project/ray queries](notes/camera-query-precision-2026-11-02/README.md), bounded CPU PASS; its measured raster boundary is addressed by D434 for the declared profile.
- Previous CPU checkpoint: [D431 retained Viewer coordinates and world hits](notes/viewer-cpu-world-precision-2026-11-02/README.md), bounded CPU PASS; original raster failures remain in its historical record.
- First-loss diagnosis: [D430 far-coordinate first loss](notes/far-gpu-first-loss-2026-11-02/README.md), retained measured failure before D431/D432/D434.
- Image-quality control: [D429 orthographic depth conditioning](notes/orthographic-depth-conditioning-2026-11-02/README.md), bounded centered effects-ON artifact correction; exact ROI remains passing in D434.
- Latest measurement: [D428 orthographic AO/bounds interaction](notes/orthographic-ao-artifact-2026-11-02/README.md), bounded diagnostic PASS; its selected correction is D429.
- Current qualified bounded camera checkpoint: [D427](notes/small-camera-scale-2026-11-02/README.md), centered fit/visibility/picking. General raster quality remains HOLD. D426 retains native Model world-coordinate proof; D433 is the latest full-kernel run.
- D418 documentation organization: **QUALIFIED**, [record](notes/roadmap-index-2026-11-01/README.md).
- D423 historical mass source checkpoint: **scoped source PASS; original Studio/full-backend HOLD**, [record](notes/mass-translation-2026-11-01/README.md). D424 current source has full-kernel and two bounded actual flow PASS; original failure cause remains unexplained.
- D420 owner-approved develop integration: **MERGED**, [PR #2274](https://github.com/barocss/barocss/pull/2274), [scope and CI](notes/develop-integration-2026-11-01/README.md).
- Resume from the [Claude handoff](notes/claude-handoff-2026-11-02/README.md). Other operating rules remain in the [prior handoff](notes/codex-handoff-2026-11-01/README.md); D445 replaces only its active execution order.
- Decisions: [current navigation](decisions.md); numeric proof belongs to canonical item notes and qualifications.
- Before selecting one next item, check its dependencies, current source, recorded HOLDs and owner authorization.
- Do not restart qualified bounded profiles or infer release acceptance from a documentation change.

## Current navigation — active lane and next boundary

- D446 is merged in PR#2281. [D447](notes/rectangle-driving-retention-2026-11-02/README.md) fixes authored rectangle length retention; [D448](notes/core-part-workflow-2026-11-03/README.md) qualifies the single declared C1-1 combined-part loop. [D449](notes/ordinary-finishing-2026-11-03/README.md) qualifies three bounded C2 finishing branches; [D450](notes/preview-selection-handoff-2026-11-03/README.md) fixes that post-Apply ordinal-selection mismatch for three declared cases. [D451](notes/circular-hole-workflow-2026-11-03/README.md) qualifies one current rounded Hole circle workflow; [D452](notes/ordinary-booleans-2026-11-03/README.md) qualifies two ordinary Boolean workflows and one reverse create-only control; [D453](notes/body-pattern-spread-2026-11-03/README.md) retains new circular spread and qualifies two bounded body-pattern workflows; [D454](notes/drawing-parameter-revision-2026-11-03/README.md) fixes parameter-dependent drawing staleness and qualifies one eight-group workflow; [D455](notes/section-detail-workflow-2026-11-03/README.md) qualifies one ordinary section/detail/source-update loop; [D456](notes/bom-parameter-identity-2026-11-03/README.md) fixes ordinary parameterized BOM identity and qualifies a public assembly/project loop; [D457](notes/static-mate-linked-update-2026-11-03/README.md) qualifies one static planar mate and explicit linked-source update loop; [D458](notes/concentric-distance-workflow-2026-11-03/README.md) qualifies one ordinary public concentric/distance loop; [D459](notes/assembly-drawing-revision-2026-11-03/README.md) fixes private assembly drawing staleness and qualifies one eight-group revision/project loop. [D460](notes/github-issue-intake-2026-11-03/README.md) adopts the planning-only issue intake; [D461](notes/sketch-round-construction-2026-11-03/README.md) qualifies one existing line–line Round loop and fixes unchanged legacy construction identity. [D462](notes/body-mirror-workflow-2026-11-03/README.md) qualifies one ordinary BODY Mirror profile without product changes. [D463](notes/partial-revolve-workflow-2026-11-03/README.md) qualifies one partial Revolve Angle/source/history/project profile without product changes. [D464](notes/body-rotate-workflow-2026-11-03/README.md) qualifies one ordinary BODY Rotate quarter-turn workflow without product changes. [D465](notes/line-arc-round-support-2026-11-03/README.md) measures six current-support groups, retaining the line–arc guard. [D466](notes/line-arc-settle-readiness-2026-11-03/README.md) passes bounded initial/same-value settle for two manual candidates, not a Round producer. [D467](notes/body-scale-workflow-2026-11-03/README.md) qualifies one ordinary BODY Scale workflow without product changes. [D468](notes/body-move-workflow-2026-11-03/README.md) qualifies existing Move To-minXYZ lowering/fixed translation. [D469](notes/scale-suppression-lifecycle-2026-11-03/README.md) qualifies the terminal Scale suppression lifecycle. [D470](notes/named-version-restore-physical-2026-11-03/README.md) qualifies five named-Version Restore physical/Measure/re-edit groups. [D471](notes/parameter-rename-binding-2026-11-03/README.md) qualifies existing public parameter Rename/binding/native/persistence proof. [D472](notes/rectangular-pipe-workflow-2026-11-03/README.md) qualifies the existing public rectangular Pipe lifecycle. [D473](notes/ordinary-loft-height-workflow-2026-11-03/README.md) qualifies the ordinary copied-section Loft height lifecycle. [D474](notes/face-picked-extrude-join-2026-11-03/README.md) qualifies the real face-picked default Join lifecycle. [D475](notes/native-face-extrude-height-2026-11-03/README.md) fixes one reproduced native face Extrude height case and passes seven desktop groups; [D476](notes/native-circle-face-extrude-height-2026-11-03/README.md) fixes one existing circular +Z height case and passes seven desktop groups. The current known C1/C2 reproduced-defect list has FIRST-PASS CLOSEOUT through D476; broader cap/XY cases remain deferred follow-ups. [D477](notes/drawing-circle-snap-recovery-2026-11-03/README.md) fixes bounded round-circle CENTER visibility priority and qualifies8/8 drawing loss/recovery groups. [D478](notes/shaft-drawing-fix-2026-11-03/README.md) qualifies the existing shaft Fix lifecycle with7/7 checkpoints, including two no-action quiescence observations. [D479](notes/part-types-extraction-2026-11-03/README.md) completes only the type-contract extraction, with exact runtime/export proof and three unchanged-document smoke checkpoints. [D480](notes/part-transform-extraction-2026-11-03/README.md) completes only the mechanical transform/pattern dispatcher extraction with paired parity and one selected eight-checkpoint linear profile. D481 reproduces only that recorded accepted curve-spacing6 strict-native failure in actual Studio. D482 closes only that concrete unsafe-success case by typed refusal and proves three actual retained8 groups. D483 finalizes the parallel JSX/Viewer proof at the final D482 CAD source. Next D484 is queued profile/detail extraction with a fresh current public antecedent where needed. The owner deferred ASME PDF mismatch investigation; retain its original failure.
- Rows 12 and 16 remain cross-cutting file/acceptance and robustness concerns. Row 30 changes only for concrete core-workflow blockers.
- Exchange profiles through D444 remain qualified at their recorded scope. General exchange stays open, but another uncommon cone/format variant is not the automatic next task. Preserve public-thicken/fitter/NURBS HOLDs.
- Follow C1–C8 above. The former row sequence is historical context, not current execution authority. Manufacturing, Motion/Physics and the deferred UI redesign remain held.

## Current navigation — progress reporting

- **Legacy estimate at D444: 43%, frozen.** The former equal-row heuristic was `(7 + 15 × 0.5) / 34 = 42.65%`: seven bounded closeouts, fifteen partial rows and twelve planned/held rows. It is history, not core CAD readiness; delivered/open rows are not each 50% complete.
- **Core workflow readiness: NOT_MEASURED.** D448 covers12/12 declared action groups for one bearing-support case, reusing D447's exact-source prefix. D449 qualifies3/3 independent rectangular finishing branches; D450 qualifies3/3 selected post-Apply selection cases and9checks, without a new general matching policy. D451 qualifies1/1 current rounded Hole workflow and7links; ideal-circle accuracy remains separate. D452 qualifies2/2 ordinary Boolean workflows with8links each, plus one reverse creation control. D453 adds2/2 body-pattern workflows with8links each and a full-circle create/edit control. D454 qualifies1/1 ordinary drawing revision workflow with8groups. D455 qualifies1/1 section/detail workflow with8groups and seven actual native/Worker/SVG bindings. D456 qualifies1/1 ordinary static assembly/BOM workflow with7groups and nine native/oracle reads. D457 adds1/1 static planar-mate/link workflow with7groups and ten native bindings (four captures, six exact-document reuses). D458 adds1/1 ordinary concentric/distance workflow with7groups and eight native bindings (three captures, five exact-document reuses). D459 adds1/1 assembly drawing revision/project workflow with8groups and nine native bindings (six captures, three exact-document reuses). D461 adds1/1 ordinary line–line Round workflow with8groups and seven current native/oracle/Worker-property bindings. D462 adds1/1 ordinary BODY Mirror workflow with8groups and eight native bindings (four captures, four exact-document reuses). D463 adds1/1 ordinary partial Revolve workflow with8groups and eight native bindings (four captures, four exact-document reuses). D464 adds1/1 ordinary BODY Rotate workflow with8groups and eight native bindings (four captures, four exact-document reuses). D465 measures6/6 current-support groups with seven native bindings (two captures, five exact-document reuses); no line–arc feature is delivered. D466 measures4/4 manual-profile consumer groups with four fresh native/Python/Worker bindings; no new Round feature or history/project proof. D467 adds1/1 ordinary BODY Scale workflow with8groups and eight native bindings (four captures, four exact-document reuses). D468 adds1/1 ordinary BODY Move workflow with8groups and eight native bindings (four captures, four exact-document reuses). D469 adds1/1 terminal Scale suppression lifecycle with8groups and nine native bindings (four exact-document captures/five reuses,three physical profiles). D470 adds1/1 named-Version Restore supplement with5groups and four native bindings (three captures/one exact-document reuse). D471 adds1/1 parameter Rename/binding supplement with5groups and seven native bindings (three renamed bound-document captures/four exact reuses). D472 adds1/1 rectangular Pipe workflow with8groups and eight native bindings (four captures/four exact-document reuses). D473 adds one ordinary Loft height workflow with six groups and six native bindings (three captures/three exact-document reuses). D474 adds one face-picked Extrude Join workflow with seven groups and seven native bindings (three captures/four exact-document reuses). D475 corrects one dyadic native face Extrude height case with seven desktop groups and seven bindings (three captures/four exact-document reuses). D476 corrects one existing circular +Z native face Extrude height case with seven desktop groups and seven bindings (three captures/four exact actual-document reuses). The current known C1/C2 reproduced-defect list has FIRST-PASS CLOSEOUT through D476; this is not whole C1/C2 completion. D477 adds one C3 drawing loss/recovery loop with8/8 groups and nine native/Worker/SVG bindings (three captures/six exact reuses). Its historical related test suite retains one proven pre-existing failure. D478 now qualifies one existing shaft Drawing Fix lifecycle with7/7 checkpoints and seven bindings (three captures/four exact reuses); two checkpoints execute no Fix action. D479 adds only type-contract structural maintenance and unchanged-document smoke; it adds no feature qualification or percentage. D480 adds only mechanical transform/pattern extraction with bounded parity and one retained linear regression profile; it adds no feature percentage and preserves the matched curve limitation. D481 reproduces that one accepted6 strict-native failure with an Open8 current-consumer antecedent. D482 corrects its unsafe success by an existing typed refusal and retains8 through three actual groups; no healed6 geometry or feature percentage follows. This bounded case coverage is not a whole-CAD percentage. Report the selected category and measured case/action scope; keep legacy43% frozen and do not invent readiness, weights or scores.
- Announce the selected priority, rows and concrete task. Keep the [owner UX discussion](roadmap-rows/15.md) deferred.
- Scope labels are not percentages: **Verified scope** means recorded acceptance of the agreed bounded scope; **Delivered; open scope** means delivered profiles with broader acceptance still open; **Planned / held** retains its existing planning/owner boundary. None means whole-family, release or standards acceptance.
- State reproduced defects separately from unverified breadth. Row 12's open collaboration scope does not mean Save, native versions or local-project Open are missing.

## Current navigation — category validation cadence

- Owner request2026-11-03: work in one bounded roadmap category, collect related changes/source review, then run affected checks and an integrated Studio flow together. C1-1 is the first qualified bounded case; broad row IDs remain scope inventories.
- Retain the first failure. Repeat only failed steps and necessary antecedents, not successful category prefixes. A reproduced accuracy defect still gets an immediate minimal reproduction.
- One category milestone gets its decision/qualification and normal branch push. This does not remove independent review, final Model tsc, source freeze, physical oracles or the existing B-rep-core-only full-kernel rule.

## Current navigation — 34 scope rows

| Row | Scope and acceptance navigation | Current evidence / next boundary | Scope label |
| --- | --- | --- | --- |
| 01 | [독립 공차 프레임 — CG5 DR-6](roadmap-rows/01.md) | Bounded closeout D372. | Verified scope |
| 02 | [도면 사용 문서 연결](roadmap-rows/02.md) | Bounded documentation closeout D374. | Verified scope |
| 03 | [절삭 피처 선형 반복 — CG2](roadmap-rows/03.md) | Bounded closeout D373. | Verified scope |
| 04 | [실제 API 문서·그림·탐색 구조](roadmap-rows/04.md) | Bounded API/documentation closeout D374. | Verified scope |
| 05 | [Viewer 제품 마감과 다음 리뷰 전달](roadmap-rows/05.md) | Bounded Viewer closeout D375. | Verified scope |
| 06 | [GPU 소유 결과 인계와 다음 GPU 기능](roadmap-rows/06.md) | D434 bounded relative raster frame, physical GPU picks/native lines and shared orthographic grid correction qualified. General far/mixed-scale/unsupported profiles and other GPU features remain open. | Delivered; open scope |
| 07 | [Advanced modeling — CG1](roadmap-rows/07.md) | Delivered recorded modeling profiles; reuse D288–D316. | Delivered; open scope |
| 08 | [Feature patterns, direct editing and surfaces — CG2](roadmap-rows/08.md) | Bounded closeout D333–D347; extensions are separate. | Verified scope |
| 09 | [Advanced sketch — CG3](roadmap-rows/09.md) | BOUNDED_CLOSED for D348–D358/D366 scope. | Verified scope |
| 10 | [조립 확장 — CG4](roadmap-rows/10.md) | Qualified assembly slices D383–D393; D456 adds one parameter-distinct BOM/public project profile. D457 adds one public planar-mate/linked-update profile; D458 adds one public concentric/distance profile; D459 adds one assembly drawing revision/project profile; other static profiles remain separate and motion/physics HOLD remains. | Delivered; open scope |
| 11 | [도면 확장 — CG5 DR-6/7/8](roadmap-rows/11.md) | Qualified drawing slices through D416, D454/D455 part profiles and D459 assembly revision/project profile; general certification remains open. | Delivered; open scope |
| 12 | [파일·버전·협업 — CG6](roadmap-rows/12.md) | OPEN general file/version/collaboration scope. | Delivered; open scope |
| 13 | [교환과 손실 표시 — CG7](roadmap-rows/13.md) | OPEN exchange scope. Bounded analytic offsets D419/D436 and three native STEP round trips plus one actual far workflow D437 qualify declared profiles. D438 omits mesh-derived bbox declarations and reports their loss; D439 preserves quoted supported face strings and D441 restores bounded ASCII literal backslashes; D442 discloses selected native face/edge character loss without changing output bytes. D443 records the prior zero-offset cone refusal; D444 admits the bounded exact-zero frustum profile and retains nonzero-underflow refusals. General bbox accuracy, assemblies/presentation/PMI/other offsets/topology and general format acceptance remain open; #2263/#2248/#2266 stay open. | Delivered; open scope |
| 14 | [생산 기능 — CG8](roadmap-rows/14.md) | Planned manufacturing; P2/PG11 HOLDs remain. | Planned / held |
| 15 | [제품 사용성 — CG9](roadmap-rows/15.md) | U1–U4 and D425 quantity labels bounded closeouts; other usability work remains. | Delivered; open scope |
| 16 | [정확도·강건성·API/참조 — CG10, R7, #2210/#2215](roadmap-rows/16.md) | OPEN general robustness scope. Native/CPU/GPU profiles through D435 and D436 exact spherical-offset boundary/local representation checks qualify declared cases. D440 qualifies one current original-case native/public Open/Fit profile while its historical denominator cause stays unresolved. D444 adds necessary profile/rank guards to the bounded zero-cone identity admission. D433 remains latest full kernel. No universal geometry/raster precision claim. | Delivered; open scope |
| 17 | [경로 묶음·가상 클립 — PB0–PB4](roadmap-rows/17.md) | Existing bounded path/clip profiles; no automatic dynamics work. | Delivered; open scope |
| 18 | [관절·로봇 — J1/J2, R1/D1/R2, RS6/RS7/P4](roadmap-rows/18.md) | Existing staged robotics plan; Physics/Motion HOLD remains. | Delivered; open scope |
| 19 | [가상 실험·다물리·실측 — Stage0–6](roadmap-rows/19.md) | Existing staged experiment plan; CAE/Physics HOLDs remain. | Planned / held |
| 20 | [기즈모·핸들 드래그 UI/UX·렌더링 (2026-10-27 사용자 관찰)](roadmap-rows/20.md) | Bounded handle/UI profiles; measured drag limits remain. | Delivered; open scope |
| 21 | [Studio 도구 사이드바 배치 (2026-10-27 사용자 요청)](roadmap-rows/21.md) | Bounded sidebar/history closeouts; search/ribbon scope remains. | Delivered; open scope |
| 22 | [Kernel JavaScript performance and code shape](roadmap-rows/22.md) | Bounded performance/code-shape measurements; no universal acceptance. | Delivered; open scope |
| 23 | [대형 조립 성능 (2026-10-30 상용 공백)](roadmap-rows/23.md) | Planned large-assembly work after assembly foundations. | Planned / held |
| 24 | [곡면 품질·Class-A (2026-10-30)](roadmap-rows/24.md) | Planned Class-A scope; preserve B2/08 dependencies. | Planned / held |
| 25 | [공차 누적 해석 (2026-10-30)](roadmap-rows/25.md) | Planned tolerance-stack scope after drawing/assembly foundations. | Planned / held |
| 26 | [실제 고객 파일 회귀 (2026-10-30)](roadmap-rows/26.md) | Customer regression requires per-download permission. | Planned / held |
| 27 | [릴리스·운영 (2026-10-30)](roadmap-rows/27.md) | Release/operations decisions retain owner gates. | Planned / held |
| 28 | [교환 형식 범위·표준 부품 카탈로그 (2026-10-30)](roadmap-rows/28.md) | Format/catalog/SDK decisions retain owner gates. | Planned / held |
| 29 | [협업·PDM (2026-10-30)](roadmap-rows/29.md) | Collaboration/PDM retains server and owner gates. | Planned / held |
| 30 | [커널 일반성 (2026-10-30 엔진 리뷰)](roadmap-rows/30.md) | OPEN kernel generality; #2266 widening is deferred. | Delivered; open scope |
| 31 | [B-rep 직접 편집 (2026-10-30 엔진 리뷰)](roadmap-rows/31.md) | Planned direct editing after kernel generality. | Planned / held |
| 32 | [Viewer SDK 상용 기준 (2026-10-30 엔진 리뷰)](roadmap-rows/32.md) | Viewer commercial scope remains separately qualified. | Delivered; open scope |
| 33 | [CI 브라우저 검증 (2026-10-30 엔진 리뷰)](roadmap-rows/33.md) | Local-only browser verification boundary D359; no CI restart. | Planned / held |
| 34 | [단위 접미사 이름 정리 R7.7 (2026-10-30 엔진 리뷰)](roadmap-rows/34.md) | R7.7 quiet boundary; no schema5/migration authority. | Planned / held |

## Current navigation — holds and evidence

- Rows 13, 16 and 30 remain OPEN. D417/D419 qualify bounded admission/refusal fixes; NURBS limits remain unchanged.
- Motion/Physics and virtual experiment gates remain. Pose, kinematics and static results are not dynamics qualification.
- CAM/postprocessor/nesting retain P2/PG11 and NOT FOR PRODUCTION boundaries; no automatic implementation.
- New dependencies, external SDKs, services, release/deployment and downloads retain their existing owner gates.
- Browser CI remains local-only under D359. Do not recreate the reverted WebGPU CI job.
- Native schema3/4 authority remains; no schema5 or migration authorization is introduced.
- Preserve accepted history, original failures, refusal limits, references and authored values.
- Product changes require their own tier, source review, checks and actual flow. D418 is documentation only.

## Current navigation — how to use the records

1. Read this index for current status and the selected row for scope/acceptance/dependencies.
2. Read the canonical item note and qualification for measured claims, failure history and limits.
3. Use the immutable archives for historical wording and authority. Do not copy historical status into new status tables.
4. Update this index and the new canonical item note at a qualified milestone; do not create another full-text archive.

<!-- D418 LEGACY COMPATIBILITY BEGIN: fixed original heading sequence -->
<details>
<summary>Legacy heading compatibility (historical navigation)</summary>

Each original heading links directly to its section in the byte-exact archive.

# barocss CAD roadmap

[Read archived section](roadmap-history-through-D417.md#barocss-cad-roadmap)

## Current execution index — 2026-10-30

[Read archived section](roadmap-history-through-D417.md#current-execution-index-%E2%80%94-2026-10-30)

### 현재 마감할 항목

[Read archived section](roadmap-history-through-D417.md#%E1%84%92%E1%85%A7%E1%86%AB%E1%84%8C%E1%85%A2-%E1%84%86%E1%85%A1%E1%84%80%E1%85%A1%E1%86%B7%E1%84%92%E1%85%A1%E1%86%AF-%E1%84%92%E1%85%A1%E1%86%BC%E1%84%86%E1%85%A9%E1%86%A8)

### 남은 기능 묶음

[Read archived section](roadmap-history-through-D417.md#%E1%84%82%E1%85%A1%E1%86%B7%E1%84%8B%E1%85%B3%E1%86%AB-%E1%84%80%E1%85%B5%E1%84%82%E1%85%B3%E1%86%BC-%E1%84%86%E1%85%AE%E1%86%A9%E1%84%8B%E1%85%B3%E1%86%B7)

### 07 delivery ledger — reconciled 2026-10-29

[Read archived section](roadmap-history-through-D417.md#_07-delivery-ledger-%E2%80%94-reconciled-2026-10-29)

### GitHub research reconciliation — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#github-research-reconciliation-%E2%80%94-2026-10-29)

### Static engine-audit follow-ups — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#static-engine-audit-follow-ups-%E2%80%94-2026-10-29)

### Native OPFS conditional-write report — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#native-opfs-conditional-write-report-%E2%80%94-2026-10-29)

### Controlled Stop wrong-edit rollback — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#controlled-stop-wrong-edit-rollback-%E2%80%94-2026-10-29)

### Original skeleton-file independent reader supplement — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#original-skeleton-file-independent-reader-supplement-%E2%80%94-2026-10-29)

### Later independent receipt and exact original UI supplements — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#later-independent-receipt-and-exact-original-ui-supplements-%E2%80%94-2026-10-29)

### Additional package acceptance gates — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#additional-package-acceptance-gates-%E2%80%94-2026-10-29)

### GitHub issue intake after the 2026-10-29 reconciliation — 2026-10-30

[Read archived section](roadmap-history-through-D417.md#github-issue-intake-after-the-2026-10-29-reconciliation-%E2%80%94-2026-10-30)

### 제품 완료와 인계의 공통 조건

[Read archived section](roadmap-history-through-D417.md#%E1%84%8C%E1%85%A6%E1%84%91%E1%85%AE%E1%86%B7-%E1%84%8B%E1%85%AA%E1%86%AB%E1%84%85%E1%85%AD%E1%84%8B%E1%85%AA-%E1%84%8B%E1%85%B5%E1%86%AB%E1%84%80%E1%85%A8%E1%84%8B%E1%85%B4-%E1%84%80%E1%85%A9%E1%86%BC%E1%84%90%E1%85%A9%E1%86%BC-%E1%84%8C%E1%85%A9%E1%84%80%E1%85%A5%E1%86%AB)

## Historical contracts and execution records

[Read archived section](roadmap-history-through-D417.md#historical-contracts-and-execution-records)

## Foundation before Studio (owner order, 2026-10-26)

[Read archived section](roadmap-history-through-D417.md#foundation-before-studio-owner-order-2026-10-26)

## Joint and robot completion plan (owner update, 2026-10-27)

[Read archived section](roadmap-history-through-D417.md#joint-and-robot-completion-plan-owner-update-2026-10-27)

## Goal and staged expansion (2026-10-25)

[Read archived section](roadmap-history-through-D417.md#goal-and-staged-expansion-2026-10-25)

### First implementation boundary

[Read archived section](roadmap-history-through-D417.md#first-implementation-boundary)

## Reliability priorities from research index 2214

[Read archived section](roadmap-history-through-D417.md#reliability-priorities-from-research-index-2214)

## CAD result acceptance: review 2215

[Read archived section](roadmap-history-through-D417.md#cad-result-acceptance-review-2215)

### Delivery and cross-owner resolution

[Read archived section](roadmap-history-through-D417.md#delivery-and-cross-owner-resolution)

## Workflow completion cases from SolidCraft

[Read archived section](roadmap-history-through-D417.md#workflow-completion-cases-from-solidcraft)

## Shared route bundles and virtual clips (Zip Ties)

[Read archived section](roadmap-history-through-D417.md#shared-route-bundles-and-virtual-clips-zip-ties)

## CAD-to-simulation handoff: issue 2209 planning boundary

[Read archived section](roadmap-history-through-D417.md#cad-to-simulation-handoff-issue-2209-planning-boundary)

## Completion gates for virtual experiments

[Read archived section](roadmap-history-through-D417.md#completion-gates-for-virtual-experiments)

## Reporting experiment progress

[Read archived section](roadmap-history-through-D417.md#reporting-experiment-progress)

## Order now (2026-10-27)

[Read archived section](roadmap-history-through-D417.md#order-now-2026-10-27)

### Near-term delivery ownership (2026-10-26)

[Read archived section](roadmap-history-through-D417.md#near-term-delivery-ownership-2026-10-26)

## Historical lane order (2026-10-25, owner: "필요한 것들 로드맵에 추가 해서 진행해줘")

[Read archived section](roadmap-history-through-D417.md#historical-lane-order-2026-10-25-owner-%E1%84%91%E1%85%B5%E1%86%AF%E1%84%8B%E1%85%AD%E1%84%92%E1%85%A1%E1%86%AB-%E1%84%80%E1%85%A5%E1%86%BA%E1%84%83%E1%85%B3%E1%86%AF-%E1%84%85%E1%85%A9%E1%84%83%E1%85%B3%E1%84%86%E1%85%A2%E1%86%B8%E1%84%8B%E1%85%A6-%E1%84%8E%E1%85%AE%E1%84%80%E1%85%A1-%E1%84%92%E1%85%A2%E1%84%89%E1%85%A5-%E1%84%8C%E1%85%B5%E1%86%AB%E1%84%92%E1%85%A2%E1%86%BC%E1%84%92%E1%85%A2%E1%84%8C%E1%85%AF)

## Codex lane ownership and R7 readiness (2026-10-24)

[Read archived section](roadmap-history-through-D417.md#codex-lane-ownership-and-r7-readiness-2026-10-24)

### Historical R7 preparation and hold records

[Read archived section](roadmap-history-through-D417.md#historical-r7-preparation-and-hold-records)

### Historical residual work assignments (2026-10-25, before final qualification)

[Read archived section](roadmap-history-through-D417.md#historical-residual-work-assignments-2026-10-25-before-final-qualification)

## Where we are

[Read archived section](roadmap-history-through-D417.md#where-we-are)

## Phase 0: only what a green baseline needs, now

[Read archived section](roadmap-history-through-D417.md#phase-0-only-what-a-green-baseline-needs-now)

## Phase 1: the roadmap, per lane (starts as each lane's Phase 0 items close)

[Read archived section](roadmap-history-through-D417.md#phase-1-the-roadmap-per-lane-starts-as-each-lane-s-phase-0-items-close)

### Kernel lane: finish the frame track (FRk)

[Read archived section](roadmap-history-through-D417.md#kernel-lane-finish-the-frame-track-frk)

### Outer lane: A9, brief → buyable, manufacturable product

[Read archived section](roadmap-history-through-D417.md#outer-lane-a9-brief-%E2%86%92-buyable-manufacturable-product)

### GPU lane: viewer track G21–G25

[Read archived section](roadmap-history-through-D417.md#gpu-lane-viewer-track-g21%E2%80%93g25)

### Next items (2026-10-23)

[Read archived section](roadmap-history-through-D417.md#next-items-2026-10-23)

### Robot samples and motion (owner, 2026-10-24)

[Read archived section](roadmap-history-through-D417.md#robot-samples-and-motion-owner-2026-10-24)

### Real products (owner, 2026-10-24)

[Read archived section](roadmap-history-through-D417.md#real-products-owner-2026-10-24)

### Photoreal rendering G15 (owner, 2026-10-24)

[Read archived section](roadmap-history-through-D417.md#photoreal-rendering-g15-owner-2026-10-24)

### Toward commercial grade (2026-10-24; the owner's order: CG1, CG2, CG5, CG6 first)

[Read archived section](roadmap-history-through-D417.md#toward-commercial-grade-2026-10-24-the-owner-s-order-cg1-cg2-cg5-cg6-first)

### RS7: rotor head and swashplate (owner, 2026-10-25)

[Read archived section](roadmap-history-through-D417.md#rs7-rotor-head-and-swashplate-owner-2026-10-25)

## Phase R: refactoring, once the current items close (owner, 2026-10-23)

[Read archived section](roadmap-history-through-D417.md#phase-r-refactoring-once-the-current-items-close-owner-2026-10-23)

## Item index (one line each; the /lanes pane shows the owner's Korean title after " · ko: ")

[Read archived section](roadmap-history-through-D417.md#item-index-one-line-each-the-lanes-pane-shows-the-owner-s-korean-title-after-%C2%B7-ko)

## Later (on the roadmap, not started)

[Read archived section](roadmap-history-through-D417.md#later-on-the-roadmap-not-started)

## Waiting on the owner

[Read archived section](roadmap-history-through-D417.md#waiting-on-the-owner)

## Off the roadmap (owner decisions)

[Read archived section](roadmap-history-through-D417.md#off-the-roadmap-owner-decisions)

## Viewer SDK and app delivery (dedicated Work, updated 2026-10-27)

[Read archived section](roadmap-history-through-D417.md#viewer-sdk-and-app-delivery-dedicated-work-updated-2026-10-27)

### D321 originating-work Stop qualification — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#d321-originating-work-stop-qualification-%E2%80%94-2026-10-29)

### Viewer app review and design proposal intake — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#viewer-app-review-and-design-proposal-intake-%E2%80%94-2026-10-29)

### D322 late Save ownership qualification — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#d322-late-save-ownership-qualification-%E2%80%94-2026-10-29)

### Viewer draft asserted UI evidence supplement — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#viewer-draft-asserted-ui-evidence-supplement-%E2%80%94-2026-10-29)

### D323 canonical snapshot qualification — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#d323-canonical-snapshot-qualification-%E2%80%94-2026-10-29)

### D322 independent author-receipt review supplement — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#d322-independent-author-receipt-review-supplement-%E2%80%94-2026-10-29)

### D324 delayed GPU pick ownership qualification — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#d324-delayed-gpu-pick-ownership-qualification-%E2%80%94-2026-10-29)

### D321 independent review and Render-history evidence correction — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#d321-independent-review-and-render-history-evidence-correction-%E2%80%94-2026-10-29)

### Studio modernization proposal intake — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#studio-modernization-proposal-intake-%E2%80%94-2026-10-29)

### D325 clipping boundary and next priority — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#d325-clipping-boundary-and-next-priority-%E2%80%94-2026-10-29)

### Direct owner priority — App decomposition, 2026-10-29

[Read archived section](roadmap-history-through-D417.md#direct-owner-priority-%E2%80%94-app-decomposition-2026-10-29)

### D326 selected qualification — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#d326-selected-qualification-%E2%80%94-2026-10-29)

### GPU material authoring and Studio evidence intake — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#gpu-material-authoring-and-studio-evidence-intake-%E2%80%94-2026-10-29)

### D327 direct-priority App decomposition — complete locally (2026-10-29)

[Read archived section](roadmap-history-through-D417.md#d327-direct-priority-app-decomposition-%E2%80%94-complete-locally-2026-10-29)

### Drawing assistant and material-map evidence intake — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#drawing-assistant-and-material-map-evidence-intake-%E2%80%94-2026-10-29)

### DA-1a supplementary document/API receipt — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#da-1a-supplementary-document-api-receipt-%E2%80%94-2026-10-29)

### D328 second App decomposition — qualified (2026-10-29)

[Read archived section](roadmap-history-through-D417.md#d328-second-app-decomposition-%E2%80%94-qualified-2026-10-29)

### DA-1c supplementary fix and standalone SVG evidence — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#da-1c-supplementary-fix-and-standalone-svg-evidence-%E2%80%94-2026-10-29)

### DA-DUP-1 — P2 independent-hole location dimension removed as duplicate (2026-10-29)

[Read archived section](roadmap-history-through-D417.md#da-dup-1-%E2%80%94-p2-independent-hole-location-dimension-removed-as-duplicate-2026-10-29)

### DA-DUP-1 runtime differential supplement — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#da-dup-1-runtime-differential-supplement-%E2%80%94-2026-10-29)

### D323/A04 snapshot retained-receipt review — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#d323-a04-snapshot-retained-receipt-review-%E2%80%94-2026-10-29)

### D324/A07 delayed pick retained-receipt review — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#d324-a07-delayed-pick-retained-receipt-review-%E2%80%94-2026-10-29)

### D325/A08 clipping retained-receipt review — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#d325-a08-clipping-retained-receipt-review-%E2%80%94-2026-10-29)

### D326 selected Open ownership retained-receipt review — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#d326-selected-open-ownership-retained-receipt-review-%E2%80%94-2026-10-29)

### GPU003 fresh owned logical-device recovery evidence — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#gpu003-fresh-owned-logical-device-recovery-evidence-%E2%80%94-2026-10-29)

### GPU004 custom CSS/live-uniform recovery evidence — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#gpu004-custom-css-live-uniform-recovery-evidence-%E2%80%94-2026-10-29)

### GPU005 packed texture-map recovery evidence — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#gpu005-packed-texture-map-recovery-evidence-%E2%80%94-2026-10-29)

### GPU006 two-instance recovery and reorder evidence — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#gpu006-two-instance-recovery-and-reorder-evidence-%E2%80%94-2026-10-29)

### D329 nonserialized import and stage ownership — qualified (2026-10-29)

[Read archived section](roadmap-history-through-D417.md#d329-nonserialized-import-and-stage-ownership-%E2%80%94-qualified-2026-10-29)

### Further App decomposition candidate — owner feedback, 2026-10-29

[Read archived section](roadmap-history-through-D417.md#further-app-decomposition-candidate-%E2%80%94-owner-feedback-2026-10-29)

### Commercial-readiness issue intake and bounded Studio recovery — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#commercial-readiness-issue-intake-and-bounded-studio-recovery-%E2%80%94-2026-10-29)

### D330 Worker and wire lifetime — qualified (2026-10-29)

[Read archived section](roadmap-history-through-D417.md#d330-worker-and-wire-lifetime-%E2%80%94-qualified-2026-10-29)

### D331 independent drawing location ownership — qualified (2026-10-29)

[Read archived section](roadmap-history-through-D417.md#d331-independent-drawing-location-ownership-%E2%80%94-qualified-2026-10-29)

### Direct owner priority: selection visibility — D332, 2026-10-29

[Read archived section](roadmap-history-through-D417.md#direct-owner-priority-selection-visibility-%E2%80%94-d332-2026-10-29)

### D332 base selection visibility — qualified (2026-10-29)

[Read archived section](roadmap-history-through-D417.md#d332-base-selection-visibility-%E2%80%94-qualified-2026-10-29)

### Existing Model/drawing review supplement — intake only, 2026-10-29

[Read archived section](roadmap-history-through-D417.md#existing-model-drawing-review-supplement-%E2%80%94-intake-only-2026-10-29)

### Electron execution validation — queued under15 desktop (owner, 2026-10-29)

[Read archived section](roadmap-history-through-D417.md#electron-execution-validation-%E2%80%94-queued-under15-desktop-owner-2026-10-29)

### D333 rectangular two-axis cut feature pattern — qualified (2026-10-29)

[Read archived section](roadmap-history-through-D417.md#d333-rectangular-two-axis-cut-feature-pattern-%E2%80%94-qualified-2026-10-29)

### Existing API/domain boundary review — intake only, 2026-10-29

[Read archived section](roadmap-history-through-D417.md#existing-api-domain-boundary-review-%E2%80%94-intake-only-2026-10-29)

### D343 — Longitudinal mass and actual Offset result qualification (2026-10-30)

[Read archived section](roadmap-history-through-D417.md#d343-%E2%80%94-longitudinal-mass-and-actual-offset-result-qualification-2026-10-30)

### D344 — Native whole-patch conditioning and default STEP proof (2026-10-30)

[Read archived section](roadmap-history-through-D417.md#d344-%E2%80%94-native-whole-patch-conditioning-and-default-step-proof-2026-10-30)

<a id="additional-package-acceptance-gates--2026-10-29"></a>

[Read archived package acceptance section](roadmap-history-through-D417.md#additional-package-acceptance-gates-%E2%80%94-2026-10-29)

</details>
<!-- D418 LEGACY COMPATIBILITY END -->
