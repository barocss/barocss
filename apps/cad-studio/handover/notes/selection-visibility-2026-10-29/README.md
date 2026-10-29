# Clearer viewport selection — D332, 2026-10-29

The owner requests a more visible point/edge/face/body selection colour. Existing yellow reused the
Studio accent; the inspected decisions contain no separate rationale. Keep general tool, section and
mould accents while giving selection its own dark cyan #22d3ee and light cyan #007f9e palettes.

Selected faces mix64% selection colour, selected edges use3.4px, and body outlines3px. Selected points
use6px circles with a contrasting ring; hovered points use4px and do not cover selected points. The
outliner uses the same CSS palette. WebGPU and WebGL2 share theme values; direct and instance source
paths are updated, while their separate actual coverage is NOT_RUN. No geometry, schema, dependency,
Model or GPU-package source changes. WebGL2 reuses its visible-edge pass for selected body edges;
WebGPU's global3px outline also affects existing red contact outlines, preserving their priority.

## Validation and first failure

See [qualification.json](qualification.json). Node22 Studio types/build and scoped lint pass; existing
facePaint tests3/3 pass. Existing bundler warnings remain. Root source review fixed a theme-recolour
path that initially dropped direct geometry material properties; full kind-specific properties remain.
No artificial constant-mirror test or entire package suite was added for this visual change.

Actual Chrome profiles run serially: WebGPU dark/light PASS in native-first; WebGL2 dark initially
fails during Box setup, before any selection or rendering assertion. The actual public toast refuses
editing while computation is pending. Raw failure remains:

```text
page.waitForSelector: Timeout 30000ms exceeded.
  - waiting for locator('.hud') to be visible
```

No page/console exception or source change was observed. A driver-only followup waits for accepted
engine readiness before New and Box. Only WebGL2 dark/light are retaken, both PASS. The two earlier
WebGPU successes are reused; this is four distinct qualified profiles across two runs, not one whole
four-profile run. Screenshots/state captures are not extra test cases. Actual mouse controls select
point, edge, face and body; projection/selection hooks only observe. Public Escape clears selection;
selected-face theme flips preserve references, document nodes and parameters. All owned contexts,
browsers and servers close, with at most one browser active at a time.

Root manually reviewed eight representative captures listed in qualification.json, including both
renderers/themes and actual face recolouring. This is bounded visual evidence, not numeric contrast,
color-vision/accessibility certification or every hardware/display-mode acceptance. Source capsules
and watches bind five changed modules and the selected driver only, not the full served graph.

## Electron question

The owner asks whether an Electron build could require WebGPU only. This is a feasible product-support
policy: Electron embeds Chromium, but adapter/device availability still depends on the supported
platform/GPU/driver combination. A selected Electron build needs actual platform acceptance, startup
adapter/device checks and document-preserving device-loss/recovery. This question does not itself
change the current dual-renderer implementation or authorize a wrapper/release. Existing desktop scope
retains the proposal; the next regular feature remains08.

Official references consulted2026-10-29:
- [Electron introduction](https://www.electronjs.org/docs/latest/)
- [Chrome WebGPU troubleshooting](https://developer.chrome.com/docs/web-platform/webgpu/troubleshooting-tips)
- [Electron app GPU status APIs](https://www.electronjs.org/docs/latest/api/app#appgetgpufeaturestatus)

No full suites, direct/instance actual matrix, Electron runtime, remoteCI, performance or release
acceptance. Completed D331 drawing qualification remains separate.
