# FLUID-04 CAD shelf evidence — 2026-10-09

## Frozen profile

Issue [#816](https://github.com/barocss/barocss/issues/816) freezes one sourceVersion 0 native Surface as one fixed axis-aligned box proxy inside the v1 256-particle basin. Source identity is the complete source text plus `shelfRev1`. A changed source or revision must be refused before a step or reset. Positions stay in metres inside Physics; Viewer converts them to scene units once. The source Surface remains the visible CAD geometry. Box projection counts are diagnostics, not forces.

The fixture is `fluid-cad-shelf.barocad`, `@model fluid_shelf` / `@surface #shelf`. The CAD proxy reports ID `fixture:fluid_shelf.shelf`, centre `[0.35,0.2,0.25]` m, half extents `[0.15,0.01,0.15]` m, and an explicit control-net box approximation label. The collision box expands by the 0.0125 m particle radius.

## Compiled Physics checks

Node 22.22.0; `pnpm --filter @barocss/physics build:library`; `node examples/physics-scene/fluid-cad-shelf-probe.mjs`. The probe passed static-box admission and rejected an oversized box, dynamic proxy, offset proxy and initial particle overlap. It rejected changed revision, changed source text and missing current source with `STALE_SOURCE`; accepted state stayed at step 0. It also rejected a stale reset. Returned obstacle dimensions and particle state were copies. Two independently created shelf worlds had the same step-240 raw Float64 position SHA-256.

| Accepted step | Bare v1 SHA-256 | Shelf SHA-256 | Shelf projections in step | Shelf projections total | Mean absolute density error |
| --- | --- | --- | ---: | ---: | ---: |
| 60 | `f14b5eaa5b34c074c8ecbe501be5b84af56eabbfdfbbcb823940aa999605e1bc` | `2cfda35a877aaf8bd21cfa83eaadc3179c0b70e896b44fd5f3698c47ad6c5086` | 21 | 859 | 0.226770201 |
| 240 | `6a951b6fe9baeee2d40a5cd2fd4752d7681f484ef07f167a8edc7dd03f8c068b` | `3d261943d75f9b94363c4c6085900a2e6e8a096b36c13a7310f7811d115bdb8d` | 4 | 2660 | 0.033090973 |

Every accepted step through 240 had zero particle centres inside the radius-expanded box, using a 1e-9 m interior margin. The same-process per-step p95 was 24.226 ms without the shelf and 23.567 ms with it, ratio 0.973, under the frozen 1.5× gate. This one-machine wall time is an observation, not a general speed guarantee.

`node examples/physics-scene/fluid-world-probe.mjs` passed with unchanged v1 step-240 SHA `6a951b6f…068b`. `node examples/physics-scene/fluid-visual-profile-probe.mjs` passed unchanged v1/v2 numeric checks at steps 60, 240 and 720 for release and high-drop fixtures. `node examples/physics-scene/source-import-probe.mjs` passed five source and five compiled entries, including `/fluid-cad`.

## Actual Viewer browser flow

The `fluid-cad-viewer` host bundled Physics `src/fluid-cad.ts` with built Viewer/CAD dependencies. Headless Chromium opened `http://127.0.0.1:52955/`. The native CAD Surface and 256 particles appeared in one 640 × 480 WebGL2 canvas. An instrumented reload observed one unique WebGL2 context and 256 POINTS vertices per particle draw. WebGL error was 0. Step-0 SHA was `9f3fec9d63e9be9f313857c9591bbe1deda5ffa471382184081e4c18cf8c618b`. At step 60 the bare mode matched the compiled v1 SHA above; the shelf mode matched the compiled shelf SHA above and reported 21 box projections. Shelf step 240 matched the compiled shelf SHA above and reported 4 box projections. The same source Surface remained visible in both modes.

The stale-revision button at shelf step 240 received `STALE_SOURCE`, retained step 240 and retained the rendered-pixel hash `3222176261`. Reset returned to step 0 and the original SHA. Forced `WEBGL_lose_context` disabled all controls. Restoration reloaded the scene at shelf step 0 with 256 particles and WebGL error 0.

- [Shelf step 0](physics-816-shelf-step-0.png)
- [Shelf step 60](physics-816-shelf-step-60.png)
- [Shelf step 240](physics-816-shelf-step-240.png)
- [No-collision step 60](physics-816-bare-step-60.png)

## Scope

This proves the selected first shelf fixture and 240 accepted steps. The collision shape is a control-net box approximation. Thin features can tunnel if a particle crosses the whole box between steps. This profile does not cover exact Surface contact, moving CAD, more than one box, fluid pressure, v2 visual settling with a CAD obstacle or all browser/GPU combinations.
