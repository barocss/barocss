# D903 — retain the finite Round guard after unlocking its radius

2026-11-13 · FEATURE · P1 rows 09 and 16 · [#2282](https://github.com/barocss/barocss/issues/2282) stays open.

Parent desktop Studio silently accepted an R10 draft after clearing the R4 fillet lock. The source R20 arc was almost collapsed, and Studio showed the draft as fully defined. Cancel preserved the committed R4 document. The actual baseline run passed as a reproduction of this product failure.

When one radius is missing, use the edited arc's measured radius to reconstruct the previous recipe only if the other radius remains locked. The prior outline must still match the exact pinned finite geometry. The candidate must supply both locks and pass the same branch and tangency checks as a regular radius edit. The existing solver still handles the first lock on an outline with neither radius locked.

## Verification

- **PASS** Desktop Studio WebGPU refused R10 in the inline and panel fields after unlocking the reversed XY fillet. The unlocked outline, accepted document, visible history and dirty state remained exact. Finish removed only the radius lock. Undo and Redo replayed both documents. OPFS Save and fresh Open retained the unlocked outline and side IDs. Studio again refused R10 and accepted R5 inline, then replayed the exact documents through Undo and Redo.
- **PASS** Strict native B-rep and Studio Worker volume matched independent planar construction within 1e-7 mm³. Both named cylinders and all five boundary points on both caps met the 1e-8 mm coordinate tolerance. The existing forward source-radius edit and source re-lock Studio regression passed separately.
- **PASS** The Model tests cover both authored traversals after reopening the unlocked outline. Both editor paths refuse 9.99999999 and 10 mm and agree on the exact 5.0000004 mm solution. With both locks cleared, restoring the unchanged source R20 uses the generic path and the second lock again refuses R10.
- **PASS** Independent geometry review of the retained branch and the reproduced failure. 64 focused Model tests, 45 focused Studio tests, both type checks, desktop build, affected lint, driver syntax and diff checks passed.
- **NOT_RUN** Forward fillet re-lock and both-locks-cleared workflows in desktop Studio, broader or oblique Round geometry, full suites and mobile.

[Commands, numeric results and receipt hashes](qualification.json).
