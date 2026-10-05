# CAD v0 exchange fixtures

- `quarter-circle.css`: rational quadratic radius 10 mm arc.
- `quarter-cylinder.css`: radius 10 mm, height 30 mm tensor-product surface.
- `asymmetric-patch.css`: nonplanar bilinear patch with distinct U/V domains.

The host reads source, calls `parseModel`, evaluates geometry and calls
`exportIGES(model, ids)`. No declaration reads or writes files. Run the package
exchange script for retained actual IGES files and independent OCP evidence.
These are open geometry fixtures, not manufacturing solids or a GPU preview.
