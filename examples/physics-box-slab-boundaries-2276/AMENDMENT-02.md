# Amendment 02: identity quaternion sign

The actual baseline is preserved in `evidence/baseline-01/`. Both Source and Native passed the frozen 20-case table with 18 Worlds, 22 accepted steps, 4 creation refusals and 2 command refusals per graph. All recorded numeric residuals were zero. The two negative identity quaternion constructors actually refused `INVALID_CONFIG`. The original cases, independent bank, provider pins, freeze, harness and failure-boundary outputs remain unchanged.

For a unit Hamilton quaternion q, vector rotation is R(q)v. Its rotation matrix contains only quadratic terms in q. Therefore R(q)=R(-q). In particular, [0,0,0,1] and [0,0,0,-1] both represent the identity rotation. Requiring only w near +1 excludes an equivalent orientation. Root owns the proposed admission edit and reproducible build. This amendment does not authorize other production changes.

CASES-02 changes only the two negative-q rows. They become finite centered impacts with start [0,2,0], velocity [0,-256,0] and dt 1/128 s, matching the positive identity control. The expected first TOI is 1/2, accepted center is [0,1,0], outgoing velocity and spin are zero, and the moving-box impulse is [0,512,0] Ns. The moving-q row changes only the moving orientation; the fixture-q row changes only the fixture orientation. The analytic bank remains independent of production code.

The new harness compares each negative-q model and before/after physical state to the positive identity control. It replaces unit quaternions with the Hamilton rotation matrix and maps signed zero to mathematical zero for this intra-graph physical comparison only. It excludes model revision and World identity metadata because those identify different represented inputs. No nonzero value is rounded or normalized, and no recorder log or raw quaternion equality across q signs is asserted. Full raw inputs, states and outputs remain saved. Source/Native comparisons for each same case still use exact raw parity after providerDigest normalization only.

Use the new Source bundle at `build/sign-02/source.mjs` and its generated `provider-pins.json`; the accompanying result must be `PASS_BUILD`. Freeze every supplied source/dist hash, the model builder, new bank and harness before API imports. The new manifest is `FREEZE-02.json`. It does not replace the original provider or freeze. The proposed sign-invariant check keeps every existing 1e-12 orientation/angular threshold and all current refusal rules.

The population stays 20 cases per graph: 16 finite cases, 2 command controls and 2 creation boundaries. Expected counts are 20 Worlds, 24 accepted steps, 22 constructor attempts, 2 creation refusals and 2 command refusals. Hard caps remain 24 Worlds, 28 accepted steps and 16 MiB per graph. All original geometry/TOI/normal/spin/tangent gates remain 1e-12 SI; velocity/momentum/energy gates remain 1e-10. Stop on the first failure. No widened tolerance or extra iteration.

After root reviews the amended files and completes the separate sign-02 build, run these commands through the existing heavy gate and 180-second wrapper:

```sh
python3 -B examples/physics-box-slab-boundaries-2276/reference-02.py
node examples/physics-box-slab-boundaries-2276/freeze-02.mjs
node examples/physics-box-slab-boundaries-2276/run-02.mjs sign-api-02
```

Authoring only: the new bank generator, freezer and API harness have not run. No renderer is authored before the repaired API gate passes. Full G2, persistent box contact geometry, P4, coupled mechanics, HOLDs and deployment limits remain separate.
