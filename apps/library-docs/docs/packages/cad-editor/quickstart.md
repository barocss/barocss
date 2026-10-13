# Open a native document into a pure session

**Looking for the visible CAD Editor rather than a developer session?** Begin with the [first-model UI walkthrough](./first-model). The instructions below are for embedding and controlling the original native Surface/Curve session programmatically, not the `#/model` end-user workspace.

Use the real `apps/cad-editor/fixtures/canonical-surface-and-curve.cad-document.json` (canonical Surface/Curve document; local source) as a text asset in your local host. Pass its complete text into this function.

```ts
import { parseCadDocument } from '@barocss/cad';
import { createCadEditorSession } from '@barocss/cad-editor';

export function openDocument(savedText: string) {
  const parsed = parseCadDocument(savedText);
  const session = createCadEditorSession(parsed.document);
  const snapshot = session.getSnapshot();
  const capture = session.serializeAccepted();
  console.log(snapshot.accepted, capture.suggestedFilename);
  return session;
}
```

This creates copied, validated native CPU authority and an accepted download capture. It does not display a frame or write a file. The host uses `capture.text` for its download and marks only the same current capture token after the download starts. A started download cannot certify filesystem persistence.

Mount `CadEditor` in a React 19.2.3 host with the typed options in [the guide](./guides#mount-the-react-bridge). Keep the session across component unmounts if the document stays open. Call `session.dispose()` when the host closes the document.

`packages/barocss-cad-editor/package.json` (Manifest and version; local source) · `packages/barocss-cad-editor/README.md` (Package task notes; local source)
