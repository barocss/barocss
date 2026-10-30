# D335 Studio source status

Source FINAL. Studio heavy slot released. Focused fill tests5/5, existing direct curve7/7, existing stop ownership13/13 PASS. Studio tsc PASS after one doc-context type adaptation. Vite build PASS. Changed-file ESLint PASS. git diff --check PASS. Browser NOT_RUN by Studio worker; root owns browser proof.

- App feature editor uses preparePatternNodeCandidate for curve/fill recipe edits, then existing stageCurveCandidate and owned candidate Worker.
- The candidate retains accepted document, IDs and history until existing acceptance completes. Existing cancel/Escape/Stop/Open invalidation is reused.
- Fill pending: Checking the fill cut pattern…; fill refusal: Fill cut pattern not changed. Existing direct geometry refusal title unchanged.
- HUD and NodeEditor share exact snapshot/reference hint text.
- Snapshot region editing uses shared Model editFields with Current region snapshot sentinel; choosing a sketch captures copied numeric vertices.
- No new live snapshot source dependency or direct epoch.

Focused file: apps/cad-studio/test/fill-pattern-candidate.test.ts (5 tests); checks real candidate helper, actual editor numeric/region fields and existing ownership boundary. These focused checks do not prove App/browser acceptance.

GUI selectors: dialog Fill cut pattern; fields Region snapshot, Reference X, Reference Y, X spacing, Columns, Y spacing, Rows; .node-editor Apply. History group History, button Fill cut pattern 4 × 3 and data-node-index; click edits; double-click rolls back.

First failures retained: focused-first-failure.txt (test omitted GUI H/V metadata; fixture corrected, no product change); types.txt (NodeEditor doc type lacked Model-required parameters; type adapted). Final fill rerun focused-fill-final.txt; tsc types-final.txt; Vite vite.txt; ESLint lint.txt. No commit, push, handover edits or browser run.
