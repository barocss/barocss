# G1e forced candidate: static mathematical review

READY_FOR_PARENT_FREEZE. No mathematical blocker was found in the reviewed
private helper. Accuracy, World integration and production support are NOT_RUN.

Reviewed `rigid-forced-rotation.ts`, SHA-256
`3026c0392cf81afe59efb0c983ad4f4b0b20d58bc0693c01f496671c06dc678d`.
The review read source and the frozen G1e contract. It ran no module, reference,
numerical case, World, compiler or build. No frozen input or numerical file changed.

## Equations and quaternion convention

Lines 42–44 reconstruct `Lplus=R0 I R0^T omegaAfterJ` from the actual candidate
body. This is correct when World has applied J exactly once and has not applied
the full torque kick. The helper does not add J again or read an initial-state
momentum cache. Its inertia is the actual numeric Body inertia; the independent
oracle correctly retains the separate volume-integral inertia.

Lines 47–54 use `L(t)=Lplus+tauWorld*t` and
`omegaWorld=R(q) I^-1 R(q)^T L(t)`. Torque remains a world vector at every
stage. It is not held constant in rotating body coordinates.

The matrix in lines 9–16 is the proper homogeneous body-to-world quaternion
matrix: every entry is divided by q dot q. The quaternion used by the RHS stays
raw. Lines 61–62 implement exactly `qdot=([omegaWorld,0]*q)/2`, with the world
factor on the left. The scalar derivative is `-omegaWorld dot qVector/2`.
There is no missing factor of two, conjugation or reversed cross product.

For the exact unit-quaternion solution, this gives `Rdot=[omegaWorld]cross R`.
Writing `l=R^T L` then gives `ldot=l cross I^-1 l+R^T tau`, the independent
13-state reference equation. Work is `tau dot omegaWorld`. The candidate does
not use the oracle's R/p Taylor method or its independent work integral.

## Fixed steps and returned state

The two RK4 halfsteps use h=dt/2. Their abscissae are
`[0,dt/4,dt/4,dt/2]` and `[dt/2,3dt/4,3dt/4,dt]`. There are exactly eight
quaternion RHS evaluations. Line 83 performs one additional omega reconstruction;
it does not perform a ninth quaternion RHS or an extra integration step.

Each derivative multiplies its raw stage q. Normalization occurs only after
a complete halfstep. It preserves quaternion sign and does not force qw>0.
The final omega uses the normalized final q and `Lplus+tau*dt`. The returned
q/omega describe the same endpoint. No free-flow factor is composed afterward
inside this helper. Its fixed fourth-order truncation error still requires the
unchanged physical and trajectory gates; static order is not a numerical PASS.

Finite positive moments, dt<=1/60, finite bounded torque, nonzero stage norms,
scaled momentum norm<15/16, original component/movement limits, finite rates
and final squared-q-norm<=1e-12 are checked. These are refusal guards, not an
accuracy certificate for the whole guarded domain. Intermediate results remain
local. The helper returns a prepared result without mutating the Body.

## World integration conditions still to verify

The corrected World overlay was not available in the reviewed files. Its
integration is therefore NOT_REVIEWED. Before a repaired run, verify these
specific source conditions:

- Select the declared anisotropic forced leaf before applying the old full
  `tau*dt` angular kick. Apply J exactly once through the current copied body.
- Pass the original world torque unchanged to this helper. When it returns a
  result, assign that pair once and skip both S8 and geometric free advance.
- When tau is zero, use the qualified free leaf after J. A nonzero-torque
  failure must refuse; it must not enter an old anisotropic rotation fallback.
- The helper accepts any dynamic box with nonzero torque, including cubes.
  World must select the declared new leaf explicitly if existing isotropic
  arithmetic is to remain unchanged. This helper alone does not impose that
  public support boundary.
- Keep shared precommit, recording, rollback and ownership guards after prepared
  q/omega. A helper-level local return does not prove World-level atomicity.

No additional candidate change is requested by this mathematical review.
The repaired finite micro must reuse the validated forced bank and pass before
any horizon extension or canonical World adoption. Existing failures, HOLDs,
tolerances and no-deployment scope remain unchanged. READY; STOP.
