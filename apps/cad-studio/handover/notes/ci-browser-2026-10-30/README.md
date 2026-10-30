# CI browser verification (roadmap 33, D359)

The gpu and viewer WebGPU tests used to skip in CI because `CHROME` and `PW_DIR` were never set. CI now runs them for real.

- **Where:** a `browser` job in `.github/workflows/ci.yml`. It runs when `@barocss/gpu` or `@barocss/viewer` is affected, or when the plan is full. The aggregate "Test and Build" check requires it in exactly those cases.
- **Environment:** `.github/actions/webgpu-chrome` uses the runner's Google Chrome through `chrome.sh`, which applies the SwiftShader WebGPU flags. It installs Playwright 1.62.1 outside the workspace and sets `CHROME`, `PW_DIR` and `VIEWER_ADAPTER=swiftshader`.
- **Runner:** `.github/scripts/browser-ci.mjs` first probes for a WebGPU adapter. Then it runs every `tests/*-browser.test.mjs` in each package one at a time, writing TAP output. It fails on any fail, cancel, skip or todo, on zero passes, and on a file that registers no test.
- **Missing browser:** in CI a missing `CHROME`/`PW_DIR` fails. Locally the runner reports NOT_RUN.
- **Run it locally:**
  ```
  CHROME=… PW_DIR=… node .github/scripts/browser-ci.mjs [gpu|viewer|all]
  ```
  Add `CI=true` to get the CI strictness. Build the packages first:
  ```
  pnpm --filter '@barocss/gpu...' --filter '@barocss/viewer...' run build:library
  ```
- **Evidence:** written under `BROWSER_EVIDENCE_DIR` (in CI, the `webgpu-browser-evidence` artifact). Never in the repo.

Results are in `qualification.json`.
- **Native Metal:** 59/59 pass, 0 skips.
- **SwiftShader on the Mac:** 58/59. The G20 pick-readback point misses the CPU point by about 1.1e-4 against a 1e-4 bound, which is left for the GPU owner.
- **Remote CI:** pending.
