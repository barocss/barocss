# D911 — define a versioned rounded inset recipe and its admission

2026-11-13 · SMALL · P1 rows 09 and 16 · [#2232](https://github.com/barocss/barocss/issues/2232) stays open.

Choose a distinct `rounded-rectangle-inset` sketch producer kind with version 1. The older schema 3 and 4 reader rejects unknown feature kinds. An extra property on an ordinary sketch could instead leave the saved profile active while ignoring the recipe. [D833](../linear-pattern-span-compatibility-2026-11-12/README.md) verified this distinction in the existing reader. Keep the existing schema numbers and planar-face inset contract.

## First stored scope

- The stored node contains the earlier sketch index, its explicit unique feature ID, the positive inset distance and a one-to-one map from all eight source IDs to reserved derived IDs. It carries no authoritative materialized profile. Index changes must follow the existing graph renumbering. Source identity must still match after renumbering.
- Admit one independent numeric XY loop with the D910 quarter-arc profile, no placement, holes, separate regions, construction or other association. Validate the saved native segment centers, endpoints, traversal and explicit side tags before reconstructing the source. A reconstructed bulge alone cannot establish that a saved arc endpoint lies on its saved circle.
- Start with one source, one recipe and one positive direct ordinary Extrude in the complete saved document. Permit the legitimate source-only and source-plus-recipe history prefixes during internal evaluation. Treat the recipe as a non-solid in the graph and in Studio history. Unsupported dependent features, placement and reference-bearing ancillary sections must refuse at this boundary. Ordinary sketch editing and automatic flattening must refuse the recipe.
- Lower from the current source via D910. Validate the stored recipe and current geometry on both native File Open and browser Project Open before replacing the accepted document. Detect a direct reference to a retired side of the recipe's own Extrude before signature matching. Keep generic marked rematch for ordinary documents, as [D909](../rounded-sketch-offset-missing-corner-2026-11-13/README.md) measured.
- Verify valid 1/2/2.5/1 native readback, exact file persistence, legacy unknown-kind refusal, malformed or duplicate source IDs, rejected consumers and a direct retired-corner Fillet without a changed accepted document. Live distance editing and detach are later steps.

## Verification

- **PASS** Desktop Studio reran the existing straight linked-inset consumer. Creation, independent Extrude, source width edit, Undo/Redo, invalid loose File and Project Open, and superseded invalid replies all passed. The accepted geometry and selection stayed current on invalid Open.
- **PASS** Independent source and architecture review, 30 Model tests, 16 Studio tests and diff checks.
- **FAIL** The first browser run reached its 10 s navigation cap before any product interaction. The retry uses the 30 s cap already used by the Round driver.
- **NOT_RUN** Implementation or runtime acceptance of the new recipe, live distance editing, arbitrary curves, full suites and mobile.

[Commands and receipt hashes](qualification.json).
