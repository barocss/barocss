# D914 — detach a stored rounded inset without changing its solid

2026-11-13 · FULL · P1 rows 09 and 16 · [#2232](https://github.com/barocss/barocss/issues/2232) remains open.

The direct Extrude editor can detach the current rounded inset. The owned candidate first verifies the linked native solid. It stores the same resolved ordinary sketch at the recipe's index and feature ID. The source, Extrude, output, exact loops and current side tags are retained. The editor requires a clean draft for Detach. The source sketch remains available as an independent sketch after the link is removed.

## Verification

- **PASS** Desktop Studio detached the rounded 1 mm and sharp 2.5 mm insets. The full lowered kernel inputs, strict native solid results, face names, cylindrical geometry and vertices were equal before and after detach. The selected body stayed selected. The 1 and 2.5 mm native volumes were 534.247779607693 and 1215.663706143591 mm³. Undo restored the recipe and Redo restored the detached sketch in both cases.
- **PASS** The sharp detached document saved to 4061 bytes and opened in a fresh desktop Studio. The ordinary sketch editor opened and its unchanged Finish preserved the file content. The D913 distance edit and native refusal flow also passed.
- **PASS** 102 Model tests, 124 Studio tests, both type checks, Studio build, scoped lint, driver syntax and diff checks. Independent geometry review confirmed the exact lowering and source independence. The mutation control passed five tests and detected all five stored-recipe omissions.
- **FAIL** Whole-file App lint reports the parent's existing unused `_k` diagnostic. No new diagnostic was found.
- **NOT_RUN** A modified detached source in Studio, old desktop product, recipe authoring, dependent features, whole suites and mobile.

[Commands and receipt hashes](qualification.json).
