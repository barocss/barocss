# Public upright capsule controller reference — #1064

This example runs the actual root `createUprightCapsuleController` factory in
ordinary source and complete compiled package graphs. The accepted 14-field
state is compared with the immutable selected model at `8d72af1f` and with the
same production core, with private recording enabled. The direct-core trace is
internal production-code evidence; it is not direct observation of facade
calls. No verifier movement implementation or public diagnostics are added.

The eight frozen scenes are REST, FLAT, STEP10, SLOPE15, HEADROOM, TOO_HIGH15,
WALL_SLIDE and SPAWN_OVERLAP. Seven complete 240 steps, and overlap must refuse.
Independent geometry, committed query prefixes, gravity, support, movement
bounds, all-state copies, refusal retention and exact raw bits are checked.
The original first-model wall failure stays in its separate immutable example.

## Run

Use Node22. The setup makes two declared local workspace links and installs no
packages. The package build keeps its original command and compiled map.

```sh
node examples/physics-character-public-reference/setup.mjs
pnpm --filter @barocss/physics build:library
pnpm exec tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck examples/physics-character-public-reference/source-contract.ts
pnpm exec tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck examples/physics-character-public-reference/compiled-contract.ts
node examples/physics-character-public-reference/probe.mjs source /tmp/controller-source
node examples/physics-character-public-reference/probe.mjs compiled /tmp/controller-compiled
node examples/physics-character-public-reference/decode.mjs /tmp/controller-source/manifest.json
node examples/physics-character-public-reference/decode.mjs /tmp/controller-compiled/manifest.json
node examples/physics-character-public-reference/browser-driver.mjs /tmp/controller-browser-numeric /tmp/controller-source /tmp/controller-compiled numeric
```

Only after both graphs' numerical/control/raw gates pass, run each serial public
cost campaign with `PHYSICS_REFERENCE_COST=1`. Each named scene has one full
warmup and three 240-step trials; every p95 must be ≤8.33ms. Actual queries,
admission and returned state copies are included, with trace capture disabled.
Constructor, oracle, hashing, trace export and IO are outside the measured step.
The browser driver's final `cost` argument enables the same campaign in Chrome.
The browser driver checks both full Node records and raw bits before its pass.
The independent decoder imports no production controller, query or math policy.

The source graph has no source aliases, custom conditions or resolver plugin.
The compiled graph uses every transitive public publishConfig export and an
explicit direct emitted core for the private trace harness; it admits no own
source file. Root public errors and internal errors must use the same canonical
`PhysicsError` constructor within each graph.

Reports use gzip. Raw LE buffers and manifests preserve numeric bits, with
negative-zero offsets separately recorded. `selected-reference.json` is immutable
expected data, not a runtime movement dependency; the selected raw buffers were
extracted from native `a102d9ee`. First working failures are preserved.

No 3D Viewer, GPU, FPS, arbitrary-terrain, moving-platform, dynamic-pushing,
scientific, Integration file-flow or publication acceptance follows from these
bounded results. Real capsule rendering and caller clock belong to existing
#1065. No product push, PR, package publication or release was performed.
