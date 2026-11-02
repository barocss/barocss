# G1e: finite angular-load design

READY_FOR_PARENT_FREEZE. Static design at `2435ae21c`; execution NOT_RUN.
This file authorizes no runtime, production adoption, tolerance change or deploy.
All earlier HOLD, NO_GO, first failures and qualified-provider limits remain.

## Command meaning and the old result

Use SI, right-handed axes, body-to-world XYZW Hamilton quaternions and world
vectors. `angularImpulseNms` is instantaneous at the start of the step.
`torqueNm` is constant in world coordinates over that step, then expires.
Commands on a later step do not inherit either load. The public clock advances
once by its original native dt. ODE time is the exact sum of native dt operands.

Let R map body to world, I be the physical body inertia and K=R I^-1 R^T.
At a kick, q is continuous, L+=L-+J and omega+=omega-+K J.
Its work is `DeltaE_J=omega- dot J + (J dot K J)/2`.
During the remaining step, `L(t)=L+ + tau*t` and `dE/dt=tau dot omega(t)`.
The exact principal-axis angle is `omega+*dt + tau*dt^2/(2*Iaxis)`.

The current World adds `Iworld^-1*(J+tau*dt)` before free motion. Its staged
corrected-free variant still makes this full torque kick. This is a first-order
load discretization. Correct final L does not imply correct orientation/work.
G1d K explicitly checked `dt*(J+tau*dt)/Iaxis` from rest. Its PASS establishes
that discrete kick/free law and expiry. Preserve that receipt. It does not
qualify the continuous torque meaning above. The angle defect is already
`tau*dt^2/(2*Iaxis)` in the principal reduction.

## New fixed inputs and order

All cases use one homogeneous 1 kg primitive-COM box, half extents
`[0.1,0.2,0.3]` m, zero gravity/position/linear speed, no other body,
contact, joint, motor, projection, sleep, CCD or domain. Capture actual native
inputs and admitted q/moments. Integrate their geometry independently;
intended moments `[13/300,1/30,1/60]` never replace observed operands.

Use q=`[0,0,0,1]`, omega=`[1,1,1]` rad/s and dt=`1/120` s.
The exact dyadic world vectors are:

- `J=[1/1024,-1/2048,1/4096]` N m s.
- `tau=[1/128,-1/256,1/512]` N m.

Each load is nonprincipal for the stated triaxial plant; tau is exactly 8*J.
The fixed micro leaves are J: J only; JT: J and tau together. Each takes
one loaded step. Initial spin is not parallel to either applied load.

First acquire a NEW old-staged baseline: both leaves, one step/graph, four
Worlds maximum, eight initial/endpoint audits. Paired failure acquisition is
a narrow baseline exception and needs an explicit parent freeze. It does not
waive Source-PASS-before-Native for qualification. Preserve the first failure
of each graph; no later steps, recovery search or baseline rerun. Capture the
bounded raw baseline states before physical classification. Stop on any
operational/reference failure. Expected torque trajectory FAIL is a prediction.

Then freeze a separate corrected micro: J, JT in that order, Source complete
before Native loads. Maximum four Worlds, four accepted steps and eight
initial/endpoint audits. Dispose and release owned observers in finally paths.
Use the actual World/command path, not a standalone helper as product proof.

Only a complete micro PASS permits a separately frozen extension: JT at dt
`1/60,1/120,1/240` for `6,12,24` steps, nominal 0.1 s.
J acts on the first step only; resubmit the same tau on every step.
These represent the same continuous torque history across grids. Compare at
the six matched physical times. Include q=`[0,0,0,-1]` for one JT trajectory
at dt `1/120`; its physical R/omega/W bank is shared with positive q and its
continuous q sign is reversed. Add one empty-command step to the existing
dt120 trajectory after its last loaded endpoint. Check expiry against a new
zero-torque reference continuation; do not use a free bank with a different L.
No other input is added automatically.

## Fixed forced candidate, if the baseline fails

Retain qualified S8 free motion when tau is exactly zero, after applying J.
For nonzero tau, use two fixed RK4 halfsteps of h=dt/2. This is a candidate,
not an accuracy result. Derive L+ from current admitted q/omega and J once.
At every RK stage use the exact stage abscissa: `Lstage=L+ + tau*tstage`.
Evolve `qdot=0.5*[omega(q,Lstage),0] HamiltonMultiply q` and
`omega=R(q)*I^-1*transpose(R(q))*Lstage`. The world factor multiplies on
the LEFT. Never add tau*dt to omega first or apply J twice.

For stage R, use the proper homogeneous quaternion matrix, dividing by the
stage norm squared. The derivative multiplies the raw stage q. Do not insert
a different normalized-stage q in that product. Normalize after each complete
halfstep. Require a finite nonzero normalization denominator; retain the old
final squared-norm gate and continuous sign. Do not force qw positive.
Reconstruct final omega from normalized final q and `Lend=L+ +tau*dt`.
Discard L scratch before downstream consumers and common commit.

