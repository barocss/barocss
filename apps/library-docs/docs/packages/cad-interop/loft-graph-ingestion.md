# Read a complete evaluated NURBS Loft graph

Use this reader when an application receives a complete evaluated CAD Loft graph or a complete update result. It retains original sources, native Models, source edits, qualified Curve bindings and the matching validation report. It creates no renderer or new authored geometry.

This optional entry is available in local provider `7e96b959746a3fee957644fd1b5ccaf79c992c6c`, with package version `0.0.0-experimental` and ingestion version 0. It is newer than the portal's earlier `5f5ad866205a21510ac69552e704cc162fa253b5` reference. Use a matching workspace source entry with a TypeScript-capable bundler, or its matching compiled public build. This availability does not establish npm publication.

## Choose the input role

An authored document describes intent. An evaluated Graph contains the complete current native result. An Update contains both the complete next Graph and the operation that produced it. These are different inputs.

Create complete values with the ordinary CAD APIs in [the NURBS Loft graph guide](../cad/nurbs-loft-graph), then pass those values to the matching reader. Do not pass only a report, only a derived Surface or an authored document to the evaluated Graph reader.

| Complete Graph field | Meaning |
| --- | --- |
| `document` | Current authored sources, graph recipes and revision. |
| `options` | Actual graph evaluation options. |
| `originalSources` | Complete original source text and compiled Models, including unrelated siblings. |
| `evaluatedNodes` | The source-edit results and their native data. |
| `loft` | Active or suppressed Loft state and its evaluation. |
| `bindings` | Source/node-qualified Curve and Loft associations. |
| `report` | Current Graph report and retained receipt information. |

The Update has exactly `result` and `transaction`. `result` is the complete seven-field Graph above. `transaction` contains `request` and `report`; its request contains `previousDocument`, `options` and `edits`. This stores the previous authored baseline and requested operation without nesting an entire previous evaluated Graph recursively.

Reading an Update validates the next Graph **and** its transaction together. Reading only `update.result` can establish a current Graph, but cannot establish the operation, affected-node set or transaction report.

## Use the four public functions

```ts
import {
  parseBaroCadNurbsSourceLoftFeatureGraph,
  readBaroCadNurbsSourceLoftFeatureGraph,
  parseBaroCadNurbsSourceLoftFeatureGraphUpdate,
  readBaroCadNurbsSourceLoftFeatureGraphUpdate,
} from '@barocss/cad-interop/nurbs-source-loft-feature-graph';
```

| Function | Complete input | Returned type |
| --- | --- | --- |
| `parseBaroCadNurbsSourceLoftFeatureGraph(text: string)` | Saved evaluated Graph JSON text. | `BaroCadNurbsSourceLoftFeatureGraphRead` |
| `readBaroCadNurbsSourceLoftFeatureGraph(input: unknown)` | Evaluated Graph own-data object. | `BaroCadNurbsSourceLoftFeatureGraphRead` |
| `parseBaroCadNurbsSourceLoftFeatureGraphUpdate(text: string)` | Saved complete Update JSON text. | `BaroCadNurbsSourceLoftFeatureGraphUpdateRead` |
| `readBaroCadNurbsSourceLoftFeatureGraphUpdate(input: unknown)` | Complete Update own-data object. | `BaroCadNurbsSourceLoftFeatureGraphUpdateRead` |

The text functions check strict finite JSON before native validation. The own-data functions copy descriptor-checked data before validation. Both use the matching whole CAD validator; schema recognition alone is insufficient.

For values already produced by the CAD graph APIs, use owned-data admission:

```ts
import {
  readBaroCadNurbsSourceLoftFeatureGraph,
  readBaroCadNurbsSourceLoftFeatureGraphUpdate,
} from '@barocss/cad-interop/nurbs-source-loft-feature-graph';
import type {
  NurbsSourceLoftFeatureGraphResult,
  NurbsSourceLoftFeatureGraphUpdateResult,
} from '@barocss/cad';

function receiveCurrentGraph(completeGraph: NurbsSourceLoftFeatureGraphResult) {
  const admitted = readBaroCadNurbsSourceLoftFeatureGraph(completeGraph);
  console.log(admitted.native.document.id, admitted.validationReport.revision);
  console.log(admitted.native.loft.status, admitted.profile.packetRole);
  return admitted;
}

function receiveUpdate(completeUpdate: NurbsSourceLoftFeatureGraphUpdateResult) {
  const admitted = readBaroCadNurbsSourceLoftFeatureGraphUpdate(completeUpdate);
  console.log(admitted.native.result.document.revision);
  console.log(admitted.validationReport.loftAction, admitted.validationReport.noOp);
  return admitted;
}
```

These application functions accept complete values from [evaluate/update](../cad/nurbs-loft-graph). They do not invent missing sources, parents or reports. If your application obtains saved JSON text instead, pass that complete text to the corresponding `parse` function. Network/file I/O and cancellation belong to your host; the reader itself has no URL or byte-input API.

## Separate native data, reports and profile

Every admission returns `{native, validationReport, profile, sourceText}`.

- `native` is the complete current Graph or complete Update, copied independently from the input.
- `validationReport` is another independent copy from the matching whole validator. For a Graph it is a Graph report; for an Update it is a transaction report.
- `profile` is deeply frozen ingestion metadata. Its packet role is `graph` or `update`; only the Update profile has `capabilities.updateReceipt:true`.
- `sourceText` is the exact admitted JSON string for text parsing, including its original whitespace/newline. Owned-data admission returns `null` here.

Native data and validation reports are mutable CPU copies. Editing an admitted native object does not change the input, its independent report or another admission. Such an edit also does not become validated authoring automatically: use the actual CAD update/validation path before treating changed data as accepted.

