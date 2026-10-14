# CAD learning path: measured browser run

This is the physical browser receipt for [issue #1803](https://github.com/barocss/barocss/issues/1803). The first model, L-bracket, and mounting plate ran in the actual `#/model` application at source commit `96356fc44a2a4f0a65a3ef3e3333920bd938e1b7`. The [round-post physical receipt](https://github.com/barocss/barocss/wiki/CAD-Round-Post-Physical-QA-2026-10-14) covers the other lesson at its own pinned commit. These are local acceptance results, not a deployed site or a published package.

## Run conditions

| Item | Recorded value |
| --- | --- |
| Source | `96356fc44a2a4f0a65a3ef3e3333920bd938e1b7` on `develop` |
| CI for that source | [Successful run 38576403949](https://github.com/barocss/barocss/actions/runs/38576403949) |
| Device | macOS 15.6.1; Google Chrome 155.0.8059.40; Playwright Core 1.57.0 |
| Runtime | Node 22.22.0; pnpm 10.11.0 |
| Viewport | 1440 × 900 CSS pixels; device pixel ratio 2 |
| Application | `http://127.0.0.1:51803/#/model` in an isolated checkout |
| GPU | WebGL2 canvas; actual `readPixels` returned error 0 for the recorded first-model, L-bracket, and mounting-plate frames. The launch requested ANGLE SwiftShader. The renderer string was not collected. |

Commands used in the isolated checkout:

```sh
pnpm install --offline --frozen-lockfile
pnpm --filter @barocss/cad-editor run build:library
pnpm --filter @barocss/cad-editor-app run build
pnpm --filter @barocss/cad-editor-app exec vite --host 127.0.0.1 --port 51803 --strictPort
```

The browser loaded the real editor and native worker. It reported no page exception or console error in the final runs. A local route returned HTTP 204 for the unused favicon. The full <a href="/evidence/cad-editor/manual-1803/receipt.json">machine-readable receipt</a> contains each original PNG checksum, input, accepted output, UI inspection text, and GPU readback. The screenshot links below point to those original browser captures.

## First model: underside pocket

| Accepted step | Named output from the editor | Screenshot |
| --- | --- | --- |
| `depth=4` | `part`, 5632 / 1 mm³; history 1/1 | [Pocket at 4 mm](/evidence/cad-editor/manual-1803/pocket-depth4.png) |
| `depth=8` | `part`, 5120 / 1 mm³; history 2/2 | [Through-window at 8 mm](/evidence/cad-editor/manual-1803/pocket-depth8.png) |
| Undo | `part`, 5632 / 1 mm³; history 1/2 | [Undo](/evidence/cad-editor/manual-1803/pocket-undo.png) |
| Redo | `part`, 5120 / 1 mm³; history 2/2 | [Redo](/evidence/cad-editor/manual-1803/pocket-redo.png) |

The source-qualified integer-cell volume came from the accepted model's **Inspect selection** panel. The distinct browser frames show the derived display. Pixel values were not used to calculate the volume.

## L-bracket: union, refusal, and real file

| Step | Named output from the editor | Screenshot |
| --- | --- | --- |
| Initial `legWidth=8`, `legMinY=0` | `base` 2048, `leg` 1536, `bracket` 3072 mm³; history 1/1 | [Initial bracket](/evidence/cad-editor/manual-1803/bracket-width8.png) |
| Accept `legWidth=12` | `base` 2048, `leg` 2304, `bracket` 3584 mm³; history 2/2 | [Wider bracket](/evidence/cad-editor/manual-1803/bracket-width12.png) |
| Accept `legMinY=8` | Face contact; `bracket` 3584 mm³; history 3/3 | [Face contact](/evidence/cad-editor/manual-1803/bracket-face-contact.png) |
| Attempt `legMinX=32` | Edge contact refused as nonmanifold; accepted `bracket` 3584 mm³ and history 3/3 retained | [Refused draft](/evidence/cad-editor/manual-1803/bracket-edge-contact-refusal.png) |

**Download model** saved an actual 685-byte <a href="/evidence/cad-editor/manual-1803/part.cad.json"><code>part.cad.json</code></a>, SHA-256 `dec39518f578176d63fc44587b2230811c135f6a8a676ae4b96af41aa0553e08`. A fresh browser context chose that disk file. File selection staged 685 bytes while the prior accepted model stayed unchanged. Only after checking **Replace accepted model and discard its history and pending dimensions** and choosing **Open saved model** did the editor rebuild it. Generic Open initially showed `leg`; [reselecting `bracket`](/evidence/cad-editor/manual-1803/fresh-reselect-bracket.png) displayed the saved union. A further `legHeight=16` edit produced [accepted `bracket` 5120 mm³](/evidence/cad-editor/manual-1803/fresh-reedit-height16.png). This re-edit starts from `legWidth=12`, `legMinY=8`; it is different from the 4608 mm³ native fixture that first restores the initial width and origin.

The real picker refused malformed UTF-8 and a 262,145-byte file. Both showed **Cannot read model file** and retained the earlier staged text and accepted `bracket`. The prior accepted `bracket` and history also survived the edge-contact refusal. These are distinct file and native geometry rejection cases.

## Mounting plate: rational output and containment

| Step | Editor result | Screenshot |
| --- | --- | --- |
| Initial `radius=5` | `blank` 25,600 / 1 mm³; `plate`: **Certified volume unavailable**; history 1/1 | [Initial plate](/evidence/cad-editor/manual-1803/plate-radius5.png) |
| Accept `radius=2.5` | Same named outputs and certification boundary; history 2/2 | [Smaller hole](/evidence/cad-editor/manual-1803/plate-radius2.5.png) |
| Accept `centerX=32.5`, `centerY=18.75` | Off-center accepted plate; history 4/4 | [Off-center hole](/evidence/cad-editor/manual-1803/plate-offcenter.png) |
| Attempt `radius=18.75` | Strict containment refusal; previous plate and history 4/4 retained | [Refused containment](/evidence/cad-editor/manual-1803/plate-containment-refused.png) |

The visible dimension fields had accessible labels, and the actual `radius`, `centerX`, and `centerY` inputs took keyboard focus. The refusal appeared in the aria alert; the accepted model remained in the status and inspection panel. The separate [mounting-plate physical receipt](https://github.com/barocss/barocss/wiki/CAD-Mounting-Plate-Physical-QA-2026-10-14) records an earlier device run at its own source pin.

## Earlier round-post run and evidence limits

The independent [#1683 round-post run](https://github.com/barocss/barocss/wiki/CAD-Round-Post-Physical-QA-2026-10-14) used adopted software `59b44b6f7bfa5e7135bca9c391e3ce2519aced20` and a clean `develop` checkout at `cb7298bf3fb5cc119c2b907bb6625ad9965fa4c4`. Chrome 148/WebGL2 accepted height 6→9 and diameter 8→4, kept `post` with **Certified volume unavailable**, refused diameter 0 while retaining the accepted source, and completed a 402-byte physical Download → fresh Open → re-edit. Its five actual screenshots, final receipt, and four earlier driver failures remain linked there. This document cites that result; it does not claim the round post was rerun at `96356fc4`.

Three harness errors were kept in the <a href="/evidence/cad-editor/manual-1803/receipt.json">receipt</a>: a wait for **Accepted model** after a correctly refused draft, an invalid `selectOption` argument, and a locator that searched for `holeRadius` instead of the actual `radius (mm)` label. They are harness failures, not product failures. Final first-model/L-bracket and plate runs each reported no browser error.

Native and UI values above are limited to the stated source, dimensions, and device. The screenshots establish actual displayed frames and successful WebGL2 readback for the listed captures. They do not certify plate volume, arbitrary Boolean operations, manufacturing, production deployment, npm publication, or all browser devices.

[Learning path](./learning-path) · [Browser evidence protocol](./browser-evidence) · [First model](./first-model) · [Round post](./round-post) · [Mounting plate](./mounting-plate) · [L-bracket](./l-bracket)
