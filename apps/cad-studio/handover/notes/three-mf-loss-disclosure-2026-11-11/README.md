# D690 — Disclose editable CAD and assembly losses in 3MF export

P2 B07, rows 10 and 13. Parent `81e0770d8ec6e864cc084cb871f139c227413dac`. SMALL repair to the existing success notice. [D689](../stl-assembly-loss-2026-11-11/README.md) froze the supported exchange cases. [D688](../three-mf-shown-variant-2026-11-11/README.md) qualified the shown assembly meshes and the pending-placement refusal.

## Actual desktop Studio

**FAIL before repair.** In Chrome WebGPU at 1440 × 900, export Master, Tall, restored Master and a standalone parametric plate. The independent reader accepts all four 3MF packages. The notice identifies mesh data, millimetres and appearance. It leaves the loss of editable features, parameters and history implicit in every export, and leaves out the loss of assembly hierarchy, mates and variant definitions in all three assembly exports.

**PASS after repair.** Each success notice now states the editable losses. The assembly notices also state the loss of hierarchy, mates and variant definitions. The standalone plate notice gives the applicable part loss. This uses the existing notice. A held Tall placement still produces the refusal and zero new files, with no success or loss notice. The Master returns to its original document and each export retains the accepted source.

| Actual file | Build objects | Mesh triangles | Source revision | Independent geometry in mm |
| --- | ---: | ---: | --- | --- |
| Master and restored Master | 2 each | 24 each | `d6714167d75938f3` | Base 30 × 12 × 6. Cap starts at [10, 2, 8]. |
| Tall | 2 | 24 | `ba144981414c3ddf` | Base 30 × 12 × 9. Cap starts at [10, 2, 14]. |
| Standalone plate | 1 | 12 | `e0fefb851a0ff09b` | Base 30 × 12 × 6. Volume 2,160 mm³. |

The Python ZIP/XML reader checks CRC, archive members, millimetres, object and build references, names and materials, eight corners per object within 1e-6 mm, closed directed edge pairs, and signed volume within 1e-6 mm³. Each package contains the model, content types and relationships. The model has mesh objects with material references and build items. Its only metadata values are the title, application and source revision. The cap retains the occurrence's Steel (mild) and `#D08036` appearance. The base retains Aluminium 6061 and `#357AC4`. The hidden decoy stays outside the package.

All four pre/post packages match in their content types and relationships bytes and in canonical model XML after excluding the writer's Production UUID attributes. The comparison also matches the independent geometry and material results. ZIP container timestamps and UUIDs can vary per export.

## Verification

Use Node 22.19.0 and the existing `PW_DIR` and `CHROME`. Run one heavy job at a time through `gate.sh acquire heavy 180 <label>`.

- From Studio run `D690_SOURCE_FROZEN=1 node test/three-mf-variant-browser.mjs "$EVIDENCE" --loss-report`. Original **FAIL** receipt SHA-256 `f8e46cf1b8f3f038aa041b1c507c67fe692725b382e677f32f9b1a917479d8cc`. Final **PASS** receipt SHA-256 `4d518977895bb93478428527e3acff2eb49c92e67ffb5f44b366a643ed2d743a`. Reviewed the original Tall notice and all five final screenshots. All 326 frozen paths matched through cleanup. Browser downloads, page errors, console errors and watched source changes were zero.
- **PASS.** `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test three-mf-export-ownership assembly-linked-faces step-export-preparation` passed 36/36. `TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test threemf o11-variability instance-looks` passed 36/36. Driver syntax, scoped ESLint, Studio and final Model type checks, and Git whitespace passed.
- **NOT_RUN.** Browser-managed download, standalone part with its own variant definitions, print-orientation profile in Studio, third-party slicer and full suites. Studio has no supported 3MF Open.

D690 supplies the standalone 3MF export and the assembly disclosure evidence missing in D689. Whole B07 remains open. Next D691 uses the selected D404 80 × 50 × 10 mm standalone part for actual STEP Export, independent Part 21 checks and fresh Studio Open of the same bytes. [#539](https://github.com/barocss/barocss/issues/539) and [#2425](https://github.com/barocss/barocss/issues/2425) remain open.
