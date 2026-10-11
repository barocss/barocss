# Viewer display pose: selected Manual checkpoint

Status: first real dev flow passed its selected checks. Later readout and selected production presentation/navigation passed separately. Terminal GPU deletion and global runtime acceptance remain unmeasured.

Provider: `5f5ad866205a21510ac69552e704cc162fa253b5`. Frozen scope: https://github.com/barocss/barocss/issues/1247#issuecomment-6108343444.

This record was extracted from Root's saved session. No browser, provider API, CPU consumer or build was rerun to write it. Exact receipts, session lines and native image hashes are in `viewer-display-pose-browser.json`.

## First real dev flow

In-app browser tab 44 loaded the dev example on port 52949. Initial public state was ready, with no recorded warning/error logs. Native points `[0,0,20]` and `[100,0,20]` mm gave distance 100 mm, native-authored and not-certified.

Apply pose retained source, camera and measurement. Actual Viewer midpoint became `[0.029999999999999992,0.06000000000000001,0.02]` scene units; native midpoint stayed `[50,0,20]` mm. Measure native returned 100 mm again.

Actual public projection→pick→select chose `pose_panel/panel`, triangle 1, approximate U/V `[0.3500000000000001,0.40000000000000047]`, ambiguous false. This is displayed sampled geometry, not native topology or a certified ray hit.

Quaternion `[0,0,0,2]` genuinely refused with `RangeError: Motion rotation must be finite in -1..1`. Probe `[2,0.4]` genuinely refused with `RangeError: Native U/V parameters must be inside the original Surface domain`. For each, complete public snapshots were compared recursively with Object.is and all 1,075,200 actual before/after readPixels bytes were compared. Both were equal; the raw displayed report was retained. These files store observations, not raw pixel buffers. Checksums were not the refusal oracle.

Reset display made motion null and retained 100 mm measurement, selection and camera. Midpoint returned to `[0.05,0,0.02]`. lastPick remained historical under its previous pose, with the explicit history label.

The last observed live ledger was created 3 / disposeCalls 2, listenersAttached 3 / listenersRemoved 2, pending 0. Two rejected candidates were disposed; one accepted Viewer was still live. Tab close followed, but no terminal ledger was recorded. These are application calls, not raw GPU deletion proof.

## First failures kept

The first 462 × 303 JPEG crossed fixed navigation because the canvas began above the viewport. It was 6,110 bytes / SHA-256 `4ed8fbff863e4ebf0e65ce4d60819e5d34f38e4907532f14f5902c525b1b93b0`. Scrolling outside canvas preserved the camera and produced a clean native-only 462 × 303 JPEG: 1,826 bytes / SHA-256 `b3bd4bc8c4ea5c56726d4fb1bd143e7a9130d2378b5b9af662a2cbdd5a68ebb2`. Later presentation replaced it.

After the successful Reset receipt, a locator searched for a button named Actual result data. It found no match and timed out. The Reset receipt preceded this failure and remains valid. Successful summary toggling was not observed.

The later image extraction script matched its own command record and failed with AttributeError: NoneType has no attribute items. Root corrected the filter to the actual McpToolCall image result and reused the same native capture. This recording failure did not require a browser recapture.

This evidence extraction also first asserted 11 receipts instead of the actual 10. It failed before writing files. Only the expected count was corrected; observed receipts were unchanged and no API/browser replay occurred.

## CPU and Viewer remain separate

Selected Node22 CPU data passed public CAD compile/evaluate/3 × 3 tessellation: 9 vertices / 8 triangles, native midpoint `[50,0,20]`, probe `[35,0,16]`, distance 100 mm. Profile 281 blobs / 170 own source / 0 dist; no Viewer or GL execution.

Independent app TRS midpoint was `[0.02999999999999999,0.06000000000000002,0.02]`. Actual Viewer differed in final binary64 rounding. Both describe approximately `[0.03,0.06,0.02]`; no bit, raster or CPU/GPU parity is claimed.

## Later readout presentation

Separate dev tab 47 mounted the presentation enhancement, applied pose and selected the actual projected probe. It was ready with this exact DOM text:

> Application readout · rounded to 3 decimals. Native width: 100.000 mm. Native midpoint: [50.000, 0.000, 20.000] mm. Displayed midpoint: [0.030, 0.060, 0.020] scene units.

This is app text from already computed results, not Viewer annotation. The native 462 × 522 JPEG is 15,228 bytes / SHA-256 `f0b2e82f02fc50da19379734617465d9e7c4804e7e8166c4cff46f1f80eaaf28`. It replaced `docs/public/examples/viewer-display-pose.jpg` and matches the captured tool bytes. This presentation subset did not replay the first refusal/reset qualification or CPU check.

## Build and documentation checks

The first combined build passed in 13.94 seconds. The first docs check failed because the catalog label Native points and display pose differed from preset label Viewer display pose. The analogous CAD label also differed. Root changed only these two catalog labels, stopped transient preview session 73846, then rebuilt in 13.78 seconds. The second docs check passed: 109 pages, 684 internal links, 56 images, 3 downloads; 44 catalog presets with 11 API / 32 language / 1 integration purposes; 13 generated modules; 12 manifest hashes matched. The Viewer JPEG source/build bytes matched SHA-256 `f0b2e82f02fc50da19379734617465d9e7c4804e7e8166c4cff46f1f80eaaf28` and the built guide embedded it. No API or CPU replay repaired the labels.

The final protected preview is Root session 33589 on port 52948. Older preview 9266 and dev 85217 were stopped before the build; transient 73846 was stopped before the second build. This avoids inheriting a static server's earlier hashed-asset file map.

## Selected production presentation and navigation

Actual in-app browser tab 49 was ready with Viewer display pose selected and no Open diagram JSON control. Its initial readout showed native 100.000 mm / native midpoint `[50.000,0.000,20.000]` mm and identity display `[0.050,0.000,0.020]` scene units. Apply pose showed `[0.030,0.060,0.020]` scene units while native values stayed unchanged.

The actual guide link reached `/packages/viewer/display-pose`. An exact heading-role locator then timed out because its name omitted the rendered permalink label. Root read the already-loaded h1 and image without repeating the navigation or Viewer actions. The image was complete and decoded to 462 × 522. Open Viewer display pose returned to the actual example with ready true.

An unscoped Browse the catalog click first failed strict mode: two matching links, with no navigation. Root scoped the link inside .visual-examples, searched Viewer display pose, observed 1 of 44 runnable examples and href `/examples/library#viewer-display-pose`, then returned through that actual link to ready true. The tab was marked as the deliverable and its viewport was reset by Root.

Production did not repeat the first dev refusal/Reset qualification. Its guide decoded the existing native dev readout image; no new production screenshot or terminal disposal observation is claimed.

## Remaining boundaries

Terminal disposal ledger/raw GPU deletion is not measured. Current Root/global/Integration runtime verification is unrun. This selected Manual result does not establish global Viewer/device/recovery, release or publication acceptance.
