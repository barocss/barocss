# #1349 ownership and harness plan

Status: source review only. No candidate, solver, oracle, control, build or trial was run. Only this planning file was written. Root owns exact adoption, the final before-code contract, full freezes, execution and remote receipts. Root now reports exact parent adoption verified and the new lane clean at base d6b552f9; the complete before-code contract is still required.

## Confirmed parent boundary

Reviewed live OPEN #1349, PHYS-ENGINE-JOINT-03: Qualify detached hinge pose and velocity momentum coupling, and native #1309 checkout at HEAD 1381164c5752671c7f1197f27d8a8894537b01d9. The old lane was clean when inspected.

The unchanged `projectCoupledHingeCandidate(config,state,dt)` is a usable pose composition boundary. It calls admission, computes one angle correction and one COM-preserving anchor closure, calls original `validateResult`, and returns copied `{bodies,poseReport,diagnostics}`. It does not apply the COM/P/L quality thresholds. Its final private typed guard checks finite data and unchanged velocity/spin bits only.

The old runner asks the independent observer and fails when `reference.ok` is false. Its first failure has `refusal:null` and a real returned output. Thus the new candidate can call the old function ONCE, keep its exact poses and poseReport, record its pose-only before/after momentum, and then compute the stated velocity projection. Do not catch the observed momentum loss, retry the old pose function, copy its law, or treat its old reference rejection as a constructor error. Original output-bound PhysicsError and unknown thrown values must still propagate unchanged. The old projectOnce/dynamic-hinge projection, World and motor remain absent.

Old output has parsed internal Body metadata and no returned carrier. New public input remains `(config,state,dt)` and the old state/cursor are retained only as source metadata. Do not fabricate a stepped PhysicsState or copy changed body data back into the caller. New output and all nested diagnostics must be separate copied values.

Native evidence is a structured manifest, not the older diagnostic hash map: `{issue,base,measuredSource,verdict,sourceUnchanged,artifacts:[{path,bytes,sha256,decodedBytes?,decodedSha256?}]}`. It has 40 artifacts, manifest SHA b7f8ed96b71c2a14e976ff37423e01dee18027b94485e2fabeee74a3d977cbe0, measured source 830a911d333ab5f3a8a82c790068170a181b19dc and 417 historical pins. Old report has 24 observations per graph: 15 literals, 8 archived records, then the failed admitted input. Before/after streams are each 4992 bytes = 24*208. Preserve that old NO-GO as parent evidence.

## Minimal new ownership split

All implementation, if authorized, is only under NEW `examples/physics-rigid-hinge-velocity-reference/**`. No old examples, packages, root config, lock, Integration or producer changes.

| Owner | New files | Boundary |
| --- | --- | --- |
| A: candidate and numeric model | `profile.ts`, `candidate.ts`, `rows.ts`, `linear-solver.ts`, `diagnostics.ts`, `entry.ts` | Profile/errors/types; one unchanged old pose call; independently stated 12-DOF rows and physical scaling; bounded 11/12-row solve; output validation and copied diagnostics. |
| B: harness and archive | `archive.mjs`, `controls.mjs`, `bundle.mjs`, `runner.mjs`, `freeze.mjs`, `tsconfig.json`, `input-freeze.json` | Authenticate parents/raw data; execute frozen pure guards and ordered actual cases; raw/copy/error/graph parity; validate prior emitted ledger; archive results. |
| C: independent reference | `reference.py`, `reference-controls.mjs` | Independently authored expected pose/rows/velocity/objective; Fraction and Decimal80/120 evidence; literal/reference errors. No candidate or JS solver import. |
| Root | `CONTRACT.md`, provenance/adoption documents, source/emitted freezes and native receipt | Resolve interfaces, freeze complete graph and literal gates, authorize build/types/one campaign, adopt exact delta. |

Do not add another parser. Candidate should reuse old admission through its one old pose call. A new pure linear input validator may be separate inside `linear-solver.ts`; this is a private algebra guard, not an extension of physical mass/axis admission.

## Candidate/reference handshake to freeze

Proposed candidate export: `projectHingePoseVelocityReference(config,state,dt)`. Export original PhysicsError plus exact new error constants for strict controls. Export the private algebra guard entry only if root authorizes it for explicitly labelled matrix controls. No injected solver, observer, law or callback is required by the detached physical API.

Proposed return: `{bodies,poseReport,diagnostics}`. `poseReport` retains the exact old three keys. Diagnostics include source cursor, `poseLawEvaluations:1`, `velocitySolveAttempts:0|1|2`, copied old pose-stage measurements, physical before/after P/L and energy, pose and velocity deltas with units, final anchor velocities, transverse relative rates, selected stop, full row/certificate metadata and identity/raw-bit flags. Freeze exact keys and the identity meaning before code. A feasible identity branch may skip a numeric solve; it must still validate its rows and final constraints.

