# Signed-sweep arc native observation

Native child parent: verified #923 local develop merge `724beb9aa182483074c5d6883c23117c0685bbf5`.

- Node 22 library build passed; bundled `dist/index.js` 176.2 KiB. Strict compiled public consumer type check passed.
- Focused arc probe passed: positive and negative quarter sweeps, full signed sweeps, sector closure, fresh `build()` copies, 13 invalid or unrepresentable geometry refusals with previous commands retained, and one 256-command `SCENE_LIMIT` refusal. Existing circle/ellipse builder probes passed.
- Actual Chromium 155/WebGL2 at DPR 2: stroked clockwise quarter arc at `(44,31)` was blue `[0,0,255,255]` and hit `Arc`; outside sweep `(16,31)` stayed gray `[64,64,64,255]` and hit `Back`. Filled sector at `(90,52)` was red `[255,0,0,255]` and hit `Sector`; outside `(70,52)` stayed gray and hit `Back`. Real pointer at `(44,31)` routed `Arc:Arc`, then `stage:Arc`.
- Rejected incomplete `setPath` returned `SCENE_LIMIT`; prior path commands and accepted frame remained. Browser Save downloaded a 1,196-byte [v1/Scene v17 document](document.json), SHA-256 `4f2b8824dc53893ba42a9ca2c29cc1274ef1ac92e4e360a16712e2c2703eddc1`.
- File chooser Open staged the document on a new canvas, renderer and tree. Generation 2 repeated the same pixels and hits. A real pointer routed to the restored `Arc`. Editing that restored handle to a negative sweep moved blue paint/hit from `(44,31)` to `(16,31)` without changing the red sector. Browser console errors/warnings: 0/0.

This is one native compiled Chromium/WebGL2 consumer. It does not establish exact circular geometry, cross-browser coverage, a published npm artifact or release acceptance.
