# D943 — retire the drawing-dimension removal notice after Undo

2026-11-13 · P2 rows 11 and 16 · SMALL feedback repair

- **FAIL on the parent** The D942 actual Studio screenshot after Undo showed “Removed 2 drawing dimensions” while both dimensions were already restored.
- **PASS** The existing document-source guard now owns successful feature or selection deletion notices about removed drawing dimensions. The notice appears for the accepted delete. After Undo restores the earlier document the stale notice disappears. Redo returns the exact deleted document without reviving the notice. The restored actual SVG is byte-identical to the D942 original.
- **PASS** The actual tolerance-acceptance notice remains visible across its Undo. The source guard is applied only to the two existing successful drawing-dimension removal notices. Studio roundtrip 4/4, Studio type check, driver syntax and diff check pass.
- **NOT_RUN** Separate selection Delete pointer flow, production build, full suites, PDF and mobile. #2322 stays open for the remaining clipped-arc profiles. B06 remains 6/7 with PDF held.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
