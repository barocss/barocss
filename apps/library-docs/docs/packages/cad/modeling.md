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
- **Units.** Lengths are millimetres. Public and document angles are degrees. Z is up.
- **The reference.** The full set of kinds and their fields is the `CadPartFeature` type, which the package exports.

Sketch profile points use local XY coordinates. Without `plane`, these are part XY at Z = 0.
With `plane`, local X follows `xAxis`, local Y follows `normal × xAxis`, and local Z follows `normal`, from `origin`.
An `extrude` runs from local Z = `from` (default 0) to `from + height`; these are offsets along the sketch normal.
A negative `height` extrudes in the opposite direction. Zero height is refused.

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

### Boolean algorithms

`union`, `difference` and `intersect` select solid material from a target and a tool. Their implementation depends on
the input representation: height-wise 2D arrangements, rational polyhedral operations, trimmed-surface intersections,
or a mixed mesh path. See [Boolean operations](/packages/cad/robustness#boolean-operations) for a tested example,
the algorithm stages, tolerances and refusal conditions.

## Evaluating

```ts
evaluateCadPart(document, previous?, options?): CadPartSnapshot
loadCadPart(text): CadPartSnapshot        // JSON text, at most 4 MiB
emptyCadPart(): CadPartDocument
```

A snapshot holds:

- `outputs`: the parts no later feature consumes, in feature order. `outputOf(snapshot, id)` gets one by id.
- `features`: each feature's id, kind and dependencies.
- `recomputation`: the features computed in this evaluation, and those reused unchanged.

Snapshots and outputs are plain data. Import these functions from `@barocss/cad`:

- `reevaluate(snapshot, { parameters: edits })`: evaluates new parameter values and reuses unchanged features.
- `reevaluate(snapshot, { document })`: evaluates another document and reuses unchanged features.
- `saveCadPart(snapshot)`: returns the document as text.

<<< @/../samples/cad-part.test.mjs#edit

## Outputs

Each output is one body, or several with `bodyCount`, as a B-rep (`brep`).

- **Representation.** It is one of:
  - `upright`: a Z-prismatic solid, with closed-form mass;
  - `planar`;
  - `curved`;
  - `faceted`: a mesh body.
- **Mass properties.** `massPropertiesOf(output, density)` takes density in g/cm³ and returns:
  - `volume` in mm³, `mass` in g and `centroid` in mm;
  - `inertia` in g·mm², about the centroid;
  - `method`: `closed-form`, `planar-exact`, `quadrature` or `tessellated`. A tessellated result carries
    `volumeBound`, its estimated volume error in mm³.
- **Validity.** `checkOutput(output)` gives the strict validity report: `valid`, the first `issues`, the counts and topology, and
  the largest gaps.
- **Surface area.** `surfaceAreaOf(output)` is in mm², over the exact surfaces.
- **STEP.** `exportStep(output, { name })` writes the exact B-rep as STEP AP214.
- **STL.** `exportStl(output, { segmentsPerQuarter })` writes the display tessellation as binary STL.
- **Sheet metal.** `flatPatternOf(output, { fixedFace, kFactor })` returns a sheet-metal flat pattern.
- **Reports.** Gears, racks and other generated parts carry a report of their own, such as `gear`.

### Moment of inertia about an axis

Import `momentOfInertiaAboutAxis` and the `MassInertiaAxis` type from `@barocss/cad`. The function takes mass
properties and an axis, and returns a number in g·mm². Supply a full 3 × 3 inertia tensor about the centre of mass
in g·mm², positive finite mass in g and the centroid in mm. The axis requires a `point` in mm and a finite, nonzero
`direction`. Use dense arrays of finite numbers: three components per vector and three rows of three for the tensor.
Use the same XYZ frame for the axis and mass properties. The function normalizes the direction, so its magnitude
does not change the axis.

With unit direction `u` and offset `d = centroid − point`, the result is `uᵀ I_COM u + mass × |d × u|²`.
The second term shifts the moment from the parallel axis through the centre of mass to the requested line.
Invalid input arrays, non-finite arithmetic or a negative central inertia projection give `SOLID_MASS`.
This query uses the supplied mass properties; it provides no frame or SI conversion, B-rep evaluation, motion
simulation or physical validation.

### A numerical unit check

For a 10 × 10 × 10 mm cube at density 2.7 g/cm³:

- Volume is 1000 mm³.
- Mass is 1000 × 2.7 / 1000 = 2.7 g.
- The centroid is [5, 5, 5] mm.
- Each diagonal centroidal inertia is 2.7 × (10² + 10²) / 12 = 45 g·mm². Off-diagonal terms are zero.

The kernel already returns these units. Do not convert its mass or inertia a second time.

<<< @/../samples/cad-mmgs.test.mjs#mass

## Tessellation

The display mesh, and the STL written from it, is a tessellation of the exact surfaces. `segmentsPerQuarter` sets how
finely curves are divided. Measurements and STEP never use the tessellation, except for a `tessellated` mass result.
