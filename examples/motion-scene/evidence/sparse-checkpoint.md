# Sparse glTF animation checkpoint — 2026-10-08

Issue: [#729](https://github.com/barocss/barocss/issues/729). Native parent: `e9c8e2c233aa2069fc2bfa0c161d1f5584745373` (#726). Scope: `packages/barocss-motion/**` and `examples/motion-scene/**` only.

## Executed evidence

- The first affected `pnpm --dir packages/barocss-motion build:library` passed with Node 22.22.0. Two further builds passed after sparse validation refinements. Existing compiled glTF, GLB, cubic and cubic GLB probes passed after the shared accessor reader change.
- `node examples/motion-scene/sparse-probe.mjs` passed. A local CC0 derivative of Khronos InterpolationTest stores animation 4's 15 original VEC4 output records in a zero-base sparse accessor. Dense and sparse four-subdivision `MotionClip` values matched exactly; the source bytes stayed unchanged. An original-base sparse overlay also matched. In-memory sparse variants with 8-, 16-, and 32-bit indices and sparse input timestamps matched the dense clip. Duplicate/out-of-range indices and short sparse value region refused with `INVALID_ACCESSOR`; a strided sparse view refused with `UNSUPPORTED`.
- Headed Chromium loaded `sparse-demo.html` from a repository-root server on port 52239. At 0.125 s the fixed box rotated and the owned pose readout showed `[0,0,-0.0576771,0.9983353]`; [quarter screenshot](sparse-quarter.png). The old import API then refused CUBICSPLINE with `UNSUPPORTED` while the pose stayed visible; [refusal screenshot](sparse-refusal.png). Playwright console: zero errors and warnings.

## Boundary

The fixture is a local derivative, not an upstream sparse Khronos sample. It proves the bounded node TRS float32 accessor path with these inputs. It does not prove general glTF validation, mesh/skin/morph support, Viewer adoption, Integration adoption, release acceptance, or a uniform spline approximation error bound.
