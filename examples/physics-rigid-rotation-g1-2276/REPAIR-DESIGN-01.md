---
work_id: physics-rigid-rotation-g1a-repair-2276
artifact_type: bounded-axisymmetric-repair-design
status: PROPOSAL_PARENT_FREEZE_REQUIRED_NO_IMPLEMENTATION_OR_EXECUTION
owner_role: independent-physics-algorithm-work
source_request: choose the first free-rotation repair after the preserved public baseline NO_GO
last_updated: 2026-11-02
---

# Decision and preserved baseline

Choose the exact torque-free symmetric-top flow for the first staged G1a
repair. Use a new private body-aware free-rotation leaf in the existing public
World candidate graph. Keep the shared geometric advanceOrientation helper,
all old isotropic arithmetic and common commit ownership unchanged. Do not
select an iterative general rigid integrator before a bounded G1b reference.

The actual baseline at evidence/g1-baseline-01 is immutable
CHARACTERIZED_PHYSICAL_NO_GO in source/native. Parent reported first Lx
residual -3.472182034651074e-7kg m²/s, maximum Ly residual
8.333140433438353e-5 against2e-12, zero rotational-energy change and
quaternion squared-norm defect2.3943771368430156e-16. These are existing
observations, not calculations executed by this design. Energy alone missed
the physical defect. No baseline rerun or altered failure is proposed.

This document and REPAIR-CASES-01 are author-only. No package/source, old
CONTRACT/CASES, baseline, reference or criteria file is edited. No module,
fixture, reference arithmetic, build, candidate or World is executed. Parent
must freeze this design before implementation and separately freeze the final
source/oracle/harness before one run.

# Exact flow and integration boundary

For a symmetric top let A be its repeated principal moment, C its distinct
moment, e the body-local symmetry unit axis and q0 the current candidate
orientation. Its current world symmetry axis is a0=R(q0)e. From current world
omega0, compute u=omega0 dot a0, temporary world momentum
L=A*omega0+(C-A)*u*a0, Omega=L/A and k=(A-C)*u/A.

The exact free flow is q1=Q_world(Omega,dt)*q0*Q_body(e*k,dt), followed by the
ordinary quaternion unit normalization, and omega1=Omega+k*R(q1)e. The left
factor rotates around fixed spatial momentum; the right factor accounts for
spin around the body's symmetry axis. Both use radians and seconds. No force,
motor, contact or constraint reaction is derived from this flow. There is no
energy/momentum clamp, fitted damping, projection or repeated correction.

This is a specialization of Euler's torque-free equations, with no local
truncation error for the declared axisymmetric model. Binary64 rounding and
normalization still need the frozen physical/trajectory gates. Do not claim
an observed order from errors already at the rounding floor.

Implementable private boundary after parent authorization:

- Expected edit surface: src/world.ts free-motion dispatch and one new private
  src/rigid-free-rotation.ts; no public type/entry, Body history or CAD change.
- Retain the existing external angular impulse/torque and motor order. Derive
  L from the actual numeric q/omega **after** those stages, inside the current
  copied body. No accepted/model initial momentum is reused on later steps.
- Select actual numeric isotropy by exact equality of the admitted principal
  moments. Spheres, original cubes and capsule proxy then execute the original
  omega/quaternion statements and helper with identical arithmetic/order.
  No tolerance, ID, fixture/archive detector, legacy flag or user mode selects
  that path. Merely reading classification data must not rewrite it.
- Axisymmetric eligibility uses equal primitive box half-extents and the
  corresponding exact equal numeric moments, with positive finite A/C.
  Rounded equality of unrelated geometric moments is not authority to call a
  genuinely triaxial model axisymmetric. A body-axis index supplies e; the
  first numerical qualification covers the frozen z-symmetry literal family.
  Other axis/frame ranges require their named G4 controls before adoption.
- Compute paired q/omega in local temporaries, with local normalization for
  the physical q used by this new flow. Zero spin returns a copied constant
  orientation/zero physical spin without dividing by a zero axis. C=A uses
  the preserved isotropic path. Principal spin has the uniform-spin limit.
- Keep the existing pre-flow angular guard. Before any later stage consumes
  newly recomputed omega, repeat finite/component and speed*dt limits for the
  new result and check finite/unit q. NUMERIC_LIMIT refuses without a partial
  accepted update. Do not change any existing bound or silently cap omega.
