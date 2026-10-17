---
"@barocss/gpu": patch
---

Viewer: `render()` takes the place of a frame already requested (no second draw on the next animation frame), `resize()` asks for a frame only when the backing size or pixel ratio changed, a disposed geometry is no longer kept (or restored after a lost device), and a removed mesh releases its own instance and material buffers.
