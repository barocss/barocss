# D898 — compare Offset face handle and field input

2026-11-13 · SMALL · P1 rows 08 and 16 · [#2285](https://github.com/barocss/barocss/issues/2285) remains open.

In desktop Studio WebGPU, each run picked the same native `n1.top` on a 20 × 10 × 5 mm prism. The orthographic Iso handle started at the command default of +2 mm. An outward drag moved 29.51 CSS px up and reached +3 mm. An inward drag moved 88.54 CSS px down and reached −1 mm. Separate runs entered the same signed values in the Offset field. Each preview preserved the original document until Apply.

| Input | Appended operation | Height | Volume |
| --- | --- | ---: | ---: |
| +3 mm, handle and field | Union | 8 mm | 1600 mm³ |
| −1 mm, handle and field | Difference | 4 mm | 800 mm³ |

For each signed value, the two routes committed identical complete documents, including the source prefix, snapshot plane at Z5, generated node IDs and output reference. Undo after each commit restored the exact seed. Native strict validation confirmed one closed solid, six box support planes and the independent volume and centroid within 1e-7 mm³ and 1e-7 mm.

Focused Model 35/35, Studio 14/14, driver syntax and diff checks passed. The browser recorded zero page errors, console errors and downloads. Commands, document hashes and native values are in [qualification.json](qualification.json). D895 and D896 retain the previous Save/Open evidence. A new Save cycle, end-on drag, tangent fillet chain comparison, missing or ambiguous Offset cap rematch, full suites and mobile were NOT_RUN. Next, verify a signed Shell cap reference when an upstream change removes the expected Offset cap role.
