# D814 — Keep the flat pattern after rotating a sheet body

P1, rows 07, 08 and 16. FULL for the affected native output contract. Semantic Rotate uses the same single-solid and unique named skin and bend-face guards as Translate. The existing transform maps each bend-axis origin and direction. The existing native mass-provenance path and the native unfolder keep their separate contracts.

| Result | Check |
| --- | --- |
| FAIL | The baseline 30° X-axis Rotate about the origin preserves the folded geometry and names. Native flat returns CAPABILITY and the Studio Flat control disappears. The baseline driver passes its explicit reproduction assertions. |
| PASS | Actual Studio rotates the original D546 bracket with axis X and pivot (0, 0, 0). The native output is one valid solid. Its unchanged volume is 2967.7682447597 mm³. Its centroid is (12.1410980541, 9.4864598010, 13.5689696406) mm. All native vertices and face names match the rigidly rotated source within the original numerical budgets. |
| PASS | The named DOWN bend and fixed skin persist. The bend-axis origin is (3, 24.4807621135, 17.5980762114) mm and direction (0, −0.8660254038, −0.5). One alignment of the complete native flat verifies the 30 × 67.3929200659 mm rectangle, area 1974.2710130908 mm², two radius-2.75 mm holes and the bend center and tangents. The actual dialog uses the orientation-dependent axis-aligned bounds, 59.677 × 73.364 mm in this view. |
| PASS | The Flat dialog works after Rotate, first Undo and Redo, and actual Save, Close and fresh project Open. The exact 2,355-byte rotated document reopens and recomputes the same native evidence. The D813 translated flange and post-Open source edit pass again on the final source. |
| PASS | CAD build and type-check, 43 focused CAD tests including native mass translation, 20 R12 conformance cases, 13 Model tests, Model and Studio type-checks, Studio production build, syntax, diff check, Sol High implementation and root visual review. Both final desktop runs have zero page errors, console errors and downloads. The focused tests include a non-origin pivot and preserve refusals for ambiguous and multi-solid results. |
| NOT_RUN | Actual flange on the rotated edge, flat DXF after rotation, Mirror and pattern extension, whole-kernel/full suites, mobile and other browsers. |

[Commands and receipt digests](qualification.json). [#2230](https://github.com/barocss/barocss/issues/2230) remains open. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**.
