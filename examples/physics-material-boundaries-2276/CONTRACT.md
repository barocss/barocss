---
work_id: physics-material-boundaries-2276
artifact_type: contract
status: frozen_before_execution
owner_role: independent Physics Work
last_updated: 2026-11-03
---

This is a finite qualification of the existing public discrete friction law. Do not change production code, tolerances, iteration counts, admission, or previous evidence. The persistent-impact Source bundle and canonical Native dist are reused. The runner checks every frozen input hash before importing either graph. A mismatch stops the run. No build, download, browser, or historical campaign rerun is required.

The default input is one uniform sphere of mass2kg and radius0.5m, at center[0,0.5,0], with velocity[vt,-1,0], zero spin, zero gravity, no CCD, and a finite static floor of half extents[2,0.5,2] at[0,-0.5,0]. Use rigid-discrete-v1 and dt1/120s. Restitution is0. Sphere/floor static friction1/0.25 mix to0.5. Dynamic friction0.25/0.0625 mix to0.125. Primitive COM inertia is0.2kgm².

Independent physical constraints: Newton normal velocity and linear momentum imply Jn2Ns. For a geometric contact arm[0,-0.5,0], angular momentum and zero final contact slip imply the sticking magnitude Jt=(2/7)m|vt|. The static cap is1Ns and the dynamic cap is0.25Ns. Freeze vt immediately below, exactly at, and immediately above1.75 as represented binary64 words. Equality belongs to the static branch; no branch epsilon is permitted. Boundary references pin Jt≈1,1,0.25 independently. The above-boundary result is vx=vt-0.125 and omegaZ=-0.625. The exact-boundary result is vx1.25 and omegaZ-2.5.

The finite table also covers lower sticking/higher sliding speed, reversed and zero tangential speed, swapped material sides, IDs and input order, zero static friction, zero dynamic friction, and normal separating/resting inputs. A contact with Jn0 must transfer no tangential impulse. Separating at the touching initial pose can have no end-of-step contact; resting must retain an actual contact with no normal or tangential impulse. Separate friction-free controls freeze closing speeds nextDown(0.5),0.5,nextUp(0.5) at restitution1; only the last takes the positive restitution branch.

Measure public before/after states and contacts. Normalize contact impulse signs onto the moving sphere. Check normal momentum, all linear and spin components, angular impulse using the geometric arm, contact tangent-plane residual, zero slip on sticking cases, dynamic Coulomb magnitude on sliding cases, mean-velocity impulse work, and total kinetic-energy non-growth. Expected inertia and contact arm are physical constants, not values read from solver helpers. Do not reproduce a private iterative solver or request an arbitrary friction impulse.

Gates are1e-10 in SI for motion, impulse, momentum, angular momentum and energy; tangent-plane impulse residual is1e-12Ns. Branch comparisons are exact. Source/Native full public state and contact parity is exact after normalizing providerDigest only. Each graph uses at most32Worlds and32accepted steps, one step per case, and at most8MiB of raw input/state/reference evidence. The first failure stops every dependent case and graph. Preserve the frozen inputs and first failure. This is no qualification of persistent friction, boxes, multi-contact impacts, sustained support, CCD, real equipment, or manufacturing.
