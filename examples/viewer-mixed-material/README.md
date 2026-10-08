# Qualified Surface materials with native Curves

This Viewer example loads the existing two-source source0 CAD model-set fixture.
Both aliases retain the original `shared_panel` Surface and `wide_64` Curve IDs.
The host compiles two opaque Surface materials through the public GPU compiler.
Viewer keeps both materials during Curve display, picking, selection and pose.

With Node 22, build `@barocss/cad`, `@barocss/gpu`, `@barocss/cad-interop`
and `@barocss/viewer`, then run:

```sh
VIEWER_MIXED_MATERIAL_EVIDENCE=/tmp/viewer-885-browser.json node examples/viewer-mixed-material/server.mjs
```

Open <http://127.0.0.1:52985/> in Chromium. The page records its browser
result to the evidence file. This verifies one local WebGL2 flow. It does not
certify other hardware, performance, Curve shaders or publication.
