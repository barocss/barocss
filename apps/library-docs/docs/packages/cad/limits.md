# CAD limits and errors

## Newer exact convex modeling profile

The separate [sketch, cut and chamfer guide](./exact-prism-modeling) covers adopted convex planar operations and a fixed five-node authored v0 document. Restricted source-edge chamfer is available for one cardinal perpendicular edge with orthogonal ends. General Boolean, chamfer, fillet and persistent topology naming remain outside that profile. Its source-only codec does not establish editor file-picker or GPU acceptance.

## Literal geometry and compiler bounds

| Resource | Bound |
| --- | --- |
| Authored source | 256 KiB UTF-8 |
| Model geometry declarations | 1..16, unique IDs |
| Degree | Integer 1..5, smaller than pole count |
| Curve poles | 2..64 |
| Surface poles | 2..16 per direction, at most 256 |
| Coordinates | Finite, absolute value at most 1e6 mm |
| Weights | Finite, 1e-6..1e6 |
| Uniform samples | 2..4096; Surface countU×countV at most 4096 |
| Compiler allocation | 65536 value/AST nodes, 131072 tokens, bounded array nesting |

For N poles and degree p, knot count is N+p+1. Knots are finite/nondecreasing, endpoints repeat p+1 times, interior multiplicity is at most p, and the original domain has positive length. Parameters outside that domain refuse. Sampling is uniform in parameter, not arc length or angle.

## Task-specific envelopes

XY profile/arc builders use ±10000 mm coordinates, minimum dimensions/adjacent segments of 0.001 mm and strict own-data request shapes. Rectangle extrusion has its separate integer1..10000 mm dimension domain. Other native operations may admit narrower domains than literal Model geometry. A successful compiler result does not qualify every topology/Boolean operation on that model.

Surface preview grids use integer2..64 per axis, at most4096 vertices and7938 triangles. Revisions use integer0..2147483647. Packet validation rejects sparse/typed input arrays, accessors, unsupported metadata and incompatible units/frame/winding. Packet output is approximate geometry. A valid preview is not a watertight Solid or manufacturing certificate.

## Diagnose a refusal

`compileCadModel` returns `{ok:false,diagnostics}` with code, severity, message, UTF-16 source range and optional object ID. It returns no partial AST/IR/model. Select sourceVersion0/1/2 explicitly and match the authored header. Missing/foreign/accessor options refuse without invoking getters.

Native math APIs and initial packet operations throw for invalid geometry or requests. More specialized exported operations use their named error classes and diagnostic codes. Preserve the actual cause and report rather than substituting geometry or clamping coordinates. The [API inventory](./api) links each public operation family to its exact declarations.

At an exact interior C0 knot, D1 refusal is expected even when a particular pole arrangement visually looks smooth. A point query is a different operation. A zero tangent is valid data but cannot define a regular normal.

## Quality and lifecycle

Native outputs are CPU data. They create no browser renderer, event loop or network request. The host owns storage, accepted document state and display lifecycles. Compiler/builder outputs own independent nested occurrences; follow each operation's precise copy contract before mutating results.

IGES output is selected Curve/Surface geometry with a separate identity report. It excludes native source and closed Solid serialization. Preview mesh and GLB are derived display artifacts. Restricted integer-box validity, planar sections or selected plate-hole qualification do not establish general CAD parity, global geometry correctness, certified tolerances or an npm publication.

---

Source snapshot: local Git `5f5ad866205a21510ac69552e704cc162fa253b5`. `packages/barocss-cad/package.json` (Manifest; local source), `packages/barocss-cad/src/index.ts` (public root; local source), `packages/barocss-cad/README.md` (package README; local source). Source paths identify that fixed local snapshot. Local source is the authority for this manual.

[Overview](./) · [Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits](./limits)
