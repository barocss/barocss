# Open a native document into a pure session

Use the real [canonical Surface/Curve document](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/apps/cad-editor/fixtures/canonical-surface-and-curve.cad-document.json) as a text asset in your local host. Pass its complete text into this function.

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

[Manifest and version](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad-editor/package.json) · [Package task notes](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad-editor/README.md)
