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

## Executed native evidence

Actual parent `716e84428bd0f5145b6c6aac9c0a63254b14a5fa` → clean measured source
`f255b3734fe37d5ae8e224bc34b67b6ff2f2c234`. Canonical reports record a clean
source tree. Original build and both typed consumers passed. Node22.22.0 and
Chrome155.0.8059.39 each passed all eight fixed scenes, 39 public boundary
controls and 12 original direct-core controls. Source resolves 39 own source
files and zero compiled files; full compiled resolves zero source and 18
compiled files. Both runtime graphs preserve canonical root error identity.

Independent saved-artifact replay passed 1,687 states, 2,489 hit witnesses and
852,432 LE trace/input bytes; copied public states add 236,752 raw bytes.
All four graphs have identical input, trace and public-state bits, including
two complete repeat records and full Node/browser control parity. The selected
input and output SHA256 remain, respectively:

- `feda47adb6facf25db155ea6ae7d25451d3bc6f2c214b21b94e71c8fc6c1b1ad`
- `e22a39b24738f0b5e58b026082150566c8951f3cbbd7b6a16fc63c567988c11c`

All 21 public combined step p95 values per graph meet 8.33ms. Worst values:
Node source0.034458ms, compiled0.037334ms; both Chrome graphs0.100000009ms.
Chrome's minimum positive clock increment is about0.1ms; retain that quantization
limit. Full samples, query counts and independently recomputed percentiles are
saved. Numeric/control/raw gates ran before any cost campaign. Public timing
uses recording OFF; actual queries and returned state copies are included.

Both actual eight-row browser tables were visually inspected; errors/warnings0,
owned browser/server closed. These are numerical tables, not actual3D Viewer
pixels. The first verifier syntax failure and earlier working runs remain in
`evidence/first` and `evidence/working-*`. No product-code failure or target
relaxation was required. A static helper checked admission precedence, canonical
identity, full rollback and instrumentation neutrality; it ran no numerical or
cost work. Unresolved-lookahead, public computed numeric and genuine scalar64
limit guards remain unobserved; labelled private small-cap/fault proofs are not
claims of those public triggers.

`evidence/canonical/receipt.json` links exact source and saved proof. The final
native child adds only saved canonical evidence and this README. Public API
code has not been adopted into Integration or published. #1065 remains the
next actual Viewer consumer after code availability and its own frozen host
contract. Current integrated screen/file/recovery follow-ups remain separate
under #674.
