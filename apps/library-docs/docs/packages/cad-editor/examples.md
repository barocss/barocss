# CAD Editor: draft coefficients and accept a complete native document

A native document is accepted authoring data. Raw input fields are drafts. A prepared candidate is a proposed complete document. A displayed frame is derived from that candidate. Keep these roles separate when embedding the editor.

Use the workspace packages with a TypeScript-capable bundler. The root is a pure CPU session API; `/react` requires React and React DOM 19.2.3 and a browser host.

## Create a complete native document

This input contains one original bilinear Surface and one document body that references it. `panel_asset`, `panel_body` and native Surface `panel` are different identities.

```ts
import { parseCadDocument } from '@barocss/cad';
import { createCadEditorSession } from '@barocss/cad-editor';

const source = `@model panel_demo {
  version: 0; length-unit: mm;
  @surface #panel {
    type: nurbs; degree-u: 1; degree-v: 1;
    knots-u: [0,0,1,1]; knots-v: [0,0,1,1];
    control-points: [[[0,0,0],[0,0,40]],[[100,0,0],[100,0,40]]];
    weights: [[1,1],[1,1]];
  }
}`;
const documentText = JSON.stringify({
  schema: 'barocss-cad-document', version: 1, profile: 'direct-geometry',
  documentId: 'panel_document', revision: 0,
  units: { length: 'mm', angle: 'rad' },
  nativeFrame: 'authored-xyz-no-axis-conversion',
  assets: [{ id: 'panel_asset', revision: 0, role: 'authored-native-source',
    sourceVersion: 0, sourceFrame: 'authored-xyz-no-axis-conversion', source }],
  bodies: [{ id: 'panel_body', name: 'Panel', kind: 'direct-geometry-object',
    assetId: 'panel_asset', geometryId: 'panel' }],
  features: [], parameters: [], constraints: [], placements: [], derivedCaches: [],
});
const nativeDocument = parseCadDocument(documentText).document;
const session = createCadEditorSession(nativeDocument);
console.log(session.getSnapshot().accepted.document.revision); // 0.
```

The session validates and copies original native data. Surface coordinates use mm. U/V and weights are dimensionless. Sampling or moving display geometry does not edit those coefficients.

## Stage and prepare a coefficient change

```ts
session.selectSurfacePole({ bodyId: 'panel_body', uIndex: 1, vIndex: 1 });
session.stageSurfacePoleField('zMM', '60');
const candidate = session.prepareApply();
```

The selected corner starts at `[100,0,40]` mm with weight 1. The raw string `60` is a draft; accepted source/revision remains unchanged during staging and preparation. The candidate contains a real native edit and the complete reconstructed document. A valid change produces the corner `[100,0,60]` after acceptance, with one document/asset revision advance.

Invalid raw text remains available for correction. Native or display refusal must not turn it into accepted geometry. A bitwise native no-op clears pending fields without adding history.

## Let the React bridge present before acceptance

Give the host HTML a defined editor height and a TSX entry:

```html
<div id="root" style="height:520px"></div>
<script type="module" src="./main.tsx"></script>
```

Use the session created from the complete input above in that entry:

```tsx
import { createRoot } from 'react-dom/client';
import { CadEditor } from '@barocss/cad-editor/react';
import type { CadEditorDisplayOptions } from '@barocss/cad-editor/react';
import '@barocss/cad-editor/styles.css';

const displayOptions: CadEditorDisplayOptions = {
  viewer: { mmToSceneUnit: 0.01, background: [0.07, 0.08, 0.10] },
  document: {
    basis: 'authored-xyz-matches-rhyup',
    native: { sourceVersion: 0, countU: 17, countV: 17, unitsPerMillimeter: 1 },
  },
};
const root = createRoot(document.getElementById('root')!);
root.render(<CadEditor session={session} displayOptions={displayOptions}
  onError={console.error}
  onAccepted={snapshot => console.log(snapshot.accepted.document.revision)} />);
window.addEventListener('pagehide', () => {
  root.unmount();
  session.dispose();
}, { once: true });
```

Select a pole, enter a new coefficient and Apply. The bridge presents the candidate through Viewer before accepting its session token. In a custom bridge, call `acceptCandidate(candidate.token)` only after your required presentation succeeds. Preparing a candidate alone does not commit history. Headless CPU acceptance has no displayed-frame guarantee.

Unmount releases component-owned Viewer resources and listeners; the caller's session remains alive until you dispose it. Mounting in your host is an integration recipe, not a guarantee for every browser/device or every native profile.

## Save accepted authority and reopen it

```ts
const capture = session.serializeAccepted();
// Your host downloads capture.text using capture.suggestedFilename.
// Call session.markDownloaded(capture.token) only for that current capture.
const reopened = createCadEditorSession(parseCadDocument(capture.text).document);
console.log(reopened.getSnapshot().accepted.document.revision);
// On document close: reopened.dispose().
```

Serialized data contains complete accepted native source and identities. Draft text, runtime tokens, camera, history and runtime display data are excluded. A started download is not proof of durable filesystem persistence. A stale capture token is refused.

Open, Undo and Redo use complete candidate admission too. Resolve pending fields with Apply, Discard or Cancel before replacing a document, and retain the live session while reading a proposed file. Bind file names to the actual accepted Open candidate. Derived mesh/PNG output is separate from this editable native document.

The [CAD playground](/playground#cad-surface) illustrates original Surface versus derived display geometry. It does not implement CAD Editor's candidate, history or file decisions.
