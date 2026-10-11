# Reuse a bounded easing function and color palette

[Open Reusable palette shader](/examples/language#reusable-shader) to edit two pure material functions and their caller. A float function squares a diagonal wave; a color-return function maps that ratio from navy to gold. The [playground link](/playground#reusable-shader) opens the same source and controls.

![Gold and navy diagonal bands from reusable material functions](/examples/reusable-shader.jpg)

The paused image uses the original program below with `frequency:3`, `tilt:.5`, `phase:0` and `strength:.85`. The bands are fragment color on the same fixed quad, not changed geometry.

This example uses `@barocss/gpu` version `0.0.0` at the separate source profile `363f583cfb3d2fde6ebf70330ccd6e786e098713`. It retains material profile `engine-opaque-uv-repeating-fragment-v0`, version 0, and the existing public compile, reconstruction, lowering, binding and evaluation APIs. Authored `@fn` syntax requires this matching provider. The older [built-in function gallery](./function-examples), [mesh material language](./material-language) and [Neon plasma](./advanced-shader) keep their stated `5f5ad866` and `7e96b959` sources. Their complete programs are not upgraded by this example. Source availability does not establish publication.

## Complete editable program

```css
@shader #function_palette {
  @uniform frequency: float(1,8,3);
  @uniform tilt: float(0,1,.5);
  @uniform phase: float(0,6.283185307179586,0);
  @uniform strength: float(0,1,.85);
  @fn ease(t: float(0,1)): float(pow(t,2));
  @fn palette(t: float(0,1)): color(mix(#122A4A,#F6C453,t));
  @let wave: float(sin((fract(uv_u)+fract(uv_v)*tilt)*frequency*6.283185307179586+phase)*.5+.5);
  @fragment { color: palette(ease(wave)*strength); }
}
```

Choose this preset, edit its complete source and select **Run input**. Functions separate two responsibilities: `ease` changes a bounded float response; `palette` chooses colors. The caller supplies the wave and strength. Neither function body reads the shader's uniforms or UV inputs.

## Read the exact function grammar

```text
program  = "@shader" shader-id "{" uniform* function* local* fragment "}"
function = "@fn" name "(" parameter ": float(" min "," max "))"
           ":" ("float" | "color") "(" expression ");"
```

Uniforms come first, then functions, then locals, then the single fragment block. A function placed after a local is not admitted. Only whitespace and comments may follow the closing block. Keywords and identifiers are case sensitive.

Each function takes exactly one dimensionless `float` parameter. Its finite ordered minimum and maximum are signed numeric literals within ±1000. Equal bounds are allowed. There is no parameter default, named argument, second parameter or color parameter. Function and parameter names use 1..32 ASCII characters, start with a letter or `_`, and then allow letters, digits and `_`. Do not collide with existing functions, uniforms, built-ins, types or the selected profile's reserved coordinates. The parameter also cannot have its function's own name.

The declared return type is either `float` or `color`, and the body must match it. A color result is the existing linear RGB expression type, not a general vector, alpha output, texture or layer. `palette` still takes a float; returning color does not permit passing color as its argument.

The body is one expression, not a statement block. It may use its own parameter, literals and existing built-ins admitted by the selected material profile. It cannot capture uniforms, locals, UV coordinates or resources. It cannot call any authored function, including itself, and cannot mutate state. This keeps the body independent of caller state.

### Caller nesting is different from a body call

The fragment's `palette(ease(wave)*strength)` is valid caller-side nesting. First `ease(wave)` returns a float, then multiplication by strength supplies the float argument to `palette`. The caller can use uniforms and UV-derived locals.

Putting `ease(t)` inside the authored `palette` body is unsupported, even if `ease` was declared earlier. Authored body calls and recursion remain forbidden. Built-in calls such as the body's `mix(...)` and `pow(...)` are allowed. A reusable function name is not a first-class value: call it with one admitted float argument.

## Follow the source intervals

The definition of `ease` is checked across its complete parameter interval `[0,1]`. `pow(t,2)` lowers to multiplication and returns a float in `[0,1]`. It does not mean linear interpolation: .5 becomes .25, so middle wave values contribute less gold.

`palette` uses `t` as the ratio in `mix(#122A4A,#F6C453,t)`. Its `[0,1]` parameter interval admits the complete color mix. The compiler checks each caller argument's inferred interval against the declared function interval. It does not implicitly clamp an out-of-range argument or admit it because a currently bound value happens to fit.

In the caller, `fract(uv_u)` and `fract(uv_v)` wrap dimensionless UV into a unit tile. With tilt in `[0,1]`, `u+v*tilt` stays in `[0,2]`. Frequency in `[1,8]` and phase in `[0,2π]` keep the sine argument within `[0,34π]`, below its ±1000 limit. Mapping sine with `*.5+.5` gives wave in `[0,1]`. Squaring and multiplying by strength in `[0,1]` keep the palette argument admitted.

The wave is fragment color on a fixed quad. It is not a Scene shape parameter, a native Surface parameter, displacement, mesh deformation or a texture lookup. Wrapping UV alone does not guarantee a seamless displayed tile for every frequency and tilt combination.

## Use the four controls

| Control | Range / default / slider step | Meaning |
| --- | --- | --- |
| `frequency` | 1..8 / 3 / .25 | Wave cycles along the combined UV coordinate |
| `tilt` | 0..1 / .5 / .05 | V's contribution to the diagonal coordinate; this is not an angle in degrees |
| `phase` | 0..2π / 0 / .05 | Explicit sine phase in radians |
| `strength` | 0..1 / .85 / .05 | Maximum gold palette ratio after easing |

1. Set tilt to 0. The wave varies only with U. Return it to .5, then move toward 1 to compare diagonal directions.
2. Increase frequency from 3 to 6. More waves fit across the quad without changing its vertices.
3. Set strength to 0 to inspect the navy endpoint. At strength 1, a wave peak reaches gold; default strength .85 retains a navy contribution even at the peak.
4. Change phase or select **Play shader**. **Pause shader** holds the current frame. A slider step need not represent an exact multiple of π; the CPU example can provide exact `Math.PI` expressions.

Play/Pause belongs to the caller's clock. Function compilation creates no scheduler or automatic time input. A slider edit or **Run input** pauses the clock. Run retains matching currently bound uniform values when the new program admits them; changing a default in source does not automatically replace that existing value. **Reset example** restores this complete source and its defaults. Switching examples or closing the view stops scheduling and releases the app-owned WebGL resources.

## Compile, reconstruct, lower, bind and evaluate

The following application function takes the complete source above. It uses public imports and the complete four-vertex, two-triangle UV quad. These CPU stages do not draw pixels or allocate a renderer.

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

function inspectReusablePalette(source:string) {
  const compiled=compileEngineUVRepeatingMaterial(source);
  if (!compiled.ok) return {ok:false,diagnostics:compiled.diagnostics};
  const material=validateEngineUVRepeatingMaterialIR(compiled.material);
  const lowered=lowerEngineUVRepeatingMaterial(material);
  const prepared=prepareEngineUVRepeatingMaterialBindings(scene,{
    format:'barocss-gpu-engine-uv-repeating-material-bindings',version:0,
    sceneId:scene.id,
    bindings:[{materialId:'advanced_uv_material',material,uniforms:{}}],
  });
  const origin=evaluateAuthoredMaterial({material,uniforms:{},uv:[0,0]});
  const peak=evaluateAuthoredMaterial({material,uniforms:{},uv:[1/12,0]});
  const navy=evaluateAuthoredMaterial({
    material,uniforms:{phase:3*Math.PI/2},uv:[0,0],
  });
  return {ok:true,material,lowered,prepared,origin,peak,navy};
}
```

Empty override records select declared defaults. Reconstruction checks the entire retained source against the canonical material; changing an expression field while leaving source unchanged does not create a new program. Material IR, lowering data and evaluator samples use fresh deeply frozen public copies. Samples retain copied UV and resolved uniform data independently from the caller's mutable request.

Functions expand into the existing expression IR. There is no new function node, public `functions` table or parameter uniform named `t`. The four shader uniforms retain their ordinary binding names and layout. Lowered expression text contains existing operations rather than runtime calls to `ease`, `palette` or `pow`. A color-return declaration does not emit a caller-defined GLSL function or permit arbitrary GLSL source.

## Compare three numeric results

The public binary64 evaluator produced these values for the complete accepted program:

| UV / overrides | Wave / eased / palette ratio | Linear RGB, approximately |
| --- | --- | --- |
| `[0,0]`, defaults | .5 / .25 / .2125 | `[.198657784,.134000044,.069767502]` |
| `[1/12,0]`, defaults | 1 / 1 / .85 | `[.785834183,.479261227,.081808366]` |
| `[0,0]`, `phase:3π/2` | 0 / 0 / 0 | `[.002932318,.018912983,.065753880]` |

At the origin with phase 0, sine is 0, wave is .5, and ease squares it to .25. Strength .85 gives ratio `.25*.85=.2125`. At U = 1/12, frequency 3 gives angle π/2 and the wave peak. At the origin with phase 3π/2, sine reaches −1 and the navy endpoint is selected. Analytic color mixes were compared within `1e-12`; trigonometric roundoff and screenshot bytes are separate concerns.

Hex colors convert each byte to linear RGB with `(byte/255)^2.2`. The host clamps the final result and applies `linear^(1/2.2)` for opaque display. That fixed power curve is not exact piecewise sRGB. Strength is a color ratio, not alpha, measured light intensity or HDR exposure. CPU binary64 values do not certify GPU arithmetic, interpolation, framebuffer conversion or all-device parity.

## Keep definitions and calls bounded

| Bound | Contract |
| --- | --- |
| Source / tokens | At most 65,536 UTF-8 bytes and 4,096 tokens |
| Functions | At most eight total declarations, shared by float- and color-return functions |
| Uniforms / locals | At most 16 each; this source declares four uniforms and one local |
| Parameter | One finite ordered float interval with literal bounds within ±1000; no implicit clamp or default |
| Expanded work | At most 256 charged definition/expression nodes; depth and parse nesting at most 16 |
| Values | Finite literals within ±1000 and intermediate magnitude at most 1,000,000 |
| Profile coordinates | Repeating Engine UV only in this example; existing profiles keep their own coordinate permissions |
| CPU evaluation | Finite dimensionless UV tuple within ±1000; declared finite uniform overrides only |

The accepted final expression has 42 public node occurrences and depth 13. Those measurements describe the final expanded IR, not available compiler budget. Definition validation, unused definitions, argument parsing, body expansion and every full argument subtree substituted for a parameter reference all consume bounded work. Calling a function repeatedly does not create a cheap runtime reference or guarantee that another call fits.

Declarations preserve their original source ranges. Body errors refer to original body tokens; argument arity/type/range errors refer to the call name, and a return-type mismatch refers to the original declared result type. Full-source reconstruction applies these rules again before trusted lowering or binding. Function expansion does not change the material profile, schema version or uniform-layout contract.

## Refuse unsafe source without adopting it

| Candidate | Result |
| --- | --- |
| Replace the fragment call with `palette(2)` | Compiler `RANGE`: argument interval exceeds `[0,1]` |
| Change the ease body to `pow(t+phase,2)` | Compiler `TYPE`: the pure body cannot capture `phase` |
| Bind `strength:2` | Evaluator `UNIFORM`, with `MeshMaterialError` cause code `UNIFORM` |
| Pass a color to `ease`, omit an argument or supply two | `TYPE`: one float argument is required |
| Call an authored function within another authored body | `SYNTAX`; recursion and body chaining are unsupported |
| Add enough definitions or repeated argument expansions | `BUDGET` for the shared work or depth limit |

The first three are genuine selected refusals for this program. The accepted CPU sample's reference and value remained intact. A compiler refusal returns diagnostics and no new material. The caller owns candidate adoption: keep the accepted source, uniforms and data until compilation, reconstruction, binding and required presentation succeed.

The display uses an app-owned WebGL2 quad host, not a new package renderer. It inserts public reconstructed/lowered expression data into a fixed shader wrapper and supplies UV attributes, uniforms, explicit draws and clock updates. The host owns listeners, programs, buffers and cleanup. A source or uniform refusal preserves its accepted output while the context remains usable; context loss can prevent restoring pixels. Retain CPU source/material independently when recreating a view.

[Built-in function examples](./function-examples) · [Material language](./material-language) · [Neon plasma](./advanced-shader) · [CPU material evaluation](./cpu-material-evaluation)
