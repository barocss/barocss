# D1173 — Edit the original signed face Offset in History

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2465](https://github.com/barocss/barocss/issues/2465)

New native face Offsets carry a signed distance and the persistent name of the original cap. History groups the private construction as one feature and previews edits against the exact original cap in the preceding model. It retains the feature and output IDs. Apply requires the native composition proof and successful regeneration of the candidate document.

| Result | Check |
| --- | --- |
| FAIL | At the parent, desktop Studio made a valid +2 mm Offset from the cylinder bottom but History had no command to edit its original signed distance. |
| PASS | Desktop Studio picked the bottom cap of a cylinder with radius 5 mm and thickness 10 mm. History opened at +2 mm. Changing to +3 mm moved the cap from Z−2 to Z−3. Reversing to −2 mm moved it to Z+2. The opposite cap stayed at Z10. Each result was one valid native solid. The measured volumes were 942.4777960769375, 1021.0176124166823 and 628.3185307179583 mm³. The closed-form volumes are 300π, 325π and 200π mm³, within 1e−6 mm³. The respective centroid Z values were 4, 3.5 and 6 mm, within 1e−7 mm. |
| PASS | An inward −10 mm input would remove all thickness. Studio refused it, disabled Apply and retained the accepted document. Save and fresh Open restored the −2 mm history input, valid native solid and exact accepted document. Cancel retained it. |
| PASS | 52 focused Model tests, including a later Move, group deletion, copy and flatten. Four focused Studio tests, D1172 desktop regression, Sol High geometry review, both type checks, scoped lint, driver syntax, diff check and production build. |
| NOT_RUN | Migration of older unmarked Extrude/Boolean features, imported STEP caps and other geometry families, face-bound suffixes across a sign reversal, full suites and mobile. |

[#2465](https://github.com/barocss/barocss/issues/2465) stays open. Desktop QA is **29/54 (54%)** and initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. D1174 measures the signed History flow on an imported rectangular STEP cap. [Commands and hashes](qualification.json).
