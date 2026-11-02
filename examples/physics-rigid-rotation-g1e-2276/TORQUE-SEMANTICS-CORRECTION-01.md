# Continuous torque interpretation: additive correction

The original G1d K source, oracle, inputs, counts and PASS remain unchanged.
That oracle explicitly used theta=n*dt*(J+tau*dt)/I for an initially resting
principal rotor: it qualified a discrete full-kick/free map and command expiry.
It did not qualify the pose under continuous constant torque over the step.
This correction changes that interpretation, not an old result or tolerance.

For an initial spin omega0, instantaneous start impulse J and constant world
principal-axis torque tau over one dt, physical angular momentum at the end is
I*omega0+J+tau*dt, but the physical angle is
omega0*dt+J*dt/I+tau*dt^2/(2I). The old pose has an extra tau*dt^2/(2I).
Correct final angular momentum and apparent post-kick energy do not prove the
continuous pose or torque work. The same distinction applies to nonprincipal
torque, where an independent governing-ODE solution is required.

G1e uses continuous world torque, independent instantaneous impulse work, and
an independently integrated work coordinate W'=tau dot omega. All old numeric
gates remain. A paired new baseline will measure actual errors before a
different candidate runs. The predicted failure is not recorded as a measured
NO_GO until the actual run returns it.

G1d R recording/reconstruction and failure-retention evidence is unaffected.
The original free-flow G1a/G1b/G1c results have zero torque and are unaffected.
No canonical API activation or general forced-rotation qualification follows
from the old discrete K PASS. Existing HOLDs and first failures remain.
