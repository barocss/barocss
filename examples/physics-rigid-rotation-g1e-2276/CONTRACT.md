---
work_id: physics-rigid-rotation-g1e-2276
artifact_type: supported-input-and-forced-rotation-contract
status: authoring_authorized_runtime_requires_parent_hash_freeze
owner_role: independent-physics-algorithm-work
source_request: finalize G1 support inputs and validate nonprincipal external loads before public adoption
last_updated: 2026-11-02
---

# Meaning and preserved evidence

Angular impulse is instantaneous at the start of a step. World torque is
constant over its configured positive interval and expires afterward. The old
full-torque kick followed by free rotation is a first-order discretization.
G1d K qualified that discrete map, not the continuous forced pose. Its original
PASS, code and inputs remain immutable; this correction narrows its physical
interpretation. G1d recording/rollback and all old free-flow evidence remain.
No held worker, Studio/manufacturing/equipment work, deploy or dependency change.

# Fixed micro population and mathematical reference

Use the saved actual native M02 input: one 1 kg box, half extents
[0.1,0.2,0.3] m, q identity, world omega [1,1,1], zero linear state/gravity,
dt=1/120 s, discrete/direct, no contacts/joints/CCD/domain. J is
[1/1024,-1/2048,1/4096] N m s; tau is [1/128,-1/256,1/512] N m.
J uses angular impulse only. JT uses both commands. These are nonprincipal
loads; J and tau are parallel to each other, not to initial spin or a box axis.

Reference input contains only the raw pair and commands, never candidate state.
Derive true inertia by cuboid monomial volume integration. Let p=body momentum
divided by L*=1/16 kg m²/s and D=L*I^-1. Independently integrate 13 variables:
p'=p cross Dp + R^T tau/L*, R'=R[Dp]cross, W'=tau dot R Dp, W(0)=0.
The initial p includes R0^T J/L* once. W is expressed in joules divided by 1 J.
Use directed Decimal80/120 Taylor32, two fixed native dt240 windows per case
per precision, full degree64 polynomial defect, Picard tube17/16 and verified
field/Lipschitz caps8/16. Thus eight new windows maximum. Check rather than
assume tube/conditioning bounds after adding linear force/work terms.
Require endpoint R/omega/q/W widths <=1e-24 and intersecting precision targets.

Audit actual before/after data using independent proper quaternion geometry
and integral inertia. Lend must equal Lbefore+J+tau*dt. Instant impulse work is
omega_before dot J + (J dot Iworld^-1 J)/2. Compare Eend-EafterJ with the
independently integrated W. Never define reference work as observed energy
difference. Retain old gates: L/work/energy residual1e-12+1e-12*max(1,abs(values));
squared q norm1e-12; R/omega/q endpoint1e-11+1e-12*abs(reference endpoint).

# Execution order

1. Parent hash-freezes all scripts, actual tools, old provider sources and input.
2. Capture a NEW paired baseline with the existing corrected-free M02 World:
   Source J/JT then Native J/JT, four Worlds/reads/steps/disposals. This is a
   baseline acquisition exception: physical classification starts only after
   both graphs close. Operational/schema failure stops immediately.
3. Build one independent bank from inputs; classify all four closed records,
   preserving first physical failure for each graph. Do not relabel an expected
   torque failure as PASS. Preserve the bank for reuse; no old reference prefix
   is rerun. No corrective solver is loaded under this baseline freeze.
4. Only after baseline review, separately freeze a repaired micro. It reuses
   that same bank without new ODE work. Run Source J/JT then Native J/JT only
   after Source PASS. Four Worlds/four accepted steps/eight state audits maximum.
5. A new trajectory/horizon extension requires a separate freeze after micro
   PASS. No extension or public activation happens automatically.

# Corrective candidate and support decision

For zero torque retain the qualified S8 free flow after one impulse kick.
For nonzero torque reconstruct L+ from the actual post-impulse q/omega, integrate
q with two fixed RK4 halfsteps, eight RHS evaluations total, and exact stage
L(t)=L+ +tau*t. Each stage uses homogeneous proper R(q), left world quaternion
rate, and the raw stage q. Normalize only at each accepted halfstep; recover
omega from qend/Lend. No full tau*dt kick before this flow, no double impulse,
adaptive iteration, compatibility solver or old anisotropic fallback.

The future public admission change is explicitly breaking and uses the existing
World/profile API. Dynamic spheres, true cubic boxes and the declared capsule
proxy retain their previous support. Other dynamic boxes must match an explicit
qualified isolated-rotor leaf; reject the rest at construction with INVALID_CONFIG.
An initial public leaf may be only this literal dt120 identity rotor and one
accepted step, with empty/J/JT commands after those respective physical gates
pass. Out-of-leaf commands refuse INVALID_COMMAND; exceeding the declared
physical horizon refuses NUMERIC_LIMIT, preserving accepted state and recording.
No new integrator option or second World. A numeric guard is not a qualified
continuous input interval. Support of former anisotropic contact/CCD/motor
models becomes explicit unsupported status, not a hidden changed fixture/PASS.

The parent must still verify canonical root/replay builds, changed caller
refusals, recording/reconstruction and failure preservation before adoption.
Existing isotropic receipts are retained at their actual discretization scope;
this leaf does not claim new continuous-forcing accuracy for every old profile.

# Fixed resources

Use the heavy lane and existing180 s process-group guard; inner170 s deadline.
Reference32M directed Decimal operations, Fraction cap1M, sqrt endpoint cap16;
eight windows maximum, no retry/refinement or cap increase. Reference logical
8 MiB/8192 distinct objects including tuple/Fraction/Decimal roots, harness
16 MiB, build16 MiB, evidence16 MiB, reserve8 MiB: total64 MiB, not RSS.
Stream degree64 defects; do not retain their whole coefficient tree. Bound
input/output packets64 KiB and bank1 MiB. Each finite child has an explicit
deadline inside the parent limit. Cleanup must reap owned children and release
World/test observers. Preserve all first failures and raw code snapshots.
