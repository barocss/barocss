# CAD consumer readiness — 2026-11-04

The library is usable for the bounded primitive experiments below. It is not a
complete CAD dynamics or manufacturing engine. This review changes only Physics,
its independent examples and documentation. CAD, CAD-model, GPU and CAD Studio
product source/dependencies are unchanged.

## Actual checks and current boundaries

| Consumer | Actual evidence | Usable scope | Required next work |
| --- | --- | --- | --- |
| `@barocss/cad` | PASS: compile a real Source-v0 Surface, admit a primitive proxy, run 8 steps, map accepted pose back to mm, check stale source/revision refusal | Selected box/sphere proxy experiments using `@barocss/physics/cad-proxy`; source/revision binding stays explicit | Exact native Surface / B-rep collision, solid-derived mass and general document update flow are not implemented by this adapter |
| `@barocss/cad-model/api` | PASS: build an actual box, read mass/COM/inertia and meshes, convert MMGS to SI, run a primitive-COM box for 8 steps | Manual primitive-model DTOs and explicit units/frame conversion; meshes can follow accepted poses | G3 arbitrary COM, principal/full tensor and collider-offset admission; assembly/joint bridge and document synchronization |
| `@barocss/gpu/api` | PASS: actual CAD tessellation and CAD-model meshes enter `scene().add(...).data`; this is CPU validation, not a render-device test | Render-data preparation; a caller can map accepted Physics poses through an explicit adapter | A product adapter and its actual GPU-library render tests. The separate current desktop sample uses direct WebGPU |
| `apps/cad-studio` | SOURCE INSPECTION ONLY; NOT INTEGRATED; HOLD | No current Physics-backed Studio simulation claim | No Physics dependency/import or World owner exists in the inspected app. An approved integration scope, units/pose ownership, start/pause/reset/restore and product tests are still needed |

`anisotropic-consumers-02` actually runs two Worlds / 16 accepted steps in each
Physics graph, with exact complete state/command word parity. Physics Source
uses the current TypeScript root/cad-proxy; Physics Native uses actual canonical
root/cad-proxy from `public-build-02`. CAD, CAD-model and GPU remain workspace
Source APIs in both graphs. Their compiled packages are not newly qualified.
No GPU device or Studio build/test runs in this consumer bank.

Separately, the standalone desktop sample loads that same canonical Physics
provider into one worker-owned World at a time. Two 64-step cases pass full
state-word parity, independent numerical references, changed actual GPU pixels,
controls and 1280/1440/1920 widths. This proves that sample's rendering path;
it does not establish a CAD Studio or GPU-library application integration.

## Units and frames at the adapter boundary

Physics uses metres, kilograms, seconds, radians, right-handed XYZ and a
body-local-to-world XYZW quaternion. CAD geometry uses mm. CAD-model's mass
API uses MMGS: mass in g, inertia in g·mm². Convert before constructing a model:

- CAD length / COM: mm × 1e-3 → m.
- CAD-model mass: g × 1e-3 → kg.
- CAD-model inertia: g·mm² × 1e-9 → kg·m².
- Keep one explicit coordinate transform. The current consumer test keeps CAD
  XYZ unchanged and supplies Z gravity `[0,0,-9.81]`. It does not silently map
  CAD Z-up to the Y-gravity convention of other examples.

The actual 500 × 1000 × 1500 mm box at density 2.7 g/cm³ has mass 2025 kg,
COM `[250,500,750]` mm and central diagonal inertia
`[548.4375,421.875,210.9375]` kg·m². All are checked against analytic cuboid
values with the predeclared 1e-10 relative gate. Physics receives primitive-COM
geometry and mass; it does not admit that inertia array as a new tensor API.
A visually unchanged mesh is not evidence of correct mass or inertia.

The existing CAD pose adapter computes
`translationMM = 1000 * positionM - R(q) * sourceCenterMM`, with quaternion
unchanged. The fixed quarter-turn consumer checks this against an independent
literal geometric transform. Caller code must still apply that accepted pose
to the intended document/render object; no automatic CAD document mutation is
claimed here. Keep the CAD definition unchanged and store transient simulation
poses separately until an explicit document-edit contract is designed.

## Source paths and extension order

- `packages/barocss-physics/src/cad-proxy-admission.ts`:
  `admitCadSurfaceProxy`, `assertCadProxyCurrent`; a Source-v0 control-net AABB
  or enclosing-sphere proxy, manual mass, immutable source/revision binding.
- `packages/barocss-physics/src/cad-proxy-pose.ts`: accepted primitive-COM pose
  conversion to CAD mm. This is not exact Surface collision.
- `packages/barocss-physics/src/model-admission.ts`: current primitive-COM /
  sphere-isotropic inertia and identity collider-local transform boundaries.
- `packages/barocss-cad-model/src/api/core.ts`, `src/app/mass.ts`:
  use the public `/api` subpath; the package's root intentionally exports no API.
- `packages/barocss-cad-model/src/robot/motion.ts`: joint-space/FK motion is
  kinematic replay. It is not the dynamic common World or a robot controller.
- `packages/barocss-gpu/src/api/scene.ts`: the current consumer facade admits
  generated mesh data on CPU. Actual render integration is a separate gate.
- `apps/cad-studio/package.json`, `apps/cad-studio/src`: inspected for current
  dependencies/imports. `UsdPhysics` export labels do not establish Physics
  library integration. Existing Studio/manufacturing/equipment HOLDs remain.

Continue numerical contact qualification first. For generic CAD solids, fix
G3's COM/tensor/frame/parallel-axis contract before a general import adapter.
Then qualify an explicit GPU pose consumer and only an authorized Studio
integration. Preserve the current moving-eight-body, friction and arbitrary
contact NO_GO entries. No real-equipment prediction or manufacturing approval.

Actual command (under existing lane/command guards, installed Node 22):

```sh
node examples/physics-anisotropic-inertia-2276/consumers.mjs consumers-02 \
  --public examples/physics-anisotropic-inertia-2276/evidence/api-01/result.json
```

This is an immutable paid run ID. Reproduction uses a fresh ID. Inputs, state
words, actual virtual esbuild source and every physical import hash are in
`evidence/consumers-02/`. The first virtual-entry authorization failure remains
under `baseline/first-consumer-auth-01` and its original failed run. See
[full results](RESULTS.md) for independent numerical and desktop evidence.
