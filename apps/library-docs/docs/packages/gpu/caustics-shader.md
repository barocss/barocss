# Build an interference-caustics shader

[Open Caustics shader](/playground#caustics-shader). Crossing waves color a cyan body, while a separate bent diagonal field supplies sharper gold highlights. Edit the complete program, adjust its four controls, or select **Play shader** and **Pause shader** to inspect the moving pattern.

![The interference-caustics shader with its initial controls](/examples/caustics-shader.jpg)

The initial image uses `density:6`, `warp:.35`, `phase:0` and `glow:.7`.

The example uses local `@barocss/gpu` version `0.0.0` at source profile `7e96b959746a3fee957644fd1b5ccaf79c992c6c`. Its explicit material profile is `engine-opaque-uv-repeating-fragment-v0`, version0. This is the same public material family used by [Neon plasma](./advanced-shader), with an independent shader program. The earlier [mesh material language](./material-language) examples retain their separate `5f5ad866` profile. Use the matching source package; source availability does not establish npm publication.

## Complete editable source

```css
@shader #interference_caustics {
  @uniform density: float(2,12,6);
  @uniform warp: float(0,1,.35);
  @uniform phase: float(0,6.283185307179586,0);
  @uniform glow: float(0,1,.7);
  @let u: float(fract(uv_u));
  @let v: float(fract(uv_v));
  @let crossing: float((cos(u*density*6.283185307179586+phase)+sin(v*density*6.283185307179586-phase))*.25+.5);
  @let bend: float(sin((u-v)*6.283185307179586+phase)*warp);
  @let bands: float(cos((u+v)*density*6.283185307179586+bend)*.5+.5);
  @let body: color(mix(#062C3D,#33D9D0,crossing));
  @fragment { color: mix(body,#FFD175,pow(bands,2)*glow); }
}
```

Paste the whole program into the source editor and select **Run input**. Uniform declarations provide complete finite ranges and defaults. `@let` names describe intermediate values; they do not declare custom functions or create a clock.

## Follow the crossing and highlight layers

`fract(uv_u)` and `fract(uv_v)` wrap dimensionless UV coordinates into a unit tile. For example, `fract(-.25)` is`.75`. The display host supplies UV from its quad; these coordinates are not texture samples or CAD parameters. Fractional density values can produce a visible tile boundary, so wrapping coordinates alone does not guarantee a seamless pattern.

The `crossing` field combines a horizontal cosine and a vertical sine. Phase enters them with opposite signs. Each wave is in`[-1,1]`; their sum is in`[-2,2]`. Multiplying by`.25` and adding`.5` produces a bounded ratio in`[0,1]`. This ratio blends dark teal `#062C3D` and cyan `#33D9D0`. The crossing field is not squared.

The highlight field uses two diagonal coordinates. `u-v` drives `bend`, a sine value multiplied by `warp`. This bend is added to the phase of a separate cosine driven by `u+v`. It changes the diagonal bands without changing the cyan body's crossing formula. Here `warp` controls an angular bend, not a direct translation of UV or geometry.

`bands` maps that cosine from`[-1,1]` into`[0,1]`. The final fragment squares it once, then multiplies it by `glow`. For a band value`.5`, squaring gives`.25`; a band value1 remains1. This narrows the brighter contribution before blending gold `#FFD175` into the body. The effect is stylized wave-color interference. It does not trace water geometry or refractive lighting.

The material changes fragment color across a fixed quad. It does not change vertices or create a light source, texture, bloom pass or transparent layer.

## Change the controls with a purpose

| Control | Range / default / slider step | Interpretation |
| --- | --- | --- |
| `density` | 2..12 / 6 / .25 | Spatial frequency of crossing waves and diagonal bands |
| `warp` | 0..1 / .35 / .05 | Maximum angular bend of the diagonal band field, in radians |
| `phase` | 0..2π / 0 / .05 | Wave phase in radians |
| `glow` | 0..1 / .7 / .05 | Strength of the gold color mix |

1. Set `glow` to0 to inspect only the dark-teal/cyan crossing layer. Increasing `warp` then leaves that body's formula unchanged.
2. Restore `glow` to`.7` and set `warp` to0. The diagonal highlights lose their bend. Raise `warp` toward`.8` to make their deformation easier to see.
3. Increase `density` from6 to9. Both fields become more closely spaced. This remains inside the program's declared range.
4. Change `phase`, or select **Play shader**. Select **Pause shader** to hold a frame. For a denser, more bent variant, try `density:9`, `warp:.8`, `phase:π/2` and `glow:.9`; the slider supplies the nearest supported step to the desired phase.

![The same caustics program after changing its phase](/examples/caustics-shader-phase.jpg)

This image uses phase2radians. The quad geometry remains unchanged.

Play is an application clock. It submits phase values inside the declared interval; source compilation and material binding supply no time source. Changing a slider pauses animation. **Run input** also pauses it and keeps matching currently bound uniform values when the new program admits them. Changing a uniform's default does not automatically replace that existing value. **Reset example** restores this preset's source and defaults. Switching samples or closing the example stops the clock and releases the owned WebGL resources.

## Inspect public CPU material data

The following application function takes the complete source above and an optional uniform override record. It uses ordinary public imports and supplies a complete scene with four vertices, six indices, UVs, an unlit material and one mesh node.

```ts
import {
  compileEngineUVRepeatingMaterial, prepareEngineUVRepeatingMaterialBindings,
  evaluateAuthoredMaterial
} from '@barocss/gpu';

const scene = {
  format: 'barocss-gpu-engine-scene', version: 0, id: 'advanced_uv_scene',
  coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', background: [0,0,0],
  camera: { eye:[0,0,3], target:[0,0,0], up:[0,1,0], fovYDegrees:45, near:.1, far:10 },
  geometries: [{
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

function prepareCaustics(source: string, uniforms: Record<string,number> = {}) {
  const compiled = compileEngineUVRepeatingMaterial(source);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
  return prepareEngineUVRepeatingMaterialBindings(scene, {
    format:'barocss-gpu-engine-uv-repeating-material-bindings',version:0,
    sceneId:scene.id,
    bindings:[{materialId:'advanced_uv_material',material:compiled.material,uniforms}]
  });
}

function inspectCausticsOrigin(source: string) {
  const prepared = prepareCaustics(source);
  const binding = prepared.resolvedBindings[0].binding;
  const sample = evaluateAuthoredMaterial({
    material:binding.material,uniforms:binding.uniforms,uv:[0,0]
  });
  return {
    source:sample.source,
    uniforms:sample.uniforms,
    linearRGB:sample.linearRGB,
    lowered:prepared.loweredBindings[0].lowered
  };
}
```

An empty override record selects all declared defaults. The preparer reconstructs the canonical material from its retained full source, resolves bindings, admits the complete scene and returns copied prepared data. Lowered data contains `expression`, `uniformDeclarations`, `uniformLayout` and `inputDeclarations`. These CPU APIs do not draw a frame. The application functions above are not additional package exports.

For this program, the public binary64 evaluator produces approximately these linear channel values:

| UV / uniform overrides | Linear RGB |
| --- | --- |
| `[0,0]`, defaults | `[.706542633,.611223163,.273050406]` |
| `[.13,.27]`, defaults | `[.035630045,.285685365,.264677219]` |
| `[0,0]`, `phase:π` | `[.702233186,.509190408,.183681539]` |
| `[.13,.27]`, `density:9, warp:.8, phase:π/2, glow:.9` | `[.089610413,.387136776,.332607956]` |

At the default origin, `crossing` is`.75`, `bend` is0 and `bands` is1. The final gold mix ratio is therefore`.7`. These values explain the origin sample; RGB channels are authored linear values, not screenshot bytes. See [CPU material evaluation](./cpu-material-evaluation) for request ownership, frozen samples and supported profiles.

## Edit source within the admitted language

Change `#33D9D0` to another cyan or blue literal, then select **Run input**. Change `#FFD175` to `rgb(255,225,160)` for a different highlight palette. `rgb` channels must be literal integer bytes0..255; they are not uniform expressions. These palette changes keep geometry and the field formulas unchanged.

`pow(bands,2)` uses an unsigned literal exponent. The supported range is2..8, but each additional power expands the base expression again and can exceed a node or depth budget. To explore sharper highlights, try a larger supported exponent and compile the complete candidate; do not assume that every legal exponent fits this particular program. Final color clamping cannot repair an earlier unsafe expression range.

| Bound | Contract |
| --- | --- |
| Source | At most 65,536 UTF-8 bytes and 4,096 tokens |
| Definitions | At most16uniforms and16locals; this source has4uniforms and6locals |
| Expression budget | At most256 definition/expanded nodes and depth16; local reuse and `pow` expansion are charged |
| Scalars | Literals within±1000; finite intermediate magnitude at most1,000,000 |
| Functions | `sin`, `cos` and `fract` must receive an inferred interval within±1000; `mix` ratios must be bounded in0..1 |
| Uniform overrides | Declared names and finite values inside the complete declared ranges; omitted names use defaults |
| UV evaluation | Dense finite `[u,v]` tuple within±1000 for the public CPU evaluator; UV is dimensionless |

The full compiler checks every declared control value, even if the visible quad uses only UV0..1 and the slider is currently near its default. Wrapping before frequency multiplication admits a bounded source. At maximum density, the diagonal cosine argument remains within approximately`[-1,151.797]`, well inside its permitted interval.

The public final expanded IR has85node occurrences and depth14 for this accepted program. The host's report exposes those final-IR measurements. They are not a measurement of the compiler's private definition/reuse counter, and they do not imply that another171nodes are available for arbitrary source edits.

## Handle refused input and own the display

The source compiler returns diagnostics with `code`, `message`, `start` and `end`. Offsets refer to the original source text, including comments. The binding preparer reconstructs the entire retained program; editing an IR field cannot replace that source authority.

| Candidate | Refusal |
| --- | --- |
| Replace a supported function with `unknown(...)` or `noise(...)` | Compiler `SYNTAX`: unsupported function |
| Use a uniform instead of the literal exponent in `pow` | Compiler `TYPE` |
| Increase a declared frequency range until a trigonometric argument exceeds±1000 | Compiler `RANGE` |
| Duplicate sufficiently large local expressions | Compiler `BUDGET` for nodes or depth |
| Bind `density:13` | Outside the declared maximum12; the public evaluator reports `UNIFORM` |

`prepareEngineUVRepeatingMaterialBindings` throws `EngineMaterialBindingsError` with code `MATERIAL` when its material provider refuses a uniform override; the actual `MeshMaterialError` cause carries `UNIFORM`. This is separate from compiler diagnostics and from WebGL allocation or shader errors. A failed candidate supplies no replacement material. The example host keeps the last accepted source result, controls and output while its WebGL context remains usable; the editable source draft remains available for correction.

The playground uses an app-owned WebGL2 quad host. It inserts only the public source-reconstructed lowered expression into a fixed shader wrapper and supplies the admitted UV attributes and uniform layout. This is a focused consumer of public material data, not a package Engine renderer. The host owns its program, buffers, candidate adoption, draws, clock and cleanup. It restores the accepted draw after a refusal when possible. Context loss can prevent restoration; pause and recreate the example when the host becomes unavailable.

## Interpret rendered color

Hex colors and `rgb` bytes convert to authored linear RGB with `(byte/255)^2.2`. The host converts the final clamped color with `linear^(1/2.2)` and writes opaque output. This fixed power conversion is not the exact piecewise sRGB transfer function. `glow` is a blend strength, not HDR exposure or measured light intensity.

GPU arithmetic, UV interpolation and framebuffer conversion can differ from CPU binary64 evaluation. The screenshots show actual example output; the numeric table inspects public CPU color. They do not certify CPU/GPU equality, optical accuracy, a seamless animation loop or behavior on every device.

[Neon plasma shader](./advanced-shader) · [Material language](./material-language) · [CPU material evaluation](./cpu-material-evaluation)
