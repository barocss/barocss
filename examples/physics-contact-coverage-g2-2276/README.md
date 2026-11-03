---
work_id: physics-contact-coverage-g2-2276
artifact_type: finite-contact-law-evidence-map
status: STATIC_EVIDENCE_MAP_COMPLETE_QUALIFICATION_OPEN
owner_role: independent-physics-algorithm-work
source_request: continue required roadmap G2 without duplicate campaigns
last_updated: 2026-11-02
---

# G2 contact and CCD evidence map

The initial inventory used source inspection and saved evidence, with **0** new physics/geometry/reference/World calls. The later C03 follow-up below made one source sweep and one independent witness audit, with **0 World** calls. No branch-coverage instrumentation ran. The rows name finite missing proofs; they do not promise universal contact support.

| ID | Law/profile | Boundary or evidence | Status | Next/evidence limit |
| --- | --- | --- | --- | --- |
| D01 | discrete normal impulse | closing/resting/separating; inverse-mass zero | HISTORICAL_PARTIAL | elastic pair and sphere support; no full branch census |
| D02 | restitution switch | closing speed below/exactly/above0.5m/s; unequal material minimum | MISSING_BOUNDARY_PROOF | freeze adjacent representable words; analytic two-body momentum/energy loss |
| D03 | discrete friction admission | zero mu / zero normal impulse / zero tangential speed | HISTORICAL_PARTIAL | support and zero-friction probe; zero impulse plus finite tangential speed separate |
| D04 | discrete static/dynamic friction | required impulse below/exactly/above muStatic*normal; reverse tangent; unequal mu | HISTORICAL_PARTIAL | sliding-to-rolling covers a transition, not exact boundary or unequal geometric-mean mixing |
| D05 | contact position correction | geometry before/after projection; force moment and work accounting | HISTORICAL_PARTIAL | sphere floor exact arm independent; generic body producer points insufficient |
| P01 | persistent normal accumulation | positive/clamped zero and normal-cache reduction | MISSING_BRANCH_PROOF | old32point equilibrium does not prove cache reduction law |
| P02 | persistent friction cache | tangent below/exactly/above1e-12m/s; stale tangent reprojected after normal decrease | MISSING_BRANCH_PROOF | do not widen original1e-12 switch or iteration caps |
| P03 | persistent Coulomb limit | requested norm below/exactly/above static; dynamic cap; zero cache | MISSING_BRANCH_PROOF | instantaneous point microcase then actual public profile if supported |
| P04 | eight-box long-time exit | ALIGNED/OFFSET/YAW1200 and original settle window | EXISTING_NO_GO | original failures/tolerances/timeouts preserved; no rerun in inventory |
| C01 | sphere/static-box face CCD | orthogonal face crossing, separating, rotated static fixture | HISTORICAL_SELECTED_PASS | TOI0.282 within1e-12; rotated normal probe is bounded smoke |
| C02 | slab CCD boundary | initial touching/overlap; stationary/parallel-outside; endpoint; tied axes | MISSING_BOUNDARY_PROOF | slab initial inside/touch returns no CCDhit, discrete owns subsequent response |
| C03 | sphere/static-box corner CCD | expanded OBB corner versus exact rounded Minkowski boundary | EXACT_CONTACT_WITNESS_NO_GO_CONSERVATIVE_BOUND | Actual corner witness fails; exact rounded contact and conservative broad-phase semantics stay distinct. See CORNER-RESULTS-01.json |
| C04 | multiple static fixtures | equal TOI sorted ID; near ties and input permutation | MISSING_BRANCH_PROOF | earliest tie uses >= and sorted fixture order; no capsule-query result transferred |
| C05 | sphere/sphere CCD | head-on crossing; overlap; separating; reversed input order | HISTORICAL_SELECTED_PASS | TOI0.135 within1e-12; equal mass inelastic head-on only |
| C06 | sphere/sphere quadratic boundary | zero relative travel, discriminant zero/negative, endpoint, near-grazing cancellation | MISSING_BOUNDARY_PROOF | independent analytic relative geometry; finite current admission only |
| C07 | axis-aligned box/static-box CCD | linear thin-face hit; initial overlap; no entry; rotated candidate refusal | HISTORICAL_SELECTED_PASS | TOI0.09541284403669836 within1e-12; CAD-based fixture receipt retained |
| C08 | box CCD admission boundaries | exact current angular tolerance, negative q equivalence, angular command refusal | HISTORICAL_PARTIAL | do not infer generic rotation support or silently normalize original input |
| X01 | capsule/rotating/general mesh CCD | outside admitted rigid CCD profile | NOT_SUPPORTED | private upright capsule geometry is a separate API; no rigid world capability claim |
| P05 | persistent material restitution meaning | nonzero restitution admitted versus inelastic accumulated-normal law | SOURCE_SEMANTICS_GAP_PENDING | Persistent normal stage uses no restitution coefficient; qualify/document selected profile law before assuming shared discrete bounce semantics. No new numerical failure claimed. |


## Reused evidence and limits

