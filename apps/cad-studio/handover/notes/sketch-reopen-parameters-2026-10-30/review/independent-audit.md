# D356 independent audit (claude-opus-5-5 sub-agent, 2026-10-30)

The audit was read-only, on 4d25aa7f3 plus the D356 diff. Probes and mutants are in [../audit](../audit), and before/after outputs are in `*.before-fix.txt`, `before.*.txt` and `after.*.txt`.

**Verdict: CHANGES_REQUIRED.** The core claim held.

## Holds

- **Reopen without NaN.** A bound rectangle or circle reopens with the parameters' values.
- **Unchanged Finish keeps the binding.**
- **Missing parameter.** A missing parameter shows a toast.
- **Edge values.** Zero and negative values rebind.
- **Parameter changes.** Renaming or deleting a parameter is safe.
- **No conflicts.** `keptFields` has no conflict with the rebinding, and the linked and face-profile callers see only numbers.
- **Base tests fail for the right reasons.** On base, the new tests failed 8 of 13, each for the expected reason.

## Findings and root disposition

- **F1 (medium, reachable from the UI): fixed as dropped and reported.**
  - Setup: a circle-first sketch with a rectangle region, centre bound via ƒ, reopened and Finished with no change.
  - `startPicking` makes the outline the main shape, so the profile kind changes and the binding was silently lost.
  - After the fix it is still dropped, because the circle becomes a one-arc region and no representation matches, but Finish now shows the toast "Bindings became numbers".
- **F2 (low/medium): fixed.** Matching by index alone bound the wrong vertex after a deletion or rotation (B1, B4, C1).
  - Point lists are now rebound only when every other coordinate of the loop is unchanged.
  - Rectangles and circles rebind per named size: a root refinement, because the strict rule dropped a width binding when only the height changed.
- **F3 (low): reported.** Kind changes and untouched regions dropped bindings silently.
  - Bindings that cannot be restored now produce a toast.
  - The untouched region now keeps its binding.
- **F4 (low): kept as is.** The Studio test's transport stub always returns ok, so evaluation is checked only in the Model test.
- **F5 (cosmetic): fixed.** The missing and non-finite messages are now distinct, and the toast no longer shows the code prefix.
- **Mutants: all killed.** The audit run had 8 of 15 surviving. After the fixes, all 21 die, including the root-refinement mutant M21. M15 was rewritten because its target moved.

## Side notes (not D356)

- **Previews.** `profiles.ts` reads bound sketches as NaN in previews: `profileMiddle`, `profileRings` and `loftSections`, and `App.tsx` draws free sketch rings from the unresolved document. This is a candidate for the next item.
- **Circle-first role swap.** An unchanged Finish on a circle-first sketch with a region swaps the main profile kind (also D355 S1).
- **Parameter edited while the sketch is open.** Changing a parameter's value while its sketch is open pins the old value. The auditor did not check whether the UI allows this.
