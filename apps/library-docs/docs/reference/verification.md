# How it is verified

Each claim in these pages rests on a check that runs. This page describes those checks, from the kernel up to the
studio in a browser.

## Unit and conformance tests

- **The kernel** (`pnpm test` in `packages/barocss-cad`) runs its tests and the conformance suite against the built
  package. `pnpm build:library` comes first.
  - The conformance suite has over 400 cases, in folders named by the roadmap step that added each.
  - Each case states the outputs any correct implementation must give: volume, centroid, area, bodies, topology, face
    names, a watertight mesh, a STEP round trip, or the error it is refused with.
  - Each says where its expected values come from: closed form, an independent tool, or this kernel. See
    [B-rep, robustness and refusals](/packages/cad/robustness).
- **The document model** (`packages/barocss-cad-model`) and **the studio** (`apps/cad-studio`) have test suites of
  their own, for the commands, the tools and their gates, drawings, manufacturing, robots and files.
- **This site's samples** (`pnpm test:samples` in `apps/library-docs`) run every code sample the pages show, through
  the packages' sources and the real `cad-mcp` and `cad-cli`.

## Unit and export comparisons

Compare physical quantities in the same units. Modeling mass results use MMGS. The confirmed R7 contract also uses
MMGS for public robot inertia reports. Its combined runtime check is pending. Native robot export files retain
their format-specific SI units. See [Robot unit boundaries](/studio/robots#robot-unit-boundaries).

| Quantity | MMGS to SI |
|---|---|
| Mass | g × 10⁻³ = kg |
| Length or centroid coordinate | mm × 10⁻³ = m |
| Inertia | g·mm² × 10⁻⁹ = kg·m² |
| Turning torque or effort | N·mm × 10⁻³ = N·m |
| Gravity | mm/s² × 10⁻³ = m/s² |

For a 10 × 10 × 10 mm cube at density 2.7 g/cm³, the mass is 2.7 g and each diagonal centroidal inertia is
45 g·mm². The same values in SI are 0.0027 kg and 4.5 × 10⁻⁸ kg·m². A unit conversion changes the representation,
not the physical quantity.

For robot boundary checks, use independent degree and mm inputs for both joint types. Check the stored settings,
public limits and velocities, mimic multipliers and offsets, contact values, torque and gravity reports. Check
seconds separately from former milliseconds or hours. Bind these checks to the exact combined producer and facade
commit before execution. A documented contract or a prepared fixture supplies no runtime pass result.

A numerical comparison and a frozen-file comparison answer different questions. Floating-point multiplication and
conversion can change the last stored digits. A passing numerical check does not prove identical serialized bytes.
Keep the numerical tolerance and the byte comparison as separate assertions. A byte difference needs investigation;
it is not a reason to regenerate the expected file or loosen a tolerance.

## Robustness, the fuzz and the fingerprint

- **The robustness runner** (`pnpm rb`) runs every conformance case and the seed corpus, each under a time limit,
  and fails on any failure that isn't known.
- **The properties** (`pnpm rb:props`) and **the fuzz** (`pnpm rb:fuzz`) check generated inputs: seeded random CSG
  trees against an independent ray-casting oracle. A finding is shrunk to its smallest case.
- **Determinism.** A test evaluates each model alone, after the others and again, and requires the same B-rep to the
  bit.
- **The fingerprint.** A refactor that should change nothing is checked with a fingerprint.
  - **The cases:** every robustness corpus case, and the fuzz cases of two seeds, 200 each.
  - **What it records:** each output's validity, its face, edge and vertex counts, its area and mass properties to the
    bit, and a SHA-256 of its tessellation. Refusals are recorded by name.
  - **The check:** one SHA-256 over all of it, which must be identical before and after the refactor.
  - **Running it:** `packages/barocss-cad/scripts/r5-fingerprint.mjs`, after `pnpm -s build:library`:

    ```bash
    node scripts/r5-fingerprint.mjs [out.jsonl] [jobs]
    ```

  - **Where the digests go:** the digest a refactor was checked against goes in its decision record
    (`apps/cad-studio/handover/decisions.md`). The digest changes whenever behaviour changes on purpose, so there's no
    fixed value to check against.

## Browser flows on both renderers

`apps/cad-studio/test/browser-flow.mjs` drives the studio in Chromium, step by step:

- It starts the dev server, works the studio as a person would, and checks what it shows.
- It has about 280 steps, from a first box to frames, robots, drawings and the agent through the real chat server.
- It runs on WebGPU, or on WebGL2 with `FLOW_RENDERER=webgl2`. `FLOW_ONLY` runs the steps a change touches.

This site's capture script walks Getting started the same way on both renderers. It fails when a label the page names
isn't on screen.

## Reading a verification result

A result names its source SHA, selected checks, renderer and outcome. Keep their scope explicit:

- A passing sample or focused suite covers the checks that ran. It does not make a failing full suite pass.
- After a bounded repair, a focused rerun verifies that repair. The earlier full-suite failure remains a separate
  result until the full suite is rerun.
- A stopped or waiting run is incomplete. It supplies no completed pass result for the checks that did not finish.
- A passing browser flow covers the named renderer and steps. A successful capture that used no retry does not
  demonstrate recovery from a detached-element error.

These results also differ from standards conformity, manufacturing acceptance and product release approval.

## External readers

Exports are read back by tools written by others:

- **Running them.** The tools run outside the product, and their readings are committed beside each test case. The
  tests compare the studio's output with those readings.
- **URDF:** urdfdom's `check_urdf`.
- **MJCF:** MuJoCo. The model's structure and its kinematics match the studio's.
- **USD:** OpenUSD (`usd-core`) and UsdPhysics' own parser.
- **DXF:** `ezdxf`, which must audit the file clean and read back every entity.
- **SDF:** not yet read back by an external validator. That waits for the owner's go-ahead.

## Verification tiers

Work is checked in tiers, recorded in the handover:

- **T1, at every checkpoint:**
  - the changed packages' lint and type check;
  - the stage's tests and the conformance folders it touches;
  - the flow steps that run its code.
- **T2:** a wider run every fourth checkpoint, or when a core file changes.
- **T3:** at track boundaries.
