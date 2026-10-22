---
"@barocss/cad": minor
---

Closed triangle meshes as solids: `brepFromTriangles(positions, indices)` welds the corners, merges triangles lying flat against each other into one planar face (holes kept as inner loops), turns an inward mesh outward and refuses one that does not close; `readStl` (binary or ASCII) and `readObj` read the files; a part's `mesh` feature (positions and indices in mm) builds the solid, so it can be drilled, cut and combined like any other.
