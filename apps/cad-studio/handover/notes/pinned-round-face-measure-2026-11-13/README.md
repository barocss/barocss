# D893 — verify named Round faces through Measure

2026-11-13 · SMALL · P1 rows 09 and 16 · [#2282](https://github.com/barocss/barocss/issues/2282) stays open.

Desktop Studio WebGPU created one pinned counterclockwise Round on XY, changed its source radius, undid and redid the edit, saved to OPFS, opened the exact file in a fresh context, and edited the source again. In each state, real canvas clicks in the Right view selected the two independently predicted cylinder interiors. The display index of each selection matched the named native face. Inspect → Measure reported the following radii. Measure and its dismissal preserved the accepted document.

| State | Source e2 | Fillet e5 |
| --- | ---: | ---: |
| Initial | 20 mm | 4 mm |
| Source edited | 16 mm | 4 mm |
| Fresh Open | 16 mm | 4 mm |
| Edited after Open | 18 mm | 4 mm |

Strict native extrusion, independent contact and volume checks, focused Model 10/10, focused Studio 7/7, syntax and diff checks passed. The passing run had zero page errors, console errors or downloads. Commands and evidence hashes are in [qualification.json](qualification.json).

The same run exposed a separate accuracy limit. At source R16, both curved faces sweep exactly 90 degrees for a depth of 10 mm. Measure showed Area values 62.73 and 250.92 mm², while the analytic areas are 62.831853 and 251.327412 mm². Those displayed values come from tessellation. D894 will verify the area source and its presentation. XZ Measure, edge measurement, broad fillet acceptance, full suites and mobile were NOT_RUN.
