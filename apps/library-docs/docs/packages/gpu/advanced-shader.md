# Build a layered neon plasma shader

[Open Neon plasma shader](/playground#advanced-shader). This spatial material combines distorted veins, a crossing wave field and bright diagonal bands. Edit the complete shader, change its four controls, or use **Play** and **Pause** to advance its phase.

The example uses `@barocss/gpu` version `0.0.0` at source profile `7e96b959746a3fee957644fd1b5ccaf79c992c6c`. Its material profile is `engine-opaque-uv-repeating-fragment-v0`, version0. This profile is newer than the earlier `5f5ad866205a21510ac69552e704cc162fa253b5` mesh material samples. The browser needs WebGL2.

![Neon plasma shader with its initial controls](/examples/advanced-shader.png)

## Complete editable source

```css
@shader #warped_plasma {
  @uniform scale: float(2,12,6);
  @uniform warp: float(0,3,1.5);
  @uniform phase: float(0,6.283185307179586,0);
  @uniform glow: float(0,1,.65);
  @let u: float(fract(uv_u));
  @let v: float(fract(uv_v));
  @let bend: float(sin(v*6.283185307179586+phase)*warp);
  @let vein: float(sin((u*scale+bend)*6.283185307179586));
  @let plasma: float((vein+cos(v*scale*6.283185307179586-phase))*.25+.5);
  @let body: color(mix(#080F35,#E22B73,plasma));
  @let sparks: float(pow(clamp(sin((u-v)*31.41592653589793+phase)*.5+.5,0,1),3)*glow);
  @fragment { color: mix(body,rgb(255,240,210),sparks); }
}
```

This source uses supported `fract`, `sin`, `cos`, `clamp`, `pow`, `mix` and `rgb` functions. The local definitions explain the layers; they do not add custom functions, loops or a noise generator.

## Follow the three layers

First, `fract(uv_u)` and `fract(uv_v)` wrap each dimensionless coordinate into a repeating tile. Negative coordinates repeat too: `fract(-.25)` is`.75`. UV is supplied by the example's quad; it is not a texture or a CAD parameter domain.

The `bend` expression shifts the horizontal coordinate according to a vertical sine wave. `warp` controls the shift's strength. `vein` then applies a sine wave to that distorted coordinate. Increasing `scale` creates more veins across the tile.

The `plasma` expression adds a second, vertical cosine field. Each wave has range-1..1. Their sum has range-2..2, so multiplying by`.25` and adding`.5` maps it into0..1. The first `mix` uses that bounded ratio to blend dark navy and hot pink in linear color.

Finally, `sparks` creates a separate diagonal wave from `u-v`. It maps the sine to0..1, clamps it, and raises it to power3. Cubing narrows the brighter parts of the band. `glow` scales their strength. The final color mix brings in the pale RGB palette only where those bands are bright.

The material evaluates color at each supplied UV coordinate. It does not change the quad's geometry.

## Change the controls

| Control | Range / default | Visible effect |
| --- | --- | --- |
| `scale` | 2..12 / 6 | Number of distorted veins |
| `warp` | 0..3 / 1.5 | Strength of the coordinate distortion |
| `phase` | 0..2π / 0, in radians | Position of waves and bright bands |
| `glow` | 0..1 / .65 | Strength of pale diagonal highlights |

1. Set `warp` to0. The coordinate distortion disappears, making the underlying stripes easier to see.
2. Increase `scale` from6 to10. The same surface contains more veins.
3. Set `glow` to0. Only the navy-to-pink plasma layer remains.
4. Change `phase`, or select **Play**. The pattern moves across the fixed quad. Select **Pause** to inspect a frame.

![The same shader after changing its phase](/examples/advanced-shader-phase.png)

The phase control is an explicit uniform. **Play** starts a clock in this example host and submits phase values inside the declared range. **Pause** stops the host's updates. The package compiler, material and binding APIs create no clock. Closing the example stops the host clock and releases its WebGL resources.

## Edit the palette and the pattern

Change `#E22B73` to `#F09030`, then select **Run input**. The hot palette becomes orange. Change `rgb(255,240,210)` to `rgb(90,230,255)` for cyan highlights.

For wider highlight bands, change `pow(...,3)` to `pow(...,2)`. The exponent must remain an unsigned integer literal2..8. Larger powers also consume more expanded expression nodes, so they can exceed the compiler's budget even when the visual idea is valid.

The shader uses four bounded uniforms and seven local definitions. The compiler admits at most16uniforms,16locals,256definition/expanded expression nodes and depth16. Local reuse expands its expression; copying a long layer repeatedly is not free. A budget refusal supplies no replacement material.

All sine and cosine inputs must remain bounded within±1000. Wrapping UV before multiplying by `scale` keeps this source inside that range for every declared control value. The intermediate magnitude limit remains1,000,000. Clamping a final color cannot repair an earlier invalid range.

Try these refused candidates:

| Candidate | Why it is refused |
| --- | --- |
| Replace a supported function with `noise(...)` | `noise` is outside this language |
| Replace the exponent3 with a uniform name | `pow` requires a literal integer exponent |
| Bind `warp: 4` | Override exceeds its declared maximum3 |
| Increase a declared frequency range until a sine argument exceeds±1000 | Compiler checks the entire input range |

Compile and bind a complete candidate before adopting it. A refused source or uniform value keeps the last accepted result while the WebGL context is live. Context loss can prevent frame restoration; stop the host clock and create a new view when recovery is required.

## Connect public material APIs to a display host

The public CPU compiler produces material data. The complete scene binding preparer reconstructs it, resolves uniforms and supplies trusted lowered expressions:

```ts
import {
  compileEngineUVRepeatingMaterial,
  prepareEngineUVRepeatingMaterialBindings
} from '@barocss/gpu';

const compiled = compileEngineUVRepeatingMaterial(source);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
const prepared = prepareEngineUVRepeatingMaterialBindings(scene, {
  format: 'barocss-gpu-engine-uv-repeating-material-bindings',
  version: 0,
  sceneId: scene.id,
  bindings: [{
    materialId: 'plasma',
    material: compiled.material,
    uniforms: { scale: 6, warp: 1.5, phase: 0, glow: .65 }
  }]
});
const lowered = prepared.loweredBindings[0].lowered;
console.log(lowered.expression, lowered.uniformLayout);
```

In this API excerpt, the application supplies `scene` as a complete admitted Engine scene with a UV quad and matching material ID `plasma`. Its original geometry, transform, camera and material records remain separate from the shader source. The preparer creates copied CPU scene/binding data; it does not draw a frame.

This playground uses an app-owned WebGL quad host to draw the trusted lowered expression with UV input. It is a focused public-API consumer, not an existing package Engine renderer. Arbitrary caller GLSL is not inserted in place of the compiled expression. The host owns its shader program, buffers, controls, candidate adoption and cleanup.

## Interpret color and precision

The material computes authored linear RGB. Hex and RGB byte literals convert with `(byte/255)^2.2`. The display host uses a fixed power conversion `linear^(1/2.2)` for its opaque output. This is a simple display policy, not the exact piecewise sRGB transfer function.

GPU arithmetic, interpolation and framebuffer conversion can differ from CPU binary64 evaluation. The image is a rendered example, not a CPU/GPU equality or precision certificate. Use [CPU material evaluation](./cpu-material-evaluation) to inspect numeric channels separately, and the [material language](./material-language) and [function examples](./function-examples) when adapting individual expressions.
