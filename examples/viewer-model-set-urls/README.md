# Viewer model-set URL admission

The host supplies a Loader model-set manifest with two actual HTTP source0 files.
Viewer admits the complete Loader result into its scene request generation. The
files retain duplicate original Surface and Curve IDs under distinct aliases.

With Node 22, build `@barocss/cad`, `@barocss/gpu`, `@barocss/cad-interop`
and `@barocss/viewer`, then run:

```sh
VIEWER_MODEL_SET_URL_EVIDENCE=/tmp/viewer-894-browser.json node examples/viewer-model-set-urls/server.mjs
```

Open <http://127.0.0.1:52994/> in Chromium. The page compares synchronous
Loader admission with URL admission and checks progress, abort, stale requests,
failed source, scene replacement and resource cleanup in one WebGL2 canvas.
A deliberate HTTP 404 may appear as one browser network-console error.
