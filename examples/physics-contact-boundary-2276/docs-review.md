---
work_id: physics-contact-boundary-2276
artifact_type: read-only-documentation-review
status: review-complete-implementation-not-requested
owner_role: physics-motion-docs-reviewer
source_request: "Review Physics and Motion content on the documentation site alongside the contact-boundary work"
last_updated: 2026-11-01
---

# Physics and motion documentation review

The robot documentation already explains useful API, unit, playback and
verification boundaries. The main content gap is a discoverable Physics
package guide that connects existing bounded APIs to their actual evidence.
Keep robot motion inside CAD Model. Do not restore the retired Motion package.

This is a source review and a proposed content plan. No website, package,
navigation, test, browser, build, simulation, or publication was changed or run.
All existing HOLDs and historical NO_GO receipts remain unchanged.

## Source and publication boundary

Reviewed checkout: `/Users/user/Documents/ChatGPT/barocss-physics-motion-2276`,
branch `codex/physics-contact-boundary-2276`, HEAD `8d7474ba0` at inventory.
Its working tree contains ongoing boundary work; this review does not adopt it.

The current local CAD checkout is
`/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`,
branch `local/cad-dev`, HEAD `c24e282fc`. A read-only comparison of the docs
trees found only a `studio/files.md` change between these heads. The reviewed
robot, limits, verification, configuration and navigation content is the same.
The active CAD checkout has no root `createPlanarPendulum` export. The review
checkout does, at `packages/barocss-physics/src/index.ts:5-6`. The independent
branch's new API must not be described as adopted by the active CAD checkout.

The library site is VitePress (`apps/library-docs/package.json:7-12`).
`apps/library-docs/docs/.vitepress/config.mts:23-29` sets clean URLs, excludes
underscore include files, and gives no canonical hostname or custom base.
The paths below are verified local route paths, not verified deployed URLs.
No live public site was read, so this review makes no deployment-content claim.

The existing `.github/workflows/deploy-docs.yml:8-18,63` targets
`apps/barocss-docs`, rather than `apps/library-docs`. Do not infer that this
workflow publishes the reviewed CAD library site. Confirm the intended site
host, build artifact, deployment pipeline and revision before publication.

## Existing coverage

| Verified local route | Source and useful coverage | Review finding |
|---|---|---|
| `/studio/robots` | `apps/library-docs/docs/studio/robots.md:6-40,63-124,281-336` | Joint tree, UI playback, limits, public degree/mm inputs, SI export boundary and MMGS reports already exist. Preserve these distinctions. |
| `/packages/cad-model/` | `apps/library-docs/docs/packages/cad-model/index.md:427-431,467-515` | `Robot.path`, `motion`, `poseAt` joint results, `robot.pose` placements and separate clearance checks. A strong existing API entry point. |
| `/how/cad-model` | `apps/library-docs/docs/how/cad-model.md:22-29,111-130` | FK product of exponentials, IK residuals/Jacobian, loops and inertia. No new kinematics explanation needs to be invented. |
| `/reference/limits` | `apps/library-docs/docs/reference/limits.md:13-28,93-106` | Planned physical experiments, prescribed torque versus forward prediction, looped collision refusal. Preserve the CAD workflow's planned status. |
| `/reference/verification` | `apps/library-docs/docs/reference/verification.md:17-24,30-60,125-141` | Test-derived samples, unit conversion, numerical versus file-byte checks, numerical/measured/product stages. Extend this existing evidence framework. |
| `/` | `apps/library-docs/docs/index.md:39-60` | Lists CAD/CAD Model/GPU/Studio/Viewer/Agent, with no Physics entry. Correctly says animation does not establish physical prediction. |

The navigation source is `apps/library-docs/docs/.vitepress/sidebar.mjs`.
It already links robot motion under CAD Model (`:42-54`), Robots under Studio
(`:90-98`) and limits/verification (`:188-197`). There is no Physics section.
The top navigation also has no Physics entry (`config.mts:32-41`). No existing
`docs/packages/physics/` page was found in either reviewed docs tree.

## Ownership and evidence facts to preserve

The retired Motion work previously owned `packages/barocss-motion` and
`examples/motion-scene`. Those paths were removed after Viewer adopted display
pose; see `docs/autonomy-v3.md:153-185`. That source also warns against assuming
one universal CAD up axis. Robot paths remain CAD Model functionality, Physics
owns bounded forward dynamics, and Viewer owns display pose application.

