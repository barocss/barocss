# D844 — Resolve an Extrude to face in one cardinal YZ frame

P1, rows 07, 08 and 16. FULL for one rigid rotation of the D843 profile and target. The raw YZ frame has normal +X and sketch X axis +Y. Native trim and signed travel use world axes Y, Z and X in that order. An eligible target has one exact rectangular trim and outward normal −X. The feature preserves its native target name and lowers to a positive local height. The target can come from another earlier native feature if its current geometry meets the same rule.

| Result | Check |
| --- | --- |
| PASS | At the parent, the finished cardinal sketch previews at Distance 8 mm and has no To face mode. The structurally valid bound file opens with a source-frame evaluation refusal and noncurrent geometry. Undo restores the source. |
| PASS | Current desktop Studio creates To face from the finished +X-normal rectangle and the original target face using the Left view. With source origin (−100, 12, −7) mm, world X target and end levels are −80, −70 and −60 mm. Local heights are 20, 30 and 40 mm. Both bodies retain eight exact corners and the named caps have opposed normals. The extrusion volumes are 2000, 3000 and 4000 mm³. The target stays 2000 mm³. |
| PASS | Zero and negative local travel are refused with accepted document, bodies, selection, history and dirty state intact. First Undo and Redo restore the previous and edited cap levels. The 1430-byte project reopens after reload and another target edit regenerates the bound extrusion. |
| PASS | Current desktop regression runs retain both D841 default XY and D843 translated XY. The Model also verifies an asymmetric 10 × 6 mm source on its narrow YZ trim and rejects a reduced trim, wrong face, tilted, rotated or reversed raw axes, and small travel. Sol High reviewed native placement, naming, handedness and the independent physical oracle. |
| PASS | Model 135/135 and Studio 76/76, both type checks, scoped lint, both driver syntax checks, production build, diff check and root visual review pass. The mutation control passes and all nine single-source mutants fail in their designated tests. |
| NOT_RUN | Other cardinal and general frames, reverse direction, same-ID replacement with a held creation preview, independent STEP, full suites, mobile and other browsers. |

[Issue #2308](https://github.com/barocss/barocss/issues/2308) remains open. D845 measures a held creation result across target re-pick, Cancel and same-ID document Open. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
