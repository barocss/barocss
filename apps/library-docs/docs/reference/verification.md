# How it is verified

Claims about supported behaviour name their checks and limits. Planned work and source-only candidates are
identified separately. This page describes checks from the kernel up to the studio in a browser.

For fixed-step dynamics, contact research, numerical errors and retained NO_GO results, read
[Physics verification](/reference/physics-verification). For joint timing and pose sampling, read
[Robot motion](/guide/robot-motion).

## Package test commands

Run the commands below from the repository root with the installed workspace dependencies. Each default has a
different scope. A default test command does not run every optional command for that package.

| Library | Default command | Scope and prerequisites |
|---|---|---|
| CAD kernel | `pnpm --filter @barocss/cad test` | Runs `test/*.test.mjs` against emitted CAD JavaScript, including kernel and conformance checks. Run `build:library` first; `test` does not build. |
| CAD document model | `pnpm --filter @barocss/cad-model test` | Bundles each `test/*.test.ts` file with TypeScript sources using esbuild, then runs Node tests. This is not a type check or packed-consumer check. Optional name arguments select matching files. |
| CAD React | `pnpm --filter @barocss/cad-react test` | Runs `tests/*.test.mjs`, including controlled host and React DOM tests. This does not start a native browser or run the separate public type guards. |
| CAD interop | `pnpm --filter @barocss/cad-interop test` | Builds interop, runs `test/interop.test.mjs`, verifies the paired world-points codec, and checks the two world-reader TypeScript configurations. Native loader and integration commands are separate. |
| GPU | `pnpm --filter @barocss/gpu test` | Runs the explicit Node test list in its manifest with the CAD dist loader. Build both CAD and GPU with their `build:library` commands first. This default does not run `test:browser`. |
| Viewer | `pnpm --filter @barocss/viewer test` | Runs only `tests/clipping-contract.test.mjs`. It bundles current sources for the Viewer/Presenter/camera and CPU picking contract. It does not verify native GPU pixels, device transport or all Viewer behavior. |

The CAD API smoke command is a smaller, explicit path:

```sh
pnpm --filter @barocss/cad test:api-smoke
```

It runs the existing fast esbuild transpilation of current CAD sources into `dist`, then runs
`api-part.test.mjs`, `api-verbs.test.mjs` and `api-mmgs.test.mjs` serially (currently 22 cases). It checks current
JavaScript behavior of the facade, verbs and MMGS results. The fast build does not clear `dist`, rebuild declarations
or type-check sources. Old `.d.ts` files can remain. A smoke pass does not establish complete type, packed-consumer,
independent native-reader, browser or full-suite acceptance.

Studio and documentation checks are separate from these six libraries:

- `pnpm --filter @barocss/cad-studio-app test` bundles `test/*.test.ts` with workspace sources and runs Node tests.
  Optional name arguments select matching files. It does not start the Studio browser flow.
- `pnpm --filter @barocss/library-docs test:samples` runs the site's executable samples through package sources and
  the real `cad-mcp` and `cad-cli`. It does not establish browser or external-reader acceptance.

### Optional checks

| Command | Separate check and requirements |
|---|---|
| `pnpm --filter @barocss/cad type-check` and `pnpm --filter @barocss/cad build:library` | Check CAD types and perform the full build, including declaration output. The full build clears CAD `dist` first. |
| `pnpm --filter @barocss/cad test:consumer` | Checks actual packed runtime and TypeScript consumers. Requires a current full CAD build. |
| `pnpm --filter @barocss/cad test:exchange` | Runs the independent exchange-reader gates. Requires the configured external interpreter/readers and current-head packed evidence. It is not part of the API smoke command. |
| `pnpm --filter @barocss/cad rb`, `rb:seed`, `rb:props`, `rb:fuzz`, `rb:commute` | Run the selected robustness, seed, property, fuzz or operation-order checks. Their oracles and limits are described below and in their decision records. |
| `pnpm --filter @barocss/cad-react test:types` | Runs public TypeScript consumer guards, including the example sources selected by that test configuration. |
| `pnpm --filter @barocss/cad-interop test:native`, `test:babylon`, `test:integration` | Run the selected native loader, Babylon loader or CAD/GPU integration path. These scripts include their declared library builds; inspect their own requirements before execution. |
| `pnpm --filter @barocss/gpu test:consumer` and `pnpm --filter @barocss/gpu test:browser` | Run the separate compiled-consumer or real-browser lists. Current CAD/GPU builds are prerequisites; browser checks also require the installed supported browser and GPU environment. |
| `pnpm --filter @barocss/cad-studio-app test:browser` | Runs the Studio browser flow described below. Renderer, selected steps, browser and server requirements belong to that run. |

