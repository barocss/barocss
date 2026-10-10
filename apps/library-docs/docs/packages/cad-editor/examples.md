# CAD Editor: original coefficient edit and document reopen

## Task 1 — prepare and accept one native pole edit on the CPU

Run from the repository root with Node 22+ and the existing app-local esbuild runtime. The runner reads ordinary public source export maps and transforms TypeScript; it does not install or publish packages.

```sh
node apps/library-docs/scripts/run-example.mjs apps/library-docs/scripts/snippets/cad-editor-example.ts
```

The complete runnable file is shown below. Its expected values come from the fixed API and inputs. This CPU command succeeded on Node22.22.0 at the fixed source pin in #1270. Its native receipt records the actual output and zero own dist inputs. A successful CPU task does not prove browser pixels.


```ts
import { parseCadDocument, evaluateSurface } from '@barocss/cad';
import { parseBaroCadSource } from '@barocss/cad-interop/native';
import { createCadEditorSession, CadEditorError } from '@barocss/cad-editor';
const source = `@model panel_demo {
  version: 0; length-unit: mm;
  @surface #panel {
    type: nurbs; degree-u: 1; degree-v: 1;
    knots-u: [0,0,1,1]; knots-v: [0,0,1,1];
    control-points: [[[0,0,0],[0,0,40]],[[100,0,0],[100,0,40]]];
    weights: [[1,1],[1,1]];
  }
}`;
const text = JSON.stringify({ schema: 'barocss-cad-document', version: 1,
  profile: 'direct-geometry', documentId: 'panel_document', revision: 0,
  units: { length: 'mm', angle: 'rad' }, nativeFrame: 'authored-xyz-no-axis-conversion',
  assets: [{ id: 'panel_asset', revision: 0, role: 'authored-native-source',
    sourceVersion: 0, sourceFrame: 'authored-xyz-no-axis-conversion', source }],
  bodies: [{ id: 'panel_body', name: 'Panel', kind: 'direct-geometry-object',
    assetId: 'panel_asset', geometryId: 'panel' }],
  features: [], parameters: [], constraints: [], placements: [], derivedCaches: [] });
const session = createCadEditorSession(parseCadDocument(text).document);
try {
  session.selectSurfacePole({ bodyId: 'panel_body', uIndex: 1, vIndex: 1 });
  session.stageSurfacePoleField('zMM', '60');
  const before = session.getSnapshot().accepted.document.revision;
  const candidate = session.prepareApply();
  if (!candidate) throw new Error('Expected effective candidate');
  session.acceptCandidate(candidate.token); // CPU-only acceptance, no Viewer frame claim.
  const accepted = session.getSnapshot().accepted.document;
  session.stageSurfacePoleField('zMM', 'not-a-number');
  let refused = '';
  try { session.prepareApply(); }
  catch (error) { if (!(error instanceof CadEditorError)) throw error; refused = error.code; }
  const native = parseBaroCadSource(accepted.assets[0].source, {
    sourceVersion: 0, countU: 3, countV: 3, unitsPerMillimeter: 1 });
  const surface = native.model.objects.find(object => object.kind === 'surface');
  if (!surface || surface.kind !== 'surface') throw new Error('Expected accepted native Surface');
  const cornerMM = evaluateSurface(surface, 1, 1);
  if (cornerMM[0] !== 100 || cornerMM[1] !== 0 || cornerMM[2] !== 60) throw new Error('Native coefficient edit missing');
  const capture = session.serializeAccepted();
  const reopened = createCadEditorSession(parseCadDocument(capture.text).document);
  try {
    if (accepted.revision !== before + 1 || !refused || reopened.getSnapshot().accepted.document.revision !== accepted.revision) throw new Error('Unexpected native edit');
    console.log(JSON.stringify({ task: 'cad-editor-native-edit', beforeRevision: before,
      acceptedRevision: accepted.revision, assetRevision: accepted.assets[0].revision,
      bodyId: accepted.bodies[0].id, cornerMM, refused,
      reopenedRevision: reopened.getSnapshot().accepted.document.revision,
      rendered: false }, null, 2));
  } finally { reopened.dispose(); }
} finally { session.dispose(); }
```

The input is a complete version1 direct-geometry document: one Source0 asset, one asset-qualified body, original source/frame/units and empty feature/constraint/cache tables. `panel_body` is a document body ID; `panel` is the original Surface ID. They are not interchangeable.

The selected corner starts at `[100,0,40]` mm with weight1. Staging `zMM:'60'` leaves the accepted document at revision0. Preparation reconstructs an actual native candidate. This headless example explicitly accepts its token, producing document revision1 and asset revision1, while body/model/Surface identity remains unchanged.

Expect `beforeRevision:0`, `acceptedRevision:1`, `assetRevision:1`, `bodyId:'panel_body'`, `cornerMM:[100,0,60]` and `rendered:false`. The corner result is evaluated from accepted original source through public CAD, so a revision increment alone cannot pass this check. Invalid raw text makes preparation refuse. The actual printed refusal was `INPUT`, from `CadEditorError.code`. The accepted source/revision stays at the last valid edit. CPU acceptance does not show or certify Viewer pixels.

## Task 2 — reopen accepted source and perform a visible Apply

The final part of the same file serializes only accepted native authority and reopens it into a new session. Expect `reopenedRevision:1`. Invalid pending text is absent from this saved file. The test disposes both sessions; runtime candidate tokens and history are not transferred to the new session.

For the actual UI/file task, use the existing React host with its declared workspace dependencies and Node22+:

```sh
pnpm --filter @barocss/cad-editor-app dev
```

Open its printed URL. Input provenance is `apps/cad-editor/fixtures/canonical-surface-and-curve.cad-document.json`. In that fixture, Surface `surface_fixture` has a 3×3 weighted control net; body `surface_body` and asset `surface_asset` identify it. Select pole `(uIndex:1,vIndex:1)`, whose original XYZ is `[30,20,18]` mm and weight is1.5. Enter Z=20, then Apply.

Expect one accepted native document/asset revision advance after real candidate presentation succeeds. Source selection and geometry IDs stay original; the preview changes because a native coefficient changed. Save, then open the actual downloaded file in a fresh editor. The reopened coefficient must be20, with complete original source and reference identity retained. A Download started status is not proof of durable filesystem persistence.

The React bridge, unlike Task 1, presents and reads the real Viewer frame before accepting its candidate. If native or display admission refuses, retain raw fields and accepted history; report unavailable recovery distinctly. Host Open/New must resolve Apply/Discard/Cancel and recheck file-read staleness before replacement.

[The playground](/playground) lets you inspect a separate CAD Surface source and display result. It does not execute CAD Editor's candidate, file, history or recovery protocol. Detailed app provenance and focused flows are in `apps/cad-editor/README.md`.

Source pin: `5f5ad866205a21510ac69552e704cc162fa253b5`. Public declarations: [API](./api) · [Exact public reference](./reference). Read [limits and errors](./limits) before changing the input profile.
