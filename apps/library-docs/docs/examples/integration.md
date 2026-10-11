---
outline: false
---
<script setup>
import VisualExamples from '../.vitepress/components/VisualExamples.vue'
</script>

# Follow native CAD geometry into GPU display

This view follows the existing CAD surface through two public library contracts: CAD retains the native weighted Surface and samples a preview packet; GPU admits that packet with an explicit millimetre-to-scene conversion and draws it.

1. Inspect the authored poles, weights and original U/V domains.
2. Edit the CAD source and inspect its independent native geometry.
3. Read the sampled grid and triangle data separately from the native Surface.
4. Compare the GPU picture with native millimetre values and the chosen display conversion.

<VisualExamples category="integration" />

The native model, sampled display mesh and rendered image have different meanings. Sampling does not replace the source coefficients or establish a closed Solid. View configuration affects screen size; inspect numeric geometry as well as the picture.

Read [View the weighted Surface](/packages/cad/examples#view-the-weighted-surface), [CAD-to-GPU units](/concepts/coordinates) and [GPU examples](/packages/gpu/examples) for the complete input and public handoff. Other package guides can describe further application workflows without adding live presets to this view.

Materials and shaders may use a CAD-backed mesh while teaching language expressions. Viewer and Physics examples have their own public API tasks and browser hosts. Neither shared execution components nor a browser drawing context automatically establish another multi-library workflow.

[Browse the catalog](./) · [Tasks by library](./library) · [Language practice](./language)
