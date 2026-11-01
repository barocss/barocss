# D376 — Row 06 closed: GPU owner-branch hand-over (docs only)

Tier: **small**, docs only. Owner order "Go to 01–06", 2026-10-31. [Qualification](qualification.json).

This record hands over the GPU lane's finished owner-branch work. **None of it is merged into this product branch.** The roadmap row says to hand it over and not merge it automatically, and that still holds. Merging is for the integrator the owner names.

## Where the commits are

All seven recorded commits exist in this repository. Each is reachable only from one of two local branches:
- neither branch is in `local/cad-dev`;
- neither branch is on origin (`git ls-remote` returned nothing).

Both branches fork from `0d1ec3551`.

| Branch (local only) | Tip | Commits not in HEAD |
| --- | --- | --- |
| `gpu/readback-camera-20261026` | `861ab4408` | 37 |
| `gpu/gltf-03-20261027` | `133d29e9b` | 35 |

| Roadmap item | Commit | Branch | What it adds | Owner-branch checks (from the GPU roadmap and checkpoint) |
| --- | --- | --- | --- | --- |
| PT soft visibility | `fe2637f41` | both | Path-traced point and spot shadows sample frozen light radius | new browser test `viewer-path-trace-soft-shadows-browser`, CPU `viewer-path-trace-light-radius`, public example `examples/path-trace-soft-shadows.html` |
| 01 RenderTarget | `607f7d086` | readback-camera | Viewer-owned single-colour render target at canvas size | per-target pixels, reuse, other-viewer refusal, resize mismatch, dispose and device loss; example `examples/render-target.html` |
| 02.1 sized target | `8de2f6ac8` | readback-camera | Explicit target size and aspect | two differently sized targets, resize and lifetime, canvas output and picking. The demo fix `1252eed9f` was also checked in Chrome DPR 2 emulation (`69b8b6e58`) |
| 02.2 target.asTexture | `2a35e9b66` | readback-camera | Opaque LDR sRGB target output as `Material.map`; refuses self-sampling and path-trace surfaces | scoped emit, new WebGPU regression, lint 5, synthetic public example `examples/render-target-texture.html`, resource release (`8be837e0a`) |
| 03.1 GLB subset | `5d8b77579` (fix of `2b0566777`) | gltf-03 | Self-contained GLB triangles, node transforms, opaque base PBR factors | emit after the fix, 18 new CPU tests, lint 3, synthetic sample auto-load and reload in a browser (`b3e6417f2`) |
| 03.2 GLB embedded textures | `29fd01911` → `d4e2c3ec7` | gltf-03 | Bounded embedded PNG/JPEG, UV and base-colour texture | emit after the fix, 6 new CPU tests, 1 WebGPU test, lint 4, synthetic PNG→JPEG→PNG public browser check (`c4c2a017b`) |

## Original failures, kept

- **03.2 first emit (`29fd01911`).** The emit failed with TS2345/TS2322: an unknown MIME string was passed where the PNG/JPEG union was expected. Exits: wait 2, acquire 0, command 2, release 0, wrapper 2. The CPU, WebGPU, lint and public checks were NOT_RUN on that commit. `d4e2c3ec7` narrows the MIME type and passes.
- **03.1.** `2b0566777` needed the typed colour-tuple fix `5d8b77579` before its emit passed. The original text is not kept in this repository.
- **02.2.** The roadmap keeps an initial sandbox failure; its original text is not kept in this repository.
- **Device failure (open).** The checkpoint records forced recovery rejection only in the console, and the context-failure device clean-up is unconfirmed. The source fixes on readback-camera, `4187210f9` and `861ab4408`, are past the recorded commits. They have no recorded qualification here, and physical failure is NOT_RUN.

## PNG

The GPU roadmap says each item left a browser example and a PNG. **No such PNG is committed in either branch or in this repository**, and the repository guard refuses PNG files. Their files were not found in this checkout or its scratch areas. The examples above reproduce the images. An integrator who needs the original images must ask the GPU lane.

## Not covered

- **Later work.** `133d29e9b`, GLB `UNSIGNED_INT` indices (roadmap 04.1), is source only: emit, CPU, WebGPU, lint and public checks are NOT_RUN.
- **Scope.** The GLB work is not general glTF: external assets, animation, skin and morph are absent, and mipmapped minification is unchecked.
- **Product acceptance.** None of this is product-integrated acceptance or a quality verdict. Owner-branch completion is not run or quality completion in this product.
- **This record.** No product build, test or browser run was made for it, and no commit was cherry-picked or merged.
- **Branch safety.** Both branches exist only in this local repository. Losing the local refs would lose the work, so pushing or backing them up is the owner's call.
- **Next GPU items.** These follow the GPU lane's own numbered roadmap on its branch: 04 real glTF gaps, 05 morph, 06 cube environment, and onward.
