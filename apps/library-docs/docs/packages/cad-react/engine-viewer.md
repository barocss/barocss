# Engine and Viewer integration

The package does not create a Worker or ship an engine client. Supply an existing implementation of `EnginePort`, a provenance-aware mass merger and a Viewer sink. Give one ModelHost exclusive evaluation use of its injected engine.

`EngineClient` in the Studio source and the repository's `connectHost` example helper are application integration examples, not exports from `@barocss/cad-react`. A private Studio import is not a portable public client.

## Connect an existing engine

This is an application helper built from current public exports. The caller provides engine/massPolicy and later disposes the returned host. Pass that host as Part's lifecycle.

```ts
import { ModelHost, type EnginePort, type MassPolicy } from '@barocss/cad-react/engine';
import { ExistingViewerHost } from '@barocss/cad-react/viewer';

export async function connectCADView(
  canvas: HTMLCanvasElement,
  engine: EnginePort,
  massPolicy: MassPolicy,
): Promise<ModelHost> {
  const sink = await ExistingViewerHost.create(canvas);
  let host: ModelHost|undefined;
  try {
    host = new ModelHost({ engine, ownership: 'borrowed', massPolicy, sink, ownsSink: true });
    host.connect();
    return host;
  } catch (error) {
    try { if (host) host.dispose(); else sink.dispose(); } catch { /* Retain connection error. */ }
    throw error;
  }
}
```

Construct/connect after React commit, such as in an owning effect, and clean up when the application unmounts. Guard an asynchronous Viewer creation against an already-retired mount; the repository App examples show this pattern. ModelHost's constructor is inert: `connect()` installs subscriptions. Keep the engine, massPolicy and lifecycle identities stable for the intended lifetime.

A Worker failure after a successful frame also makes `ModelHost.read()` report `failed`, with readable title, hint and detail. It does not restart the borrowed engine or resubmit automatically. In the repository `App` and `ProfileApp` examples, the engine owner can provide an optional `onRestart` callback that calls its existing client's `restart()` and returns whether it succeeded. The private Retry button uses that explicit callback, then rerenders the current declaration with the same Part, host, parameter values and feature IDs. A refused or thrown restart keeps the failure visible. Reset changes only the example's parameter. A Viewer startup failure has no connected host and does not offer Worker Retry; recreating that Viewer remains the caller's responsibility.

## Required ports and ownership

Import these public types from `@barocss/cad-react/engine`:

| Type | Required contract |
|---|---|
| `EnginePort` | `evaluate(doc,revision)`, `restart()`, `dispose()`, `onFailure(listener)`, `onMasses(listener)` |
| `MassPatch` | `ref`, `fields`, and original `nativeMass` provenance envelope |
| `MassPolicy` | `merge(bodies,patches)` using the existing provenance-aware native-mass policy |
| `Owner` | Readonly `hostEpoch`, `declaration`, `evaluationRevision`, `fingerprint` |
| `ExistingViewerSink` | Async `show(bodies,owner,stillCurrent)`, `snapshot()`, `dispose()` |
| `ModelHostOptions` | `engine`, `ownership`, `massPolicy`, `sink`, `ownsSink` |

`EnginePort.evaluate` returns a Promise of the existing CAD Model evaluation result or null. Failure/mass subscription methods return unsubscribe functions. `restart` returns a boolean. The host application owns the engine's Worker URL, protocol, CSP and caches; this package does not duplicate them.

Do not merge mass patches only because numeric refs happen to match. Inject the existing native provenance checks. This is part of the port contract, not an optional performance optimization.

`ownership:'borrowed'` leaves the engine with its caller. `ownership:'owned'` transfers its disposal policy to the host. `ownsSink` separately controls sink disposal. Host disposal removes subscriptions; applications must dispose their borrowed resources at their own boundary.

## ModelHost and readiness

`ModelHost` implements the public `ModelLifecycle` interface. Part supplies `dirty`, `invalid`, `complete` and `detached` events; ordinary application components should not manufacture those events to inject a document. `connect()`, `read()` and `dispose()` serve integration and observation.

`read()` reports status, pending declaration state, current accepted document/JSON, fingerprint, native/rendered owners, current native body diagnostics and the sink snapshot. Status is `pending`, `ready`, `failed` or `disposed`. A ready state requires current native and completed presentation ownership. A previous mesh may remain visible while the latest declaration is pending or invalid. Its visibility is not current acceptance.

Each `read()` detaches the host-owned current document (including nested values), submitted request array and records, native centroid/bounds arrays, and the adapter's outer state. Mutating these returned copies does not change the host or a later observation. A held observation does not acquire later submitted requests. Volume, centroid, bounds and other numeric values keep their existing units and meaning.

Owner tokens retain the same identity across reads. Tokens issued by `EngineAdapter` are frozen; a caller-provided Owner passed to `ExistingViewerHost.show()` is neither copied nor frozen by the sink. The adapter's `error: unknown` payload and a custom sink's `snapshot(): unknown` result are extension-owned values: their original identities and extension contracts remain in effect, and they are not deep-cloned. These boundaries allow callbacks and other non-cloneable extension data. The complete observation is not an immutable deep snapshot.

Readiness separates declaration, evaluation revision, native mass readiness and display completion. Equivalent valid checkpoints may reuse a current request/result; invalid/failure recovery requires current ownership again. The existing Model reader normalizes accepted output keys. Diagnostic volume/centroid and mesh bounds do not replace independent native physical validation.

## ExistingViewerHost

Import `ExistingViewerHost` from `@barocss/cad-react/viewer`. `create(canvas)` creates the existing Viewer sink and attaches the Viewer's pointer/keyboard controls. `show` sends render-only body meshes with right-handed Z-up/mm source metadata to the public Viewer facade, then observes frame completion under the supplied owner. `snapshot()` reports Viewer/camera/display-mesh metadata, mounted/frame owners and pixel diagnostics. `dispose()` releases its controls and Viewer. The sink detaches its own pixel-diagnostic record (`bytes`, `nonBackgroundPixels`, `sha256`) on each observation; this does not copy render meshes or raw image buffers. Viewer-provided camera and display metadata keep the existing Viewer facade's contract.

Meshes have approximate-display authority. They are not native Face/UV geometry, pick provenance or physical B-rep authority. Frame-owner/pixel observations show a displayed current result; they are not an accuracy oracle. Global translation plus automatic framing may leave pixels identical while the document and world-space bounds change.

The existing [Viewer documentation](/packages/viewer/) covers its separate public review/file/control features. Those APIs are not new CAD React exports, and saving a Viewer review does not save or reconnect JSX source.
