# C2D-63 authored stroke dashes: native observation

The implementation starts from the separately verified #944 local `develop` merge `bbfda071dc9105f09292fd7868005eeac66fd948`.

- Node 22 `pnpm --filter @barocss/canvas2d build:library` passed (187.9 KiB ESM bundle). Strict compiled consumer type check passed. The focused `probe.mjs` checked Scene v19 acceptance and v20 exact dash fields, public solid default, copied lengths, positive and negative phase, subpath restart, a cut exactly at a sampled vertex, closed seam joins and caps against equivalent solid geometry, invalid inputs, atomic failed edits and `SCENE_LIMIT` for excessive cuts.
- Actual Chromium 155/WebGL2 at DPR 2: on samples `(25,30)` and `(55,30)` were blue/Dash. Gap `(35,30)` was gray/Back. A real pointer down in the gap routed `Back:Back`, `stage:Back`; a real pointer down on the stroke routed `Dash:Dash`, `stage:Dash`. The transformed path returned world bounds `{x:91.90766906738281,y:44.90766906738281,width:23.862335205078125,height:30.226295471191406}`.
- Invalid dash edit returned `INVALID_SCENE`; a valid but resource-rejected zoom 64 returned `SCENE_LIMIT`. Both left the observed frame unchanged. Shifting the public handle's offset to 10 made `(35,30)` blue/Dash and `(25,30)` and `(55,30)` gray/Back. Browser warnings/errors: zero.
- Browser Save produced the 1,592-byte `document.json` (SHA-256 `48040c7aa7b5dcc21233573936f8e308fe1bbb9a043f5b26923dfa9964ba99ec`). File-input Open staged that exact v1 Scene v20 file on a fresh canvas/renderer/tree (generation 2), preserving the sampled pixels, hits and transformed bounds. Editing the restored Dash handle to offset 10 changed the gap to blue/Dash.

Separate local `develop` merged-head acceptance remains pending. The fixed browser samples do not prove precise spacing on every curve or SVG compatibility.
