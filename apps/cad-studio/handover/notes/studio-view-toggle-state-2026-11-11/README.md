---
work_id: D672
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D672 — Keep Ortho and AO in sync with the viewport

P4, row 21. SMALL repair of existing Model and Render display controls. Ortho and AO expose their pressed states. Space and Enter activate the focused control through its native button action. The viewport reports projection changes from the same path for a button press, camera restoration and preview exit. Model AO is disabled and off in line-only views. Returning to shading restores the prior Model AO preference. WebGPU Render uses its existing Scene Occlusion checkbox.

| Check | Result | Evidence |
| --- | --- | --- |
| Original Model controls | FAIL | Both buttons lacked a pressed state. Space opened the command palette while the focused toggle and viewport state stayed unchanged. The AO button appeared on in wireframe while the renderer had no AO. |
| Original restored camera | FAIL | Go to saved view restored the orthographic camera. The Ortho button stayed off and the status still read Perspective. The Model AO button was also present in WebGPU Render and had no effect on Render AO. |
| Model keyboard and viewport | PASS | At 1280 × 720 and 1024 × 768, Tab reached both controls. Space and Enter changed the actual WebGPU projection or AO, pressed state and visual state together. The smaller layout had chat open. Wireframe disabled AO and shaded mode restored it. The document and feature history stayed exact. |
| Render and Print restoration | PASS | Render Scene Occlusion controlled actual raster AO. The saved orthographic camera updated the Viewport and Ortho status on restore. Model AO resumed on return. Print preview restored the prior Model projection and button state after a temporary change in the preview. The saved document stayed exact. |
| Focused checks | PASS | 64 Studio tests, Studio and CAD Model TypeScript, changed-source lint, browser syntax and the Studio production build. |
| Wider execution | NOT_RUN | CAM browser restoration, WebGL2 browser, screen-reader software, mobile and whole CAD readiness. |

The final browser run checked the effective camera and AO on the existing WebGPU Viewer, verified 320 frozen files through cleanup, and recorded zero page errors, console errors and downloads. Model and Render screenshots were reviewed.

Use Node 22.19.0. Run one heavy job at a time under `gate.sh acquire heavy 180 <label>` and `gate.sh release heavy`. Run browser commands from `apps/cad-studio` and use external `EVIDENCE`.

- Baseline `D672_SOURCE_FROZEN=1 node test/view-toggle-state-browser.mjs "$EVIDENCE/baseline" --baseline`. Receipt SHA-256 `f9eacdf4ef742c5fe95454d5205ae7f9f5cb3b73f2d33013c53287a0640d6845`.
- First fixed receipt SHA-256 `c94be24447ca7a38b5f38532f384223173fb2de36f0c18e107fd8c4d08d69ea7`.
- Final `D672_SOURCE_FROZEN=1 node test/view-toggle-state-browser.mjs "$EVIDENCE/final" --fixed`. Receipt SHA-256 `7544a7ef1f0f798c770cf701573bb7413efbd537a1096afff842f2a8037fb7f9`.
- From the root run `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test display-mode small-camera-scale camera-projector camera-relative-query render-focus assembly-steps ui-icons`, `pnpm --dir apps/cad-studio exec tsc --noEmit`, `pnpm --dir packages/barocss-cad-model run type-check`, `pnpm exec eslint apps/cad-studio/src/App.tsx apps/cad-studio/src/ui/ViewDisplayControls.tsx apps/cad-studio/src/viewport/Viewport.tsx`, `node --check apps/cad-studio/test/view-toggle-state-browser.mjs`, `pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/vite-build"` and `git diff --check`.

D673 checks the duplicated Studio Chat startup instructions. Initial scenarios remain 4/10, B09 remains 9/9 and whole CAD readiness is **NOT_MEASURED**. [#2287](https://github.com/barocss/barocss/issues/2287) remains open for the broader contextual UI work.
