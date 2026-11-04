---
work_id: physics-three-cubes-floor-2276
artifact_type: verification
status: bounded_numerical_public_world_and_desktop_pass
owner_role: independent-physics-algorithm-work
source_request: expand only after two cubes and floor pass numerical public API and desktop gates
last_updated: 2026-11-04
---

# Three cubes and a floor within the existing body cap

The two-cube/floor milestone passes its numerical, common World, restore,
failure and desktop gates before this expansion. Its source, first failures
and proof are retained by local commit6b156e22d and CHECKPOINT-12. This case
changes authored inputs and verification consumers only: the actual common
World/global island algorithm and compiled provider are unchanged.

Lower/middle/upper are2kg half0.5m primitive-COM cubes at initialY0.5/1.5/2.75,
identity and zero motion. The prescribed static floor is centered atY−0.5 with
half-extents[2,0.5,2]. Gravity−9.81m/s², zero restitution/friction, empty commands,
direct broadphase and1/120s apply. Four bodies fit the original persistent cap;
no cap, timestep, tolerance or solver budget is increased.

Actual owned command, from the isolated checkout:

```
node examples/physics-three-cubes-floor-2276/run.mjs api-01 --build-manifest examples/physics-coupled-cubes-floor-2276/evidence/public-build-01/result.json
```

`three-cubes-floor-api-01` passes in28898.240833ms with
`THREE_CUBES_FLOOR_SOURCE_NATIVE_256_CONFIRMED`. Each graph creates one real
public World/recorder and accepts256 steps. Both original Worlds first pass
their32-step independent checkpoints and full-word parity before either may
attempt33. The same Worlds then continue to256. Each graph has2 independent
reference calls,0 restores and no hidden replays. All257 full public states
and numeric words agree across Source and actual canonical Native; only the
providerDigest string differs. Graph evidence is1370630bytes each, below16MiB.
Source integrity passes; there is no first failure, timeout or unknown error.

The reference is a separate exact Fraction3DOF chain projection. It enumerates
the8 fixed active subsets of floor/lower, lower/middle and middle/upper and
solves at most3×3 Gram equations. It does not import production contact geometry,
normal/position optimizers or expected engine outputs. It checks simultaneous
global position/velocity/impulse/momentum/KKT/energy and independently inverse-
rotated public contact representatives. Public mean×net impulse is explicitly
not treated as the actual per-point wrench. Observed spin/rotation and energy
are checked separately; no private manifold-point observation is invented.

| Independent256 metric | Maximum | Unchanged gate |
| --- | --- | --- |
| Global projected velocity |2.0192181260370035e-14m/s |1e-10 |
| Global projected position |1.2434497875801753e-14m |1e-10 |
| Normal multiplier |4.0330107309305416e-14Ns |1e-10 |
| Momentum/stationarity |6.934707437918538e-16Ns |1e-10 |
| Normal complementarity |9.904264908211778e-15J |1e-10 |
| Unexpected angular speed |6.064593272014918e-14rad/s |1e-10 |
| Public representative face/bounds |3.108624468950433e-15m |1e-12 |

Measured first contacts are[1,1,27], matching the independent geometry-derived
contact sequence. The lower two require support from step1 while the top falls
through its initial0.25m gap. When the top contacts, all three normal rows load
the same dynamic chain. The resulting rest heights are derived from the global
constraints, not supplied to World or set by a pose table.

## Independent reference controls

`three-cubes-floor-controls-01` passes in6641.364833ms. Six exact analytical
helper cases cover free feasibility, floor-only, lower/middle compression,
middle/upper with a zero-dual binding constraint, full position projection and
full velocity projection. Independently specified targets, component mass
balance, duals and objectives all match; the full velocity example loses14J.
Eleven CLI controls include2 paid byte-exact replies,4 terminal256 physical
mutations,4 invalid-word cases and1 signed-zero positive. The1e-11m public
pointY shift is rejected by the unchanged1e-12m geometry gate. There are0 World,
candidate, compiler, capture or replay calls; synthetic data is not physical
support evidence. Source integrity passes and no first failure occurs.

## Actual same-Native desktop

`three-desktop-build-01` passes in690.368375ms; `three-desktop-01` passes in
14763.453208ms. The real browser uses the same actual canonical provider
4ff775ef30fd0de633b84a78c71fe8535661776a988e4fcb2643e355a9e4f5c4.
One zero-step initial World is reset, then the same second World accepts256.
The complete257-state public capture matches the paid Native numerical packet,
including all numeric words and signed0. Expected states stay host-only and
are never supplied to Worker, World or solver.

Actual first contacts are lower1/middle1/upper27. At20 the lower two are
supported and the top is falling. At256 exactly three adjacent support edges
remain; no nonadjacent edge is fabricated. GPU readback observes20955 initial
colored pixels and1623 changed flight pixels with unchanged thresholds.
Independent quaternion corner/marker submission checks, camera/contact controls,
separate KE/PE and1280/1440/1920 desktop widths pass with no page/console errors.
Root viewed flight20.png and final256.png. These establish display correctness;
the independent3DOF reference establishes this bounded numerical accuracy.

Final displayed KE is7.695326229878872e-27J, PE88.2900000000006J. This is not
total-energy conservation; the contact is inelastic and projection work and
kick-drift error are reported separately. Desktop proof is2504794bytes before
the final receipt, below16MiB. Local preview: http://127.0.0.1:53048/.

## Remaining boundary

This case passes numerical/public/desktop gates through256steps. It does not qualify
arbitrary four-body arrangements, tilted/anisotropic/frictional contact,
restitution networks, longer horizons, moving8, hardware agreement or safety.
The earlier two-cube restore/failure bank stays separate; this three-cube bank
has0 restore calls and cannot be reported as a new four-body restore test.
All inherited HOLDs, tolerances and historical first failures remain. No mobile
test, deployment, release or old-worker restart is authorized or performed.

Local documentation checks pass: `three-doc-example-01` runs3 executable API
tests in2167.377042ms (two32-step examples and the explicit AABB refusal),
`three-docbuild-01` builds the site in18007.165083ms, and `three-docsite-01`
passes in182.425417ms. Built-page/anchor/snippet/evidence-copy checks remain
separate from numerical and desktop proof. Network destinations are not probed.
The new three-cube snippet uses authored model/commands only. The next roadmap
dependencies are the observed anisotropic tensor refusal, coupled timestep/
horizon validation and then changing topology/materials. Moving8 stays NO_GO.
