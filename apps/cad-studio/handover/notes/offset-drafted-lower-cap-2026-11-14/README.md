# D1255 — Move the lower cap of a rectangular taper

2026-11-14 · FULL · P5, rows 08 and 31 · [#2264](https://github.com/barocss/barocss/issues/2264)

Offset face takes either native ±Z end cap of a supported authored rectangular taper. A positive distance moves the selected cap outward. The four native wall planes continue to the new section, and the other cap retains its geometry and references. The existing History and file format retain the selected face signature and signed distance. The operation refuses cap crossing, wall collapse and unrepresentable geometry before adoption.

- **PASS, actual desktop Studio.** Picked the lower cap of an authored 20 × 10 × 12 mm block with 15° Draft Extrude. Dragged the actual arrow and changed the offset from +2 to +3 mm. Applied +2 mm, edited to −2 mm in History, then used Undo and Redo. A −12 mm History edit refused and preserved the accepted part. Native Save and fresh File Open kept the −2 mm document and source nodes. Opening a file with the same invalid signed offset preserved the displayed part. The upper-cap and straight-prism controls also passed.
- **PASS, physical proof.** With s = tan(15°), integrate the section area (20 − 2sz)(10 − 2sz) from z = −2 or +2 mm to the fixed cap at z = 12 mm. The expected volumes 1840.798981444906 and 1039.267317024117 mm³ match the strict native and Studio results. The maximum measured edge-to-surface gap is 1.777e−15 mm. Native cases also cover asymmetric walls, movement near the fixed cap, and a reversed and translated solid whose named top is geometrically the lower cap.
- **PASS, focused checks.** 45 kernel, 43 Model and 16 Studio file tests. The deterministic tool dispatcher accepts +2 mm and refuses −12 mm without changing its document. Package type-checks, selected lint, code shape and the production build pass. Two independent reviews checked native identity, file admission and legacy isolation. A mutation that drops the selected cap sign fails the independent asymmetric-wall volume assertion.
- **FAIL, intermediate checks.** Kernel type-check caught a shadowed selector variable. The first Model assertion treated −0 and +0 as different direction coordinates. The subsequent type-check required a presence guard for the signature direction and an explicit test document type. These were corrected.
- **NOT_RUN.** Full suites, general fuzz, actual Project Open UI, STEP exchange, tilted caps, general face move/delete/replace, and mobile. The broader #2264 remains open.

D1256 starts P5 row 25. Compute one signed worst-case linear clearance chain from resolved Drawing dimensions with explicit numeric tolerances. Report the nominal, minimum and maximum in mm. Check a hand-calculated example and refuse missing, unsupported or unresolved tolerances. Use the authored numeric values and keep the printed annotation separate.

[Commands and receipt hashes](qualification.json).
