---
work_id: D445
artifact_type: roadmap-priority-and-handoff
status: done
owner_role: executor
source_request: "Prioritize core CAD, explain bounded status, update the roadmap, and prepare Claude handoff after develop integration"
last_updated: 2026-11-02
---

# Core CAD priority and acceptance plan

The owner requested an order based on everyday CAD usefulness, then asked to continue in Claude and integrate all completed work into the changed develop branch. This record changes execution priority and documentation. It adds no product behavior or new geometry acceptance. [Current roadmap](../../roadmap.md) remains the single status index; [Claude handoff](../claude-handoff-2026-11-02/README.md) is the entry point.

## Priority authority

C1 reliable everyday part workflow comes first; C2 common modeling robustness follows; C3 engineering handoff covers common exchange and drawings; C4 basic assemblies follows; C5 usability and scale, C6 advanced surfaces/generality, C7 ecosystem and C8 separately held tracks follow under their existing gates. The roadmap maps these priorities to the unchanged 34 row IDs. This owner-requested order supersedes only the old handoff's 10 → 11 → 13 → 14 execution order. Safety rules, qualification tiers and explicit HOLDs remain.

This order is engineering judgment, not a vendor benchmark. The ordinary sketch/feature/history workflow is consistent with the primary descriptions of [parametric timeline editing](https://help.autodesk.com/cloudhelp/ENU/Fusion-Designs/files/ASM-USE-TIMELINE.htm) and [sketch profiles and constraints](https://help.autodesk.com/view/fusion360/ENU/?contextId=SKT-3D-SKETCH).

D446 is reserved for the now-authorized develop integration. The next CAD feature task after that integration is C1-1, using the next unallocated decision number (expected D447). Do not restart the stopped source-only nonzero-cone proposal under D445. It produced no product edits, build or actual Studio run; uncommon nonzero-cone admission is deferred unless a concrete C1/C3 task requires it.

## What the status labels mean

“Verified scope” means that the cited bounded acceptance is recorded. It does not certify the entire family. “Delivered; open scope” means useful behavior exists and additional declared scope remains open. “Planned / held” retains the existing dependency or owner gate. None of these labels is a percentage.

Examples: D444 admits the declared exact-zero cone frustum while general nonzero offsets remain open. Row 09 already has accepted basic sketch editing/constraints and saved-document flows while advanced conic/open-spline/general-conflict scope remains separate. Row 12 already has native/local-project Save, fresh Open and version/history behavior; its open collaboration/PDM scope does not mean Save is absent. Do not rebuild delivered features merely because a broad row remains open.

The old estimate of 43% is frozen at D444: (7 verified rows + 15 open rows × 0.5) / 34 = 42.65%. That historical equal-row heuristic is not core-CAD readiness, and an open row is not measured as 50% done. Core workflow readiness is NOT_MEASURED. Report measured N/M acceptance coverage only after defining the cases and checking retained evidence; do not invent a new percentage.

## C1-1: first acceptance audit

Use one ordinary bearing-support or bracket workflow: dimension/constrain a rectangular sketch; extrude; revolve a boss and combine it; create a hole/cut and outer fillet; edit an upstream width and rebuild; check surviving feature references, dimensions and physical quantities; Undo/Redo; verify a deliberately invalid fillet retains the last accepted state; Save through the isolated local-project flow and fresh Open, then re-edit. Choose explicit native/analytic expectations and tolerances before a new run. Render meshes alone are not geometry oracles.

First inventory retained acceptance and source. Reuse D349's sketch/reopen identity, D377's downstream-feature drag retention and D380's typed handle/Save/fresh Open receipts for their exact scopes. D378 is a GPU branch merge, not a fillet/Save proof. The [row09 scope ledger](../roadmap09-scope-ledger-2026-10-30/README.md) records advanced gaps. D412 qualifies the single Fillet UI command, not arbitrary fillet geometry. Run only uncovered or changed steps. Fix the first reproducible functional or accuracy failure as one bounded item, with its own decision, required tier, actual Studio proof and normal push.

Source entry points include `apps/cad-studio/src/sketch/useSketchActions.ts`, `src/ui/SketchPanel.tsx`, `src/state/useFeatureHistory.ts`, `src/ui/MeasurementInspector.tsx`, `src/ui/SelectionInspector.tsx`, `src/files/documentFile.ts` and `src/storage/useProject.ts`. They establish existing implementation, not new product acceptance. No C1-1 end-to-end run has been performed for this documentation change.

## Validation and limits

Documentation-only maintenance: navigation, exact archive hashes, unchanged product/runtime source and diff checks. No new Studio run, kernel suite, build or type check is claimed by D445. D444's retained actual/runtime receipts remain scoped historical evidence; they do not qualify C1-1. Qualification commands and results are in [qualification.json](qualification.json).

UI redesign remains deferred for owner discussion. #2258 public-thicken/fitter, #2266 widening, manufacturing P2/PG11, new CAD Physics/Motion work, schema5/migration, browser CI, downloads, paid runs and release retain their gates. Existing develop Physics work is preserved by the authorized integration; that is not permission to start a new Physics campaign. General STEP/exchange, robustness and research issues remain open; a documentation reorder satisfies none of their remaining acceptance criteria.
