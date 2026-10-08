# Viewer scene

This local reference page loads `two-surfaces.barocad` through the public
`@barocss/cad-interop/native` parser and displays both original Surface packets
through `@barocss/viewer` and the public BaroCSS GPU scene backend.

After the Viewer and GPU libraries are built:

```sh
node examples/viewer-scene/probe.mjs
node examples/viewer-scene/server.mjs
```

Open <http://127.0.0.1:52165/>. Click each surface to inspect its qualified ID
and approximate triangle U/V. Fit, Orbit, Pan and Zoom change the camera. The
native source and model remain in `viewer.getState().native`.

The measurement panel accepts two qualified native Surface parameters. Its
initial values include an interior point on the nonunit weighted Surface.
Press **Measure native points** to show the native XYZ points and
**Native point distance (mm)**. A displayed triangle click can fill one
parameter pair, but that selected U/V is approximate. The method evaluates
the native Surface again and does not measure display or assembly placement.

Open the optional **Native Curve chord** section for two original Curve
parameters. Curves remain in the native model but are not drawn. For a
nonunit rational example, open `/?weightedCurve=1`; only the hidden
`reference_edge` Curve weight changes to 0.5. Parameters 0.25 and 0.75
produce a straight native chord of 45.714285714285715 mm. It is not the
length along the Curve or a certified dimension.

Open **Native Surface-to-Curve distance** to evaluate one original Surface
U/V and one original Curve t. On `/?weightedCurve=1`, the initial values
give Surface `[50,70,20]` mm and Curve `[60,0,0]` mm, so the straight
distance is `sqrt(5400)` mm. The Curve is not drawn. The result is separate
from Surface-Surface and Curve-Curve measurements and is not a path along
either geometry or a certified dimension.

Each measurement section also has **Measure with typed native points**. It calls
`measureNativePoints` with tagged Surface or Curve inputs and shows the
latest result from `getState().nativeMeasurement`. The mixed section can
reverse point order. The generic method also accepts both same-kind pairs.
The three older measurement
methods remain callable and also update this latest result. A generic call
does not replace their separate last-result fields. All results use original
native XYZ/mm, not displayed Motion poses or Curve arc length.
