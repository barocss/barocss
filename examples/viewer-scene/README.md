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