- Assign only candidate-body fields after preparation/guards. Contacts,
  joints, CCD, warm starts, sleep and final output/recording preparation keep
  their current order. Never restore an earlier L after their impulses or
  sleep zeroing. L is local scratch and is discarded before shared commit.

The one World still owns all state/time. Static/kinematic and sleeping
branches, P5's earlier domain return, existing geometric joint-correction calls
and common P0/P2 error/owner/commit behavior retain their ownership. Successful
torque/contact/motor trajectories are not qualified by an empty-command free
top even though the production boundary is placed correctly relative to them.

# Triaxial admission and activation

G1a does not silently reject, reinterpret or claim to repair currently admitted
triaxial boxes. Current production admission and runtime remain unchanged
during this staged study. The test overlay uses the actual common World and
new free-stage leaf; all unmodified ranges remain explicitly unqualified.
Its specialization is a mathematical body classification, not a second engine
or old/new runtime switch.

**Activation gate:** no promotion of this staged G1a result as a general-box
fix or completed G1. Before production adoption/core completion, G1b must
freeze and qualify a bounded general triaxial reference/integrator and resolve
the public admitted range, or the owner must separately approve an explicit
admission/migration contract. A restriction would be a visible support change,
not numerical PASS, and is not chosen/authorized here. Do not add a new
old-triaxial compatibility mode. G1b cannot use the axial shortcut with a
near-equality epsilon. Shared accepted-state integration ultimately needs one
declared correct flow for each supported class.

# Independent analytic oracle

Reuse the frozen baseline's nine-monomial cuboid integral and rational
normalized-quaternion observed-state audit by pinned pure-function import.
Do not copy them into a new truth source or import production helpers. A
separately bounded arithmetic adapter may change the operation ledger only;
the original scalar/bit checks and physical functions remain unchanged.

The trajectory reference uses a different analytic construction from the
candidate's quaternion product. For off-axis input in body axes with e=e3:
Euler's equations give constant u3 and a transverse (u1,u2) vector rotating
at b=(C-A)*u3/A. Independently evolve the world symmetry axis by Rodrigues
precession about fixed L at rate |L|/A. From the body momentum direction
ell_body(t)=diag(A,A,C)*u(t), construct body triad[p,e3 cross p,e3], where p
is its normalized transverse projection. Construct world triad[P,a cross P,a]
from the projection of L perpendicular to a(t). Then
R(t)=worldTriad*bodyTriad-transpose. This fixes the spin phase that L/E alone
cannot determine; it does not reuse candidate quaternion composition.

For these off-axis literals the initial transverse speed is exactly1, so the
normalizing momentum magnitude is the positive A. Isotropic and principal
limits use independent uniform-spin Rodrigues matrices; zero spin is exact.
Extract reference q from R using the positive-trace square-root branch, then
the declared initial q sign. The1s population has |omega|<=sqrt(2) and the
continuous scalar q component stays safely away from0. The reference must
enclose/verify that branch bound; no ad hoc quaternion branch switch or sign
normalization is allowed. Reference physical R is sign-independent.

Check analytic derivatives Rdot=[omega]x*R, body Euler equations, fixed world
L, energy, orthogonality/determinant and initial conditions using independent
interval expressions. The correct derivative/phase check prevents two copied
wrong closed forms from self-certifying a shared spin-rate error.

Use the already proposed separate Decimal80/120 directed interval arithmetic,
128 fixed Taylor terms for sin/cos and exact remainder majorants at absolute
argument2. Here the full precession/Euler angles stay within[-2,2]; no pi or
argument reduction is needed. Square roots use adjacent rounded enclosures
with endpoint-square verification. Width<=1e-65 at80 and<=1e-105 at120,120
contained in80, residual intervals containing0, all caller contexts restored.
No adaptive precision/terms, numerical ODE or finest-grid truth. The independent
matrix/q extraction needs at most24 square roots total; this supersedes the
unexecuted future-proposal18 bound, before any repair implementation/math.
No baseline or old tolerance changes.

# Frozen first repair population

Reuse the original future-proposal literal two trajectory families, three dts,
four one-step controls and four command-refusal recipes.1kg cube and
z-axisymmetric box; omega[1,0,1]; zero gravity/translation/contacts/joints;
duration1s; dt1/60,1/120,1/240;60/120/240accepted steps; matched quarters of
the common exact sum n*dt_native. State clock remains the public rounded rule.
Controls cover principal spin, positive zero, signed zero/negative q and
negative q with off-axis spin. Canonical native words and intended rounding
remain separate. No arbitrary new scale, body or contact case enters.

