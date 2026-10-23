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
