# D915 — create a linked inset and Extrude in Studio

2026-11-13 · FULL · P1 rows 09 and 16 · [#2232](https://github.com/barocss/barocss/issues/2232) remains open.

Studio exposes Linked inset extrude under Create and in the command palette. Select one finished standalone XY sketch that meets the stored recipe's native source contract. Apply creates the recipe and direct Extrude in one history change after native verification. It preserves the source, assigns feature IDs with the existing allocator and reserves eight derived side IDs in source order. The ordinary independent Offset is a separate command.

## Verification

- **PASS** Desktop Studio opened the finished source-only document and selected its sketch in the Browser. Create refused 5 mm before Apply. It applied 2.5 mm with a 10 mm Extrude and produced the exact expected graph and canonical output. The four straight inset tags remained, and the four arc tags stayed reserved in the recipe. The native volume was 1215.663706143591 mm³ (independent value 1215.6637061435918 mm³). One Undo returned to the exact source-only document and one Redo restored the entire solid.
- **PASS** Save and fresh File Open preserved the 2195-byte document and the exact native result. The detached sketch and ordinary independent Offset regressions passed. The ordinary action still refuses the unsupported 2 and 2.5 mm offsets and accepts 1 mm.
- **PASS** 103 Model tests, 126 Studio tests, both type checks, Studio build, scoped lint, driver syntax and diff checks. Independent review covered native source scope, ID allocation and candidate admission. The mutation control passed six tests and detected all five stored-recipe omissions.
- **FAIL** Whole-file App lint has the same existing unused `_k` diagnostic as the parent. No new diagnostic was found.
- **NOT_RUN** Palette interaction, direct drawing and Finish of the source in Studio, linked source editing, dependent features, whole suites and mobile. The stored v1 source currently refuses authored `outline` metadata. A finished sketch that contains constraints through that field needs a separate compatibility decision and product run.

[Commands and receipt hashes](qualification.json).
