# GPU lane brief (2026-10-23)

## Role
You own:
- `packages/barocss-gpu/**`;
- the studio's `src/viewport/**`;
- App.tsx's call sites for joints, explode, section and overlays;
- the `apps/library-docs` shader hosts.

Branch `claude/gpu-viewer-pose-clip-2026-10-21`, worktree
`/Users/user/github/barocss/barocss/.claude/worktrees/great-einstein-3ea69b`. It is fast-forwarded to integration
`99da385a1`. Before each checkpoint, merge the latest integration SHA into your branch. Stay out of the kernel's core
files.

## Read first
1. common.md (appended above).
2. The last sections of decisions-gpu.md (G19.5 onward, and the GPU hand-over).
3. The GPU section of `notes/codex-handback-2026-10-23.md`.

## State
Integration has Codex's GPU work:
- the cap/pick correction (REVIEW-G1);
- G20.2's bounded timing and display work;
- assembly display modes, curved silhouettes and isolate/fade (G21);
- G22's native clearance UI source;
- G23's print-layer source and persistence, with the slider fix.

Still open:
- G22's and G23's actual dual-renderer and file acceptance;
- G24 (3D PMI) and G25 (GPU analyses);
- antialiased cap edges.

Codex branches, read with git only:
- `codex/a9-7-ui-connection`: the A9-7 UI correction `8789e468`, on top of the original `d46ddbd8`;
- `codex/g23-cam-preview`: G23 CNC preview source `5c9f861f`;
- `codex/cad-gpu-cutout-pick-d5ec`, whose worktree `~/.codex/worktrees/d5ec/barocss` has a dirty fixture
  `packages/barocss-gpu/tests/fixtures/cad-display-browser.ts`. Leave it alone.

## Your queue
1. **The Studio lint error** from Codex's final window: `apps/cad-studio/test/bench-assembly.mjs:34` no-this-alias.
   Also any viewport/GPU failure the coordinator's window reports at `99da385a1`. Codex once saw studio test 183:
   `sectionedInstances` now returns sourceBodies/Faces/Edges. Keep the legacy geometry and validate the additive
   identity metadata.
2. **A9-7 UI connection.** Review `8789e468` and its parent `d46ddbd8`, and port their source (no evidence):
   - the NodeEditor/Outliner Housing path, exact-owner restore and commit, current-source and selection guards;
   - the linked BOM pending/refusal CSV block;
   - the current root/owner native faceTable in useAssembly.

   History of the fix:
   - Codex's first failure was a blank React screen from a bare linked child FaceClient/faceKey read, then a Save
     timeout. `8789e468` addresses that.
   - The no-row flow passed at `8789e468`. Linked-bearing success waits for a person-supplied row file (owner).

   It touches studio UI and BOM: agree the files with the outer lane through the coordinator before building.
3. **G23 CNC preview.** `5c9f861f` has six cam source files and the S0 only. Finish the App, Viewport and renderer
   connections and the tests.
4. **G22 and G23 acceptance** on both renderers, including Save/Open and WebGL2 (print controls).
5. **G24** (3D PMI, calling the outer lane's glyph builders), then **G25** (GPU analyses), then antialiased cap edges.

## Rules specific to you
- No nested functions in per-frame, per-draw or per-element paths.
- The icon font is loaded from Google Fonts and never bundled.
- Bench budgets: about 2× the measured value. Run them only when the load is low; say LOADED otherwise.
