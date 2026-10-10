# Physics: manual steps, copied state and cloth


## Live sample — a manually stepped free-falling sphere {#physics-step}

[Open the complete Physics sample](/playground#physics-step). Start the portal with the existing Node22+ runtime and the [example execution guide](/concepts/run-examples). The editable input below is the actual public `PhysicsWorldConfig` object, not a new package source language or a wrapper document schema.

```json
{
  "fixedStepSeconds": 0.008333333333333333,
  "gravityMps2": [
    0,
    -9.81,
    0
  ],
  "bodies": [
    {
      "id": "part:ball",
      "kind": "dynamic",
      "shape": {
        "kind": "sphere",
        "radiusM": 0.15
      },
      "positionM": [
        0,
        2,
        0
      ],
      "velocityMps": [
        0,
        0,
        0
      ],
      "massKg": 1,
      "restitution": 0.25
    }
  ]
}
```

The host sample admits exactly one dynamic sphere and `fixedStepSeconds:1/120`. Public Physics admission validates the complete config before that additional host profile is accepted. This bounded view does not display every shape/configuration supported by the package. Try changing `gravityMps2[1]`, the starting `positionM[1]`, `velocityMps[1]` or sphere radius, then run the complete candidate. A successful new input starts a new world at step0 and replaces the baseline ghost. A JSON/Physics/profile refusal keeps accepted input, world and frame.

### Advance, refuse and reset

| Control | Actual operation | State to inspect |
| --- | --- | --- |
| Advance 1 step | One `world.step(1/120)` | Accepted step count increases by1. |
| Advance 20 steps | Twenty sequential public calls from the current state | Step count increases by20 after a complete successful action. |
| Try 1/60 s | Actual `world.step(1/60)` against the fixed1/120 world | `PhysicsError.code` is `INVALID_STEP`; world and host frame do not change. |
| Reset from accepted input | Construct a new admitted world, then dispose the old world | Step0, original accepted initial pose/velocity and a fresh baseline. |

There is no automatic clock, requestAnimationFrame loop or background step. Advance20 means **+20 from the current step**, not jump to absolute step20. To reproduce the reference below, use Reset, then Advance20. Reset, Advance1, then Advance20 reaches step21 instead.

For the default input, the existing #1270 CPU task actually observed step1: `timeSeconds:0.008333333333333333`, `yM:1.99931875` and `velocityYMps:-0.08175`. Its wrong1/60 call was refused with the accepted step still1. That receipt remains CPU-only.

The selected #1310 public-source CPU consumer and the new portal browser sample both observed the default input at `stepIndex:20`, `timeSeconds:0.16666666666666666`, `yM:1.8569375` and `velocityYMps:-1.635`. The CPU consumer drew no pixels; the browser displayed its actual copied state through the host Canvas2D projection. The actual `INVALID_STEP` refusal retained the complete CPU state, and the browser retained its accepted state and frame. Local maintenance provenance is `apps/library-docs/evidence/host-samples-physics-cpu.json` and `apps/library-docs/evidence/host-samples-browser.json`. These selected observations do not certify collisions, long-run stability, performance, other devices or native geometry. They remain separate from the earlier #1270 CPU receipt.

### Read the actual host projection

![Actual manual Physics sample capture](/examples/physics-step.png)

The gallery capture uses the sample's real current CPU state. Read its accepted step/time/metre labels to identify the captured action. This image is a **host Canvas2D XY projection** on a640×420 backing canvas; it is not a GPU Physics renderer, BaroCSS Canvas2D render or Viewer scene. Z remains a numeric label and is not rendered as depth. The orange circle is the copied current sphere state; the dashed circle is the copied initial pose. Y=0 is only a drawn reference line. There is no static floor body, so crossing that line cannot create a contact.

The host fits the current and initial circles plus the Y=0 reference into its plot. Pixel scale can therefore change after input/step changes. Physical values remain metres, and the body radius is projected with the same scalar scale as its XY coordinates. The first step's sub-millimetre motion can be visually small; inspect the numeric label rather than inferring precision from pixel movement.

The action report includes `stepIndex`, `timeSeconds`, copied `positionM`/`velocityMps`, `yM`, `velocityYMps`, body ID/radius, baseline position and actual contact count. Twenty calls are not one atomic solver transaction. If a later public step refuses after earlier steps succeeded, the host retains and draws the last successfully accepted state; it does not invent a whole-batch rollback.

### Candidate and resource lifetime

`createPhysicsExample(canvas,source)` returns `update(text)`, `report()`, `action(id)` and `dispose()`. The standalone app-local host imports only `* as PhysicsSampleAPI` from the public `@barocss/physics` root. Its implementation is `apps/library-docs/scripts/snippets/hosts/physics.mjs`; preset input/action metadata is `apps/library-docs/scripts/snippets/presets/physics.json`.

A source update prepares the candidate world and copied step0 state before touching accepted authority. Invalid JSON, actual Physics refusal or an unsupported host profile therefore paints no candidate frame. After successful host painting/adoption, the previous world is disposed. This is a Canvas2D host recipe; it does not add a package renderer, persistence or native file protocol.

The rigid public interface has no `reset()` method. The host Reset operation reconstructs from its last accepted source string. Dispose is idempotent, releases the owned world and makes later host action/update refuse. The host installs no clock or canvas listeners; the common page owns UI listeners and closes the sample on removal. Actual world calls after world disposal use the package's `DISPOSED` error; a closed host also has its own lifetime guard.

## Existing CPU task receipts

## Task 1 — advance a sphere and retain state on a wrong time step

Run from the repository root with Node 22+ and the existing app-local esbuild runtime. The runner reads ordinary public source export maps and transforms TypeScript; it does not install or publish packages.

```sh
node apps/library-docs/scripts/run-example.mjs apps/library-docs/scripts/snippets/physics-example.ts
```

The complete runnable file is shown below. Its expected values come from the fixed API and inputs. This CPU command succeeded on Node22.22.0 at the fixed source pin in #1270. Its native receipt records the actual output and zero own dist inputs. A successful CPU task does not prove browser pixels.


The same file also contains the separate cloth task below. Neither task creates a display canvas.

```ts
import { createPhysicsWorld, PhysicsError } from '@barocss/physics';
import { createClothWorld } from '@barocss/physics/cloth';
const dt = 1 / 120;
const world = createPhysicsWorld({ fixedStepSeconds: dt, gravityMps2: [0, -9.81, 0],
  bodies: [{ id: 'part:ball', kind: 'dynamic', shape: { kind: 'sphere', radiusM: 0.15 },
    positionM: [0, 2, 0], velocityMps: [0, 0, 0], massKg: 1, restitution: 0.25 }] });
try {
  const state = world.step(dt);
  let refused = '';
  try { world.step(1 / 60); }
  catch (error) { if (!(error instanceof PhysicsError)) throw error; refused = error.code; }
  if (state.stepIndex !== 1 || refused !== 'INVALID_STEP' || world.getState().stepIndex !== 1) throw new Error('Unexpected step result');
  console.log(JSON.stringify({ task: 'rigid-step', stepIndex: state.stepIndex,
    timeSeconds: state.timeSeconds, yM: state.bodies[0].positionM[1],
    velocityYMps: state.bodies[0].velocityMps[1], refused, retainedStep: world.getState().stepIndex }, null, 2));
} finally { world.dispose(); }
const cloth = createClothWorld({ format: 'barocss-cloth-scene', version: 1,
  revision: 'sheet-v1', basis: 'right-handed-xyz-metres', fixedStepSeconds: dt,
  profile: 'pinned-sheet-sphere-v1' });
try {
  const frame = cloth.step(dt);
  const reset = cloth.reset();
  console.log(JSON.stringify({ task: 'cloth-step', stepIndex: frame.stepIndex,
    vertexCount: frame.vertexCount, triangleCount: frame.triangleCount,
    positionValues: frame.positionsM.length, resetStep: reset.stepIndex }, null, 2));
} finally { cloth.dispose(); }
```

| Expected rigid result | Interpretation |
| --- | --- |
| `stepIndex: 1` | Exactly one host-requested accepted step. |
| `timeSeconds: 1/120` | The configured clock, in seconds. |
| `velocityYMps` approximately `-0.08175` | Gravity −9.81 m/s² acts for one step. |
| `yM` approximately `1.99931875` | Semi-implicit integration advances from Y=2 m using that velocity. |
| `refused: "INVALID_STEP"`, `retainedStep: 1` | Passing 1/60 does not accept a second step. |

The sphere has no floor or other body in this task, so the displacement measures free fall without contacts. Use numeric tolerance for floating-point comparison. It is not a trajectory or collision accuracy certificate. The `finally` block disposes the world. Subsequent world mutation refuses with `DISPOSED`.

## Task 2 — inspect fixed cloth topology and reset its clock

Run the same file and read its second JSON object. The full cloth input declares format/version/revision/basis/fixed step/profile; it does not accept an arbitrary mesh.

Expect `stepIndex:1`, `vertexCount:289`, `triangleCount:512`, `positionValues:867` and `resetStep:0`. Each vertex has three XYZ values in metres. The returned arrays are independent copies. Reset creates the admitted baseline again. The fixed simulation sphere is a proxy, not an original CAD Surface. Visual cloth does not establish calibrated stress or continuous triangle separation.

To display the actual supported cloth frame, use `examples/physics-cloth-viewer/README.md` and its declared Viewer/GPU host setup. The host owns the clock, rendering and exactly one metre-to-display conversion. Do not pass a browser frame delta directly to `step`.

The original CAD/GPU playground images are not Physics simulation results. The new [manual Physics sample](/playground#physics-step) displays copied actual Physics state through host Canvas2D. See [Viewer examples](/packages/viewer/examples) for the separate metre-to-Viewer display boundary.

Source pin: `5f5ad866205a21510ac69552e704cc162fa253b5`. Public declarations: [API](./api) · [Exact public reference](./reference). Read [limits and errors](./limits) before changing the input profile.
