# viewer CPU example receipt

Issue #1270. Native documentation parent: 83d3ceede9b97df1ec6bbd4da7feab9757f0f75d.
Source pin: 5f5ad866205a21510ac69552e704cc162fa253b5. Node 22.22.0. Date: 2026-10-10.

Command:

```sh
/Users/user/.nvm/versions/node/v22.22.0/bin/node apps/library-docs/scripts/run-example.mjs apps/library-docs/scripts/snippets/viewer-example.ts
```

Exit code: 0. First execution succeeded; no repair/retry. Expected invalid-input refusal, where present, is task output rather than runner failure.

```text
{
  "task": "viewer-native-input",
  "model": "panel_demo",
  "surface": "panel",
  "midpointMM": [
    50,
    0,
    20
  ],
  "sampledSurfaces": 1,
  "factoryAvailable": true,
  "viewerInstantiated": false,
  "rendered": false
}
{"sourcePin":"5f5ad866205a21510ac69552e704cc162fa253b5","ownSourceInputs":244,"ownDistInputs":0}
```

Scope: CPU source execution only. No framebuffer, screenshot, browser/file picker or publication. Viewer task imports its real factory and executes native CAD/loader input preparation, without constructing Viewer or mocking DOM. Editor tasks accept CPU candidates explicitly and test serialized native/source authority, not visible presentation.

