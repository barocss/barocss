# Independent static force balance on the same32 points

Frozen before execution, 2026-11-03. Use the authenticated ALIGNED1 model's
represented masses/gravity and the actual qualified finite-cell outputs.
No World, solver, QP, SAT, trajectory, cache, source promotion or new dependency.

Each of the8 horizontal interfaces has4 native contact points. From free-body
equilibrium, its total upward force supports the cumulative mass at and above
that interface. Symmetry assigns one quarter of that force to each corner.
Recompute every body's exact rational force and COM moment using the actual
returned points and normal words. Require exact ZERO residual and nonnegative
loads, rather than a relaxed tolerance. Confirm all32 actual point coordinates
match original words. Source and strict NodeNext are audited separately.

Bounds:2saved graphs,8 interfaces/32points and8dynamic-body balances per graph;
16384bit Fraction operands/results,8MiB new evidence,180s outer guard. Inputs
and script hashes must be frozen before execution. First discrepancy stops.

This is force/moment equilibrium only. Integrated impulse approximations,
velocity residuals, gap/complementarity, dynamic settling, position-correction
work and the1200-step P4 exit are NOT_QUALIFIED. It is not a new engine solution
or permission to change the original32-point/iteration/tolerance contracts.
Existing HOLDs, public persistent NO_GO and every first failure remain.
