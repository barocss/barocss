# Physics contact impulse audit — calculation checkpoint

Scope: issue #1572, source branch `research/physics-contact-impulse-audit-1572`.

## Measured 2026-10-13

Host Node.js v22.16.0. The sandbox cannot resolve github.com and could not clone the project. A standalone source-equivalent **identity-quaternion fixture transcription** of the functions in `packages/barocss-physics/src/persistent-box-contact.ts` and the vector operations in `math.ts` was executed locally. **This was not an import of the actual TypeScript repository files**, not a real package build, and not a public PhysicsWorld run.

Two aligned boxes (1 kg each), static finite floor, initial velocities (0,-1,0) m/s, no gravity integration, at contacts floor-lower=(0,0,0) m and lower-upper=(0,1,0) m, normal=(0,1,0), zero initial impulses, ordered floor then upper Gauss-Seidel sweeps:

| Metric | first sweep | 48 sweeps |
|---|---:|---:|
| lower vy m/s | -0.5 | -3.552713678800501e-15 |
| upper vy m/s | -0.5 | -3.552713678800501e-15 |
| floor accumulated normal Ns | 1 | 1.999999999999993 |
| upper pair accumulated normal Ns | 0.5 | 0.9999999999999964 |

The standalone transcription initially had a missing third component in its own cross-product helper, creating NaNs. This was fixed in the **standalone transcription only** before generating the results above; repository `math.ts` already correctly defines all three components. Do not attribute this harness-only error to BaroCSS.

## Status

- Offline reduced arithmetic correspondence: OBSERVED for the aligned identity-quaternion fixture.
- Committed TypeScript test `entry.ts`: **NOT EXECUTED** against checked-out repository or tsx/tsc toolchain.
- Full PhysicsWorld/gravity/position stability and original three 1200-step scenes: **UNRUN**, existing #1399 NUMERICAL_NO_GO_WORLD retained.
- No engine code changed. No public physics acceptance, build, source/compiled parity, Integration adoption, npm publication, release or PR.
- Next required check: run `npx tsx examples/physics-contact-impulse-audit-1572/entry.ts` from an actual checkout, retain exact SHA/toolchain/exit output and follow with bounded gravity-load contact tests if successful.
