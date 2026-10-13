# Viewer Curve scene

This small host uses the public compiled Viewer, Loader and GPU packages. It
loads one genuine source0 Model with two Surfaces and two weighted, nonunit
Curves. The Curves retain original `[-2,7]` parameters and native XYZ/mm.
The page also loads a Curve-only Model, fits either scene, applies a display
pose to the Surfaces and tries an invalid replacement.
The **Wide 64-pole Curve** button loads committed source0 with explicit
`curveDisplay.version:1`. It uses the GPU v1 primitive scene. The existing
mixed and Curve-only buttons retain the unversioned v0 path.
**Load mixed URL** reads the same committed source0 over local HTTP through
the neutral Loader and Viewer admission. **Cancel URL** aborts that pending
request. The accepted native source and display rules match the text load.
Use the **Directional lighting** link to recreate the same Viewer with explicit
ambient and directional Surface lighting. The default link omits lighting;
Curve lines remain unlit in both views.
The **Pose all geometry** button moves displayed Curves by 80 mm in both
mixed and Curve-only scenes. **Reset pose** restores identity display poses.

After the CAD, GPU, cad-interop and Viewer libraries are built with Node 22:

```sh
node examples/viewer-curve-scene/server.mjs
```

Open <http://127.0.0.1:52922/> and click the colored geometry. A Curve hit
reports the displayed segment and approximate parameter alongside a separate
fresh native XYZ/mm evaluation. Press **Select last hit** to highlight the
displayed Surface or Curve; **Clear selection** removes the highlight. The
**Fit selected** button frames only that displayed object, including its
accepted pose; **Fit all** returns to whole-scene framing. The
original `pick` and `select` remain Surface-only. The one-pixel GPU line and
screen tolerance do not certify an
exact Curve intersection or a native boundary.

## Browser-local Curve pick probe

After starting the example, use the browser console to measure the actual loaded
scene (including the Wide 64-pole Curve, after clicking that button):

```js
const report = window.viewerCurveDemo.benchmarkCurvePicking({
  repetitions: 5, columns: 8, rows: 6
});
console.table(report.timingsMs);
console.log(report);
```

The probe measures 48 fixed CSS-space points per scan using the public
`pickGeometry` Curve-only path. It warms up once, checks that every repeated
scan returns the same complete local hit signature (Curve ref, segment,
parameter, distance and ambiguity), and checks that accepted Viewer state is
unchanged. The median is a browser-local current-build measurement: it is
**not** an old-build comparison, a GPU timing measurement, proof of exact CAD
intersection, or a general performance improvement claim. For a fair A/B
comparison, run the same scene, camera, poses, viewport/DPR and probe settings
on the old and new commits in the same browser and record both reports. The
probe does not load or alter scenes automatically.

## Automated browser evidence

After building the workspace with Node 22, use the repository's existing
Playwright installation and Chromium executable:

```sh
PW_DIR=/path/to/playwright-package CHROME=/path/to/chromium \\
VIEWER_CURVE_EVIDENCE=/tmp/viewer-curve-evidence \\
node examples/viewer-curve-scene/benchmark-browser.mjs
```

The runner starts the local HTTP host, loads mixed, Curve-only and wide-64
source scenes in Chromium WebGL2 (SwiftShader), and writes
`curve-picking.json`. Each scene runs the existing fixed-grid probe and
confirms repeated signatures, an unchanged Viewer snapshot and no page errors.
The saved record includes the exact commit, scene, camera, viewport, DPR,
raw timings and median. It is a **current-build** measurement, not a claim
that PR #1831 improved runtime performance. For meaningful A/B measurements,
run the same script independently in clean pre-/post-#1831 checkouts with
the same browser executable and host environment; compare evidence files.
The runner requires external `PW_DIR`/`CHROME` and is not a default CI gate.
