---
work_id: D514
artifact_type: bounded-defect-fix
status: done
last_updated: 2026-11-04
---

# D514 — native edge selection

D514 passes the SMALL bounded selection-display fix. Selected and hovered local bodies now use their existing native edge lines. Selected instance bodies use the same mapped native lines. The cyan stroke has the original edge centerline and the existing 3.4 CSS-pixel selection width. Clearing selection restores the original 1.2-pixel lines. Render Edges OFF does not hide selected body or instance lines.

A body with no native edge lines uses the existing face tint. A selected edge-less instance uses private face-color geometry, so its unselected shared sibling keeps its color. The actual public Sphere has zero native edge segments and shows this fallback. No smooth contour geometry is created. Explicit face and edge picks retain their paths. Contact warnings retain the red surface outline. Native line transforms, clipping, depth classification and display-mode styles remain in place.

Six renderer-method tests pass. Scoped lint has zero errors and 12 `no-explicit-any` warnings in the material-sink test rig. Fresh Studio types and final Model types pass after the last test edit, as recorded in the shared current-source check receipt. Implementation and tests used GPT-6.1 Sol Medium; the root agent ran the actual Studio checks.

The fixed desktop Studio run passes 15 unique states: local body click/clear/hover, Render Edges OFF, explicit face/edge picks, representative instance selection/clear, and Sphere selection/clear. All 758 frozen source pins match after execution, cleanup and the root current-source check. The run has zero page errors, console errors, file changes and downloads. Its own context, Chrome and Vite server close. Root reviewed eight fixed images and the original selected-body image. Alignment passes by unchanged native edge geometry and manual image comparison. The optional pixel metric is NOT_RUN because PIL was unavailable. This is not a quantitative pixel, general antialiasing, all-silhouette or whole-CAD certificate.

The initial test run remains FAIL: five tests passed and one fixture failed because `instanceFaces` was absent. Adding the constructor-equivalent empty array repairs the test rig. The original Studio run also remains FAIL: its first five states passed, then the harness requested Edges before opening the Render Scene tab. The retained original selected-body image supplies the before image; no passing original state was replayed.

[Qualification](qualification.json) records exact source and artifact hashes, commands and counts. Fixed Studio receipt SHA256: `62288844951278504510f349d1fb1e31eaff0b40d2c1931bb9966000131c45dd`. Root visual-review receipt SHA256: `dc59d1a53c894dbf1e719ce8cd8ad5d8d6f79194ea0b5a252493dcd68088c573`. Logs and images remain outside the repository.

Issue #529 remains open with eight unchecked items. No issue write or closure follows. D509's checkpoint is preserved and its docs actual remains NOT_RUN. Core readiness remains NOT_MEASURED and existing HOLDs remain. This receipt does not establish a push or release.
