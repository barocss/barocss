---
work_id: D477
artifact_type: drawing-circle-snap-recovery
status: qualified
owner_role: executor
source_request: "Continue owner-selected C3 drawing loss/recovery after D476 first-pass closeout"
last_updated: 2026-11-03
---

# D477 — Visible circle-center snap and drawing recovery

C3, rows 11/12/16: one public Part Drawing diameter lifecycle passes eight desktop groups and nine native/Python/Worker/SVG bindings. A bounded snap-priority consumer defect is corrected. [Qualification](qualification.json) records two source hashes and the key receipts. Parent is `3bf118d21c1365f54e24ed980ab1ccef4f1ff911`, plus the two uncommitted candidate files during proof. High final saved-data audit **ACCEPT_D477_ACTUAL_PUBLIC_TOP_DIAMETER_LOSS_RECOVERY_NINE_BINDINGS** confirms this scope; it does not rerun the product.

## Original failure and correction

The exact retained public D451 part has no drawing: rectangle[-20,-20]..[60,20], Extrude10 and a terminal four-copy R2 Hole about[20,0], outputb2. Its input SHA is `89092fd8a065bf2dde1b9dd447d7fcb124fa83c3f4d4bfab526f9b94d810b147`. Hole construction was not replayed. Public Diameter/O, a Top pointer pick and placement create the new dimension.

Original desktop01 fails the declared visible top-rim identity: the snap chooses `n1.bottom|n2_p0.side0#2`, near Z0. Physical diameter 4 and plate mass pass; three top/visibility assertions fail. No group completes; eight remain pending. The original receipt (`e33efc6e…`) and failure stay immutable. A separate root cwd/hash-reader error occurred before gate/SUT and was corrected without changing sealed inputs.

`snapPoints` counted an edge with no projected pieces as visible. Its early bottom-rim center then blocked the visible coincident top center. The final fix changes only **round-circle CENTER** ranking to actual visible pieces. Endpoints and non-round centers retain their exact legacy policy; empty-only center fallback remains. No B-rep, tolerance, API, schema, annotation or UI change follows.

## Checks and the separate baseline failure

The broad candidate and final narrow candidate each record120 PASS / 1 FAIL / 0 SKIP in the121-case related suite. The new snap regression passes. The old O172 shaft Fix assertion requires `add-section`; Fix instead reports `applied:[]` while a right-view16.5 hidden-dimension/add-section warning remains.

Root's isolated original-HEAD/current control returns exit1 for both, at the same assertion, with **byte-identical pre-Fix and result payloads**. Comparison SHA is `d4930a40e722832e74a08421ae043b3ffba15bc1d8392f636c9fbf285d18e3f1`. This is a pre-existing baseline failure, not a D477 regression. Earlier provisional regression labels are superseded by this control. No assertion or tolerance was weakened. Checks03 targeted lint, StudioTSC and final ModelTSC pass (`99335495…`). There is no121-all-PASS or full-kernel claim.

## Native and desktop proof

Native preflight (`27eadadc…`) passes three template states and the exact guard `PARAMETER`, feature `n2_p0`, `n2_p0: radius must be positive`. Public Hole editing exposes **Diameter**; typed0 means radius0. Templates provide mapping only and never inject the actual dimension. Fifteen mapping source pins stay exact; the dimensions consumer source change is explicit. Physical producer/projection/reference-resolution criteria remain unchanged; no native baseline replay is claimed.

Active native geometry is one closed genus4 plate with four bores: V = 32000−160π, C = [20,0,5]. Suppressed geometry is one closed genus0 plate with no bore: V = 32000, same centroid. Bounds are[-20,-20,0]..[60,20,10]. The selected physical top circle is center[28,0,10], R2/diameter 4. Original 1e-9 relative-volume and absolute physical/reference budgets remain. Maximum native volume error is 7.275957614183426e-11; centroid error is 5.684341886080802e-14. Actual Worker V/C maximum errors are 0.

Desktop02 passes: diameter baseline; Suppress/lost; Unsuppress/restored; Diameter0 refusal; FIRST Undo/lost; Redo/restored; Suppress/pre-Save lost plus own OPFS Close/reload/Open lost; post-Open Unsuppress/restored. Nine bindings use three whole-document captures and six exact-document reuses: three authored states, two physical geometries.

The actual dimension is `d1`, edge`n1.top|n2_p0.side0#2`, near[28,−4.440892098500626e-16,10], place[39.99999852310937,13.999996299743643]. This is actual edge #2, not template edge #1. Its actual values are retained, not replaced by template coordinates. The actual complete quadratic rim bound is 6.2803698347351e-16; the separate preflight template bound is 5.370678290282277e-15. Only first Suppress adds signature metadata; it is validated once, then retained exactly. Native 4 is authority; `4× Ø4 THRU` is secondary formatting. Current SRC, completed projection and readonly sheet precede lost/SVG judgement. References rows are empty in all nine saved observations. No verification-completion hook exists, so this is not proof of automatic panel clearing; no rematch is invoked.

Root ran `bash /tmp/barocss-d477-root/run-fixed-studio01.sh`. Actual receipt SHA is `9868684a6acbcd6455ce41dd108b9e8c2580ba674c7531454a6e0a48ca50ac49`; driver config SHA is `525527c00b794e0b60cecf9f7cffbbb9b0abd73d945e2b0e918198dd7807bdb7`. Root reviewed six images. Mark/bore removal and recovery are visible; the lost badge is DOM/read-only proof only because it was below fold. This is SVG preview, not export or standards acceptance.

Cleanup verifies 2,428 wrapper paths and 2,429 helper paths equal through freeze/cleanup/current. The owned namespace is removed and absent; context/browser/server close, PID667 is absent and gate/freeze release. Errors, console errors, downloads and watched changes are 0. Sol Medium handled implementation/driver; Sol High handled geometry/reference review; root owned all runtime, source equality and image review. Mobile is NOT_RUN_OWNER_RULE; browser restart persistence is NOT_RUN.

#540 remains open; all criteria are not met. Core readiness stays NOT_MEASURED, legacy 43% frozen, C1/C2 first-pass closeout through D476 and all owner HOLDs unchanged. **Next D478:** C3 source/retained-proof inventory and root actual reproduction of the existing O172 shaft auto-dimension Fix failure before implementation. No new annotation or unit-tolerance change is selected.
