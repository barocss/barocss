---
outline: false
layout: doc
---
<script setup>
import VisualExamples from './.vitepress/components/VisualExamples.vue'
</script>
<div class="vp-doc" style="max-width:1200px;margin:32px auto;padding:0 24px">

# Run a visual example

Choose an input. Read its actual result. Edit the source and select **Run input**. Use **Reset example** to restore the original input. These examples run the fixed local source APIs in your browser. WebGL2 is required for the GPU views.

For setup, saved CPU commands and input-version selection, read [Run the examples](/concepts/run-examples).

<VisualExamples />

## Follow the language and the data

- [CAD language](/packages/cad/language): native millimetre geometry, parameters, original domains and source versions.
- [GPU scene language](/packages/gpu/language): SDF objects, styles, units, rotation and version selection.
- [GPU material language](/packages/gpu/material-language): bounded expressions, scalar uniforms, color output and host updates.
- [Material function examples](/packages/gpu/function-examples): eleven independent editable inputs and actual result images.
- [CAD examples](/packages/cad/examples) and [GPU examples](/packages/gpu/examples): input, steps, saved actual screenshots and interpretation.

The CAD curve uses real CAD evaluation followed by a small host Canvas2D drawing. It does not execute the BaroCSS Canvas2D package. The CAD surface and GPU material use the admitted MeshRenderer. The GPU scene uses SceneRenderer. No general Engine renderer, emitted package, npm release or native Solid certification is inferred.

The added CAD extrusion and parameter examples explicitly compile source1 and source2. They fit sampled bounds to the view; inspect native values for size changes. The six-shape scene compares the source1 primitive kinds. Each material function has a separate complete program and the same host-controlled amount slider. All examples retain their explicit input language and source pin.

Run locally with Node22+ and the repository dependencies:

```sh
pnpm --filter @barocss/library-docs dev --host 127.0.0.1
```

App-local example input: `apps/library-docs/scripts/snippets/visual.mjs`. Bundle generation uses ordinary public imports, exact own source, and zero package dist inputs. Original source remains at `5f5ad866205a21510ac69552e704cc162fa253b5`.

</div>
