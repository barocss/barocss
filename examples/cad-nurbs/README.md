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
