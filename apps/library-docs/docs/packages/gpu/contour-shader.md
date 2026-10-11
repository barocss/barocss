# Draw contour bands from a UV elevation field

[Open Contour bands shader](/examples/language#contour-shader) to inspect a green-to-sand field with dark contour lines. Edit its complete source, adjust four uniforms, or use **Play shader** and **Pause shader** to change its explicit phase.

![Contour bands with the default controls](/examples/contour-shader.jpg)

The image uses frequency 3, bands 6, phase 0 and contrast .8, with animation paused. It is the output of the example's WebGL2 quad host. The scalar named `elevation` changes color across that fixed quad; it is not native terrain height or displaced geometry.

This example uses `@barocss/gpu` version `0.0.0` at source profile `7e96b959746a3fee957644fd1b5ccaf79c992c6c`. Its explicit material profile is `engine-opaque-uv-repeating-fragment-v0`, version 0. Use the matching source entry with a TypeScript-capable application build. Browser display requires WebGL2. These source APIs are separate from the earlier mesh material examples' `5f5ad866` profile; source availability does not establish npm publication.

## Complete editable shader

```css
@shader #contour_bands {
  @uniform frequency: float(1,8,3);
  @uniform bands: float(2,12,6);
  @uniform phase: float(0,6.283185307179586,0);
  @uniform contrast: float(0,1,.8);
  @let u: float(fract(uv_u));
  @let v: float(fract(uv_v));
  @let elevation: float((sin(u*frequency*6.283185307179586+phase)+cos(v*frequency*6.283185307179586-phase)+2)*.25);
  @let band: float(fract(elevation*bands));
  @let line: float(clamp(1-band*10,0,1)*contrast);
  @let terrain: color(mix(#143B38,#DCD4A5,elevation));
  @fragment { color: mix(terrain,#091719,line); }
}
```

Paste the whole program into the editor and select **Run input**. Each uniform has a finite declared range and a default. The six local definitions describe intermediate expressions; they add no custom function, loop or package clock.

## Follow elevation, bands and ink

`fract(uv_u)` and `fract(uv_v)` wrap dimensionless UV coordinates into one tile. For example, U = -.25 becomes .75. The host supplies interpolated UV from its quad; no texture, model Surface or external height map is sampled.

The horizontal sine and vertical cosine each stay in `[-1,1]`. Their sum stays in `[-2,2]`. Adding 2 and multiplying by .25 produces `elevation` in `[0,1]`. Phase enters the waves with opposite signs, changing the field while its geometry stays fixed.

The first `mix` uses that elevation to blend dark green `#143B38` and pale sand `#DCD4A5`. This provides a continuous color reference beneath the lines.

Multiplying elevation by `bands` and taking its fractional part creates repeated scalar intervals. With bands 6, each whole step of elevation×6 starts another contour interval. `band` is a fractional position inside an interval, not a spatial distance to the contour.

`clamp(1-band*10,0,1)` is 1 at a band start, fades to 0 at band .1, and stays 0 for the rest of that interval. Multiplying by `contrast` gives the final ink ratio. The fragment blends dark ink `#091719` into the terrain color using that ratio. At contrast .8, a band start receives 80% ink; contrast 0 removes the lines and reveals the continuous field.

The line width is expressed in elevation-band space. The visible width changes with local field slope. Near stationary points the bands can spread, while higher spatial frequency compresses them. This is a stylized contour field, not a geographic contour measurement, signed-distance function or terrain simulation.

## Change one control at a time

| Control | Range / default / step | Effect |
| --- | --- | --- |
| `frequency` | 1..8 / 3 / .25 | Wave cycles across the unit UV tile |
| `bands` | 2..12 / 6 / .5 | Repeated contour intervals across scalar elevation |
| `phase` | 0..2π / 0 / .05 | Wave phase in radians |
| `contrast` | 0..1 / .8 / .05 | Dark ink blend strength |

1. Set contrast to 0. Inspect only the smooth green-to-sand elevation palette.
2. Restore contrast .8. Change bands from 6 to 10 to add more contour intervals without changing the underlying wave field.
3. Restore bands 6. Change frequency from 3 to 5 to fit more spatial features into the same quad.
4. Change phase, or select **Play shader**. **Pause shader** holds a frame. A slider edit pauses animation.

Integer frequency values repeat the wave endpoints across wrapped UV. Fractional frequencies remain admitted but can reveal a tile boundary. `fract` also introduces band discontinuities. Narrow, dense lines may alias at finite screen resolution; these functions provide no derivative-based anti-aliasing.

Play belongs to the application host. It advances the declared phase uniform inside its interval. Compilation and material binding supply no timer. **Run input** pauses animation and retains currently bound values for names still declared by the new source. Editing a default does not replace an existing matching value. A narrower declared range can refuse that retained value. **Reset example** restores this source and its defaults. Switching samples releases the previous host's resources and clock.

## Inspect public CPU data

The following application module accepts the complete source above, an optional override record and one UV point. It admits the same four-vertex quad scene used by the display host. Public preparation resolves defaults and produces trusted lowering data; it does not draw pixels.

```ts
import {
  compileEngineUVRepeatingMaterial, validateEngineUVRepeatingMaterialIR,
  lowerEngineUVRepeatingMaterial, prepareEngineUVRepeatingMaterialBindings,
  evaluateAuthoredMaterial,
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
    uvs:[0,0,1,0,1,1,0,1], indices:[0,1,2,0,2,3],
  }],
  materials:[{id:'advanced_uv_material',type:'unlit',colorSpace:'linear',color:[1,1,1]}],
  nodes:[{
    id:'advanced_uv_node',type:'mesh',parentId:null,
    translation:[0,0,0],rotationXYZW:[0,0,0,1],scale:[1,1,1],visible:true,
    geometryId:'advanced_uv_quad',materialId:'advanced_uv_material',
  }],
};

export function inspectContours(
  source: string, uniforms: Record<string,number> = {}, uv: [number,number] = [0,0],
) {
  const compiled = compileEngineUVRepeatingMaterial(source);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
  const material = validateEngineUVRepeatingMaterialIR(compiled.material);
  const lowered = lowerEngineUVRepeatingMaterial(material);
  const prepared = prepareEngineUVRepeatingMaterialBindings(scene, {
    format:'barocss-gpu-engine-uv-repeating-material-bindings',version:0,
    sceneId:scene.id,
    bindings:[{materialId:'advanced_uv_material',material,uniforms}],
  });
  const binding = prepared.resolvedBindings[0].binding;
  const sample = evaluateAuthoredMaterial({
    material:binding.material, uniforms:binding.uniforms, uv,
  });
  return { prepared, lowered, sample };
}
```

These are ordinary public package imports. `inspectContours` is application glue. Material reconstruction uses the retained full source rather than trusting edited IR fields. Prepared bindings, resolved uniform records and samples are fresh public copies; their exposed material/sample data is deeply frozen. Empty overrides select all declared defaults. CPU data needs no DOM or WebGL context and can be released by dropping references.

Three analytic reference points produce these approximate binary64 **linear RGB** values:

| Request | Elevation / fractional band / ink ratio | Linear RGB |
| --- | --- | --- |
| UV `[0,0]`, defaults | .75 / .5 / 0 | `[.542928650,.509574519,.296734577]` |
| UV `[0,0]`, phase π | .25 / .5 / 0 | `[.183441043,.196489620,.122654439]` |
| UV `[-.25,0]`, defaults | 1 / 0 / .8 | `[.145045037,.137245957,.081587404]` |

At the default origin, sine is 0 and cosine is 1, so elevation is .75. At phase π the wave sum is -1, giving .25. For negative U = -.25, wrapping gives .75; frequency 3 makes the sine 1 while cosine remains 1. Elevation is then 1, and `fract(1*6)` is 0, placing the sample on a contour start. These field values explain the references without using framebuffer bytes as CPU authority.

## Stay inside the language bounds

Both color ratios are bounded in `[0,1]` for every declared control value. The largest trigonometric argument magnitude is at most `18π≈56.549`, below the profile's ±1000 limit. Wrapped elevation×bands stays in `[0,12]`, also within the allowed `fract` input interval. Before clamping, the line expression is in `[-9,1]`; clamping and contrast restore its ratio to `[0,1]`.

The accepted final canonical expression has 63 node occurrences and depth 16. This measures public final IR, not the compiler's private definition and reuse accounting. The compiler's existing caps remain 256 charged/expanded nodes, depth 16, 16 uniforms and 16 locals. This program already reaches the depth limit, so adding a nested function can refuse even when its node count appears small.

The source limit is 65,536 UTF-8 bytes and 4,096 tokens. Literal magnitudes remain within ±1000; inferred finite intermediate magnitude must stay within 1,000,000. Public CPU UV requests need a dense finite two-value tuple inside ±1000. Check the complete program's inferred ranges, not only one visible sample.

| Candidate | Refusal |
| --- | --- |
| Replace `sin` with `unknown` or `noise` | Compiler `SYNTAX`, unsupported function |
| Increase frequency's declared range enough to exceed the trigonometric bound | Compiler `RANGE` |
| Add excessive nesting or expanded local reuse | Compiler `BUDGET` |
| Supply contrast 2 | Public evaluator `UNIFORM`; binding preparer `MATERIAL` with `MeshMaterialError` cause `UNIFORM` |

Compiler diagnostic `start` and `end` offsets refer to the submitted source text. On an ordinary refusal, the live example host keeps its last accepted source result, uniform values and output while retaining the corrective editor draft. Caller applications must adopt only successful candidates. Device/context failures can prevent pixel restoration; recreate an unavailable host rather than treating retained CPU data as a restored frame.

## Interpret displayed color

Authored hex bytes convert to linear channels with `(byte/255)^2.2`. The existing example host consumes public source-derived lowering in its fixed WebGL2 wrapper, then applies `linear^(1/2.2)` to clamped opaque output. It owns the program, buffers, controls, clock and disposal. It is an app-owned quad consumer, not a package Engine renderer.

That fixed power conversion is not the exact piecewise sRGB transfer function. GPU arithmetic, interpolation and framebuffer conversion can differ from the CPU evaluator's binary64 values. The image shows the actual default example; the numeric table describes CPU color. Neither certifies CPU/GPU parity, physical geography, seamless animation or all-device behavior.

[Neon plasma](./advanced-shader) · [Interference caustics](./caustics-shader) · [CPU material evaluation](./cpu-material-evaluation) · [Material language](./material-language)
