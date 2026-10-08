# Motion showcase checkpoint — Issue #736

Base: `5b337e3ea0548465ef2b63c01418ff58002e1c7a` (native #732 commit).
Scope: `examples/motion-scene/**` only. The directory root now opens a pick-and-place showcase; the original two-part API sample is preserved at `core-demo.html`.

## What the screen proves

- Two authored Motion v0 clips move the same host-owned gantry, jaws and parcel. The first clip moves the parcel to the right pad. The second moves it through the center scanner and returns it to the left pad.
- The page reads poses, time and marker events from `createMotionTimeline`. Three.js draws fixed host geometry from those poses. The renderer does not compute the animation.
- Clip selection replaces and disposes the old timeline. Play, pause, seek, restart, speed and repeat change the displayed state. Phase buttons seek to named times. The live pose summary follows the selected frame.
- The page keeps raw pose JSON under a disclosure. It also shows a visible error when the Three.js module cannot load.

## Verification (2026-10-08)

- Node 22.22.0: `pnpm --dir packages/barocss-motion build:library` passed.
- Node 22.22.0: `node examples/motion-scene/showcase-probe.mjs` passed. It checks endpoint and representative poses, marker crossings, seek, clip replacement and unchanged authored input.
- `node --check examples/motion-scene/showcase.js` and `git diff --check` passed.
- Headed Chromium at 1200 px: initial frame was paused at 0 s with the parcel on the left pad. Play for about 2.1 s, then pause, returned marker `부품 집음` and a paused timeline at 2.13 s. Click `놓기` showed 4.60 s and parcel X 105 mm.
- Headed Chromium at 390 px: the layout stacked without horizontal overflow. Clip change reset time to 0. Click `검사` showed 2.70 s, parcel X 0 mm, the center scanner and the matching scene label. Repeat and 2× speed changed the timeline state; `처음으로` paused and reset it to 0.
- An intercepted Three.js module request showed the visible `3D 장면을 열지 못했습니다` message. This interception intentionally produced browser console errors. The normal load had zero errors or warnings.
- The `기술 샘플 보기` link opened `core-demo.html` with its original page title.

Screenshots: [desktop start](./showcase-desktop.png), [mobile inspection](./showcase-mobile-inspection.png).

## Limit

This is a host-authored scene and two host-authored clips. It does not load CAD geometry, infer constraints, plan a robot path or import a complete glTF scene. The browser needs the pinned Three.js CDN module to render the stage. Package API and shared integration files are unchanged.
