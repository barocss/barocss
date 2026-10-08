# Viewer Curve scene

This small host uses the public compiled Viewer, Loader and GPU packages. It
loads one genuine source0 Model with two Surfaces and two weighted, nonunit
Curves. The Curves retain original `[-2,7]` parameters and native XYZ/mm.
The page also loads a Curve-only Model, fits either scene, applies a display
pose to the Surfaces and tries an invalid replacement.
The **Wide 64-pole Curve** button loads committed source0 with explicit
`curveDisplay.version:1`. It uses the GPU v1 primitive scene. The existing
mixed and Curve-only buttons retain the unversioned v0 path.
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
