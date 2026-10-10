# Physics: one rigid step and one cloth step

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

[The playground](/playground) renders static CAD/GPU inputs. Its images are not Physics simulation results. See [Viewer examples](/packages/viewer/examples) for the explicit CPU-state versus displayed-frame boundary.

Source pin: `5f5ad866205a21510ac69552e704cc162fa253b5`. Public declarations: [API](./api) · [Exact public reference](./reference). Read [limits and errors](./limits) before changing the input profile.
