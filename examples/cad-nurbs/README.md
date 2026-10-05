# CAD v0 exchange fixtures

- `quarter-circle.css`: rational quadratic radius 10 mm arc.
- `quarter-cylinder.css`: radius 10 mm, height 30 mm tensor-product surface.
- `asymmetric-patch.css`: nonplanar bilinear patch with distinct U/V domains.

The host reads source, calls `parseModel`, evaluates geometry and calls
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