| Capability | Actual owning source/evidence | Documentation status to use |
|---|---|---|
| FK, IK and saved/timed robot paths | `packages/barocss-cad-model/src/robot/{fk,ik,motion,profile}.ts`; `examples/physics-motion-foundations-2276/README.md:75-82` | Existing APIs with bounded numerical examples; no new Motion package. |
| Static holding efforts and prescribed-motion loads | `packages/barocss-cad-model/src/robot/dynamics.ts:1-8,36-49`; robot docs `:329-375` | Computed required moment/force. These do not simulate free motion from loads and initial conditions. |
| Reduced planar pendulum | `packages/barocss-physics/src/pendulum.ts:4-38,82-84`; foundation README `:30-39,61-65,83-89,117-131` | Local implemented one-coordinate ODE with independent numerical checks. Separate from PhysicsWorld, CAD-authored hinge workflow and hardware validation. |
| Public rigid World | `packages/barocss-physics/README.md:56-96,118-130` | Bounded SI forward dynamics, explicit fixed step, commands, profiles and refusals. No broad stack/network qualification. |
| CAD simulation proxy | Physics README `:50`; foundation README `:80` | Labelled control-net sphere/AABB approximation, exact source/revision binding and display conversion. Source-adapter tests do not establish compiled CAD or Viewer integration. |
| Original eight-box and two-hinge cases | `examples/physics-motion-nogo-2276/README.md:12-17,35-42,69-100`; `examples/physics-stack-solver-2276/README.md:94-121,175-183` | Historical admission limits, numerical/geometry failures and unknown causes stay visible. A scalar hinge certificate does not activate the two-hinge API. |
| New contact boundary construction | `examples/physics-contact-boundary-2276/evidence/geometry-source-01/result.json:2-24` and `geometry-emitted-01/result.json:2-24` | Four fixed cases, 128/128 strict rows, 77 former failed rows repaired, zero World/solver calls in these receipts. This is geometry evidence only. |

The boundary contract (`examples/physics-contact-boundary-2276/CONTRACT.md:43-69`)
requires separate original trajectory, normal KKT, position, phase and quality
checks before trajectory acceptance. Ongoing parent runs do not supply a new
result to this review. Do not publish a new full-stability claim from the 128
fixture rows, or reinterpret source/emitted parity as independent accuracy.

## Prioritized content plan

### P0 — Establish one support/status entry point

Add a small Physics overview to the package navigation and home package table.
Proposed route: `/packages/physics/`, source `docs/packages/physics/index.md`.
State the owning package, bounded prototype status, available public subpaths,
and which features exist only on an independent branch. Link the existing
robot pages; identify Motion as a capability, not an installable retired package.

Update the planned-experiment wording with two distinct rows: a locally tested
reduced pendulum API, and the still-planned CAD-bound free-motion workflow.
Do not remove the latter's planned marker merely because the ODE exists.

Bounded acceptance: every capability row names an owning export, exact profile,
evidence location and qualification level. No control/hardware, general stack,
multi-joint or engineering acceptance claim appears without its own evidence.
The publishing owner confirms which commit's APIs the site documents.

### P0 — Put the unit/frame boundary next to both entry points

Proposed route: `/packages/physics/units-and-frames`.
Cross-link it from `/studio/robots#robot-unit-boundaries` and the Physics overview.
Keep a single conversion table and one off-origin example:

- Public Robot values: degrees/mm; timed internal joint math: radians/mm.
  Motion limits follow each joint's unit. FK motions act on the solved world
  pose; they are not arbitrary absolute link placements.
- Robot facade inertia/mass reports: MMGS. Physics: m/kg/s/rad, kg·m² and N·m.
  Use mm→m ×1e-3, g→kg ×1e-3, g·mm²→kg·m² ×1e-9, N·mm→N·m ×1e-3.
- Declare world frame, quaternion x/y/z/w order, local/world axes, COM versus
  pivot inertia, contact A→B normal, and impulse signs. Do not assume all CAD
  data is Y-up. Physics examples use -Y gravity; robot statics default to -Z.
- Show 100 mm→0.1 m and +90° about an off-origin source center, using
  `displayTranslationMM = 1000*bodyPositionM - R*sourceCenterMM`.

Source anchors: robot docs `:281-336`, Physics README `:50,56,84,128`,
`docs/autonomy-v3.md:181-185`, and `examples/physics-motion-foundations-2276/units-contract.md`.

Bounded acceptance: one analytic off-origin test supports the example; each
conversion occurs once; unknown/stale source identity is a refusal. State
the proxy approximation and the source-adapter-only evidence boundary.

### P1 — Publish profile and lifecycle contracts

