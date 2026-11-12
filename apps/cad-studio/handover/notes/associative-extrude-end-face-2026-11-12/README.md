# D840 — Resolve an Extrude end to a preceding native face

P1, rows 07, 08 and 16. FULL for a saved Model feature. The first scope takes a literal rectangle on default XY and a preceding current native solid with a named downward-facing horizontal rectangular cap. The native trim must contain the entire projected rectangle. `face-end-extrude` stores the sketch index, target body, stable feature ID and exact face name. It derives height from the live native prefix and emits the same-ID native extrusion. The target is a Model dependency and remains a separate body.

| Result | Check |
| --- | --- |
| PASS | The older desktop reader explicitly refuses the new feature kind. Its ordinary Distance extrusion remains at Z20 when the target moves to Z30. The unsupported file leaves that accepted document intact. |
| PASS | Current Studio opens the saved reference and edits the target Start Z from 20 to 30 mm. The native `n3.top` follows `n1.bottom`. The dependent volume rises from 2000 to 3000 mm³. The target remains 2000 mm³. The two exact outputs retain b1 and b3, with eight native corners each. |
| PASS | Width 8 leaves the target cap too small and refuses Apply. The accepted document, bodies, selection, dirty state and history stay exact. First Undo and Redo restore target and end levels 20 and 30 mm. |
| PASS | The exact 958-byte project reopens after reload. Moving the same target to Z40 moves the bound top to Z40 and produces 4000 mm³. Sol High reviewed native cap authority, nonconsuming dependency, reference guards and the independent box oracle. |
| PASS | Model 122/122, Studio 75/75, types, scoped lint, driver syntax, build, diff check and root visual review pass. The mutation control passes and seven single-source mutations fail at their designated assertions. |
| FAIL | Two early Model tests assumed an ascending ownership chain and a movable isolated sketch. The current history groups the sketch with its dependent. The corrected test checks the actual order and refusal. The first type check also required the native point array type. |
| NOT_RUN | Studio creation and face picking, general profile and plane support, independent STEP, full suites, mobile and other browsers. |

The first scope explicitly refuses copying a bound result and flattening a placed recipe. The Model tests cover a consumed or suppressed target, missing and wrong named faces, zero and negative travel, out-of-trim profile, contradictory height and ambiguous IDs. [Issue #2308](https://github.com/barocss/barocss/issues/2308) remains open. D841 adds Studio authoring from a finished sketch and a current native end-face pick. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
