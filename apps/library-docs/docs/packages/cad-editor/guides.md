# Stage, present and accept native edits

## Mount the React bridge

```tsx
import type { CadEditorSession } from '@barocss/cad-editor';
import { CadEditor } from '@barocss/cad-editor/react';
import type { CadEditorDisplayOptions } from '@barocss/cad-editor/react';
import '@barocss/cad-editor/styles.css';

const displayOptions: CadEditorDisplayOptions = {
  viewer: { mmToSceneUnit: 0.01, background: [0.07, 0.08, 0.10] },
  document: {
    basis: 'authored-xyz-matches-rhyup',
    native: { sourceVersion: 0, countU: 17, countV: 17, unitsPerMillimeter: 1,
      curveDisplay: { version: 1, chordToleranceMM: 0.1, maxSegments: 64, maxDepth: 8 },
      nativeCapacity: { version: 1, maximumObjects: 16 } },
  },
};
// session is the pure session returned by the quickstart.
// Render this in a container with a defined height.
const mountEditor = (session: CadEditorSession) =>
  <CadEditor session={session} displayOptions={displayOptions} onError={console.error} />;
```

The component owns the mounted Viewer and its controls. Unmount releases them and preserves the caller's session. The application owns menus, route, files and replacement decisions.

## Apply a native pole edit

Select a qualified Surface pole with `selectSurfacePole({bodyId,uIndex,vIndex})`. Stage raw text using `stageSurfacePoleField('zMM','25')`. A field is draft text, not an accepted coefficient. `prepareApply()` performs the real source edit and reconstructs the complete document. It changes no accepted history yet.

The mounted bridge loads the candidate through Viewer, reads the actual frame, and calls `acceptCandidate(token)` after success. Native or display failure retains pending text, accepted source, history and the prior frame where recovery succeeds. Do not call acceptance merely because candidate preparation succeeded.

For Curve coefficients, use `selectCurvePole`, `stageCurvePoleField` and the matching Curve focus view. Original coefficients/weights remain distinct from sampled Curve vertices. Focus/view changes use display candidates and do not author geometry.

## Resolve selection and replacement

`requestSelection` can return a selection transition when fields are pending. Resolve its exact token with Apply, Discard or Cancel. File Open/New replacement is host policy: retain the existing session while reading the proposed file, resolve drafts, and recheck state identity before replacing accepted unsaved data. A Download copy does not by itself authorize replacement.

`prepareOpen`, `prepareUndo` and `prepareRedo` follow the same native/display admission path. Bind a filename only to `onAccepted(snapshot,candidate)` for the actual Open token. A prepared or rendered-but-unaccepted candidate cannot rename the current file.

## Keep display and native revisions separate

A document with more than four bodies needs an explicit 1–4 body display choice. Hidden bodies stay in the native document. `prepareDisplayBodies` and Curve focus change display generation, not authored source/history/download capture. Equal native edits clear pending fields without adding history. Save excludes raw fields, camera and runtime caches.

## Review derived export

Use `inspectExport(options)` to describe capability, then `exportAccepted(options)` to obtain qualified derived output and its report. Keep native source identity and conversion/loss descriptions visible. Derived export is a separate artifact, not replacement authoring authority.

[Manifest and version](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad-editor/package.json) · [Package task notes](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad-editor/README.md)