Proposed JSON reference request: `{config,state,dt,output?,beforeRawHex?,afterRawHex?}`. Candidate output is an observation only. The reference constructs its expected pose and rows from original config/state; never use output.bodies as the reference initial state. Raw encoding restores the 26 original binary doubles and checks JSON values. Proposed reply: `{ok,resolved,executionFailure,metrics,violations,reference}`. A resolved physical violation is NO-GO; null/nonfinite/unresolved metrics, archive mismatch or protocol defects are EXECUTION_FAILURE.

Rows use x order `[vA3,omegaA3,vB3,omegaB3]`. Row order is P.x/y/z, L.x/y/z, anchorVelocity.x/y/z, relativeOmega.x/y, then optional stop. Freeze the origin from the old pose function: midpoint of original CONFIG rest positions, not current state COM or a candidate-dependent origin. Default sphere inertia comes from original parseBody operation `0.4 * massKg * radiusM ** 2`; do not substitute decimal .004 or a new inverse-mass weight.

The certificate must distinguish physical A/b/H from the dimensionless matrix used for pivots. State each row unit, column scale, row scale, multiplier conversion and objective unit. With x = S*y, transformed Hessian is S^T H S; row scaling alone must not silently change the physical objective. Active lambdaD has the issue's sign <=0, conventional mu=-lambdaD>=0. Record both the eligible inequality and the actual active choice.

Exact Fraction checks must have an explicit binary coefficient boundary. Reference builds its coefficients from independently computed input-derived geometry. If native coefficient bytes are also checked as an exact certificate, label this supplemental certificate check; those supplied coefficients cannot replace independent expected rows. Freeze operation order and comparison gates for independently authored coefficients, targets, x and objective. Scalar sin/cos/atan2 remain declared binary operations; Decimal80/120 precision does not certify their transcendentals.

## Archive reuse and actual case order

Reuse unchanged #1309 loadInputs and #1294 selectRecords/rawBodies/restoreFrame primitives after authenticating exact adoption. They require the unchanged external #1279 native checkout at `/Users/user/.codex/worktrees/physics-multi-hinge/barocss`. Record this dependency explicitly; do not claim a current-root-only replay. Root must check current consumed source/emitted hashes independently of immutable historical CAD pins.

Add a NEW manifest adapter for the structured #1309 40-artifact receipt. Check path safety, exact file set, byte sizes, SHA values and all declared gzip decoded sizes/SHA values; check historical417 source pins against the immutable measured source/native and adopted owned blobs against current files. Do not pass this structured manifest to the old hash-map validateFiles function.

First physical case in EACH graph is the unchanged `orbitalLossCandidateControl.input`, copied as data only. It keeps BEFORE centres[-.1,0,0]/[.1,0,0], actual q values, velocities[0,-1,0]/[0,1,0] and zero spin. Old `expectedPhysicalNoGo` describes only the old pose law; do not use it as the new expected verdict.

Next consume 8 archive records per graph, 24 total across source/source-repeat/compiled. Exact order within each graph: step196 then197; within a step group0 then1; within a group private then public-canonical. These are the same #1294 selections, not 24 records per graph. Private group1 keeps Z1; canonical group1 is Z0. Preserve original IDs, rest metadata, motor metadata, complete carrier and raw13 signed zeros.

Then consume frozen new literals: nonzero P/L, common velocity, opposite spin, orbital+spin, incoherent/coherent anchors, quaternion sign, Z1, exact upper/lower opening/closing, interior and zero-rate boundary. Old authored literal inputs may be imported as data. Do not reuse old runReferenceControls unchanged: it assumes unchanged v/omega and expects the old orbital-loss NO-GO. New literal count and order must be fixed in input-freeze before execution.

Each pair frame is 208 bytes: body order A thenB, fields position3,velocity3,orientation4,angularVelocity3, Float64LE. Persist full input, full result or exact refusal, independent reply and per-case before/after raw bytes before deciding to continue. Body/result/diagnostic mutation controls use the same returned copy, not a second physical law call. Compare live objects and raw bytes across distinct source/repeat/compiled graphs; JSON does not preserve negative-zero evidence. Identity cases require Object.is for every v/omega value; corrected cases report exact changed components and do not assert old unchanged-velocity flags as final properties.

