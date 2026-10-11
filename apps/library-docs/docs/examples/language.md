---
outline: false
---
<script setup>
import VisualExamples from '../.vitepress/components/VisualExamples.vue'
</script>

# Practice a complete source language

Choose a CAD or GPU program, change one declaration and inspect both its visible result and numeric data. The source editor contains a complete starting program. **Run input** submits the candidate; **Reset example** restores the selected preset.

CAD exercises cover rational curves, typed lengths and scalars, extrusion and original parameter domains. Start with [CAD language practice](/packages/cad/language-examples). The selected preset fixes its compiler source version; changing a header alone does not select another dialect.

GPU scene exercises cover primitive declarations, styles, precedence and local transforms. Material exercises cover bounded scalar expressions, color blends and UV fields. Use [GPU scene language](/packages/gpu/language), [material language](/packages/gpu/material-language), [function examples](/packages/gpu/function-examples) and [composition examples](/packages/gpu/composition-examples) beside the live input.

<VisualExamples category="language" />

Read units and support limits before adapting a program. A material changes color, not native geometry, and creates no clock. Shader Play/Pause belongs to its example host. A material's CAD-backed mesh does not change the exercise's language-learning purpose into an integrated-workflow task.

[Browse the catalog](./) · [Tasks by library](./library) · [Integrated workflow](./integration)
