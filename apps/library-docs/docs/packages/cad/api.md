# CAD API

Use the task contracts below to check inputs, ownership, errors and lifecycle. Follow [Examples](./examples) for complete application inputs.

## Original section edits and a dependent Loft

The [NURBS Loft graph guide](./nurbs-loft-graph) covers the newer public `evaluateNurbsSourceLoftFeatureGraph`, `updateNurbsSourceLoftFeatureGraph`, both whole-result validators, and authored `serializeNurbsSourceLoftFeatureGraph` / `parseNurbsSourceLoftFeatureGraph`. It includes complete input, selective updates and a numeric before/after view. These version 0 APIs are available in the newer CAD provider identified in that guide; the core operations below retain their earlier source profile.

## Mesh an occupied Body boundary

The [Body boundary mesh guide](./body-boundary-mesh) explains `tessellateQualifiedTranslatedStripBody` and `validateQualifiedTranslatedStripBodyMesh`. It provides a complete example Body, fixed options, a shared indexed packet and six faceted display chunks. Its newer API availability is separate from the original Body guide and the earlier general API profile.

## Body and topology

The [Body and topology guide](./body-1301) explains `buildQualifiedTranslatedStripBody` and `validateQualifiedTranslatedStripBody`: complete qualified inputs, shared topology, material boundaries and copied result ownership. These newer APIs have their own availability note; the core operations below describe the earlier CAD API version.


All operations below are root exports from `@barocss/cad`. The root entry selects TypeScript source in this workspace. The publication map selects emitted `dist/index.js` and declarations for the separate build checkpoint. A declaration in an internal module is not a public API unless the root re-exports it.

## Core signatures

```ts
compileCadModel(source: string, options: { sourceVersion: 0 | 1 | 2 }): CadCompileResult
validateCurve(curve: Curve): void
validateSurface(surface: Surface): void
validateModel(model: Model): void
curveDomain(curve: Curve): [number, number]
surfaceDomain(surface: Surface): { u: [number, number]; v: [number, number] }
evaluateCurve(curve: Curve, parameter: number): Point
evaluateSurface(surface: Surface, u: number, v: number): Point
sampleCurve(curve: Curve, count: number): CurveSample[]
sampleSurface(surface: Surface, countU: number, countV: number): SurfaceSample[][]
exportIGES(model: Model, ids: string[]): { iges: string; report: IGESExportReport }
tessellateSurface(surface: Surface, options: TessellationOptions): {
  packet: PreviewPacket; report: ApproximationReport
}
```

This block summarizes declarations; it is not a module to execute. `Point` is an XYZ tuple in mm. `TessellationOptions` requires countU,countV,revision. A compiler failure contains diagnostics and no partial model. Math validators/evaluators and preview preparation throw on invalid native input. Specialized operations have their own named errors/reports.

## Choose an operation family

For native profiles start with `buildXYProfile`/`buildXYArc`. For a narrow qualified box use `buildAxisRectangleExtrusion`; its resulting shell and solid reports remain distinct. For queries use original parameter domains and D1 APIs. For editable intent choose the specific document/graph family, and use its exported serializer/parser. Boolean, section, trim, mass and inertia outputs carry their own qualifications and lineage. They are not interchangeable universal geometry records.


---

Source snapshot: local Git `5f5ad866205a21510ac69552e704cc162fa253b5`. `packages/barocss-cad/package.json` (Manifest; local source), `packages/barocss-cad/src/index.ts` (public root; local source), `packages/barocss-cad/README.md` (package README; local source). Source paths identify that fixed local snapshot. Local source is the authority for this manual.

[Overview](./) · [Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits](./limits)