First physical failure freezes the consumed prefix; remaining graphs repeat only that prefix. Typed numeric refusal in an actual physical case is retained with its exact code/message/output-unavailable marker and is a physical refusal outcome. Unexpected thrown values propagate into EXECUTION_FAILURE with safe metadata extraction; preserve the thrown identity. Do not relabel every NUMERIC_LIMIT as an expected control success. No trial-dependent new rows, cases, tolerances or retry.

## Frozen controls with no new physical profile

Reuse old structural/control precedence: wrong dt first; original structural config errors; exact private profile; finite/dense copied carrier; original old pose output validation; new linear/rank/result phases. Exact new messages and which numeric condition maps to each message remain root decisions.

Safe physical input refusals: null config; zero mass retaining original finite message; valid but different mass/radius/axis/anchors/limits/dt metadata or explicit inertia rejected as private profile; sparse body/joint arrays; duplicate IDs; null/sparse/nonfinite vectors; zero or nonunit quaternion; wrong pair ID; invalid cursor/time; nonzero gravity; malformed unused carrier metadata. Keep caller data unchanged after each refusal. Use throwing config getters with Error and null markers to verify identity propagation, if these old structural reads still occur.

The existing valid-boundary control is deterministic and reusable: both state positions[10000,0,0], identity q and reported angle0. One old anchor closure puts pairB0 beyond10000 and original validateResult throws NUMERIC_LIMIT / `pairB0 position exceeded bounds`. Preserve this original message; do not fabricate a different late projection refusal from an unmeasured extreme-velocity scene.

For pure algebra guards only, propose finite dense H with zero entry (invalid inertia), positive Number.MIN_VALUE entry (unsafe reciprocal), exact duplicate rows with incompatible finite targets, an exactly dependent compatible system, and a full-rank finite near-dependent matrix whose pivot is below the frozen threshold. They are NOT mass/axis scene inputs. Freeze matrix literals, dimensions, pivot policy, exact-rank vs numeric-rank distinction, outcome and message before code. Do not claim a near-dependent fixture is unsafe until root selects the numeric rule. No pseudoinverse or hidden dropped row for compatible dependence.

If root exposes a pure certificate validator, use malformed dense/null/boolean/sparse coefficient, multiplier, residual and result vectors; wrong matrix shape; missing row labels; wrong active multiplier sign; negative/nonfinite objective; mismatched corrected velocity. These controls must not inject a solver into the actual physical candidate. Without that private guard interface, mark malformed-certificate tests unavailable rather than adding a solver callback.

Copy controls cover caller config/state, old pose result, final bodies, poseReport, old-stage diagnostics, new rows/certificate and reference reply. Input raw bytes must remain unchanged after success/refusal. Metadata/rest motor fields are recorded; they are not calibrated motor work or reactions.

## Source/build/flow gates

Full source freeze must pin all own files and literals/errors/gates, exact adopted #1309/#1294 sources and native artifacts, unchanged #1279 external archive, observer helper, entire current original Physics/CAD source, build-local helper, package/lock/compiler metadata and the original consumed helper closure. Avoid freezing later own result files into the first source ledger.

Node22.22.0, own ignored node_modules/dist and unchanged original build-local are required. Root posts actual original build/type receipts and actual emitted ledger BEFORE flow. Harness reads and validates the preexisting ledger `{node,preConsumer:true,buildExit:0,strictTypesExit:0,measuredSource,emitted:[{path,bytes,sha256}]}`, including all hashes/bytes and current measured HEAD. It records its SHA and never rewrites it at flow start.

Bundle three distinct files. Source/repeat use original src only; genuine compiled graph redirects every consumed original Physics import, including imports through adopted pose/admission/raw adapters, to actual dist. Imported adopted examples stay source, as in1309. Require no original src path in compiled graph and no dist path in source graphs. Authenticate actual graph imports and emitted bundle hashes. Keep world/motor/island/oldprojectOnce/oldprojectDynamicHingeJoint guards, but allow the newly required unchanged projectCoupledHingeCandidate function.

Do not hardcode old10 helper or514 emitted counts for new code. Record actual counts and compare them to the complete before-consumer ledger. Freeze any exact expected graph set after static dependency review, before the one campaign.

## Concrete decisions still required before code

1. Exact output/certificate keys, identity predicate and old pose-stage diagnostic name; use `projectCoupledHingeCandidate` once, not a copied law.
2. Dimensionless column/row scales and physical multiplier reconstruction; full-rank11/12 admission, pivot order, pivot/condition limits, feasibility/KKT/identity thresholds and refusal precedence.
3. Exact stop eligibility from targetAngleRad, not measured final-angle rounding; zero-rate boundary/active tie policy and whether inactive equality solution has tiny positive residual within a frozen stop tolerance.
4. Independent coefficient binary boundary versus supplemental native Fraction certificate, and exact agreement gates for matrices, velocity and objective.
5. Whether a separate pure algebra/certificate guard export is allowed. No candidate solver injection is proposed.
6. Final literal count/order and error strings; exact adopted parent and external archive availability. No arbitrary inertia/mass physical admission can be used to fill pure guard coverage.

