# D918 — verify the detached inset and audit its acceptance

2026-11-13 · SMALL · P1 rows 09 and 16 · [#2232](https://github.com/barocss/barocss/issues/2232) remains open.

Desktop Studio drew and rounded the source, created the linked Extrude, edited the inset to 2.5 mm and detached it. The ordinary feature editor changed the first source arc from R2 to R2.25. The source segments changed and kept their feature ID and side tags. The independent sketch, Extrude, native face names, cylinders, vertices and exact body readout stayed equal. The native volume remained 1215.6637061435915 mm³. Two Undo steps restored the original link. Two Redo steps restored the detached, edited document. Save and fresh File Open retained the edited source and exact independent solid.

## Issue acceptance

| Requirement | Evidence | Disposition |
| --- | --- | --- |
| 1. Current coverage | [D906](../rounded-sketch-offset-boundary-2026-11-13/README.md) measures ordinary independent Offset and its expected refusal. [D909](../rounded-sketch-offset-missing-corner-2026-11-13/README.md) measures marked generic rematch. [D911](../rounded-inset-recipe-contract-2026-11-13/README.md) defines the separate stored recipe. | PASS for scoped comparison and adoption. |
| 2. Analytic fixture | [D910](../rounded-rectangle-inset-plan-2026-11-13/README.md) provides the analytic boundary and coordinates. [D913](../rounded-inset-distance-edit-2026-11-13/README.md) covers actual 1 → 2 → 2.5 → 1 mm and exact history. | PASS for 20 × 10 mm R2 and one direct Extrude. |
| 3. Identities | D913 verifies the persistent straight tags and returning arc tags. [D912](../rounded-inset-stored-recipe-2026-11-13/README.md) refuses a retired direct arc reference before generic matching. | PASS for whole-profile Extrude and typed loss in the stored scope. |
| 4. Downstream and source edit | [D916](../rounded-inset-drawn-source-2026-11-13/README.md) creates from a drawn source. [D917](../rounded-inset-source-width-2026-11-13/README.md) verifies the source width edit, opening vertices, native volume, refusal, history and fresh edit. | PASS for the declared ring Extrude. |
| 5. Refusals and legacy | D910 covers nonpositive and nonfinite distances, reversed traversal, non-tangency and closed opening at Model. D912 covers identity mismatch, a retired direct arc, native empty output, File/Project and parent reader refusal. D916 covers inconsistent Round metadata. | PARTIAL. The bounded product matrix still needs explicit source deletion or loss, forward/cyclic or duplicated binding, and negative compound/dependent inputs. Nonapplicable face cases need explicit routing to the planar-face inset evidence. |
| 6. Detach | [D914](../rounded-inset-detach-2026-11-13/README.md) verifies exact conversion and history. This decision edits the former source after detach and verifies the independent native solid through history and fresh Open. | PASS for the declared detached snapshot. |

Adopt the demonstrated numeric XY recipe, one direct Extrude, source width edit and detach. Unsupported source families and additional consumers stay refused by the bounded recipe. Keep the issue open until its remaining refusal cases are adjudicated.

## Verification

- **PASS** Actual desktop Studio, independent native inspection, 105 Model tests, 119 Studio tests, driver syntax and diff checks.
- **FAIL** The first browser observer used the solid feature locator on a free sketch. The retry selects the free sketch by its actual History label.
- **NOT_RUN** Full suites, mobile, and the remaining refusal matrix.

[Commands and receipt hashes](qualification.json).
