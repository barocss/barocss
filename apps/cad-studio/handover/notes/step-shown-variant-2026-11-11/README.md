# D678 — Preserve the master while preparing STEP for a variant

P2 B07, rows 13 and 16. [D407](../step-export-preview-2026-11-01/README.md) covers the preview and controlled payload tests. [D677](../step-preview-late-reply-2026-11-11/README.md) verifies late replies across Open. D678 checks actual STEP preparation while switching between Master and a named assembly variant.

## Reproduction and repair

**FAIL before repair.** Studio displayed the Tall variant with a 9 mm base and the cap at Z 14 mm. The authored master still declared height 6 mm and gap 2 mm, but its cap position had changed from Z 8 mm to 11 mm. Automatic mate solving combined the variant's base face with the master mate and wrote that placement into the master.

The automatic assembly writeback now waits for current master face tables and stays off while a variant is displayed. Variant placements still come from the existing variant solver. Returning to Master resumes automatic solving after its current face group arrives. The legacy-face regression reproduced the extra solver invocation before the repair. The final test checks no automatic solve during preview or while restored master faces are pending.

## Actual Studio result

**PASS after repair.** In Chrome WebGPU at 1440 × 900, the public Variants controls switched Master → Tall → Master. A passive observer recorded the original placed and STEP Worker replies. The independent Part 21 reader followed each solid's records to its eight vertices, and checked AP214, millimetre units, flat placement and declared losses. The corner tolerance was 1e-6 mm.

| State | Base height | Distance mate | Cap bottom Z | Base volume | STEP source |
| --- | --- | --- | --- | --- | --- |
| Master | 6 mm | 2 mm | 8 mm | 2160 mm³ | `b074d6ed73ec8281` |
| Tall | 9 mm | 5 mm | 14 mm | 3240 mm³ | `bb4cfd6d2ca9b48c` |
| Master restored | 6 mm | 2 mm | 8 mm | 2160 mm³ | `b074d6ed73ec8281` |

All three STEP preparations contain two solids. The preview lists the actual omissions for history, parameters, flattened assembly hierarchy and shared definitions, and labels. The master parameters, mate and instance placement were unchanged during Tall. Returning to Master restored the complete original authored document and the same STEP source revision. Both variant and restored screenshots were reviewed. The run recorded zero downloads, page errors, console errors and watched changes. The 325-file source capsule matched through cleanup.

## Reproduction and limits

SMALL verification covers the private assembly writeback guard. Use Node 22.19.0 and run one heavy job at a time through `gate.sh acquire heavy 180 <label>` and `gate.sh release heavy`.

- From Studio, set local `PW_DIR` and `CHROME`. Run `D678_SOURCE_FROZEN=1 node test/step-shown-variant-browser.mjs "$EVIDENCE"` with an external evidence directory. Final receipt SHA-256 `ad38ad16e5586955c3aebdd7640c3a8fe9a34e0cacdc46c60a80ab6b478f942e`. Baseline FAIL receipt SHA-256 `ae125d48e7028c7a8c203058abe62c60d09372758158aa57b87be61747bde94d`.
- Baseline `pnpm --dir apps/cad-studio test assembly-linked-faces` gave 6 PASS and 1 FAIL. Final `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test assembly-linked-faces mate-pattern-commit o24d- variant-document-draft step-export-preparation step-metadata` passed 57/57.
- `TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test o11-variability.test o11-agent.test mates.test` passed 27/27.
- Studio and Model type checks, scoped ESLint, `node --check apps/cad-studio/test/step-shown-variant-browser.mjs` and `git diff --check` passed.

**NOT_RUN.** Final STEP Export, file reimport, general mate or assembly acceptance, and whole B07. [#2263](https://github.com/barocss/barocss/issues/2263) remains open. D679 checks that the STL source record identifies the generated geometry when an unsaved Variant input changes.
