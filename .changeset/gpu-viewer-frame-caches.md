---
"@barocss/gpu": patch
---

Viewer frames: the shadow map is drawn again only when the light's view or a shadow caster (its geometry, instances or placement) changed, the scene box is worked out once a frame, and a shader material's surface WGSL once per material (the opaque sort asks for each mesh's pipeline once).
