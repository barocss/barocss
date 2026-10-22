---
"@barocss/gpu": patch
---

The viewer's frames allocate less: render and pick targets keep their texture views, the shadow map's redraw check compares numbers instead of building a string of every caster's transform, a shader mesh's parameters stay one array while they are unchanged, outline colours compare by component, and `packFrame` writes its values in place (the same bytes) with each colour string parsed once. Orbiting the studio's starter plate spends about a third less CPU per frame.
