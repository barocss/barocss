# D783 — Verify the bowed guided Loft edit lifecycle

P1, rows 07, 12 and 16. SMALL qualification of the existing behavior. The prior native quadratic guide fixture supplies two parallel ruled sections at Z0 and Z20. Both sections use the same rectangular sketch. The browser opens this exact fixture and edits it with the existing feature editor.

| Result | Check |
| --- | --- |
| PASS | The width edit changes both sections from 10 × 10 to 12 × 10 mm. The native guide, sketch and Loft identities remain fixed. An attempted Corner X change to 1 mm moves the shared section away from the guide anchor. Studio names Loft `n1` in the refusal and retains the accepted document, body and history. A separate native evaluation returns `GEOMETRY` at `n1`. |
| PASS | First Undo restores 10 × 10 mm. First Redo restores 12 × 10 mm. Project Save writes the exact accepted document. A page reload and project Open recover that document. The depth can then be changed to 14 mm in the same Loft editor. |
| PASS | Six independent Python reads agree with native and current Studio volume and centroid. The 10 × 10, 12 × 10 and 12 × 14 mm profiles give 2,000, 2,400 and 3,360 mm³, respectively. The centroids are (31/5, 17/3, 10), (36/5, 17/3, 10) and (36/5, 23/3, 10) mm. The absolute tolerance is 1e-8. |
| PASS | Each strict B-rep contains one closed shell, eight vertices, twelve edges and six faces. Nine native seam samples agree with the independent piecewise polynomial. The seam retains its ID and opposite twin uses on the same two side faces. Sol High reviewed the exact integrals, stable identities and refusal fixture. |
| PASS | Model focused tests 35/35, Model type check, driver syntax and diff checks. Visual review covers the inline refusal, reopened geometry and post-Open depth edit. The final desktop run has zero unexpected errors and downloads. |
| FAIL, first desktop driver | An exact accessible-name locator could not find the tab input while the dirty indicator was present. The fixture was already open under the correct name. The final driver verifies that name and uses the normal Save button. |
| NOT_RUN | Full suites, mobile, other guide degrees or rational weights, tilted sections, guide authoring and export. |

[Commands and receipt digests](qualification.json). This qualifies one already supported Loft profile. B04 v1 remains 26/26. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. The core parametric features epic remains open. [#534](https://github.com/barocss/barocss/issues/534).
