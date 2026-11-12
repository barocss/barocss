# D826 — Save and reuse named Hole options in Studio

P1, rows 07, 12 and 16. FEATURE. A new single Hole can save and explicitly reuse through, blind, counterbore or countersink dimensions. A versioned browser store holds up to 24 named entries with names up to 48 characters. The record holds the active type and its numerical dimensions. The Hole command supplies the target, center and preview. Preset changes retire the previous preview and clear any queued Apply.

| Result | Check |
| --- | --- |
| PASS | Studio saves blind and counterbore options, rejects a duplicate name, renames and updates a preset, and deletes a temporary entry. An injected quota failure reports the failed write and keeps the prior entries. Enter in the name field, these management actions and Cancel preserve the source, selection, dirty state and history. |
| PASS | Row copies and the tapped type disable preset actions. The four supported types retain only their allowed fields in focused coverage. Malformed or unsupported storage and stale writes are refused. |
| PASS | Studio reloads the preset list and opens a second document with the same local feature IDs. The new right face and center (25, 6) mm survive explicit Use and Reset. A held successful counterbore preview and queued Enter cannot commit after switching to the blind preset. |
| PASS | Actual Apply creates a blind Ø6 × 5 mm hole on n1.side1 along X, with the intended native inward wall and floor at X85. Native and Worker volume match 14258.6283305885 mm³ within 1e-7 mm³. The centroid agrees within 1e-8 mm. First Undo and Redo restore the exact states. |
| PASS | The exact 721-byte project reopens after clearing preset storage. The existing feature editor changes Depth 5 to 4 mm. Native and Worker volume match 14286.9026644708 mm³. |
| PASS | Studio 91/91 and Model 9/9 focused tests, both type checks, preset and HUD lint, build, syntax, diff check and final visual review. The first desktop flow passed. Visual review found a default fieldset border, which was removed before the final desktop run. All three desktop runs have zero page errors, console errors and downloads. |
| FAIL | Lint first refused the new control-character regular expression. The character-code check passes lint and the same tests. Full App.tsx lint still reports the one unused `_k` already present on the parent. |
| NOT_RUN | Other preset types through final native Apply, corrupt storage in actual desktop, late failed preview, concurrent tabs, full suites, mobile and other browsers. |

[Commands and receipt digests](qualification.json). [#2379](https://github.com/barocss/barocss/issues/2379) remains open for the remaining consumer cases. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**.
