# G1c finite coordinate and input results

**PASS for eight named one-step physical cases in staged Source and genuine
NodeNext emitted World. Public package adoption remains NOT_RUN.**

The two cyclic axis maps, three world half-turns, positive/negative radial
near-unit quaternions and mass4/length1/2 input pass against both transformed
validated reference banks. Current execution has 15 Worlds/steps/audits. It
reuses one saved Source physical PASS from the first cleanup-failed run, giving
eight physical cases per graph. This is composite evidence, not a successful
single 16-World run. All 15 new disposal/observer cleanup paths returned.

| Maximum error | Actual | Existing gate |
| --- | --- | --- |
| World angular momentum | 2.1876288451716093e-17 kg m²/s | 1e-12 + scaled 1e-12 |
| Energy | 3.3372206629316676e-17 J | 1e-12 + scaled 1e-12 |
| Squared quaternion norm | 2.421861488355989e-16 | 1e-12 |
| Rotation matrix entry | 3.155338571293821e-17 | 1e-11 + relative 1e-12 |
| World angular velocity | 7.334331101855903e-16 rad/s | 1e-11 + relative 1e-12 |
| Quaternion component | 1.2102329362648735e-16 | 1e-11 + relative 1e-12 |

Source and emitted public words agree except their own verified providerDigest.
Independent geometry and endpoint audits are separate from that deterministic
comparison. Reference work was 13,056 counted rational operations and 144
monomial integrals. New ODE/Decimal/sqrt/trig calls: zero. No new builds.
Current guarded execution completed in 1.573 s, without a timeout.

The original `g1c-frame-01` remains **FAIL**. Its first Source case passed the
physical audit, then the harness omitted private observer release after
`world.dispose()` returned. The raw first failure, frozen source copy and
continuation decision are preserved. See [continuation](CONTINUATION-02.md),
[exact results](FRAME-RESULTS-02.json) and [raw manifest](EVIDENCE-MANIFEST-02.json).
The later resource-accounting correction is separate from physical accuracy;
see `RESOURCE-CORRECTION-03.md` for its counter limitation and bound.

The executed command used Node22 and the owned guard:

```sh
node examples/physics-world-p5-2276/command-run.mjs g1c-frame-guard-02 . \
  node examples/physics-rigid-rotation-g1c-2276/frame-campaign.mjs \
  --run-id g1c-frame-02 \
  --freeze examples/physics-rigid-rotation-g1c-2276/EXECUTION-FREEZE-02.json \
  --token 37f8e836536b613976411453a5d319cf642ffc31f7afc696f2d26825dacaa6fc
```

Actual executable paths and hashes are in the freeze and guard receipt.
Output directories are exclusive; do not overwrite the recorded runs.

This checks one step per new input, not general near-unit directions, inertia
scales, all admitted boxes, dt endpoints or long duration. The equal-inertia
scale case does not broaden inertia acceptance. G1a x/y symmetry and downstream
physical integration remain separate. All original HOLD/NO_GO/gates and first
failures remain. No equipment or manufacturing accuracy is claimed.
