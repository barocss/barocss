# Loader guides

## Replace a display after success

Keep the accepted source and display until a complete candidate has passed:

```ts
function replaceSource(candidateSource: string) {
  const candidate = loader.parse(candidateSource);
  scene.add(candidate.group);
  const previous = accepted;
  accepted = candidate;
  acceptedSource = candidate.source;
  previous?.dispose();
}
```

`loader` is `BaroCADLoader` from the quickstart. `scene`, `accepted` and `acceptedSource` are host state. Catch failures outside this function and report the actual error without replacing accepted state. Parse can refuse options, source, native sampling or display conversion. Candidate construction cleans its own partial adapter resources before throwing. The loader does not automatically manage your accepted-display transaction.

For overlapping URL requests, retain a host request token or cancel the prior request. Only adopt the latest still-relevant result; dispose stale results. Source authority and load ordering are host responsibilities.

## Load a URL and cancel it

```ts
import { loadBaroCadSource } from '@barocss/cad-interop/native';

const controller = new AbortController();
const result = await loadBaroCadSource('/part.barocad', options, {
  signal: controller.signal,
  onProgress(event) { console.log(event.loadedBytes); },
});
// When cancellation is needed: controller.abort();
```

`options` is the parse profile from the [quickstart](./quickstart). Neutral URL loading validates and snapshots nested parse options before fetching. Its signal remains live. `onProgress` may return false to abort; thrown callback errors propagate. Content-Length is a progress hint, not the byte cap. The bounded reader checks actual body bytes and strict UTF-8.

The Three adapter exposes `loadAbortable(url,transport)`, returning a disposable result. Its existing `load`/`loadAsync` use the older Three transport path and do not acquire the bounded contract merely because the options are identical. Named renderer URL loaders read stored constructor options after fetch; do not mutate those options while a request is pending.

## Choose a Curve sampling profile

Adaptive `/native` Curve display defaults to v0 when the nested profile omits `version`. Explicit `version:1` enables the wider admitted sampler. Pixi requires v1. Both retain original knot-domain parameters and native basis; sample parameters are neither distance nor normalized angle.

For uniform original-parameter samples of one source0 Curve, use the separate entry:

```ts
import { parseBaroCadUniformCurveSource } from '@barocss/cad-interop/native-uniform-curve';

const preview = parseBaroCadUniformCurveSource(singleCurveSource, {
  sourceVersion: 0,
  unitsPerMillimeter: 0.001,
  uniformCurveDisplay: { version: 1, count: 17 },
});
console.log(preview.domain, preview.parameters, preview.pointsMM);
```

`singleCurveSource` contains one authored Curve. Count is integer2..129. The result retains original source/Model, domain/parameters/intervals, native pointsMM and Float32 scene positions. Its quality explicitly says approximate display, no adaptive error bound and no topology/Solid certificate. The `native-selected-uniform-curve` entry selects one original Curve from a complete source using its own explicit selection options. Do not use the single-Curve profile to strip other objects or recompile pairs as a hidden workaround.

Uniform conversion refuses lost nonzero components, repeated parameters and adjacent collapsed target segments. Adaptive tolerance reports do not turn a display polyline into exact native geometry.

## Load documents and assemblies as their own formats

`parseBaroCadDocument(text)` reads the supported native CAD document family. It is different from a source0 `@model`. Select explicit bodies and retain owning body/source IDs. Document display adapters have a separate four-body cap. Selecting one body may still prepare the complete larger asset, including unselected adapter resources that the result must dispose.

`parseBaroCadAssembly(text)` reads an authored assembly and native instance relationships. Assembly validation has separate four-part/32-instance limits. An instance pose does not modify the retained native part. Named Three/Babylon/Pixi assembly adapters have their own caller-host contracts.

`loadBaroCadModelSet` reads its manifest of up to four source entries. Qualified set/object identity prevents ID collisions across sources. Its primitive projection has a separate four-total-object cap. Complete native16 does not expand that cap.

Use [the public entry inventory](./api#public-entry-inventory) for document, assembly, model-set and Boolean graph operations. Boolean contours, filled planar material, extrusion Shell mesh and native mass properties are different outputs; do not interchange their inputs by shape guessing.

## Export a display artifact

Use `encodeCadPreviewGlb` for an admitted packet, `baroCadSourceToGLB` for its native source profile, or the specific document/Boolean GLB entry for those inputs. Keep native source/document separately. Native source-to-GLB retains a four-total-native-object cap even when display loaders use complete-source16. Embedded source text is an untrusted reference, not automatic editable recovery or a native validation cache.

## Dispose according to the target

Three result disposal releases owned Group/geometry/material; Babylon disposal releases its created meshes/resources; Pixi disposal releases its loaded root/resources. The host keeps Scene/Stage, renderer/engine, canvas, camera, lights and unrelated objects. Neutral CPU data has no renderer lifecycle. Double disposal is supported; later use of a disposed display is not a new accepted load.

---

Source snapshot: local Git `5f5ad866205a21510ac69552e704cc162fa253b5`. [Manifest](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad-interop/package.json), [public root](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad-interop/src/index.ts), [package README](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad-interop/README.md). Fixed-SHA links identify that snapshot; this native local commit may not yet be available on the remote. Local source is the authority for this manual.

[Overview](./) · [Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits](./limits)