The prescribed halfstep count never increases. No adaptive solve, retry,
dependency, fitted damping, energy clamp, momentum truth cache or legacy
omega-constant fallback is permitted. Preserve all original movement/finite
guards and final-result guards. Prepare q/omega locally; a failure preserves
accepted state, clock, recorder and cache identity/content. Empty torque uses
the existing qualified mathematical free leaf; it does not hide forced error.

## Independent reference and exact work audit

Generalize authenticated G1b M02 directed Decimal80/120 Taylor32 mechanics.
Use scaled body momentum p=l/Lstar, Lstar=`1/16`, nine R entries and work W.
For tube/Lipschitz norms the work coordinate is w=W/(1 J), so all thirteen
numerical coordinates are dimensionless; divide the W equation by 1 J.
The independent 13-state polynomial equations are:

`p'=p cross (Lstar*I^-1*p) + transpose(R)*tau/Lstar`

`R'=R*[Lstar*I^-1*p]cross; W'=tau dot (R*(Lstar*I^-1*p))`.

Initialize p from independent proper admitted R, physical inertia and omega,
then add `transpose(R)*J/Lstar` exactly at time zero. Initialize W=0 after J.
Use tensor-index construction. Extend sparse polynomial terms to degree 0/1/2
and 13 rows; do not encode linear terms with an untracked constant state.
The reference uses no candidate quaternion/RK4/S8/weight/Newton implementation.
Derive omega from its R/p and q from its independently certified trace branch.
Positive-q trajectories require a proved qw>1/2 over each reference horizon;
negative q is explicit sign data. Failed branch proof stops, without switching.

Use fixed native-dt240 windows; micro needs two windows/profile/precision.
The extension needs one 24-window JT bank per precision, sharing the two
authenticated micro JT windows. Its final empty step adds two windows per
precision. Thus extension adds at most 48 new windows, not separate banks
per candidate grid or quaternion sign. Reuse the baseline's matching targets
for the corrected micro without rebuilding their mathematics.
Piecewise tau changes exactly at the step edge.
Carry each accepted physical interval into the next window. Use full degree64
defect/Picard certification and previous initial uncertainty. Independently
derive all field/derivative sums including torque and W. The old M<=8/s,
L<=16/s and 17/16 tube are proposed ceilings, not inherited forced proofs.
Check them and h*M<1/16, h*L<1/8 explicitly; failure stops. No window/order/
precision increase. Every observable width must be <=1e-24; the two precision
enclosures must intersect. A high-precision point is not a validated oracle.

For each actual state, independently compute R, world L and E by exact
rational arithmetic on native words and volume-integral inertia. Compare L
to `Linitial+J+tau*t` on the loaded segment and its endpoint on the empty
segment. Compare `Eend-EafterJ` with independently integrated W. Also report
the exact kick-work identity. Do not compare forced E with initial E as a
conservation law or define oracle W from the same measured DeltaE.

## Gates, cost and adoption boundary

Keep L and energy/work residual gates `1e-12+1e-12*max(1,abs(before),abs(after))`.
Keep squared-q norm/COM/linear momentum gates 1e-12. Keep every omega/R/q
trajectory gate `1e-11+1e-12*abs(reference)` against BOTH interval endpoints
at BOTH precisions. Refinement remains ratio1.8 with the existing 1e-11 floor;
ROUNDING_FLOOR does not establish observed order. No tolerance enlargement.

Propose <=32M Decimal operations and <=10M Fraction operations per new phase,
8 MiB reference, 16 MiB harness, 16 MiB build, 16 MiB evidence, 8 MiB reserve;
64 MiB total. Keep 8192 unique reference objects, bounded packets <=64 KiB,
170 s internal/180 s outer guards and the single shared heavy lane. Stream
window certificates and retain only required audited rows. Count all new
Taylor windows, operations, square roots, geometry and copied/encoded roots.
Closed G1b banks cannot supply new loaded targets. Before execution, the
author must prove live-root/serialization costs within these existing caps.
If the extension cannot fit, STOP with that limit; no automatic cap increase.

Today the smallest honest qualified claim is the recorded free profiles plus
G1d's declared discrete load case. Continuous off-axis torque is NOT_RUN.
A future PASS adds only the new plant, initial inputs, load histories, steps
and horizon above. The former broad admission is not validated by class or
conditioning guards. These finite observations do not prove a continuous
inertia/spin/load interval. Any wider support envelope needs its own error
argument and finite boundary qualification. Production admission must state
unsupported inputs and refuse them explicitly; it must not select by fixture
ID or return to the old law. Parent must freeze that visible contract and
qualify canonical World/entry builds before adoption. No deployment follows.

READY; STOP. This author ran static reads only. No numerical module, World,
reference, fixture conversion, build or mathematical campaign was executed.