Proposed route: `/packages/physics/profiles-and-lifecycle`.
Extract a concise support matrix from the actual README and admission code:
default rigid, four-body persistent boxes, large-v1, bounded anchored/dynamic
hinges, CCD, replay, visual fluid/cloth, and reduced pendulum where adopted.
List incompatible combinations and step/size/body limits per profile.

Explain the caller-owned clock, exact configured `step(dt)`, copied state,
one-step force versus impulse, idempotent disposal, and retained accepted state
after refusal. Document replay restore separately from arbitrary state loading.
Do not promise `reset()` on the reduced pendulum: its current interface has
only `getState`, `step` and `dispose` (`pendulum.ts:34-38`).

Source anchors: Physics README `:52,73-84,92-110,118-130`. Keep the public
four-body persistent limit distinct from the private nine-body experiments.
Contact impulses and joint projection reactions are not calibrated mechanical
loads (`README.md:96`). A replay equality is not a physical accuracy result.

Bounded acceptance: examples import actual public exports, exercise one expected
refusal and disposal, and show the retained state without hidden retry. Keep
separate source and genuine emitted-consumer instructions.

### P1 — Give motion a short guide with explicit stages

Proposed route: `/guide/robot-motion`, linked from the existing Robots and CAD
Model pages. Reuse those pages' API examples rather than duplicating their API.
Explain the sequence: joint inputs → timing profile → `poseAt` joint values →
`robot.pose` placements → optional clearance check. Separate FK, IK, trajectory
sampling, inverse dynamics, forward dynamics, contact, feedback control and
hardware execution in a small table of inputs and outputs.

Add trapezoid/S-curve limits, synchronized joints, segment rest-to-rest behavior,
zero-length segments, endpoint clamping, and invalid finite-input checks.
Use `robot/profile.ts:1-7` and `robot/motion.ts:44-104` for low-level behavior,
and `api/robot` for the public facade. Preserve loop `LOOP_OPEN` and sample-budget
exhaustion distinctions. Studio playback speed changes are display controls,
not a physical motor/actuator acceptance claim.

Bounded acceptance: one mixed turn/slide tutorial includes an independent
duration/position oracle and expected typed refusal. Link current tests and
their measured residuals; do not call a plausible animation validation.

### P2 — Add reproducible numerical evidence and known limits

Proposed route: `/reference/physics-verification`, linked from the existing
verification page. Keep an explicit result table with model, exact input/profile,
oracle, gate, measured error, step size, cost, source/emitted graph and scope.
Link immutable receipts; retain the first failure and any later corrected result.

Use the existing foundation's period, matched-time state, convergence and energy
envelope evidence (`README.md:114-131`). Distinguish energy work accounting
from energy conservation, one fixed patch from a trajectory, and source tests
from independent references. Explain strict contact-line booleans separately
from 1e-9 m distance checks; point repair within a bound is not tolerance widening.

Include a compact known-limits table for original eight-box quality failure,
strict contact witness failures, the two-hinge public admission limit and the
historical report-field discrepancy. Keep causal unknowns explicit. Follow
the existing four stages in `/reference/verification:131-141`: implementation,
numerical verification, measured validation and product-flow acceptance.

Bounded acceptance: all pass statements specify their case and commit; unresolved
or not-run fields are explicit; no whole-engine or hardware badge derives from
unit counts. Hardware requires separate controlled measurements and uncertainty.

## Later documentation checks, not executed in this review

For an authorized implementation, reuse the site's existing `check:docs`,
`test:samples` and VitePress build scripts (`apps/library-docs/package.json:7-12`).
The README requires source-checked claims and tested samples (`README.md:9-11`).
Check navigation, anchors, imported snippets, and package source/emitted examples
at the adopted commit. Confirm deployment identity separately. These are future
acceptance checks, not passes reported by this review.

No new page, route, API, solver, integration, release or publication is approved
or implemented by this plan. Coordinate future page ownership through the
existing docs lanes; preserve current CAD work, old HOLDs, and failed receipts.

## Later parent evidence, kept separate from site acceptance

After this source review, the contact constructor's second revision passed
all192rows in six saved poses, including the previously unresolved row.
The actual source/emitted qualification is geometry-source-02/emitted-02.
The original-scene diagnostic prefix subsequently passed16steps each for
ALIGNED/OFFSET/YAW in source and actual-emitted graphs with raw-record parity.
ALIGNED additionally reached308independently accepted steps in source02,
then the fixed180s execution guard stopped the full-case attempt. Original
1200step/terminal settling acceptance remains NO_GO/NOT_RUN. These later
results do not change which APIs the active CAD checkout or site has adopted.
