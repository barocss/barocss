# Discrete unequal-material restitution

Frozen before execution, 2026-11-03. This closes a finite missing G2 material
test. It does not transfer the persistent-contact restitution proof to the
discrete solver. No production change, iteration change, dependency or download.

One-step, gravity-free, friction-free centered impacts only: fixed box against
a sphere or cube, and two uniform spheres of masses2 and3kg. No CCD, joint,
rotation, contact projection work or remaining-time claim. SI, right-handed XYZ,
XYZW, dt1/120s. The existing strict closing-speed >0.5m/s restitution branch
and minimum of the TWO material coefficients are the specified numerical law.

Before API execution, a Python Fraction reference solves the independent linear
constraints: total momentum plus relative separation velocity (or zero fixed
velocity). Store exact outgoing velocities, dynamic momentum changes and energy.
The reference imports no engine or candidate solver and reads no outputs.

Sixteen fixed cases: unequal coefficient orders and body/input orders,
0/1 endpoint coefficients, unequal dynamic masses and three threshold words.
Source and strict Native use the already qualified sphere-pair build. Pin all
source and emitted modules before imports. Require original1e-10 velocity,
impulse, angular velocity and energy gates;1e-12 tangent-plane gate. Require
actual contact, no CCD and exact Source/Native words after only validated
provider identity normalization. Stop at the first failure and preserve outputs.

Hard caps per graph:16Worlds,16accepted steps. New evidence16MiB. Existing
180s command guard. No new full trajectory/recorder/browser qualification is
claimed by this finite test; existing rendering evidence stays separately
qualified. All HOLDs, original P4 NO_GO, tolerances and first failures remain.
