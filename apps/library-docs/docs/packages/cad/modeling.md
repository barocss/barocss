# Modeling API

## The part document

A part is a `barocss-cad-part` document:

```json
{
  "format": "barocss-cad-part", "version": 1, "units": "mm",
  "parameters": { "t": 8 },
  "features": [
    { "id": "s", "kind": "sketch", "profile": "rectangle", "min": [0, 0], "max": [60, 40] },
    { "id": "p", "kind": "extrude", "sketch": "s", "height": { "parameter": "t" } }
  ]
}
```

- **Features in order.** Each feature has an `id` and a `kind`, and names the features it builds on by their ids:
  `sketch`, `target`, `tool`.
- **Dimensions.** A dimension is a number, or `{ "parameter": "name" }` bound to one of the document's parameters.
- **Units.** Lengths are millimetres, and Z is up.
- **The reference.** The full set of kinds and their fields is the `CadPartFeature` type, which the package exports.

The kinds, by family:

| Family | Kinds |
|---|---|
| Sketches and solids from them | `sketch` (rectangle, circle, polygon and loop profiles of lines and arcs, with holes, on a plane), `extrude`, `revolve`, `sweep`, `sweep-curve`, `loft` |
| Booleans | `union`, `difference`, `intersect` |
| Holes and finishing | `hole`, `thread`, `fillet`, `chamfer`, `draft`, `shell`, `thicken`, `split`, `split-face` |
| Copies and moves | `linear-pattern`, `circular-pattern`, `mirror`, `translate`, `rotate`, `scale` |
| Meshes and imports | `mesh`, `decimate`, `sew`, `separate`, `import` (a STEP file) |
| Smooth shapes | `subd` (a subdivision cage, as exact B-spline faces) |
| Sheet metal | `sheet-base`, `sheet-flange`, `sheet-contour`, `sheet-corner-relief` |
| Frames and weldments | `frame`, `frame-member`, `gusset`, `end-cap`, `weld-bead` |
| Machine elements | `spur-gear`, `spur-rack`, `internal-gear`, `bevel-gear`, `worm`, `worm-wheel`, `shaft`, `key`, `keyway`, `pin`, `retaining-ring`, `bearing`, `oring`, `oring-gland`, `pulley`, `sprocket`, `belt`, `spring`, `cam`, `coupling`, `connector-body`, `connector-opening` |

### Names

- **Faces.** A face is named `<feature>.<role>`, for example `p.top`, `p.side0` or `h.side0`.
- **Splits and copies.** When a later feature splits a face, its pieces are `#k`. Copies are `@k` (patterns) and `@m`
  (kept mirrors).
- **Edges.** An edge is named by its two faces: `p.side0|p.top`.
- **References.** A feature's `id` means all of its parts, and `id/k` means part `k`, one side of a split.

Fillets and chamfers pick edges by these names, so a selection survives parameter edits that keep the topology.

## Evaluating

```ts
evaluateCadPart(document, previous?, options?): CadPartSnapshot
loadCadPart(text): CadPartSnapshot        // JSON text, at most 4 MiB
emptyCadPart(): CadPartDocument
```

A snapshot holds:

- `outputs`: the parts no later feature consumes, in feature order. `output(id)` gets one by id.
- `features`: each feature's id, kind and dependencies.
- `recomputation`: the features computed in this evaluation, and those reused unchanged.
- `withParameters(edits)`: evaluates again with new parameter values, reusing unchanged features.
- `withDocument(document)`: evaluates another document, reusing every feature whose definition is unchanged.
- `save()`: the document as text.

<<< @/../samples/cad-part.test.mjs#edit

## Outputs

Each output is one body, or several with `bodyCount`, as a B-rep (`brep`).

- **Representation.** It is one of:
  - `upright`: a Z-prismatic solid, with closed-form mass;
  - `planar`;
  - `curved`;
  - `faceted`: a mesh body.
- **Mass properties.** `massProperties(densityKgPerM3)` returns:
  - `volumeMM3`, `massKG` and `centroidMM`;
  - `inertiaCentroidKgM2`, the inertia about the centroid;
  - `method`: `closed-form`, `planar-exact`, `quadrature` or `tessellated`. A tessellated result carries
    `volumeBoundMM3`, its estimated error.
- **Validity.** `validate()` gives the strict validity report: `valid`, the first `issues`, the counts and topology, and
  the largest gaps.
- **Surface area.** `surfaceArea()` is in mm², over the exact surfaces.
- **STEP.** `exportStep({ name })` writes the exact B-rep as STEP AP214.
- **STL.** `exportStl({ segmentsPerQuarter })` writes the display tessellation as binary STL.
- **Reports.** Gears, racks and other generated parts carry a report of their own, such as `gear`.

## Tessellation

The display mesh, and the STL written from it, is a tessellation of the exact surfaces. `segmentsPerQuarter` sets how
finely curves are divided. Measurements and STEP never use the tessellation, except for a `tessellated` mass result.