Implementation can begin only after root resolves these decisions, verifies exact1309 adoption and publishes the complete before-code contract. No new physical GO is inferred from this plan.

## Final error bridge and literal stop inputs

Parent admission has a narrow bridge: only an actual original PhysicsError with code INVALID_CONFIG and message `private hinge diagnostic requires an admitted archived pair` or `private hinge diagnostic requires finite unit raw poses within original bounds` is mapped. During profile parsing it becomes INVALID_CONFIG / `private coupled hinge profile is unsupported`; during raw-state preparation it becomes NUMERIC_LIMIT / `private coupled hinge archived pose is invalid`. Any other error, including a plain object, null, undefined or a different PhysicsError message, is rethrown unchanged. New composition can preserve these exact parent errors directly. A new remapping, if desired, must list ONLY those exact parent code/message pairs before code. Never catch all INVALID_CONFIG or NUMERIC_LIMIT. Parent dt-first error is INVALID_STEP / `private coupled hinge step must equal 1/120`; its final private result error is NUMERIC_LIMIT / `private coupled hinge result is invalid`.

Use the original fullCarrier rest config and carrier for all following declared stop literals. Metadata, IDs, material, motor fields and dt stay exact. Both linear velocities start[0,0,0]. Define sign s=+1 for upper and -1 for lower. Use the unchanged authored `slight-upper-excess` / `slight-lower-excess` pose data:

- pA=[-.09210609920557934,0,0], pB=[.09210609920557934,0,0].
- qA=[0,0,-s*.19866933324522766,.9800665773445683].
- qB=[0,0,s*.19866933324522766,.9800665773445683].
- Reported angle=s*.8. The old pose law clamps the geometrically over-limit angle to exact target s*.8; eligibility is selected from that target, not the rounded final quaternion angle.

Freeze this stop-control order after the first orbital-loss input and the eight matching-graph archive records:

| Name | s | omegaA before | omegaB before | Declared question |
| --- | --- | --- | --- | --- |
| upper-outward | +1 | [0,0,-1] | [0,0,1] | Upper inequality is eligible; certify chosen active/inactive solution and require outward rate<=1e-9. |
| upper-inward | +1 | [0,0,1] | [0,0,-1] | Upper inequality is eligible; retain inward relative motion if the equality minimum is feasible. |
| lower-outward | -1 | [0,0,1] | [0,0,-1] | Lower inequality is eligible; certify chosen active/inactive solution and require outward rate<=1e-9. |
| lower-inward | -1 | [0,0,-1] | [0,0,1] | Lower inequality is eligible; retain inward relative motion if the equality minimum is feasible. |
| upper-zero-rate | +1 | [0,0,0] | [0,0,0] | Eligible upper boundary with zero multiplier and zero relative rate; freeze tie/identity convention. |
| lower-zero-rate | -1 | [0,0,0] | [0,0,0] | Eligible lower boundary with zero multiplier and zero relative rate; freeze tie/identity convention. |

The actual branch and solved velocities remain UNMEASURED. These names describe BEFORE spin directions and the frozen eligibility question. They do not assert that the 11-row equality solution preserves the initial rates.

For interior controls, use the unchanged #1309 `inside-limit-coherent-anchors` pose: pA[-.0955336489125606,0,0],pB[.0955336489125606,0,0],qA[0,0,-.14943813247359922,.9887710779360422],qB[0,0,.14943813247359922,.9887710779360422],reported angle .6. Use omegaA[0,0,-1],omegaB[0,0,1],vA=vB0. No stop row is eligible. Add its opposite spin direction as a second literal if root fixes it in the input list.

Retain the old `exact-upper-limit` raw quaternion fixture as a distinct rounding control: its actual old computed angle is .7999999999999999, not exactly .8. Under the issue's exact target predicate it is INTERIOR even though its historical name says exact upper. The first orbital-loss input uses those same raw quaternion values. Do not snap its target to .8, add an angle slop, or silently make it an active-stop case. Root must state whether these two rounding controls belong in the declared list; exact eligibility must follow the frozen binary target.

The six stop literals above plus the interior literal are a concrete proposed control list. Root fixes additional nonzero P/L, common-velocity, opposite-spin, sign/Z and signed-zero literals, counts and order before implementation. Their old authored inputs can be reused as data; their old v/omega-unchanged verdicts cannot be reused as final new-law expectations.
