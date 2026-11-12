# D834 — Store and edit a fixed linear pattern span

P1, rows 08 and 16. FULL for a saved Model feature kind. `linear-span-pattern` stores one literal Total span and a Count from 2 to the native maximum of 64. It derives spacing as span / (count − 1) and uses the existing native linear pattern with the same target, axis and feature ID. The Model checks numeric limits, a preceding reference and contradictory stored fields. The feature editor shows the derived spacing and edits the two literal inputs. [D833](../linear-pattern-span-compatibility-2026-11-12/README.md) qualifies the older top-level reader refusal.

| Result | Check |
| --- | --- |
| FAIL | The first Model test run stopped during module initialization because the new module read node extras at module scope through a circular import. The validator now reads them when called. |
| PASS | Sol High reviewed native lowering, name ownership, spacing and copy limits, and the physical oracle. Model tests compare exact compiled features and B-reps for X, Y and Z, including fractional spacing. Copy suffixes remain ordinal. A fixed last position can belong to a different copy name after a Count edit. |
| PASS | Actual Studio opens Count 4 at 90 mm and edits it to Count 6. The pitch changes from 30 to 18 mm. The endpoints remain X = 30 and 120 mm and the overall width remains 100 mm. The one output has 4 and 6 closed native solids, 32 and 48 corners, and volumes 1920 and 2880 mm³. Each output B-rep matches an equivalent legacy pitch control exactly. |
| PASS | Count 1 and a file with an extra stored spacing both fail without changing the accepted document, geometry, selection, dirty state or history. First Undo and Redo restore Count 4 and Count 6. |
| PASS | Editing the source width from 10 to 12 mm preserves the 90 mm span and gives overall width 102 mm, 3456 mm³ and centroid (81, 13, 4) mm. The exact 674-byte project reopens after reload. Count 5 derives 22.5 mm spacing and retains the endpoints and 102 mm width. |
| PASS | The D832 legacy pitch flow passes in current Studio. Model 47/47, Studio 48/48, types, lint, browser syntax, build and diff check pass. The Model control passes and all six single-source mutations fail at their designated assertions. Root reviewed the actual desktop images. |
| NOT_RUN | Creation HUD, mode conversion, handle drags, raw agent authoring, actual Count 64 geometry, full suites, mobile and other browsers. |

[Issue #2386](https://github.com/barocss/barocss/issues/2386) remains open. Next D835 adds explicit Total span authoring and validates its creation preview. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
