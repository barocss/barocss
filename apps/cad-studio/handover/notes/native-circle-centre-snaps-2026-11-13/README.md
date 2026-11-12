# D855 — Use native circular edge centres for sketch snapping

P1, rows 09 and 16. FULL for the native geometry admission change. The mesh producer reads a circular support only from compatible rational quadratic Bézier spans. It checks the clamped knots, weights and tangent pole for every span. Merged display edges keep a centre only when all native members share the same support. Rigid placement and exploded translation move the metadata with the mesh. Sketch snapping checks the whole support against the current plane and requires a visible nonzero segment.

| Result | Check |
| --- | --- |
| FAIL | The unchanged Studio attached an XZ rectangle to the false Loft centre (−8.5937, 10.3516) mm. The native edge is polynomial. Its points follow X = 20t(1−t) and Z = 20t. The three chosen display points fit one circle. A fourth point has squared-radius residual 3.90625 mm². The baseline driver passed its assertions of the defect. |
| PASS | Current Studio gives no Centre cue at the same Loft pointer. The resulting rectangle uses grid point (−9, 10) mm. The existing End and Middle cues remain. Cancel, first Undo and Redo preserve the intended state. Browser project Save writes 1577 bytes, and a fresh File Open preserves the exact Loft and sketch coordinates. |
| PASS | The actual XZ R3 cylinder still offers Centre at (30.375, 8.625) mm. The real click records those coordinates. Native cylindrical geometry and volume 36π mm³ agree. The D746 hidden-body and visible-end desktop regression passes. |
| PASS | Model covers the six-sample ellipse, polynomial Loft at three tessellation qualities, unchanged segment-order results, valid small arcs, malformed coefficients, mixed span supports, off-plane exclusion, native Hole, Worker mesh transport and body placement. A partial CPU-clipped rim keeps its centre. A tangent-only rim has no visible arc and supplies no centre. |
| FAIL | An initial native classifier admitted a shallow middle pole perturbed by 5e−8 mm under the absolute tolerance alone. The final proof uses the perpendicular component and a bound relative to the expected pole height. Independent review also found the tangent-only clipping case, which the final visibility check rejects. |
| PASS | Model 78/78, Studio 80/80, both type checks, scoped lint, driver syntax, production build, diff check and root visual review. The control passes and all six mutations fail their designated assertions. |
| NOT_RUN | An ellipse-specific centre feature, general rational reparameterizations of circles, same-project UI reopen, other browsers and full test suites. |

[Issue #2299](https://github.com/barocss/barocss/issues/2299) covers the false circle centre defect. D856 moves to identifying geometry from existing sketch constraint rows. Initial scenarios remain **8/10**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
