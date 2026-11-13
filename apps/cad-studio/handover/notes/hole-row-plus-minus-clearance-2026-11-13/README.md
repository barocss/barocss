# D937 — clear the counted tolerance label in the hole-row drawing

2026-11-13 · P2 rows 11 and 16 · SMALL drawing placement repair

In desktop Studio, Accept all in ± mode on the hole-row plate produced `TEXT_OVER_LINES` for Top dimension `d1`. The 25.4905 mm inline label crossed its two extension strokes. It displayed `3× 20 +0.2/-0.21` from the existing inward-rounding policy on the resolved nominal.

- **PASS** If ordinary placement fails, the automatic plain-mm counted horizontal dimension above an unbroken Top view can stack the exact printed limits when its inline text crosses its own extension. The new layout requires a printable asymmetric display of a stored symmetric tolerance, checks the full label against existing obstacles, and retains the ruler, heads and extensions.
- **PASS** Studio reproduced one warning on the parent and showed zero after the repair. Accept all, first Undo, first Redo and actual A4 SVG passed. Parent and candidate accepted documents compare equal. Only d1 text changed. Its saved ±0.21, nominal 20 mm, references, pattern count, neighboring tolerances and both hole callouts stayed equal.
- **PASS** Independent paper-mm checks found a 15.2545 mm label with 2.24775 mm clearance to each extension stroke and 1.2 mm to the arrowheads. The final 2.65 mm deviation baseline spacing leaves 0.1 mm between the conservative text bounds. The SVG has the original `3× 20`, `+0.2` and `-0.21` in the same dimension group at the checked coordinates.
- **PASS** Model 92/92, Studio roundtrip 4/4, D934–D936 desktop regressions, both type checks, driver syntax, diff check and independent Sol High source review.
- **FAIL** The initial candidate's 2.1 mm deviation baseline spacing left a 0.45 mm overlap of the conservative text bounds. The final candidate passed the revised check.
- **NOT_RUN** Actual DXF, PDF, production build, full suites and mobile. B06 remains 6/7 with PDF held.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
