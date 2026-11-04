---
work_id: D427
artifact_type: small-camera-scale-qualification
status: qualified-bounded-camera-image-quality-held
owner_role: executor
source_request: "Continue the roadmap and report the row and overall progress"
last_updated: 2026-11-02
---

# Small-camera scale — bounded framing and selection qualification

D427 fixes centered tiny-body camera scale on rows 6, 13 and 16. Overall progress remains about 43%. Fit, visibility and real pointer selection pass on WebGPU and WebGL2. General raster quality remains held because a separate WebGPU orthographic surface pattern is visible. [Counts, commands, source hashes and limits](qualification.json).

Camera fit previously imposed radius 1, zoom imposed distance 1 and near clipping imposed 0.05. The corrected camera uses measured positive bounds and the existing persisted RenderCamera minimum distance 1e-3. A continuous near envelope remains exactly legacy for distances at least 1 and positive below 1. Subunit positive frame spans retain their genuine values. Ordinary valid fit/framing formulas remain exact; zero bounds use unit fallback and invalid/reversed/nonfinite bounds preserve the current valid target with a unit-radius distance. No hidden fit-scale or new stored field is introduced. Projection, far-plane and analytic-ray arithmetic remain unchanged. Existing snapshot/restore, clones, print/CAM and turntable paths continue to copy the same fields.

Before correction, the 16 new tests record 2 PASS / 14 numeric assertion FAIL. Final related tests pass 34 (16 new + 18 existing). Final Studio/Model types, scoped lint and driver syntax pass. Independent math/source review passes; 12 additional admitted-distance-floor controls cover perspective/ortho, three aspects, iso/top, finite projection, analytic rays, project reciprocity and restore. Four mutants restore old fit, near, zoom or frame floors; all fail numeric assertions without crashes. The independent 16 baseline repeats the author tests and is not counted as additional unique coverage.

Initial actual WebGPU run01 fails in driver synchronization. The real ordinary face/body picks and hide action succeed. Hiding clears selection and removes the checkbox, so Playwright uncheck waits for a control that no longer exists. The failed receipt, image, exact driver source and cleanup hashes remain preserved. A driver-only change performs a real click and validates the accepted hidden override, unchanged nodes and empty selection; no pixel, pick or camera threshold is weakened.

Accepted WebGPU run02 and WebGL2 run01 each pass ordinary Bracket, original centered tiny sphere in perspective, and the same sphere in orthographic view. Each performs 38 real pointer picks: ordinary face/body and nine interior face plus nine body picks in each tiny profile. Body 0 and actual current face ordinals are checked. Tiny projected spans are about 483.902 × 483.902 CSS pixels. Visible/hidden RGB differences above 20 cover 115600 of 115600 central ROI pixels. This is a finite visibility policy including body/shadow effects, not a photometry certificate. Public hide and Undo restore exact documents and camera pose/FOV/projection; geometry nodes and original STEP bytes stay unchanged.

Real Viewer raster planes are recorded separately from Orbit source/unit checks. Tiny perspective Viewer near is 7.206862371410768e-6 and far is Infinity; orthographic near/far are about [-29.685718439,29.720132163]. Its projection matrix is finite. WebGL2 has no exposed Viewer camera, so only existing eye/project hooks are reported there. No inferred Orbit plane is presented as a measured GPU plane.

Each accepted run keeps all 745 capsule files identical before, after and after cleanup. Page/console errors, worktree changes and downloads are zero; all contexts/browser/server close. Root and reviewer inspect the images. Centered bodies are large and selectable. Dense raster/moire lines persist across WebGPU orthographic visible/restored images; GL orthographic images lack that pattern. No cause is established and general image quality is NOT_QUALIFIED. D428 measures this artifact first. Far-coordinate GPU frame and picking work remains pending before further exchange admission.

No native geometry, mass, tolerance, units, schema or GPU shader code changes. Compatible D426 data/transport and D424 kernel evidence is reused without unrelated whole suites. Raw logs, PNGs, arrays and bundles stay under /tmp. OCP remains removed. No dependency download, further develop integration or release follows.
