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
