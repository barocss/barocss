# D891 — round a reflected pinned line–arc corner

2026-11-13 · FEATURE · P1 rows 09 and 16 · [#2282](https://github.com/barocss/barocss/issues/2282) stays open.

The parent Studio opened and extruded a clockwise four-side outline on the XZ plane but refused Round at its eastbound line-to-arc corner. The strict native source volume was 7141.592653589795 mm³. The first driver attempt entered the wrong flow. The corrected parent run verified the product refusal and retained the original outline.

Reflect the computation into the existing counterclockwise finite-contact solver when the source sweep is clockwise. Restore the sign of tangents and bulges and map the solved coordinates back. Keep point order, the pinned endpoint, horizontal and vertical constraints, and native side IDs. The analytic contact check rejects exact-limit R10 before it can collapse the retained arc. Mixed winding still fails the pinned-carrier check.

## Verification

Desktop Studio WebGPU passed creation at R3, edit to R4, Undo, Redo, OPFS Save, Open in a fresh context, R10 refusal with R4 retained, and edit to R5. Each accepted outline remained fully defined. Strict native extrusion used two caps at Y=±5 mm, retained R20 side e2, and allocated e5 to the new fillet. The five side tags were e1, e5, e2, e3, e4. The native inspector compared contact coordinates, cylinder centers and radii within 1e-8 mm, and volume against an independently integrated boundary within 1e-7 mm³.

| Radius | Expected mm³ | Native mm³ |
| --- | ---: | ---: |
| R3 | 7116.460269574863 | 7116.4602695748645 |
| R4, also after fresh Open | 7091.948937557186 | 7091.948937557187 |
| R5 | 7054.301379805951 | 7054.301379805949 |

The D890 counterclockwise desktop regression also passed. The scoped Model and Studio checks passed 61/61 and 45/45. Both type checks, Studio build, scoped lint, runner syntax, diff checks, and independent source review passed. Browser cleanup and source-manifest comparison passed for each run. There were zero page errors, console errors, or downloads in the passing runs. Commands and receipt hashes are in [qualification.json](qualification.json).

NOT_RUN includes arbitrary line angles, incoming arc corners, changed source-carrier dimensions, the broad fillet family, full suites, and mobile. Next, measure an edit to the retained source-arc radius and verify the pin, exact finite contacts, and native history before widening the family.