[COVERAGE-01.json](./COVERAGE-01.json) pins source laws, current test definitions, original source/emitted stdout and command records. It also compares seven current numerical leaf files to both historical contact and baseline source freezes. Those comparisons cover leaf bytes only. They do not turn old World/provider receipts into a current complete integration PASS.

The original elastic-impact assertions and source/emitted output are pinned explicitly through `world.test.ts` and `world-run.stdout`.

Existing analytic sphere support uses a finite floor, independent surface gap, gravitational impulse and energy balance for3,000 steps. Sliding-to-rolling uses240 steps, physical sphere arm, momentum, angular momentum and midpoint impulse work; its original sliding-position gate remains1mm. Elastic impact and named face-CCD receipts retain their original1e-12 or explicit test gates. We did not rerun them.

CCD sphere/static-box currently expands each box half extent by the sphere radius before the slab calculation. A rounded edge/corner boundary differs from that expanded rectangular box. This source observation warrants an independent geometric microcase before an engine run. It is a **hypothesis about a model gap**, not a measured new failure or permission to relax TOI tests. The existing face-aligned TOI proofs remain valid at their own scope.

Private capsule sweep tangent/tie checks are not rigid-World sphere/box CCD proof. Historical multi-box and support receipts are not generic friction-network or stable stacking proof. Original8-box32-contact/192-row/1200-step contracts and first failures are unchanged.

## Next dependency

Finish G1a staged rotation qualification. Then freeze a small G2 independent boundary population: restitution switch and material mixing, discrete/persistent Coulomb transitions, and exact CCD corner geometry. Review all current lawful inputs before running World. Preserve exact laws, iteration caps, errors, original reference and all historical NO_GO. No new dependencies, downloads, public API, deployment or hardware claim is introduced.


## First actual corner witness (2026-11-02)

[CORNER-RESULTS-01.json](./CORNER-RESULTS-01.json) preserves the source helper capture and independent exact rational closest-point witness. Status: **EXACT_CONTACT_WITNESS_NO_GO_CONSERVATIVE_BOUND**. The actual returned fraction is0.16666666666666663; centre-to-box squared distance is approximately0.0125m², above the frozen(radius+1e-12m)² bound approximately0.0100000000002m². Exact numerators/denominators and original raw F64 words are the authority.

The current source performed one actual model admission, one CCD-profile admission and one sweepSphere call. The independent files-only observer performed one point audit,41 checked Fraction operations and0sqrt/trig/ODE/helper/World calls. The first geometric failure stops the later biased-stop audit and native graph. No World was constructed or advanced.

The capture guard exits0; the witness guard exits1 for the preserved geometric NO_GO, with normal EOF/process closure. This failure shows that the returned expanded rectangular-box boundary is earlier than an exact rounded sphere/box contact. It does not establish tunnelling, refute an explicitly conservative broad-phase guarantee, or change existing face-aligned CCD receipts. Exact/conservative profile semantics and a bounded feature-aware repair are the next G2 dependency. No numerical limit, material law, public source or original8-box contract was changed.


## Current finite checkpoint (2026-11-03)

The table above is the original inventory. [COVERAGE-04.json](./COVERAGE-04.json)
records later finite proofs without editing inventories01–03. Discrete unequal
material restitution now has an independent16-case Source/Native proof. The
persistent changing-normal public baseline has a new tangent-plane and paired
witness NO_GO. It does not identify all internal PRE force points or prove that
cache projection alone repairs the physics. A private native box candidate is
kept separate from public World and full eight-box qualification. Original
first failures and all numeric/iteration gates remain. No blanket engine PASS.

The source-private contact/wrench producer now passes the bounded one-case
geometry, actual impulse/moment report and rollback/retry/restore contract.
`COVERAGE-06.json` records3 Worlds/8 attempts/6 accepted steps. Actual warm
applications are zero; Native/public/desktop/performance and original P4 remain
separate and unqualified. The earlier aggregate-report NO_GO is preserved.

`COVERAGE-08.json` records composed typed Source/Native warm recording passes,
10 desktop checks and the separate independent browser physical pass. The first
capture loss and old decoder resource NO_GO remain preserved. The next exact
cone before-case is a new source-only constitutive NO_GO; at/after remain
NOT_RUN. No blanket contact law, public package or original P4 PASS follows.

## Coupled cold static contact checkpoint (2026-11-03)

Source and actual strict emitted Native pass the original before/at inputs with
zero independent static contact-velocity residual. All33 retained packets match
without normalization. Per graph:3 Worlds/3 attempts/2 accepted steps,128 actual
applications,22 queries,19 points and513 anchor checks. Three pure reference
cases and eight separate refusal controls pass. After is a genuine typed
COUPLED_DYNAMIC_REQUIRED refusal before application with raw accepted data
preserved, not dynamic physics PASS. Original cone first failure and the new
precompiler esbuild-launcher failure remain preserved. See COVERAGE-09.json and
`examples/physics-coupled-contact-2276/RESULTS.md`. Post-application transaction,
wire and new-candidate desktop qualification are separate pending work; current
public adoption, dynamic P03, warm/multipoint and original P4 remain NO_GO/open.
All original criteria and HOLDs remain.

## Coupled static desktop checkpoint (2026-11-03)

