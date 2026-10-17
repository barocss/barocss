---
"@barocss/cad": patch
---

Two cylinders of different radii whose walls touch at a point inside a face (a cross hole whose side meets a vertical hole's wall from inside) are refused with the reason and the point ("cylinders whose walls touch at a point (tangent at x, y, z) are not supported yet"), a CAPABILITY refusal of the part model. Before, one order of the two holes failed to stitch ("not a manifold solid") and the other gave a valid-looking body about 21 mm³ short of its volume. A touch along both faces' edges (a fillet's tool along its tangent edges) is built as before.
