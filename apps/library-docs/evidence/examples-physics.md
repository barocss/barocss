# physics CPU example receipt

Issue #1270. Native documentation parent: 83d3ceede9b97df1ec6bbd4da7feab9757f0f75d.
Source pin: 5f5ad866205a21510ac69552e704cc162fa253b5. Node 22.22.0. Date: 2026-10-10.

Command:

```sh
/Users/user/.nvm/versions/node/v22.22.0/bin/node apps/library-docs/scripts/run-example.mjs apps/library-docs/scripts/snippets/physics-example.ts
```

Exit code: 0. First execution succeeded; no repair/retry. Expected invalid-input refusal, where present, is task output rather than runner failure.

```text
{
  "task": "rigid-step",
  "stepIndex": 1,
  "timeSeconds": 0.008333333333333333,
  "yM": 1.99931875,
  "velocityYMps": -0.08175,
  "refused": "INVALID_STEP",
  "retainedStep": 1
}
{
  "task": "cloth-step",
  "stepIndex": 1,
  "vertexCount": 289,
  "triangleCount": 512,
  "positionValues": 867,
  "resetStep": 0
}
{"sourcePin":"5f5ad866205a21510ac69552e704cc162fa253b5","ownSourceInputs":47,"ownDistInputs":0}
```

Scope: CPU source execution only. No framebuffer, screenshot, browser/file picker or publication. Viewer task imports its real factory and executes native CAD/loader input preparation, without constructing Viewer or mocking DOM. Editor tasks accept CPU candidates explicitly and test serialized native/source authority, not visible presentation.

