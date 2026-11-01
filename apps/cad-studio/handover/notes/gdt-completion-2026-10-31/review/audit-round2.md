# D394 audit round 2 (targeted) — ACCEPT (Opus)

All seven round-1 findings fixed; no regression with a wrong result or data loss.
1. Current frames passed: adding, moving, removing next to an old broken frame accepted; a new rule-breaking frame still refused.
2. Two-step repair works in both orders; the same rule on another row (second segment, stacked) has its own prefix and is caught. Known limits (FRAME_RULE still reports each): unnamed messages still match across a characteristic change between orientation characteristics; a second datum modifier on runout with the same message; a reused frame id with the same breaks.
3. M/L allowed on concentricity/symmetry; runout, profile, circularity, cylindricity refuse; drawings.md defers standard-specific rules to 11③.
4. Sheet and 3D agree for six attached frame kinds.
5. SØ on second and stacked rows.
6. Tangent plane with Ø or Ⓟ refused — right for ASME; Ⓣ+Ⓟ conservative under ISO 1101:2017.
7. fmtTol: 0.0025, 0.1235, 12.3456 on the sheet, in 3D and DXF; cells grow, no overlap.
Mutations 28: 22 caught; survived (follow-up tests): workspace/editor current-frames wiring, frame value and unequal width, chat canonical form, saved-mark stacked.
Root after the audit: the editor's second-segment Ø checkbox showed checked for a profile composite while the sheet drew no Ø → default now position-only (matches the sheet); final run06 PASS on that source, Studio 623/623.