The profile identifies `barocss-nurbs-source-loft-feature-graph-ingestion`, version 0. Native Graph reports identify `barocss-nurbs-source-loft-feature-graph`; transaction reports identify `barocss-nurbs-source-loft-feature-graph-transaction`, both version 0. Geometry stays in authored XYZ with no axis conversion, length in mm and original parameter domains. Qualified source/node IDs distinguish otherwise similar local geometry IDs.

## Interpret retained state and operation information

`native.report.receiptCounts` on a Graph describes the native receipts retained in that current result. It is not a count of calls performed by the Loader. For example, three source-edit receipts can remain present even when an update evaluates none of those nodes.

An Update's separate `validationReport.directCounts` describes the actual selective CAD producer calls for that operation. Its declared scope excludes prior whole validation and producer-internal work. Do not sum retained Graph receipt counts into transaction call counts or present either as Loader runtime telemetry.

Suppression is a legitimate state: `native.loft.status` can be `suppressed` and `native.loft.evaluation` can be `null`. The complete sources, source-edit results and bindings still belong to the Graph. An active derived Loft Model is separate from the original mixed-source Model and its unrelated Surface.

A semantic no-op can still advance the graph revision. `noOp:true` means the requested recipe/suppression semantics did not change, so relevant evaluations may be retained. It does not mean the complete Graph, revision or transaction is byte-identical to the previous result.

## Save authored intent or preserve a received packet

For normal authoring Save/Open, use the CAD authored serializer/parser described in [the graph guide](../cad/nurbs-loft-graph). Those functions save authored intent and reconstruct native evaluation on Open. Their authored document is not an evaluated Graph or Update input for these readers.

For an unchanged received complete packet, preserve its admitted `sourceText`. Numeric `-0`, original source strings, Unicode, CRLF and represented native values are retained. `sourceText` remains the received text even if your application later mutates `native`; it is not a serializer for those edits.

Ordinary `JSON.stringify` changes numeric `-0` to `0`. It can therefore change represented native data needed by whole validation. This entry provides no public serializer for a modified evaluated packet. Do not replace complete sources/Models/receipts with a reduced JSON object or normalize numeric values when persisting them.

## Handle refused input without replacing accepted state

`BaroCadNurbsSourceLoftReadError` exposes a stable `code`, bounded message and actual `cause` when present.

| Code | Meaning |
| --- | --- |
| `INPUT` | Wrong outer input kind, such as non-string text or a non-record owned input. |
| `JSON` | Malformed finite JSON, duplicate decoded keys or invalid Unicode scalars. |
| `OWNED` | Unsupported own data, such as getters, cycles, hidden fields, foreign prototypes or sparse arrays. |
| `BUDGET` | Text, canonical copy or per-pass structural limits exceeded. |
| `SCHEMA` | Incomplete/wrong Graph or Update fields, native report family or version. |
| `NATIVE` | Matching whole CAD reconstruction/validation refused the complete candidate. |

An inconsistent but structurally complete native packet can produce Loader `NATIVE` with a CAD `NurbsSourceLoftFeatureGraphError` whose code is `OWNED`. Keep that cause distinct from the Loader's own-data `OWNED` error.

Assign a new accepted value only after the reader returns successfully:

```ts
import {
  parseBaroCadNurbsSourceLoftFeatureGraph,
  readBaroCadNurbsSourceLoftFeatureGraph,
  BaroCadNurbsSourceLoftReadError,
} from '@barocss/cad-interop/nurbs-source-loft-feature-graph';
import type { NurbsSourceLoftFeatureGraphResult } from '@barocss/cad';

function receiveGraphText(initialGraph: NurbsSourceLoftFeatureGraphResult) {
  let accepted = readBaroCadNurbsSourceLoftFeatureGraph(initialGraph);
  return (text: string) => {
    try {
      const candidate = parseBaroCadNurbsSourceLoftFeatureGraph(text);
      accepted = candidate;
    } catch (error) {
      if (!(error instanceof BaroCadNurbsSourceLoftReadError)) throw error;
      console.error(error.code, error.message, error.cause);
    }
    return accepted;
  };
}
```

This keeps the application's accepted whole value on a refused candidate. Reading does not mutate the caller's input and returns no partial accepted packet.

## Bounds and lifetime

Complete Graph/Update text has separate limits of 2097152 UTF-8 bytes and 2097152 UTF-16 code units. The descriptor-copied native representation, including its canonical newline accounting, has the same limits. Excess raw formatting is refused before any attempt to compact it.

Each decode/copy pass separately admits at most 1048576 values, depth 64, 64 record fields, 8192 dense array elements, 262144 UTF-16 units per string and 128 per key. Acyclic aliases are copied independently per occurrence and consume that pass's quota. Accessors and unsupported data are rejected rather than invoked as value providers.

These complete-result bounds do not widen the native authored document's 1 MiB limit. Native graph limits remain separate. This profile uses three source-edit nodes and one dependent Loft with three ordered sections, and admits at most three original sources. Selected U degree is 1–5 with 2–16 poles; revision is at most 1000000000; aggregate original source UTF-8/UTF-16 limits are 262144, with at most 16 objects per Source0 Model.

The reader owns copied CPU data through ordinary garbage collection. There is no renderer, clock, resource-dispose method or implicit scene update. This source-qualified Loft profile has V degree 1 and piecewise C0 behavior; it does not establish smooth G1/G2, topology, Solid, Boolean, manufacturing or renderer authority.

[CAD graph authoring](../cad/nurbs-loft-graph) · [Interop API](./api) · [Limits and errors](./limits)
