# GLB animation import checkpoint — 2026-10-08

Issue: [#721](https://github.com/barocss/barocss/issues/721). Native parent: `27b0871bef7a69665f4a34876cc7b0b2cade3d69` (#718). Scope: `packages/barocss-motion/**` and `examples/motion-scene/**` only.

## Executed evidence

- The first affected build, `pnpm --dir packages/barocss-motion build:library`, passed with Node 22.22.0. No initial build failure occurred.
- `node examples/motion-scene/glb-probe.mjs` passed. It read the real Khronos `BoxAnimated.glb`: rotation has two keys and ends at 2.5 s, translation has four keys and ends at 3.708329916000366 s. The rotation sample at the final clip time equaled its 2.5 s sample while translation changed. Source bytes remained identical. A one-byte zero BIN pad and an unknown later chunk were accepted; nonzero pad, bad magic and truncation were refused.
- Headed Chromium loaded `glb-demo.html` from a repository-root server on port 52209. At 2.5 s the rotating-box quaternion was `[1,0,0,0]` and the moving-box translation was `[0,2520,0]` mm; [rotation-end screenshot](glb-rotation-end.png). At 3.71 s rotation held while translation returned to `[0,0,0]`. A damaged GLB header was then refused with `INVALID_INPUT`; the 3.71 s pose stayed accepted; [refusal screenshot](glb-refusal.png). Playwright console: zero errors and warnings.

## Boundary

This checkpoint proves the bounded GLB container path plus the existing selected-animation converter and this host's fixed-box display. It does not prove GLB mesh/scene loading, hierarchy composition, skinning, Viewer adoption, Integration adoption, broad file compatibility or release acceptance.
