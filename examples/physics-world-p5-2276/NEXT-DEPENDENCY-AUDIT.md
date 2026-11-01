---
work_id: physics-world-next-dependency-audit-2276
artifact_type: bounded-source-only-dependency-audit
status: READY_PROPOSAL_ONLY_NO_IMPLEMENTATION_OR_RUN
owner_role: independent-physics-algorithm-review
source_request: select one next algorithm dependency after P5 without a new World or evidence substitution
last_updated: 2026-11-02
---

# Decision

After the remaining P5 consumer/document gates close, freeze one P6a precursor:
an instantaneous, contact-free attachment impulse operator between one finite
cloth-vertex mass and one off-COM rigid anchor. Start with its explicit plant,
typed endpoint/report requirements and independent reference. Do not activate
coupling or change public schemas in this audit.

This is an algorithm building block, not P6a completion or a new simulation
owner. It has no clock, World, legacy bridge, scene loop, controller or CAD
dependency. Whole-cloth integration, contact, attachment position drift and dt
convergence remain later unqualified work.

# Inspected facts

Source checkpoint:5e3a3c642ae81f460109c96ec2b0401923df3624. This audit reads
the actual `packages/barocss-physics/ROADMAP.md:208–234`; it does not replace
that roadmap or execute any provider.

| Track | Actual dependency and current boundary |
|---|---|
| P4 | Roadmap214,227–230 requires the original eight boxes+floor,32-point/192-row gates and ALIGNED/OFFSET/YAW1200-step exits within180s. P5 success does not replace it. |
| P6a | Roadmap216,221–223 requires P5 plus the actual rigid/contact leaves used by a small declared pair. It requires equal/opposite impulse/torque, attachment/contact residuals, work, refinement and boundary/refusal tests; no pin-as-reaction shortcut. |
| P6b | Roadmap217 makes it independent of P6a, with its own rigid/contact prerequisites, mass/reaction/pressure or buoyancy reference and particle/dt refinement. It is not enabled by static visual PBF. |
| P7 | Roadmap218 requires the applicable P3/P4 leaves, fixed-axis dynamics and an explicit plant; two-link conservation/reference precedes tracking/control. Two disjoint hinges are not that plant. |

P5b actual source and native public qualifications each reached101 factory
attempts/37 returned Worlds and6334 step entries:6281 accepted,13 synthetic
failures and40 refusals (`public-runtime-results.json`). These are named
provider/runtime results. The parent is closing strict-consumer and document
checks separately. The preserved native-import01 external-module collision
and subsequent resolved-entry02 PASS do not change numerical source authority.
No broader product, hardware or whole-roadmap acceptance follows.

Current code confirms the following limits:

- `types.ts:42–50,55–76,121–126,155–166`: rigid joints and JointState have two
  body IDs; Cloth has staticColliderIds and local vertex indices; commands target
  body IDs; Fluid has visual-unit-weights and no calibrated particle kg/density
  or pressure law. Type presence is not coupled-profile admission.
- `domain/admission.ts:64–81` admits one cloth or fluid, static owners only and
  empty joints. Existing visual profiles must continue refusing dynamic mixtures.
- `cloth/constraints.ts:23–39` projects cloth positions against the fixed
  profile sphere and skips zero-inverse-mass vertices. It does not update a
  rigid candidate or accumulate its opposite impulse/torque. Pins are supported
  boundary conditions. Their correction is not measured dynamic reaction.
- `domain/cloth.ts:10–16` reconstructs finite physical vertex masses separately
  from zero inverse masses at pins. Its XPBD multipliers and position correction
  are not already public SI attachment impulses. Reset/substep/compliance and
  velocity reconstruction must be accounted before deriving any force claim.
- `fluid/kernel.ts:5–38` sums its normalized-shape kernel and uses the initial
  mean as restDensity; `fluid/pbf.ts:29–44` uses compression and algorithmic
  lambda. No source statement turns these quantities into Pa or calibrated
  fluid mass. Static-box hit counts do not establish a force model.

P4's support-radius cache approach is closed. V1/v2/v3 each preserve selected
CURRENT raw equality but fail cost; v3 is885643000→1078494000ns and sets
specificCacheSliceEnded. No fourth cache variant, profiling run, repeated
prefix or full-stack replay is proposed here. Historical raw-sign UNKNOWN,
original stack NO_GO, step77/missing-operand limits and all HOLDs remain.

