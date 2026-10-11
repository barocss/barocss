# Build a woven grid shader

[Open Woven grid shader](/examples/language#weave-shader). Warm vertical bands cross cool horizontal bands on a fixed quad. Adjust each band's strength, change the spacing, or animate the phase.

![Woven grid shader with its initial controls](/examples/weave-shader.jpg)

The initial controls are `density:6`, `warp:.85`, `phase:0` and `weft:.7`.

This example uses the public `@barocss/gpu` material profile `engine-opaque-uv-repeating-fragment-v0`, version 0, at source `7e96b959746a3fee957644fd1b5ccaf79c992c6c`. Use this matching source package. The earlier mesh material examples keep their separate `5f5ad866` profile. These source profiles do not establish npm publication.

## Complete editable source

```css
@shader #woven_grid {
  @uniform density: float(2,12,6);
  @uniform warp: float(0,1,.85);
  @uniform phase: float(0,6.283185307179586,0);
  @uniform weft: float(0,1,.7);
  @let u: float(fract(uv_u));
  @let v: float(fract(uv_v));
  @let vertical: float(pow(sin(u*density*6.283185307179586+phase)*.5+.5,2));
  @let horizontal: float(pow(cos(v*density*6.283185307179586-phase)*.5+.5,2));
  @let threads: color(mix(#091B2A,#D39C64,vertical*warp));
  @fragment { color: mix(threads,#58C5CF,horizontal*weft); }
}
```

Paste the whole program into the source editor and select **Run input**. Each uniform declaration supplies a finite range and a default. The `@let` declarations name expressions; they do not create custom functions or a clock.

## Follow the two thread layers

`fract` wraps the dimensionless UV coordinates into a unit tile. For example, `fract(-.25)` is `.75`. The quad supplies UV coordinates from 0 to 1. These values are not texture samples, world distances or CAD parameters.

The sine depends only on `u`, so its color bands run vertically. Adding `.5` after multiplying by `.5` maps the wave from `[-1,1]` to `[0,1]`. The literal power 2 squares that value: `.5` becomes `.25`, while 1 remains 1. This concentrates the brighter part of each band.

The first mix blends navy `#091B2A` toward warm `#D39C64` with ratio `vertical*warp`. Here **warp means vertical thread strength**. It does not displace UV coordinates. The cosine depends only on `v` and forms horizontal bands. The second mix adds cool `#58C5CF` with ratio `horizontal*weft`. It is applied after the warm layer, so it also changes the color at a crossing.

Both squared waves are in `[0,1]`. Both strength controls are in `[0,1]`. Their products therefore remain valid mix ratios for every admitted control value. This is a woven-style color pattern. It creates no thread geometry, alternating over-and-under structure, surface normals or cloth simulation.

## Change one control at a time

| Control | Range | Default | Slider step | Effect |
| --- | --- | --- | --- | --- |
| `density` | 2..12 | 6 | .25 | Wave cycles along each unit UV axis |
| `warp` | 0..1 | .85 | .05 | Warm vertical layer strength |
| `phase` | 0..2π | 0 | .05 | Wave phase in radians, with opposite signs on the two axes |
| `weft` | 0..1 | .7 | .05 | Cool horizontal layer strength |

1. Set `weft` to 0 to see the warm vertical layer alone.
2. Set `warp` to 0 and restore `weft` to `.7` to see the horizontal layer over navy.
3. Restore both defaults and increase `density` to 9. The bands become closer together.
4. Change `phase`, or select **Play shader**. Select **Pause shader** to inspect one frame.

Play uses an application clock that supplies phase values inside the declared range. Changing a slider or running source pauses it. A source update retains matching current uniform values if the new declarations admit them. A new default does not replace an already bound value. **Reset example** restores the source and defaults.

Integer density gives a periodic field across the unit tile in the mathematical expression. Fractional density can create a tile seam. UV wrapping alone does not guarantee a seamless image. Floating-point evaluation also prevents a promise of identical pixels at the phase wrap.

## Inspect the public CPU result

This application function accepts the complete source above. It compiles, reconstructs and lowers the material, binds the same complete quad, then evaluates one UV location. The functions imported below are public package exports.

```ts
import {
  compileEngineUVRepeatingMaterial, validateEngineUVRepeatingMaterialIR,
  lowerEngineUVRepeatingMaterial, prepareEngineUVRepeatingMaterialBindings,
  evaluateAuthoredMaterial
} from '@barocss/gpu';

const scene = {
  format:'barocss-gpu-engine-scene', version:0, id:'advanced_uv_scene',
  coordinateSystem:'right-handed-y-up', positionUnit:'scene', background:[0,0,0],
  camera:{eye:[0,0,3],target:[0,0,0],up:[0,1,0],fovYDegrees:45,near:.1,far:10},
  geometries:[{
    format:'barocss-gpu-triangle-geometry', version:0, id:'advanced_uv_quad',
    coordinateSystem:'right-handed-y-up', positionUnit:'scene', winding:'ccw',
    positions:[-1,-1,0,1,-1,0,1,1,0,-1,1,0],
    normals:[0,0,1,0,0,1,0,0,1,0,0,1],
    uvs:[0,0,1,0,1,1,0,1], indices:[0,1,2,0,2,3]
  }],
  materials:[{id:'advanced_uv_material',type:'unlit',colorSpace:'linear',color:[1,1,1]}],
  nodes:[{
    id:'advanced_uv_node',type:'mesh',parentId:null,
    translation:[0,0,0],rotationXYZW:[0,0,0,1],scale:[1,1,1],visible:true,
    geometryId:'advanced_uv_quad',materialId:'advanced_uv_material'
  }]
};

function inspectWovenGrid(
  source: string, uv: [number,number], uniforms: Record<string,number> = {}
) {
  const compiled = compileEngineUVRepeatingMaterial(source);
  if (!compiled.ok) return {ok:false, diagnostics:compiled.diagnostics};
  const material = validateEngineUVRepeatingMaterialIR(compiled.material);
  const lowered = lowerEngineUVRepeatingMaterial(material);
  const prepared = prepareEngineUVRepeatingMaterialBindings(scene, {
    format:'barocss-gpu-engine-uv-repeating-material-bindings',version:0,
    sceneId:scene.id,
    bindings:[{materialId:'advanced_uv_material',material,uniforms}]
  });
  const binding = prepared.resolvedBindings[0].binding;
  const sample = evaluateAuthoredMaterial({
    material:binding.material, uniforms:binding.uniforms, uv
  });
  return {ok:true, lowered, sample};
}
```

An empty override record uses the declared defaults. The binding preparer admits four vertices, two triangles and one draw. Reconstruction uses the retained full authored source. The evaluator returns a fresh, deeply frozen sample with copied material, resolved uniforms, UV and linear RGB. Caller input remains unchanged. See [CPU material evaluation](./cpu-material-evaluation) for its request and result contracts.

The selected public binary64 evaluation produced these values and matched an independent evaluation of the two wave formulas:

| UV / overrides | Warm / cool mix ratio | Linear RGB, rounded |
| --- | --- | --- |
| `[0,0]`, defaults | `.2125` / `.7` | `[.109562586,.420082680,.455028048]` |
| `[1/24,1/12]`, defaults | `.85` / `0` | `[.560436120,.289413090,.111237259]` |
| `[0,0]`, `phase:π` | `.2125` / `0` | `[.140587667,.077719550,.041994052]` |

At the origin, sine is 0 and cosine is 1. The shifted, squared waves are therefore `.25` and 1. At `[1/24,1/12]`, density 6 places the vertical sine at its peak and the horizontal cosine at its minimum. These points explain each layer's contribution without inspecting screenshot bytes.

## Keep edits inside the admitted bounds

The accepted program has 63 final canonical node occurrences and depth 12. The compiler separately charges definitions and expanded reuse against its 256-node budget and depth limit 16. The final count does not describe how much space an arbitrary edit will consume. Literal powers expand their bases; a higher power can exceed a budget even when its syntax is supported.

Source is limited to 65,536 UTF-8 bytes, 4,096 tokens, 16 uniforms and 16 locals. Trigonometric and `fract` arguments must have an inferred range within ±1000. Wrapping UV before frequency multiplication keeps this program's wave arguments within approximately ±81.682 for all declared control values. CPU UV requests must be finite two-element tuples within ±1000. Mix ratios must be inferred within 0..1.

Replacing `sin(...)` with `unknown(...)` gives a `SYNTAX` diagnostic with an original-source `start` and `end`. Supplying `weft:2` to the evaluator throws `AuthoredMaterialEvaluationError` with code `UNIFORM`; its material error cause also has code `UNIFORM`. Both selected refusals retained the previously accepted immutable sample. Application code must adopt a new sample only after evaluation succeeds.

## Interpret the image

The example uses an application-owned WebGL2 quad host. It consumes the public lowered expression, UV attributes and uniform layout in a fixed shader wrapper. It owns shader programs, buffers, drawing and cleanup. It does not demonstrate the package Engine renderer. A refused candidate retains the accepted output while its context remains usable; context loss can make the host unavailable.

Palette bytes convert to authored linear RGB with `(byte/255)^2.2`. The host clamps the final linear color and applies `linear^(1/2.2)` once before writing opaque output. This power conversion is not the exact piecewise sRGB transfer function. CPU arithmetic, interpolated GPU UV and framebuffer conversion can differ. The numeric table is a CPU result; the image is actual host output, not a pixel parity certificate.

[Neon plasma](./advanced-shader) · [Caustics shader](./caustics-shader) · [Material language](./material-language)
