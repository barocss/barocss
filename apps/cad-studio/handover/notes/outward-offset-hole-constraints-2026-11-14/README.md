# D1100 — retain source constraints when outward Offset makes a hole

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2456](https://github.com/barocss/barocss/issues/2456)

Keep the authored recipe for an ordinary mixed line/arc hole when ordered side IDs and the literal native segment starts, arc centers and directions match exactly. Original signed bulges reproduce the native arcs. Supported radius, Length, H/V and tangent locks must already satisfy the existing 1e-7 mm linear and 1e-9 rad angular budgets. Kernel conversion and parameter resolution ignore editing hints. The existing driven-sketch path strictly validates the same metadata and retains it only after its untouched-hole checks pass.

- **FAIL** The parent keeps the original R2 hole segments and IDs after Out 1 mm and Save/Open, but the first reopened radius field is unlocked.
- **PASS** Desktop WebGPU restores four locked R2 values, eight tangent joints and the authored H/V data on the original hole. Active outline selects that hole. Finish without a change preserves the exact saved document, as do document Undo and Redo. The 10 mm Extrude and original hole IDs remain exact. Local-project Save and fresh Open pass.
- **PASS** Strict native B-rep finds the four original R2 and four new R3 cylinders at the expected axes. The measured volume before and after Open is 597.0796326794891 mm³ and agrees with the independent rounded-rectangle area difference. Model 83/83, Studio 32/32, both type checks, scoped lint, driver syntax, diff, visual and independent numerical source review pass.
- **NOT_RUN** Arbitrary recipe families, sketch-to-sketch driving relationships, oblique Out with authored constraints, dependent feature edits, full suites and production build.

#2456 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
