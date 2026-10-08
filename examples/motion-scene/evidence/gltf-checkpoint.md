# glTF animation import checkpoint — 2026-10-08

Issue: [#718](https://github.com/barocss/barocss/issues/718). Native parent: `0b3358819cb09ff469d4a3a5d6f9609096e4e116` (#692). Scope: `packages/barocss-motion/**` and `examples/motion-scene/**` only.

## Executed evidence

- First affected build failed in `src/gltf.ts(135,29)` with TS18046: `count` was `unknown`. After narrowing it to a number, `pnpm --dir packages/barocss-motion build:library` passed with Node 22.22.0.
- `node examples/motion-scene/gltf-probe.mjs` passed. It read the real Khronos `AnimatedTriangle.gltf` and both `.bin` files. Rotation was `[0,0,0,1]` at 0 s, a normalized quarter turn at 0.25 s, `[0,0,1,0]` at 0.5 s, and `[0,0,0,1]` at 1 s. Both source buffers remained byte-identical. A float32 translation fixture converted 0.02 m to approximately 20 mm and -0.03 m to approximately -30 mm. CUBICSPLINE, an unsupported frame, a truncated buffer and an unmapped node refused with the expected codes.
- Headed Chromium loaded `gltf-demo.html` from a repository-root server on port 52199. At 0.5 s the live pose readout was `[0,0,1,0]` and the drawn triangle was inverted; [midpoint screenshot](gltf-midpoint.png). The browser then refused CUBICSPLINE with `UNSUPPORTED` while retaining the 0.5 s pose; [refusal screenshot](gltf-refusal.png). Playwright console: zero errors and warnings.

## Boundary

This checkpoint proves one selected node-local glTF TRS animation becomes an owned Motion clip and drives this host's fixed geometry. It does not prove full glTF/GLB scene or geometry import, hierarchy composition, skinning, Viewer adoption, Integration adoption or release acceptance.
