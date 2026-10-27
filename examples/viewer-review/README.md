# Review files in an external app

This example uses public Viewer and Loader imports. It loads two original bodies
from the existing direct-geometry CAD document fixture. It adds no renderer.

With the workspace dependencies available, run:

```sh
node examples/viewer-review/server.mjs
```

Open <http://127.0.0.1:53026/>. Select a body, change the camera, hide the other
body, then use **Save review**. Change the camera, visibility and selection.
Use **Open review** to select the downloaded JSON file. The app explicitly calls
`applyReviewState` and restores those three values. Open does not load CAD data.

Load the next revision or the other document and open the same file. The app
must report refusal and preserve the current camera, visibility and selection.
Malformed JSON and invalid review fields also refuse. File reads are limited to
32 KiB in this host. The SDK accepts an object; the host owns file I/O.

The server bundles this clone's source through public package exports. It reuses
installed esbuild, records every input size and SHA-256 in `/input-audit.json`,
and reports the served bundle hash. This is source evidence, not a compiled
package or release check. The UI has desktop controls; no mobile claim follows.

The read-only `window.viewerReviewEvidence` functions expose review state,
pixels and the accepted CAD document for inspection. They cannot change Viewer
state. Browser checks must use public controls for all changes and real files
for Save/Open. No automatic proof changes run on page load.
