# D1108 — snap Line, Arc and Circle anchors to native edge crossings

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2457](https://github.com/barocss/barocss/issues/2457)

Line and Arc use native edge crossings for their anchor points. Circle uses a crossing for its centre. Hover and click use the same eligible candidates. The original visible body, current plane and current evaluated geometry are required. Arc bend, Circle radius and Circle from Chord retain their existing input paths.

| Result | Check |
| --- | --- |
| FAIL | On the parent source, Line showed no Crossing cue two CSS pixels from the first projected crossing. The earlier desktop checklist recorded the same miss for Arc and Circle. |
| PASS | In desktop Studio at DPR 1 and 2, Line and Arc stored both local endpoints, (4.2346, 3.4321) mm and (24.2346, 3.4321) mm. Circle stored the first point as its centre. The native prism's first edge crosses the plane at world Z = 2.7407415 mm. |
| PASS | The Circle cue cleared before radius placement. The Arc cue cleared before the bend click, and the arc kept both endpoints and a nonzero bulge. The original prism and outputs were unchanged. Undo, Redo, project Save and fresh Open passed for each tool. The saved documents had identical hashes at both DPR values. |
| PASS | The Rectangle visibility, replacement and plane controls, Arc Extension and Circle from Chord passed in desktop Studio. Root reviewed the anchor and reopen screenshots. The Sol High source review passed. |
| PASS | Studio 9/9 and Model 22/22 focused tests, Studio and Model type checks, Vite production build, viewport lint, browser-driver syntax and diff check. |
| NOT_RUN | Centre arc Crossing, exact fractional Circle radius from End, additional source families and the full suites. |

#2457 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