# One proposed slice: finite-mass off-COM attachment exchange

Inference from those source facts: P6a offers a smaller physically interpretable
next dependency than P6b or P7. Cloth already has kg vertex masses and the rigid
model has COM mass/inertia. A small isolated impulse stage can therefore have
an independent SI oracle without inventing calibrated fluid properties or a
nonlinear two-link trajectory.

Freeze an ideal instantaneous bilateral velocity attachment as a NEW plant
assumption before code. Use an unpinned positive-mass vertex, a finite positive
rigid mass/positive-definite COM inertia, a fixed input orientation and a
nonzero local anchor arm. Initial vertex/anchor positions coincide. There is
no gravity, damping, environmental contact or positional projection during this
isolated exchange. The rest of a sheet is not advanced by this primitive.
Do not describe this reduction as the existing full289-vertex cloth law.

The operator removes attachment relative velocity by one shared impulse. The
cloth receives J in Ns; the rigid COM receives -J; the body angular impulse is
r×(-J) in Nms using the world-space arm in metres. Off-COM data is required so
the torque test is nontrivial. Both updates belong to one candidate operation;
neither side is an external command to a fabricated body ID.

This law is an explicit ideal constraint choice, not a conversion of existing
XPBD lambda, a cloth material calibration, a contact restitution/friction law
or an assertion of energy conservation for an incompatible initial velocity.
The chosen projection's kinetic loss/work must be derived and checked, not
hidden as damping or forced to zero.

# Dependencies and oracle gate

Only these prerequisites are needed for this slice:

1. Close P5's remaining named source/native consumer and documentation gates;
   retain its single candidate/shared-commit owner and original profile refusals.
2. Freeze distinct cloth-vertex and rigid-anchor ownership/references, finite
   mass/inertia units, sign/frame convention and coupled report meaning. Existing
   bodyAId/bodyBId JointState cannot hold a cloth endpoint. Do not put a cloth ID
   in bodyId or substitute a pin for a dynamic attachment. The audit adds no new
   public type, command or default parameter.
3. Identify the contact-free rigid impulse/rotation leaf actually used, including
   its source receipt and COM inertia convention. An absent needed receipt is
   a dependency to prove with the small oracle, not permission to infer it from
   a supported shape union or disjoint hinge PASS. No collision solver is used
   in the proposed primitive; the eight-box settling exit is not its oracle.
4. Freeze literal plant data, finite case/call/resource budgets and numerical
   error criteria before execution. No tolerance is selected or declared PASS
   here. Keep admission, unsupported mixes and transaction failures explicit.

Independent reference concept: construct the constraint's small effective-mass
linear system from independently owned mass, inertia and lever-arm equations.
Use literal rational first fixtures and an exact rational solve, with a
separately specified high-precision cross-check. Import no Physics
solver, production matrix builder or reported expected reaction. Check the
full vector solution, relative-velocity residual, total linear momentum,
angular momentum about a declared common origin, and the derived kinetic
work/dissipation. Preserve actual input/output IEEE operands and units beside
reference values. Byte equality to production output is not this physical oracle.

The later finite recipe must cover centered and off-COM controls, motion along
and across the arm, zero-relative-velocity response, declared mass-ratio and
inertia boundaries, wrong endpoint/pin/zero-mass refusals, and a failure after
the first candidate-side update. Refusal must leave BOTH accepted domains and
the common clock unchanged. This remains one small operator contract, not a
general cloth-contact framework.

Only a separately frozen subsequent coupled trajectory can qualify substep
exchange timing, impulse application exactly once, attachment drift, external
pin/support reactions, full-sheet work and dt convergence. The operator's
instantaneous proof cannot be relabelled as those exits. P6b still needs its
own mass/pressure plant; P7 still needs connected nonlinear dynamics and then
actuator units, saturation, sample time and reference-vs-response tracking.

# Preserved stops

This document authorizes no implementation, schema/API change, mathematical
call, World or new tolerance. Existing visual evidence stays visual. P4 and
other required roadmap exits still block integration, even if a later P6a
primitive passes. Public support, #1490 live integration, CAD/Studio/HOLDs,
hardware, merge, publication and deployment retain their separate gates.
