# D899 — verify a lost Offset cap and its marked replacement

2026-11-13 · SMALL · P1 rows 08 and 16 · [#2285](https://github.com/barocss/barocss/issues/2285) remains open.

Desktop Studio WebGPU repeated the 20 × 10 × 5 mm stock, +2 mm Offset and 1 mm Shell opened on `n3.top`. Raising the original Extrude to 8 mm moves its own cap above the fixed Offset endpoint Z7. The Offset cap becomes internal. Native inspection found only `n1.top` at Z8. Live History Apply refused the missing `n3.top` on Shell n5 and retained the accepted 536 mm³ model, document and history. First Undo and Redo returned the prior Offset and Shell documents exactly.

A cold native file with the 8 mm source still stored the signed `n3.top` reference. File Open proposed the unique same-facing `n1.top` and showed it as Matched again. The prior Z7 signature and the previous name remained in the mark. Explicit Confirm reference removed the mark and recorded the current Z8 signature. The 2026-byte OPFS Save opened in a fresh context with the confirmed reference. The repaired Shell has an 18 × 8 mm rectangular opening at Z8, a floor at Z1 and native volume 592 mm³. Native geometry and Studio volumes matched the independent box-minus-cavity oracle within 1e-7 mm and 1e-7 mm³.

The first driver expected a live rematch. The product instead gave a valid atomic refusal. The corrected driver verified both entry points. Focused Model 70/70, Studio 12/12, driver syntax and diff checks passed. There were zero browser page errors, console errors or downloads. Commands and evidence hashes are in [qualification.json](qualification.json).

The repaired cold Open also showed the generic kernel failure toast from the pre-rematch evaluation alongside the current valid Shell and marked reference. This notice is a separate FAIL. D900 will trace its source and preserve the valid reference prompt and a genuine current failure. Ambiguous Offset cap candidates, tangent chain comparison, general direct editing, full suites and mobile were NOT_RUN.
