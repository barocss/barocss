# D356 — Reopen parameter-bound sketches and keep their bindings

Status: **BOUNDED_QUALIFIED**, the ninth bounded item of roadmap 09. It fixes the data-loss defect S3 found by the D355 audit. Source commit `4dec42f83` (13 paths). [Qualification](qualification.json), [Korean report](report.ko.md), [independent audit](review/independent-audit.md).

## Defect

A sketch size can be bound to a document parameter with ƒ, for example `max: [{parameter:'W'}, 40]`.

1. Reopening the sketch applied `Number()` to each bound size, so the shape came back with NaN.
2. Finish then wrote null coordinates as a loop.
3. The kernel refused the result: "The value is out of range".

So the sketch could not be finished and its bindings were lost ([probe-before/repro.out.txt](probe-before/repro.out.txt)).

## Repair

- **Reopen.** `resolveSketchDims` resolves every bound size with the document parameters. A missing or non-finite parameter refuses the reopen with a message.
- **Finish.** `rebindDims` restores bindings where the value is unchanged:
  - per named size for rectangles and circles;
  - for outlines of points, only while the outline's other points are unchanged, so a binding never lands on another vertex.
- **Notice.** Bindings that cannot be kept become numbers, and Finish shows "Bindings became numbers".
- **Parameters elsewhere.** The feature editor's sketch fields and command edits now receive the parameters too.

## Retained failures and corrections

1. No Studio baseline run: the fix agent was editing sources in parallel. The Model reproduction is recorded.
2. Actual run01 and run02 failed in the driver: the in-page document holds `configurations: undefined`, which is absent in files. The driver now reads documents in JSON form. Run03 passed on the pre-audit source.
3. The independent audit was CHANGES_REQUIRED, and its findings were fixed:
   - F1 (silent loss on a circle-first role swap): the binding still drops, but is now reported.
   - F2 (wrong-vertex rebinding): fixed by structural matching.
   - F3 (silent kind changes): now reported.
   - F5 (messages): fixed.
4. **Root refinement.** The strict outline rule also dropped a rectangle's width binding when only the height changed. Rectangles and circles now rebind per size.

## Verification

- **Model:** 20 new tests; affected 140/140. Types and lint PASS. All 21 mutants are killed.
- **Studio:** 3 new real-hook cases (unchanged Finish, dropped-binding toast, missing-parameter toast); 52/52.
- **Docs:** check-docs, refusals and inventory PASS.
- **Actual [run-04](studio/run-04/receipt.json):** one Chrome, two contexts.
  1. Open the bound fixture.
  2. Reopen: finite values are shown. An unchanged Finish keeps the binding.
  3. Set W=70: volume 28000.
  4. Reopen, set the height to 30 and Finish: W stays bound with no notice; volume 21000.
  5. Undo/Redo, then Save.
  6. Fresh Open and set W=50: volume 15000.
  - Errors 0. All 985 frozen files equal the commit.

## Boundaries

NOT_RUN: full suites, remote CI, release.

Limits:
- Point-outline bindings drop, with a notice, when any other point of that outline changes.
- A circle-first sketch with a region swaps roles on reopen, and its bindings drop with a notice.
- The feature-editor path drops silently (documented).
- Previews still read bound sketches as NaN (side note, next item).
