# D913 — edit the distance of a stored rounded inset

2026-11-13 · FULL · P1 rows 09 and 16 · [#2232](https://github.com/barocss/barocss/issues/2232) remains open.

The direct Extrude editor exposes one numeric inset distance for the standalone v1 recipe. Apply changes only the distance. The source, complete side map, Extrude, output and feature IDs are retained. A blank input cannot apply a previous typed value. The existing owned candidate lane requires the exact authored document and result. It checks the canonical native output, strict B-rep, one closed solid and finite positive volume before installing the candidate. File and Project Open use the same strict native check.

## Verification

- **PASS** Desktop Studio edited 1 → 2 → 2.5 mm, undid to 2, rejected 1.995 and 5, and redid 2.5. Save and fresh File Open preserved the exact 2.5 mm document. A fresh edit to 1 restored the same four arc side names. Undo and Redo repeated the sharp and rounded states. Independent volumes agree within 1e-7 mm³. There were 8, 4 and 4 native cylinders and 18, 14 and 14 faces at 1, 2 and 2.5 mm.
- **PASS** A blank draft left the accepted part unchanged. The floor and closure refusals retained the document, body, selection, history controls, title and dirty state. A structurally valid small translated inset edit was refused by native evaluation for insufficient loop area. A held successful worker reply released after File Open did not replace or modify the new document. The stored File/Project and existing straight linked inset regressions passed.
- **PASS** 101 Model tests, 124 Studio tests, both type checks, Studio build, scoped lint, driver syntax and diff checks. Independent geometry and integration reviews passed. The mutation control passed four tests and detected all five stored-recipe mutations.
- **FAIL** The first Studio observer read the body count where it needed the selected body indices. The corrected observer asserts the selected index. Whole-file App lint has the same existing unused `_k` diagnostic as the parent.
- **NOT_RUN** Studio recipe creation, source geometry edits, detach, dependent features, whole suites and mobile.

[Commands and receipt hashes](qualification.json).
