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
