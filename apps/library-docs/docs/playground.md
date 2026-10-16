---
outline: false
layout: doc
---
<script setup>
import VisualExamples from './.vitepress/components/VisualExamples.vue'
</script>
<div class="vp-doc" style="max-width:1200px;margin:32px auto;padding:0 24px">

# Run any interactive example

Choose a sample, read its complete input and inspect its actual result. Edit one value and select **Run input**. **Reset example** restores that sample's starting state. Each sample keeps its stated source profile and host requirements.

[Browse the example catalog](/examples/) to choose [a library](/examples/library), [language practice](/examples/language) or [an integrated workflow](/examples/integration). This all-examples view remains available for existing playground deep links.

<VisualExamples />

## Follow the selected task

- [CAD language practice](/packages/cad/language-examples): weights, typed parameters, extrusion and original Curve domains.
- [GPU compositions](/packages/gpu/composition-examples) and [material functions](/packages/gpu/function-examples): complete scene and expression inputs.
- [Neon plasma](/packages/gpu/advanced-shader) and [caustics](/packages/gpu/caustics-shader): layered UV fields with explicit host phase controls.
- [Viewer examples](/packages/viewer/examples) and [Physics examples](/packages/physics/examples): direct API lifecycle and explicit actions.

Read [Use the interactive examples](/concepts/run-examples) for units, input selection and accepted-state behavior. A browser host does not automatically create a multi-library workflow. The integrated view specifically follows native CAD geometry, a sampled packet and GPU display; language exercises can use display fixtures while retaining their own learning purpose.

</div>
