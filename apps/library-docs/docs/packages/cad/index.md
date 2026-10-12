# CAD

Start with the [solid modeling quickstart](./quickstart), then [cut, chamfer, edit and reopen a part](./modeling). The current public entry is `cad.model()`: named millimetre dimensions, shape operations and named native Solid outputs, without version selection or internal identity/reference authoring.

`@barocss/cad` also provides rational B-spline evaluation, native construction/query operations, a bounded text compiler and an ASCII IGES writer. Its manifest version is `0.0.0-experimental`. Those advanced APIs retain their separate contracts.

| Task | Page |
| --- | --- |
| Make and edit a solid plate | [Quickstart](./quickstart) |
| Sketch → extrude → cut → chamfer → edit → save/load | [Model a part](./modeling) |
| Check supported shapes, bounds and evidence | [Capabilities](./capabilities) |
| Find advanced geometry and compatibility recipes | [Guides](./guides) |
| Find the actual public operation/type | [API](./api) |
| Work with Curve/Surface text programs | [Advanced language reference](./language) |
| See captured display examples | [Examples](./examples) |
| Check native/compiler bounds and refusal | [Limits](./limits) |

Use CAD for authoritative native geometry and authored intent. Use [CAD interop](../cad-interop/) for loading or renderer adapters, and [GPU](../gpu/) for admitted display profiles. A mesh is derived display data. The [modeling guide's evidence boundary](./modeling#evidence-and-current-availability) separates API acceptance, editor adoption, site deployment and package publication.

## Advanced and historical contracts

The [exact-prism workflow](./exact-prism-modeling), [serial-part v2 files](./serial-part-v2) and [Source0–3 programs](./language-workflows) remain source-pinned historical/advanced references. Existing saved files keep their matching readers; `cad.load` does not automatically migrate them. New solid examples use the [modeling API](./modeling).

## Native Curve/Surface authority

`Model` version0 holds Curves and Surfaces in millimetres. A native Curve holds degree, knots, poles and weights. A native Surface uses `controlPoints[uIndex][vIndex]` and corresponding weights. Parameters, knots and weights are dimensionless. Do not replace these fields with sampled display vertices.

Source dialect0/1/2, Model version0, IR schema version, document version and preview packet version have different meanings. A source1 extrusion can produce a Model version0. A pose belongs to presentation or an explicitly authored native operation; moving an image is not an edit to the model.

## Local entry and quality

The workspace root selects `src/index.ts`. Use normal package imports with a TypeScript-capable transformer. The publication map selects emitted JS/declarations after a separate build. Local public configuration is not registry publication.

Many operations qualify a narrow family, such as an integer axis box or a selected planar/cylindrical construction. Read each report and error domain. An accepted local construction does not establish general curved Boolean, unrestricted topology, certified tolerances, manufacturing quality or commercial CAD parity.

---

Historical Curve/Surface overview source snapshot: local Git `5f5ad866205a21510ac69552e704cc162fa253b5`. `packages/barocss-cad/package.json` (Manifest; local source), `packages/barocss-cad/src/index.ts` (public root; local source), `packages/barocss-cad/README.md` (package README; local source). Source paths identify that fixed local snapshot. Local source is the authority for this manual.

[Overview](./) · [Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits](./limits)