The separate actual emitted browser consumer passes6 desktop checks at
1280/1440/1920 and15 unchanged independent geometry/physical/cone/target jobs
on the complete authenticated actual browser proof. Page/console/network errors
are zero. Actual census is3 Worlds/3 attempts/2 accepted steps,128 applications,
22 queries/19 points/513 anchors. Only before/at static physics pass; after is
a typed PREapply refusal with raw accepted data preserved. See COVERAGE-10.json
and `examples/physics-coupled-viewer-2276/RESULTS.md`. AUTHOR03/build01 executed;
withdrawn04 was a corrected stale-read proposal, not a browser/source failure.
GPU triangles are display-only and screenshots are not numerical evidence.
No mobile/deployment/public adoption or dynamic P03/full P4 qualification follows.

## Transaction first observation failure (2026-11-03)

Source actual rollback after nonzero J/bucket mutation, independent fault-prefix
physics, clean retry and complete raw public/recording/private-world equality
pass. Actual serialization executes. The next hidden B comparison fails because
disposal cleared its world storage; genuine pre-dispose full accepted output was
not retained. Prefix2 Worlds/4 phase attempts/2 accepted steps,129 applications,
21 queries/19 points/513 anchors. Native, deserialization, live D restore and
parity remain NOT_RUN. COVERAGE-11.json and ROOT-FIRST-FAILURE-01 preserve this
NO_GO. A new bounded pre-dispose observer is a dependency, not an achieved gate.
No failed condition is deleted, relaxed or filled using reconstructed data.

## Genuine lifecycle and dynamic arithmetic checkpoints (2026-11-03)

The distinct lifecycle provider25da0c262 passes40 static and44 transaction
packet/wire matches between Source/Native. Real pre-dispose captures close the
hidden accepted-state observation gap without reconstructing output; old0210
NO_GO stays unchanged. Its browser8b6b2400a passes7 desktop checks and15 unchanged
physical observers plus raw lifecycle proof comparison, with zero UI errors.
See COVERAGE-12.json. The current preview is localhost53040.

Independent reference c1d9a640c is READY. Original dynamic pure36f260949 stops at
a denied262146 attempted charge under262144; that prefix is not a completed cost.
Efficientc67bc917e passes3 physical inputs and8 admission controls per Source/Native
graph,13 top-level calls and14 full packets. After completes241975 integer
primitives under unchanged prices/caps. Zero Worlds run. General arithmetic
boundary banks and runtime host integration still block promotion; the original
production13-call/cap16 remains separate from new private test-entry work. See
COVERAGE-13.json. Dynamic World, warm/multipoint, public adoption and P4 remain
NO_GO/open; no mobile/deployment or machine-accuracy claim follows.

## Shared arithmetic boundary checkpoint (2026-11-03)

Source and actual NodeNext Native each pass the unchanged production13/cap16
regression, with all14 complete packet/counter files raw equal to efficient2429.
Separate fresh private-entry processes each pass52 independently audited
literal polynomial/RNE/resource cases under cap64; all53 files including bank
match raw between Source/Native. Their observed sum65 is across separate
processes, not one combined64 cap. Shared production arithmetic has no test
entry or lowering hook. World calls remain0 for this checkpoint. First strict
compile failures01/02 remain preserved;03 changes only erased type annotations.
See COVERAGE-14.json and `examples/physics-coupled-arithmetic-2276/RESULTS.md`.
Actual dynamic World is the next priority, before desktop and original long-stack
expansion. HOLDs, tolerances, old failures and NoDeploy remain unchanged.

## Actual coupled dynamic World checkpoint (2026-11-03)

The new private host passes original before/at/after in Source and actual
NodeNext Native: each3Worlds/3attempts/3accepted,192applications,30queries,
27points/729anchors. All18independent observations pergraph pass; full26files
match raw. Actual dynamic normal-speed residual2.245727290605634e-18m/s,
cone magnitude residual3.26936304418379e-18Ns and opposition residual
3.2620547630988122e-18Ns satisfy unchanged1e-10/1e-12 gates. This qualifies only
one cold exact point and first interval. Initial ESM-format build NO_GO remains.
Inherited typing boundaries are explicit, no new waivers. See COVERAGE-15.json
and `examples/physics-coupled-dynamic-host-2276/CLEAN-RESULTS.md`. Post-impulse
rollback/wire, dynamic desktop, warm/multipoint, public adoption and original
long-duration eight-box settling remain separate unqualified gates.

## Dynamic after transaction checkpoint (2026-11-03)

Source/Native each pass4Worlds/6phase attempts/4accepted intervals and20independent
audits, including genuine post-J/bucket rollback and actual serialize/deserialize/
restore. Full38packet/wire files match raw; valid wire is4771bytes. Hidden
accepted outputs use genuine pre-dispose getters. Hidden initial getter is
NOT_RETAINED; same-model initial controls are explicitly bound to actual hidden
creation/attempt/free-input/cache records. No ID normalization. Second interval
remains a typed pre-phase refusal, not physics success. See COVERAGE-16.json and
`examples/physics-coupled-dynamic-host-2276/TRANSACTION-RESULTS.md`.
