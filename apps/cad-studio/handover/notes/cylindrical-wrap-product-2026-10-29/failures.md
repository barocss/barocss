# D313 retained failures and corrections

Earlier failures remain evidence. A later PASS applies to the corrected source/test and the stated scope; it does not make the earlier run a PASS. Raw logs and actual artifacts are copied without changing their contents. [SHA-256 values](evidence/sha256.json) identify those copies.

## Four failed actual browser runs

| Run | First observed failure | Cause and correction | Later evidence |
|---|---|---|---|
| [First](evidence/d313-wrap-flow-first.txt) | 30 s wait for preview timed out | Actual Chrome-native cap coefficients failed the closure proof's ideal ±R bit comparison. Fixed by proving the actual affine cap and center-aware disk correspondence, while preserving source bits and limits. | Second run reached preview; fifth selected flow passed. |
| [Second](evidence/d313-wrap-flow-second.txt) | HUD text did not contain `first native quarter` | `Command.hint` was a palette tooltip, not an active HUD description. Added visible Region and Limits rows through existing `Command.steps` in both create and edit. The assertion stayed in place. | Third run passed preview, refusal, Apply and Undo/Redo. |
| [Third](evidence/d313-wrap-flow-third.txt) | History click never opened `Edit Cylindrical wrap` | `App.tsx` routed only text/text-relief history nodes through `editCommand`; wrap fell into a generic editor with no editable dimensions. Added wrap to the actual command-editor route. | Fourth run reached history edit, checked volume, then reached Save. |
| [Fourth](evidence/d313-wrap-flow-fourth.txt) | Saved first eight bytes were `{\n  "for`, not `BCADPACK` | The test assumed a font/asset container for an asset-free native recipe. The existing Save writer correctly emits current-schema JSON when no blobs are referenced. Replaced only this assertion with strict UTF-8 JSON parsing and whole-document semantic equality. No writer/schema change. | [Fifth](evidence/d313-wrap-flow-fifth.txt) passed both selected steps. |

The first failure's actual [HUD/kernel detail](evidence/d313-studio-live-refused.json) says `Cylindrical wrap closed reference: original coefficient bits differ from the required reference binding`. It records no page errors and a real accepted R10/H30 source document. [Original browser coefficients](evidence/d313-browser-source.json) preserve the diagnostic source; the fixture is not substituted into normal UI input.

Chrome's lower arc control poles lead to minX/minY `-10.000000000000002`, while maxX/maxY remain `10`. The previous proof had assumed an ideal symmetric cap at exactly ±R. The new proof validates all actual affine poles, weights, knots, spans, cap pairing and orientation. It retains the actual nonzero center in exact rational form. Whole-disk error is bounded by the maximum of the center displacement and freshly proved boundary residual. Coefficients are not rounded back to an ideal rectangle, and neither native tolerance nor aggregate/scalar budgets are relaxed.

Screenshots from the failed runs remain in the matching `evidence/d313-wrap-flow-*` directories. They show the source state at the failed assertion; they are not acceptance screenshots.

## Model and tool failures

- [Initial Model type diagnostics](evidence/cylindrical-wrap-model-tsc-first.txt): an apostrophe in the new quoted hint caused TS1005 and follow-on parse errors. The quote was corrected. Later Model and Studio type checks pass.
- [First wrap test](evidence/cylindrical-wrap-model-focused-first.log): 7/8 passed. The default outward height came from fitted display curvature, yielding `10.000000000000002` for an authored radius10. Because the contract requires exact source-radius equality, the default now comes from the authored circle/parameter, without rounding the fitted radius. [Corrected focused run](evidence/cylindrical-wrap-model-focused-fixed-radius.log): 8/8 passed; the later nine-test suite adds placement coverage.
- [History type-check launcher](evidence/cylindrical-wrap-history-studio-tsc.log): a command used the wrong relative TypeScript executable path. This was a launcher/cwd failure, not a compiler diagnosis. The corrected Studio invocation has an empty successful [log](evidence/cylindrical-wrap-history-studio-tsc-final.log). No failing source was recreated to generate a new failure log.

Read-only review also found two source defects before final acceptance: globally exposing native-half candidates could alter ordinary merged-reference matching; transformed/exploded faces could keep stale source-space member coordinates. Native candidates are now wrap-only, and placement/explode omits the metadata. Focused tests check default maps, quality8/16 equality, transformed omission and original-body preservation.

## Kernel fixture and native-SI boundaries

The retained first kernel focused runs are 48/51 and 48/52; new public-feature fixtures used a merged wall name that did not exist as an exact native face. The raw failures report `selected wall name is missing from its target`. Actual names are preserved and checked; the implementation does not strip suffixes or weaken native-name admission. The subsequent feature-only diagnostic also retains its separate copy/refusal test failures. The final fixed public-SI focused run is 45/45 PASS, and the later affine-cap focused run is 66/66 PASS. Their logs are separate; do not merge their counts or call the earlier failures geometry passes.

A further review found that the public wrap mass had inherited native-SI provenance from the private formal result despite `nativeSIAccuracy: false`. The public provider now returns an explicitly unsupported native-SI wrapper with reason `combined`, preserving its MMGS numbers and the private proof. Tests require this refusal for live/save-load/re-evaluated provider results and across the Model wire. This is an intentional boundary, not a fallback to an approximate native-SI export.

## Interactive driver recovery

The interactive record is separate from the scripted first-to-fifth sequence. A wrong history `.row` selector timed out and the driver context was reset. A fresh context reopened the actual saved `.bcad` file and repeated the remaining Save/Open and edit checks. Cross-realm strict object comparison in the driver was replaced with canonical JSON semantic comparison; the saved document did not change. These were driver issues, not new product geometry failures. The [receipt](evidence/d313-wrap-live/validation.json) discloses the recovery.

Actual interactive invalid height9 and collapsed-U attempts disabled Apply and preserved the accepted document; Cancel restored the accepted U end .4/V end .75 state. Unsupported later modifiers are covered by focused tests only; their actual UI flow is **NOT_RUN**. The browser/server shutdown (server PID38643, intentional exit143) was cleanup after verification, not a crash or product failure.

The final whole-suite receipts are retained: kernel2193 total / 2187 passed / 0 failed / 6 existing skips; Model1833/1833 passed; Studio365/365 passed. Final generated checks/docs pass; API inventory is limited to its six-rule SCOPED_PASS. These source results belong to runtime commit `f29df9217cf913cc1493f122a808075e5218d411`. No earlier failed output is deleted or rewritten by this note.

## Initial API inventory drift

The original [IV001 failure](evidence/d313-api-inventory-first.json) reported `CadPartOutput` direct member count42→43. This is the new `cylindricalWrap` report, not a reason to weaken the drift check. The parent reviewed 14 additions and 154 changed existing rows, with no removed rows or package-export-map changes, then refreshed the expected inventory. Of the changed rows, 136 are literal-union/member-order only; `MassFields` and `VerifierView` add two object-property-order-only differences; 16 have the intended wrap contract changes. Raw review/status files are retained. The final docs run passes all three generated checks; the inventory result remains six-rule SCOPED_PASS, not blanket API-convention acceptance.
