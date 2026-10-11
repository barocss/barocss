# Make a repeating halftone dot pattern

[Open Halftone dots shader](/examples/language#halftone-shader) to place dark, soft-edged spots on a warm paper color. Change dot spacing, apparent size, horizontal phase or ink strength. This is a procedural fragment color on a fixed UV quad, not a printing process or a geometry generator.

![Dark halftone spots on a warm paper color](/examples/halftone-shader.jpg)

The paused display uses the complete source below with `density:6`, `size:.4`, `phase:0` and `ink:.9`. The spots come from the crossed-cosine threshold, not an exact circle construction.

The example uses `@barocss/gpu` version `0.0.0` at source profile `7e96b959746a3fee957644fd1b5ccaf79c992c6c`. Its material family is `engine-opaque-uv-repeating-fragment-v0`, version 0. It uses the same public material APIs and application-owned WebGL2 host as [Neon plasma](./advanced-shader) and [Caustics shader](./caustics-shader), with an independent program. The older [mesh material examples](./material-language) retain their separate source profile. Use the matching source package; this does not establish registry publication.

## Complete editable program

```css
@shader #halftone_dots {
  @uniform density: float(2,12,6);
  @uniform size: float(0,.8,.4);
  @uniform phase: float(0,6.283185307179586,0);
  @uniform ink: float(0,1,.9);
  @fragment { color: mix(#F3EAD7,#182F43,smoothstep(1.2,1.6,(cos(fract(uv_u)*(density*6.283185307179586)-phase)+cos(fract(uv_v)*(density*6.283185307179586)))+size)*ink); }
}
```

Select this preset, edit the whole source and select **Run input**. Its four declarations include finite ranges and defaults. The source contains no texture, random function, loop, square root or custom function declaration.

## Follow the dot construction

First, `fract(uv_u)` and `fract(uv_v)` wrap each dimensionless coordinate into a unit tile. For example, `fract(-.25)` is `.75`. Multiplication by `density * 2π` creates horizontal and vertical cosine cycles. The horizontal term subtracts `phase`; the vertical term does not.

Each cosine is in `[-1,1]`. Their sum is in `[-2,2]`. Add `size` to obtain a field in `[-2,2.8]` across all declared controls. Near coincident cosine maxima, its level sets form rounded spots. These are thresholded wave fields, not exact circles from a Euclidean distance calculation. No radius, area or physical ink coverage is measured.

`smoothstep(1.2,1.6,field)` converts the field into a mask in `[0,1]`. Values at or below 1.2 give 0; values at or above 1.6 give 1. Between them, let `t=(field-1.2)/.4`: the mask is `t²(3-2t)`. The compiler expands this supported operation into canonical arithmetic and clamping. The two edges are literal constants, not uniforms.

Multiplying the mask by `ink` gives a valid color mix ratio in `[0,1]`. A zero ratio selects paper `#F3EAD7`; a larger ratio brings in dark blue `#182F43`. At default ink .9, even a full dot retains a 10% paper contribution in linear RGB. Ink strength does not change the mask's shape or make the fragment transparent.

## Adjust one layer at a time

| Control | Range / default / step | Effect |
| --- | --- | --- |
| `density` | 2..12 / 6 / .25 | Cosine cycles per unit UV direction; larger values bring spots closer together |
| `size` | `[0,.8]` / .4 / .04 | Field offset before the fixed threshold; larger values expand the dark spots |
| `phase` | 0..2π / 0 / .05 | Horizontal phase in radians; positive phase moves the grid toward increasing U |
| `ink` | 0..1 / .9 / .05 | Linear color blend strength inside the mask |

1. Leave density at 6. Set size to 0, then raise it toward .8. Compare the smaller separated spots with the larger dark regions. Size is a dimensionless threshold offset, not a dot radius in pixels or UV units.
2. Reset the example. Set ink to 0 to inspect the paper color, then return it to .9. The procedural mask still exists when its color contribution is zero.
3. Change density from 6 to 9. The pattern becomes more closely spaced without changing the quad. Fractional densities are admitted, but their wrapped tile boundaries can be visible; UV wrapping alone does not guarantee seamless color.
4. Return density to 6 and move phase toward π/2. A quarter cycle shifts the horizontal maxima by approximately `1/(4*6)=1/24` UV. **Play shader** advances phase with an application clock; **Pause shader** holds the displayed frame.

Slider changes and **Run input** pause the host clock. Run retains matching bound uniform values when the candidate admits them; changing a source default does not automatically replace those values. **Reset example** restores this source and its declared defaults. A slider step may not represent π/2 exactly; a CPU override can supply `Math.PI/2` directly.

## Inspect the public CPU result

Pass the complete source above into this application function. The scene is the same complete four-vertex, two-triangle UV quad admitted by the display host. These calls compile, reconstruct, lower and bind public CPU material data; they do not render an image.

```ts
import {
  compileEngineUVRepeatingMaterial, validateEngineUVRepeatingMaterialIR,
  lowerEngineUVRepeatingMaterial, prepareEngineUVRepeatingMaterialBindings,
  evaluateAuthoredMaterial,
} from '@barocss/gpu';

const scene = {
  format:'barocss-gpu-engine-scene',version:0,id:'advanced_uv_scene',
  coordinateSystem:'right-handed-y-up',positionUnit:'scene',background:[0,0,0],
  camera:{eye:[0,0,3],target:[0,0,0],up:[0,1,0],fovYDegrees:45,near:.1,far:10},
  geometries:[{
    format:'barocss-gpu-triangle-geometry',version:0,id:'advanced_uv_quad',
    coordinateSystem:'right-handed-y-up',positionUnit:'scene',winding:'ccw',
    positions:[-1,-1,0,1,-1,0,1,1,0,-1,1,0],
    normals:[0,0,1,0,0,1,0,0,1,0,0,1],
    uvs:[0,0,1,0,1,1,0,1],indices:[0,1,2,0,2,3],
  }],
  materials:[{id:'advanced_uv_material',type:'unlit',colorSpace:'linear',color:[1,1,1]}],
  nodes:[{
    id:'advanced_uv_node',type:'mesh',parentId:null,
    translation:[0,0,0],rotationXYZW:[0,0,0,1],scale:[1,1,1],visible:true,
    geometryId:'advanced_uv_quad',materialId:'advanced_uv_material',
  }],
};

function inspectHalftone(source: string) {
  const compiled = compileEngineUVRepeatingMaterial(source);
  if (!compiled.ok) return {ok:false,diagnostics:compiled.diagnostics};
  const material = validateEngineUVRepeatingMaterialIR(compiled.material);
  const lowered = lowerEngineUVRepeatingMaterial(material);
  const prepared = prepareEngineUVRepeatingMaterialBindings(scene, {
    format:'barocss-gpu-engine-uv-repeating-material-bindings',version:0,
    sceneId:scene.id,
    bindings:[{materialId:'advanced_uv_material',material,uniforms:{}}],
  });
  const center = evaluateAuthoredMaterial({material,uniforms:{},uv:[0,0]});
  const paper = evaluateAuthoredMaterial({material,uniforms:{},uv:[1/12,1/12]});
  const softEdge = evaluateAuthoredMaterial({
    material,uniforms:{phase:Math.PI/2},uv:[0,0],
  });
  return {ok:true,material,lowered,prepared,center,paper,softEdge};
}
```

Empty override records select declared defaults. The preparer resolves the complete scene and material binding. Public reconstruction retains the full source as authority; editing an IR field is not a supported way to change the program. Material IR, lowered data and evaluator samples are copied and deeply frozen. The evaluator's copied source, UV and resolved uniform record make each numeric result inspectable. See [CPU material evaluation](./cpu-material-evaluation) for its full request and zero policy.

The selected public binary64 evaluation produced these linear RGB values:

| UV / overrides | Analytic mask and mix ratio | Linear RGB, approximately |
| --- | --- | --- |
| `[0,0]`, defaults | Mask 1; ratio .9 | `[.094908022,.104573227,.116260544]` |
| `[1/12,1/12]`, defaults | Mask 0; ratio 0 | `[.899384513,.827725794,.687030812]` |
| `[0,0]`, `phase:π/2` | Mask .5; ratio .45 | `[.497146267,.466149511,.401645678]` |

At the origin, both cosines are 1, so the field is 2.4 and the mask is 1. At `[1/12,1/12]`, both angles are π and the field is −1.6, giving paper. With phase π/2 at the origin, the cosine sum is approximately 1; adding .4 gives 1.4. That is halfway between the literal edges, so `smoothstep` is approximately .5. Small trigonometric roundoff remains; these analytic references were compared within `1e-12`, not against framebuffer bytes.

## Stay within the admitted bounds

The accepted final public IR has 92 node occurrences and depth 16. This is the final expanded expression, not the compiler's private definition accounting. It already reaches the depth limit. Adding another nested operation can refuse even when each function is supported. Earlier distance-based candidates exceeded the unchanged node budget; simplifying the authored program admitted this wave-based pattern.

| Bound | Contract |
| --- | --- |
| Source and tokens | At most 65,536 UTF-8 bytes and 4,096 tokens |
| Definitions | At most 16 uniforms and 16 locals; this source has four uniforms and no locals |
| Expressions | At most 256 charged definition/expanded nodes and depth 16; reuse and operation expansion count |
| Numeric values | Literals within ±1000; finite intermediate magnitude at most 1,000,000 |
| Trigonometry / `fract` | Inferred argument interval must remain within ±1000 |
| `smoothstep` | Ordered literal edges; finite reciprocal edge distance at most 1000; bounded input within ±1000 |
| Mix and overrides | Ratio in `[0,1]`; only declared uniform names and finite values within their declared ranges |
| CPU UV request | Dense finite two-number tuple within ±1000; dimensionless UV |

Wrapping UV before frequency multiplication keeps the cosine arguments bounded. Their magnitudes remain below 82 radians throughout the declared density and phase ranges. The compiler checks those complete ranges, not just the visible defaults. The mask stays in `[0,1]`, so every admitted ink value keeps the final mix ratio valid.

## Keep accepted output when a candidate refuses

Replacing `smoothstep(...)` with `unknown(...)` produces a genuine compiler `SYNTAX` diagnostic. Binding `density:13` exceeds the declared maximum and produces evaluator `UNIFORM`, with a `MeshMaterialError` cause carrying the same code. Both selected refusals retained the accepted CPU sample's reference and value.

Compiler diagnostics include `code`, `message`, `start` and `end` in the original source text. Binding preparation wraps a provider refusal as `EngineMaterialBindingsError` code `MATERIAL`; inspect its cause for `UNIFORM`. These errors are separate from WebGL allocation, shader compilation or context loss.

Adopt a candidate only after required public compilation, reconstruction and binding succeed. The example's application-owned WebGL2 host supplies a fixed shader wrapper, quad attributes, uniform uploads and drawing. It preserves its accepted state on a candidate refusal while the context remains usable. Context loss can prevent restoring a frame. The host owns its clock and releases its WebGL program and buffers when the example is replaced or closed; CPU material data has no GPU disposal operation.

## Read the display color correctly

Hex byte channels convert to linear RGB with `(byte/255)^2.2`. The host clamps the result and applies `linear^(1/2.2)` for opaque output. This fixed power curve is not the exact piecewise sRGB transfer function. Ink controls a color blend, not measured reflectance, ink deposition, light intensity or alpha.

CPU binary64 color differs in role from GPU arithmetic, UV interpolation and display bytes. A rendered sample illustrates the pattern; it does not certify CPU/GPU equality, geometric circles, print coverage, a seamless fractional-density tile or behavior on every device. This example supplies no screen-space antialiasing derivative, texture sampling or physical print calibration.

[Neon plasma](./advanced-shader) · [Caustics shader](./caustics-shader) · [Material language](./material-language) · [CPU material evaluation](./cpu-material-evaluation)
