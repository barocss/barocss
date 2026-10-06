# CAD v0 exchange fixtures

- `quarter-circle.css`: rational quadratic radius 10 mm arc.
- `quarter-cylinder.css`: radius 10 mm, height 30 mm tensor-product surface.
- `asymmetric-patch.css`: nonplanar bilinear patch with distinct U/V domains.

The host reads source, calls `compileCadModel(source, { sourceVersion: 0 })`, evaluates geometry and calls
`exportIGES(model, ids)`. No declaration reads or writes files. Run the package
exchange script for retained actual IGES files and independent OCP evidence.
These are open geometry fixtures, not manufacturing solids or a GPU preview.

Preview fixtures:

- `preview-flat.css` and `preview-flat-packet.json`: exact asymmetric affine plane,
  U-major 2×2 vertices, revision 7, +Z triangle normals. The JSON literal can be
  replayed independently by another packet consumer without importing CAD.
- `preview-weighted.css`: rational nonplanar patch with distinct weights.
- The existing quarter-cylinder is tessellated at 5×3 and 17×9 grids to compare
  finite measured distance. Uniform NURBS U is not uniform circle angle.

`tessellateSurface` returns a separate approximate packet/report. Its five
probes per cell and averaged triangle normals are finite preview evidence,
not exact derivative normals, certified distance bounds or GPU pixel evidence.

Construction source v1 fixtures:

- `extruded-cylinder.css`: rational radius 10 mm arc translated by [0,0,30].
- `extruded-asymmetric.css`: nonuniform rational degree-one curve, forward reference,
  and translation [3,-2,7]. Its interior knot has C0 continuity.
- `extruded-straight.css`: line translated into an open planar patch.

Build the CAD package, then run the host demonstration from the repository root:

```sh
node examples/cad-nurbs/construction-demo.mjs examples/cad-nurbs/extruded-cylinder.css /tmp/cad-construction-demo
```

The host uses the built ESM package. It retains source and construction history,
finds the native surface through the feature output ID, tessellates that surface,
and exports only that ID to IGES. The resolved model also contains the input curve.
No caps or solid topology are created.

Native first derivatives use the original knot parameters. After building CAD:

```sh
node examples/cad-nurbs/derivative-demo.mjs /tmp/cad-derivative-report.json
```

The report shows curve tangents and both extrusion partials at endpoints and local
spans. At the exact asymmetric interior knot U=3, D1 rejects its C0 continuity.
Positions remain accepted by the existing point API. The report does not infer
unit normals, surface regularity or solid topology.

`derivative-c1.css` describes the cubic polynomial [u,u²,u³] and its extrusion.
The internal double knot at 0.5 has continuity C1. Its exact-knot query is
retained in the packed and independent exported-geometry derivative checks.

After building CAD, retain four oriented boundaries with explicit IDs:

```sh
node examples/cad-nurbs/boundary-demo.mjs examples/cad-nurbs/quarter-cylinder.css cylinder /tmp/cad-boundaries 0
node examples/cad-nurbs/boundary-demo.mjs examples/cad-nurbs/extruded-asymmetric.css oblique_wall /tmp/cad-constructed-boundaries 1
```

Select source version and surface ID explicitly. The host retains native source
and feature data, boundary mapping, four curves, and one four-entity IGES file.
The traversal is v-min, u-max, v-max, u-min. Endpoint joins and curve orientation
do not establish a topological wire, trim loop or solid. Constant boundaries are
geometric curves with zero tangents, without a regular-edge claim.

Build a bounded face incidence descriptor with explicit IDs:

```sh
node examples/cad-nurbs/face-demo.mjs examples/cad-nurbs/quarter-cylinder.css cylinder examples/cad-nurbs/face-ids.json /tmp/cad-face 0
```

The host retains source/features, native bundle, incidence report and five-entity
geometry IGES. The graph has one face/loop and four edges/vertices. Incidence checks
always report geometricValidity not-certified and solid false. IGES carries the
surface and four curves, not these separate topology IDs or relationships.
C0/repeated-corner/constant-boundary cases are outside this face subset. Smooth
internal folds can remain structurally valid, so the report does not certify a
regular face, shell, solid or manufactured part.

Build exact adjacency for two rectangles with unequal U side lengths:

```sh
node examples/cad-nurbs/adjacency-demo.mjs examples/cad-nurbs/rectangle-left.css patch examples/cad-nurbs/rectangle-right.css patch examples/cad-nurbs/rectangle-local-ids.json examples/cad-nurbs/rectangle-global-ids.json /tmp/cad-adjacency
```

Both local bundles intentionally reuse the same surface/face/edge/curve IDs. Global
wrapper IDs qualify references. The host writes one2face/6vertex/7edge descriptor
and two separate five-object geometry IGES files. The single common edge uses
opposite canonical senses; local forward loops remain unchanged. Local reports
remain not-certified. Exact restricted-family association is not a sewn shell,
shared reader IsSame edge, closed solid, STEP or manufacturing claim.

The separate orthogonal operation uses a right-angle pair:

```sh
node examples/cad-nurbs/orthogonal-demo.mjs examples/cad-nurbs/rectangle-left.css patch examples/cad-nurbs/orthogonal-right.css patch examples/cad-nurbs/rectangle-local-ids.json examples/cad-nurbs/rectangle-global-ids.json /tmp/cad-orthogonal
```

It retains the same qualified IDs and two five-object geometry exports. The distinct
report is exact-orthogonal-axis-rectangles-v0, closed false, solid false. Individual
local face reports remain not-certified. Perpendicular normals mark a crease;
there is no one shared smooth normal or sewn reader topology. The original coplanar
demo/API remains unchanged and rejects this orthogonal pair.

Build a closed axis-box boundary from six explicit outward source surfaces:

```sh
node examples/cad-nurbs/box-shell-demo.mjs examples/cad-nurbs/axis-box.css examples/cad-nurbs/box-shell-input.json /tmp/cad-box-shell
```

The input retains explicit origin/sides/source-surface/local/global IDs. The host
writes the shell descriptor and six separate five-object geometry IGES files.
The exact report is closed:true, solid:false, solidProductImplemented:false.
Local face reports remain not-certified. Area/flux-volume tests are separate
evidence; this command supplies no original solid/STEP or sewn reader topology.

Derive exact restricted-box solid analysis from the same validated owned shell:

```sh
node examples/cad-nurbs/box-solid-demo.mjs examples/cad-nurbs/axis-box.css examples/cad-nurbs/box-shell-input.json /tmp/cad-box-solid
```

The demo retains separate shell-validation and solid-validation JSON. Shell status
stays solid:false. The new exact-axis-box-solid-v0 report includes valid/closed/
solid:true with integer volume/area and owned min/max bounds. This is the restricted
filled-box analysis, without a mutable kernel solid or serialized STEP/global
topology. Original six per-face geometry files and local statuses remain unchanged.
