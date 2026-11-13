# D1083 — reject a degenerate first Round radius lock

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2456](https://github.com/barocss/barocss/issues/2456)

For the recognized pinned finite profile, an unlocked source radius cannot make a fillet fit when twice the fillet radius reaches the fixed carrier height. Prove the previous analytic branch from both measured arcs and reject the impossible first fillet lock. Feasible first locks continue through the existing under-defined solver. The kernel and tolerances remain unchanged.

- **FAIL** Parent desktop Studio refuses R10 after restoring the source lock first. With both locks cleared, entering the same R10 as the first fillet lock silently changes the draft. This replay stops at the first incorrect input result.
- **PASS** Current desktop WebGPU shows the same immediate R10 refusal in both orders. The accepted document, history, dirty state and draft inputs remain exact. Entering R5/R20 in either order keeps the five side IDs, fixed endpoint, three tangent constraints and strict B-rep validity. The accepted solid has two named cylindrical faces. Independent arc construction and 10 mm extrusion agree with both results within 1e-8 mm for points and 1e-7 mm³ for volume. Document Undo, Redo, project Save and fresh Open pass.
- **PASS** Sol High independently checked the analytic bound, both accepted orders and the edit scope. Model tests pass 64/64 and cover both traversals, canvas and panel routes, and the R9.99999999 and R10 margin. Both type checks, scoped lint, driver syntax, diff checks and visual review pass.
- **FAIL** The Studio focused group has 39 passes and six failures. Rebuilding the same tests with the immutable parent geometry module reproduced all six (D537, D461, D349, D355 and two D358 cases). Their unchanged Finish assertions expect one commit, while the existing implementation exits with zero commits. Their test expectations are outside this decision.
- **NOT_RUN** Single-unlocked source R9/R10 in Studio, both lock orders on an oblique plane, full suites and production build.

#2456 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
