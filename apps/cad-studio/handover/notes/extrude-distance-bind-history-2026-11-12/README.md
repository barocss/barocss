# D848 — Bind a saved Distance extrusion to an end face

P1, rows 07, 08 and 16. FEATURE for one eligible saved extrusion. **Set end face** starts from a positive literal Distance on an admitted rectangular sketch, with local Start Z and draft both zero. The selected target must belong to an earlier current solid. The command preserves the original feature ID, sketch, output key, following nodes and next serial. It replaces the fixed value with the existing bound-end recipe only after Apply.

| Result | Check |
| --- | --- |
| PASS | Desktop Studio starts with target cap Z30 and a 20 mm fixed extrusion. The first extrusion has no earlier target and offers no conversion action. A dirty History draft disables the action. Reset restores the 20 mm distance. |
| PASS | A pick on the saved extrusion's own face is refused. A valid pick on the original earlier cap previews the conversion. Cancel retains the exact document, bodies, dirty state and history. |
| PASS | One explicit Apply replaces the fixed height with `n1.bottom` while retaining feature `n3` and bodies b1 and b3. Native height and volume change from 20 mm and 2000 mm³ to 30 mm and 3000 mm³. First Undo and Redo restore the two exact modes. |
| PASS | Editing the target to Z40 regenerates the end. The 958-byte project reopens after reload. Editing the target again to Z50 produces an end at Z50 and 5000 mm³. Both bodies retain eight native corners. |
| PASS | The Model verifies downstream Translate ownership, unchanged output and next serial, a stale document, a downstream face refusal and existing shifted, named and drafted input boundaries. The actual D842 detach regression passes on the same source. |
| PASS | Model 137/137, Studio 76/76, both type checks, scoped lint, driver syntax, production build, diff check and root visual review pass. |
| FAIL | Full App.tsx lint reports the same pre-existing unused `_k` as the clean parent. |
| FAIL | In the first desktop run, perspective let the second pick ray hit the existing extrusion's edge before reaching the target. The corrected desktop driver uses the public orthographic control. |
| NOT_RUN | A direct History re-pick for an existing bound target, external CAD STEP geometry import, full suites, mobile and other browsers. |

[Issue #2308](https://github.com/barocss/barocss/issues/2308) remains open. D849 adds an explicit re-pick for an already bound feature in History. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
