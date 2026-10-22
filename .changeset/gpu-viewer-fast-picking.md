---
"@barocss/gpu": patch
---

Viewer picking: a ray missing a mesh's box is rejected at once, the triangle test allocates nothing, and a mesh of 1024 triangles or more is searched through a bounding volume hierarchy built the first time it is picked; line picking skips meshes whose screen box is beyond the radius.
