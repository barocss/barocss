# D378 — Two local GPU branches merged into local/cad-dev (2026-10-31)

Owner: "나중에 두개 브랜치 머지 해줘", then "Merge before row 20". Tier: full for the gpu viewer core (conflict resolution in shared rendering code). Merge and resolution by an Opus sub-agent; review, actual Studio run and records by the coordinator (Opus).

| Commit | What |
|---|---|
| `e4d0b5a66` | merge `gpu/readback-camera-20261026` (tip `861ab4408`): PT soft visibility, RenderTarget, sized targets, `target.asTexture`, device-failure fixes |
| `8a16b0546` | fix: `ensureTargets`/`ensureOit` default to the canvas size (unit `viewer-cap-samples` calls them without one; the branch alone would fail it too) |
| `119cb0708` | fix: white-box viewer fixtures (`clipping-contract.test.mjs`, `fixtures/presenter-lifetime-harness.mjs`) get `renderTargets: new Set()` |
| `6dd94373a` | merge `gpu/gltf-03-20261027` (tip `133d29e9b`): GLB subset, embedded textures, `UNSIGNED_INT` indices |

Resolution: `local/cad-dev` already held its own copies of most shared commits (device-failure fixes as `d62aeb5d4`); the current viewer core and every current behaviour were kept and only missing pieces added. Conflicts: `viewer/viewer.ts` (20 hunks), `index.ts`, `scene.ts`, `lights.ts`, `path-trace.ts`, `path-trace-scene.ts`, `shaders/path-trace.ts`, gpu README, gpu `package.json` (current test list kept), `apps/cad-studio/src/viewport/Viewport.tsx` (current kept; Studio files are identical to before), gpu `ROADMAP.md`. Nothing dropped; no removed renderer or API revived. No dependency or lockfile change.

Checks on the merged tree (Node 22, gated, one browser):

| Check | Result |
|---|---|
| gpu build:library, type-check, lint | PASS |
| gpu unit (package list + light-radius + 3 GLB files) | 395: 379 pass, 16 fail — the same 16 fail on `origin/local/cad-dev` `0e67f8bc9` before the merge (below) |
| gpu browser (`test:browser` + 7 new: soft-shadows, render-target, -size, -texture, device-recovery-failure, glb-texture, glb-u32) | 53/53 PASS, 0 skipped |
| viewer type-check / unit 6 files / browser 3 files | PASS / 62/62 / 4/4 |
| Studio type-check; 31 Studio test files importing viewport or gpu | PASS; 185/185 |
| GLB `UNSIGNED_INT` (`133d29e9b`, never verified before) | `viewer-glb-u32` 6/6 + browser PASS; `viewer-glb` 18/18, `viewer-glb-texture` 6/6, `viewer-path-trace-light-radius` 8/8 |
| Actual Studio: B2 driver `apps/cad-studio/test/band-surface-browser.mjs` (WebGPU viewport) | PASS, 0 errors, 0 console errors, independent oracles PASS ([receipt](studio-band-surface-receipt.json)); root viewed the HUD image |

Pre-existing failures (not caused by the merge, registered as a follow-up): 14 tests in `cad-clearance-gpu` and `cad-gpu-display-contract` fail with "Cannot read properties of undefined (reading '0')" in the Studio renderer's `mix()` because their test theme lacks the `selection`/`selectionHover` colours added by `d5c5d7a20`; 2 source-text assertions in `cad-instance-display-diagnostics`. NOT_RUN: `test:consumer`, full Studio suite, remote CI. Screenshots are not committed (repository guard).
