# CAD

[Run and edit an actual example](/playground#cad-surface). Read the [language reference](./language). Compare the input with [captured result images](./examples).

`@barocss/cad` provides an original bounded model compiler, rational B-spline evaluation, native construction/query operations and an ASCII IGES writer. Its manifest version is `0.0.0-experimental`.

Use CAD for authoritative geometry. Retain the original source, native IDs, units and operation reports. Use [CAD interop](../cad-interop/) for loading or renderer adapters, and [GPU](../gpu/) for admitted display profiles.

| Task | Page |
| --- | --- |
| Compile a Curve and evaluate a point | [Quickstart](./quickstart) |
| Build profiles, measure derivatives or sample a Surface | [Guides](./guides) |
| Find the actual public operation/type | [API](./api) |
| Reproduce a complete plane→packet→GPU preparation | [Examples](./examples) |
| Check native/compiler bounds and refusal | [Limits](./limits) |

## Native authority

`Model` version0 holds Curves and Surfaces in millimetres. A native Curve holds degree, knots, poles and weights. A native Surface uses `controlPoints[uIndex][vIndex]` and corresponding weights. Parameters, knots and weights are dimensionless. Do not replace these fields with sampled display vertices.

Source dialect0/1/2, Model version0, IR schema version, document version and preview packet version have different meanings. A source1 extrusion can produce a Model version0. A pose belongs to presentation or an explicitly authored native operation; moving an image is not an edit to the model.

## Local entry and quality

The workspace root selects `src/index.ts`. Use normal package imports with a TypeScript-capable transformer. The publication map selects emitted JS/declarations after a separate build. Local public configuration is not registry publication.

Many operations qualify a narrow family, such as an integer axis box or a selected planar/cylindrical construction. Read each report and error domain. An accepted local construction does not establish general curved Boolean, unrestricted topology, certified tolerances, manufacturing quality or commercial CAD parity.

---

Source snapshot: local Git `5f5ad866205a21510ac69552e704cc162fa253b5`. `packages/barocss-cad/package.json` (Manifest; local source), `packages/barocss-cad/src/index.ts` (public root; local source), `packages/barocss-cad/README.md` (package README; local source). Source paths identify that fixed local snapshot. Local source is the authority for this manual.

[Overview](./) · [Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits](./limits)
