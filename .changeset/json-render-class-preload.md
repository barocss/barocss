---
"@barocss/browser": patch
---

Add `collectJsonRenderClassNames(spec)` and `preloadJsonRenderClasses(spec, runtime)`. They preload literal `props.className` values from a json-render Spec synchronously, so CSS can be generated before the UI mounts. The host still validates the spec and class support.