Conformance cases state their expected volumes, centroids, areas, topology, face names, meshes, STEP round trips or
refusals. They identify whether the expected values come from closed form, an independent tool or this kernel. See
[B-rep, robustness and refusals](/packages/cad/robustness). Record which command and cases actually ran; the inventory
above is a description of source scripts, not a new execution result.

The supported loop-motion tests separate driver timing and solved closure from collision checks. They compare
four-bar and slider-crank poses with independent geometry and check typed refusals. A supported path's empty
`problems()` result does not establish sweep or continuous collision clearance: the object API's looped `check()`
still refuses with `LOOP_OPEN`. See [Robot code examples](/studio/robots#in-code) for playback and the separate contact-check
boundary.

The [guided conic loft](/packages/cad/robustness#guided-conic-lofts) tests define comparisons for authored guide
controls, intermediate sections, mass properties, bounds, document round trips and rejected inputs. Their scope is
one admitted quadratic guide on two circle or ellipse sections; it does not cover general or multiple rails.

## Unit and export comparisons

Compare physical quantities in the same units. Modeling mass results use MMGS. The confirmed R7 contract also uses
MMGS for public robot inertia reports. The [physical robot examples](/studio/robots#physical-report-examples) compare
the B1 facade's cube mass/inertia and actual joint holding forces to independent geometry and gravity values.
The [duty examples](/studio/robots#duty-files-and-public-reports) use actual robot documents and original harness/sizer
results through the CLI's shared B2 adapters. These checks retain decisions and provenance; they do not establish
hardware acceptance. Native robot export files retain their format-specific SI units. Further field changes and
final combined checks are pending. See [Robot unit boundaries](/studio/robots#robot-unit-boundaries).

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
- Reading source or test definitions identifies the contract and intended checks. It supplies no new runtime pass
  result. Record execution against the selected source SHA separately.
- A passing browser flow covers the named renderer and steps. A successful capture that used no retry does not
  demonstrate recovery from a detached-element error.

These results also differ from standards conformity, manufacturing acceptance and product release approval.

## External readers

Exports are read back by tools written by others:

- **Running them.** The tools run outside the product. Versioned fixtures and numerical summaries in decision
  records can retain their results. Raw run logs, screenshots and temporary reader outputs remain external evidence;
  this page does not require committing those artifacts. A comparison with a retained reading is distinct from a
  fresh execution of the external reader. Record the exact input bytes, tool and source scope for either result.
- **URDF:** urdfdom's `check_urdf`.
- **MJCF:** MuJoCo. The model's structure and its kinematics match the studio's.
- **USD:** OpenUSD (`usd-core`) and UsdPhysics' own parser.
- **DXF:** `ezdxf`, which must audit the file clean and read back every entity.
- **SDF:** not yet read back by an external validator. That waits for the owner's go-ahead.

### Independent prismatic file check

From the repository root, use the existing STEP file and independently specified expected JSON for the admitted
prismatic fixture. Replace the two input paths below with those files:

```sh
python3 -I apps/cad-studio/test/part21-prism-check.py /tmp/cad-prism/box.step /tmp/cad-prism/box-expected.json --selftest
```

The expected JSON supplies `productCount`, `solidCount`, aggregate `bounds` and per-solid `solidBounds` from the
fixture's literal dimensions and placements. The checker uses only Python's standard library and imports no product
code. It checks Part21 records, references, AP214 schema, millimetre units, counts and reachable vertex bounds for
its eight-vertex prism profile. `--selftest` also checks escaped-string/comment decoys and detects five deliberately
corrupted inputs. It does not evaluate surfaces, calculate solid volume, prove manifold topology or replace OCCT/OCP
or a general STEP reader. This is a structural and prismatic bounds check, not general physical validation.

### Manual Studio consumer run

The existing desktop material driver starts its owned Studio server and browser, uses public actions, and checks
literal box/density arithmetic against displayed mass, central inertia and BOM values. It also exercises Undo/Redo,
native Save and fresh Open. From `apps/cad-studio`, with Node 22, Python 3, installed workspace dependencies,
Playwright and Chrome available, run:

```sh
D526_SOURCE_FROZEN=1 PW_DIR=/absolute/installed/playwright CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' CAD_STUDIO_CHAT_PORT=52391 node test/public-density-material-browser.mjs /tmp/cad-material-run01
```

Set `PW_DIR` to the installed Playwright module directory and `CHROME` to the installed browser executable. Choose a
free chat port and a new absolute output directory outside the repository; the driver creates that directory.
Freeze all worktree writers before setting `D526_SOURCE_FROZEN=1`, keep them frozen through cleanup, and serialize
this run with other heavy checks. The historical environment-variable name is required by this unchanged driver.
The helper records source hashes, screenshots, JSON states, oracle results and cleanup receipts without editing
product source. Review the receipt and screenshots; the command itself is not a new pass result.

The catalog UI covers valid Aluminium 6061 and mild Steel inputs. It bypasses the public density facade and does not
exercise arbitrary invalid densities. Its displayed-value arithmetic checks do not establish general native B-rep
accuracy. Keep these raw outputs outside Git. The native Save download is the run's own local `.bcad` artifact;
this command does not authorize external downloads, browser installation or a fresh OCP run. Retained external-reader
evidence remains distinct from either command above.

## Verification tiers

### Planned experiment evidence

The planned shared experiment workflow, including the first physical pendulum, is not an implemented capability.
For each future experiment, fix its intended use, predicted quantities, time range, assumptions, input sources
and acceptance limits before running it. Its profile must distinguish physical models from authored virtual rules.

| Stage | What it establishes |
|---|---|
| Source implementation | Input checks, supported model, units, design references and failure paths are implemented and reviewed. This supplies no execution result. |
| Numerical verification | Independent formulas or reference solutions, time-step or mesh convergence, and conservation or joint errors check the calculation within its stated range. Record error and calculation cost together. |
| Measured validation | Controlled, repeated measurements compare predictions with the intended physical use. State instrument and input uncertainty; keep calibration data separate from validation data. |
| Product-flow acceptance | Users can define, save, reopen, run, cancel and compare an experiment tied to a design revision. Missing inputs, failures, incomplete runs and stale results remain visible. |

Keep geometry approximation, numerical error, physical-model error and measurement uncertainty separate.
A plausible animation or a passing software test does not establish physical predictive accuracy. Numerical
verification does not replace measured validation, and product-flow acceptance does not widen the validated range.
Preserve original inputs, settings, warnings and failed runs when comparing results.

### Software check coverage

The tiers below set software check coverage. They do not replace the four experiment stages above.

The following T1/T2/T3 schedule is a historical verification schedule. It does not replace the active CAD Studio
handoff's SMALL/FEATURE/FULL policy. Use that handoff to select current checks and approvals, and record the actual
commands and outcomes. The historical schedule was:

- **T1, at every checkpoint:**
  - the changed packages' lint and type check;
  - the stage's tests and the conformance folders it touches;
  - the flow steps that run its code.
- **T2:** a wider run every fourth checkpoint, or when a core file changes.
- **T3:** at track boundaries.