Preserve all baseline conservation/norm/COM/linear1e-12 gates exactly. They
apply to every initial/accepted state against its own initial physical state.
For this chosen exact-flow strategy, freeze the trajectory component gate
before implementation at1e-11 absolute+1e-12*abs(reference) for world omega,
R entries and continuous-sign q, with worst reference-interval endpoint error.
This replaces the old **unexecuted proposal's** loose grid-specific trajectory
limits. It tightens new G1a truth and changes no executed acceptance criterion.
Three-dt refinement retains the1.8 reduction rule with1e-11 rounding floor;
all grids below the floor means ROUNDING_FLOOR and no measured-order claim.

Source complete PASS precedes native constructors. Source/native repaired
public physical/state fields match raw bits with own frozen provider identities
checked explicitly. Existing baseline providerDigest values are historical,
not the new source/native provider identities. Do not demand old failed
anisotropic q/omega bits remain unchanged; those are the quantities being
repaired. Isotropic arithmetic/source-transfer and named old receipts stay
preserved at their actual scope. No old successful full campaign is rerun as
a convenience or relabelled as G1a trajectory truth.

# Atomicity, finite ledger and cost

Use the existing axisymmetric dt120 World at step0 for all refusal/fault
controls. The four original command refusals and three unknown markers remain:
partial candidate omega assignment, complete candidate pose/omega, prepared
output before shared commit. Add exactly three test-only post-recompute guard
injections: nonfinite omega; finite component1001; components[900,900,900]
which individually fit the component bound but violate the dt120 angular
movement bound. They must yield canonical NUMERIC_LIMIT before downstream use.
These are validator controls, not naturally observed physical failures.

After each failed attempt getState once and require accepted state/clock and
test-observed accepted caches unchanged; same unknown Error identity. The
originally scheduled first accepted step supplies recovery against independent
truth; no recovery World/step is added. Later-body, recorder-log and affected
downstream API integration remain separately budgeted pre-adoption gates, as
the integration audit states. This small study cannot certify them by omission.

Per graph:10constructors;844accepted steps;4command refusals;3unknown faults;
3post-flow guard refusals;854step attempts;20getState;10disposals. Across two
graphs:20constructors/1688accepted/8command refusals/6unknown faults/6guard
refusals=1708step attempts;40getState/20disposals. Dispatch entry ceiling
850per graph/1700total includes accepted+unknown+post-flow guard attempts;
the original extreme-torque refusal is before the new free stage. No query,
getModel, recorder, contact, CAD or external-runtime call is included.

One reference process:2integral certificates,10unique nonzero analytic samples
at80/120 (20evaluations),<=80 sin/cos evaluations at128terms,<=24sqrt,
1708initial/accepted-state audits,<=10000000 bounded Fraction scalar operations,
0ODE/linear solves. Identical refused states use raw equality, not new audits.
Every accepted step waits for its invariant audit; every matched-time step
also waits for analytic truth before later World calls. Reuse saved reference
values across grids/source/native. Stop the entire prefix on first failure.
The10 times are8family/quarter samples plus the principal one-step sample and
the off-axis dt120 first-step recovery/negative-q sample. That last time is
not a quarter checkpoint; it is explicitly counted rather than hidden in reuse.
Persist raw state words plus compact exact invariant/error/bound receipts on
success; keep full matrices/contexts in the small analytic bank and first
failure. Do not write a full duplicated matrix tree for every accepted frame.

Keep170s work/180s external owned group/4s cleanup, no retries. Logical64MiB
partition stays8MiB reference,8MiB World/harness,16MiB source/build,16MiB
evidence,16MiB reserve, with complete simultaneous-root/serialization charges.
No process/tool heap or RSS claim. Stored Fraction4096bits/products8192/sums8193
and rational text1300characters remain. Exact providers/tools, injection
sites, static transfer and actual internal/helper call counters must be frozen
before execution; no hidden iterative method follows from these ceilings.

# Next gate

Parent review/freeze, then narrow staged implementation and independent oracle/
runner authoring, source review and one separately authorized qualification.
No implementation/runtime starts now. A PASS would close only the named G1a
leaf. Triaxial G1b and needed public integration remain before activation/G1
completion; P4 and other required roadmap exits still block merge. Old P3/P4
laws/tolerances, the original baseline NO_GO and instantaneous P6 PASS remain.
