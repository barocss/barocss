# cad-editor CPU example receipt

Issue #1270. Native documentation parent: 83d3ceede9b97df1ec6bbd4da7feab9757f0f75d.
Source pin: 5f5ad866205a21510ac69552e704cc162fa253b5. Node 22.22.0. Date: 2026-10-10.

Command:

```sh
/Users/user/.nvm/versions/node/v22.22.0/bin/node apps/library-docs/scripts/run-example.mjs apps/library-docs/scripts/snippets/cad-editor-example.ts
```

Exit code: 0. First execution succeeded; no repair/retry. Expected invalid-input refusal, where present, is task output rather than runner failure.

```text
{
  "task": "cad-editor-native-edit",
  "beforeRevision": 0,
  "acceptedRevision": 1,
  "assetRevision": 1,
  "bodyId": "panel_body",
  "refused": "INPUT",
  "reopenedRevision": 1,
  "rendered": false
}
{"sourcePin":"5f5ad866205a21510ac69552e704cc162fa253b5","ownSourceInputs":180,"ownDistInputs":0}
```

Scope: CPU source execution only. No framebuffer, screenshot, browser/file picker or publication. Viewer task imports its real factory and executes native CAD/loader input preparation, without constructing Viewer or mocking DOM. Editor tasks accept CPU candidates explicitly and test serialized native/source authority, not visible presentation.


## Additional native coefficient observation

After the first successful execution, the snippet added public native parsing/evaluation of the accepted original asset source. The same command ran again and exited0; this was a stronger geometry observation, not a failure repair. Exact output:

```text
{
  "task": "cad-editor-native-edit",
  "beforeRevision": 0,
  "acceptedRevision": 1,
  "assetRevision": 1,
  "bodyId": "panel_body",
  "cornerMM": [100, 0, 60],
  "refused": "INPUT",
  "reopenedRevision": 1,
  "rendered": false
}
{"sourcePin":"5f5ad866205a21510ac69552e704cc162fa253b5","ownSourceInputs":185,"ownDistInputs":0}
```
