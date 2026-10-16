<script setup>
import MaterialBench from '../../.vitepress/components/MaterialBench.vue'
</script>

# GPU mesh material language

The material language computes the opaque fragment color of an admitted mesh. It accepts a small typed expression language and bounded scalar uniforms. Use the [live material example](/playground#gpu-material) to change the host-controlled blend and see the mesh color change.

This page describes `mesh-opaque-fragment-v0` for local experimental `@barocss/gpu` version0.0.0. The grammar is that of source snapshot `5f5ad866205a21510ac69552e704cc162fa253b5`; the drawing recipes use the WebGPU viewer of `c79d752cb3463a34e6c93cb64e3693bc493c271f`. The CPU compiler runs before a mesh adopts the result as a viewer shader material. The browser host needs WebGPU and a TypeScript-capable bundler for this local source package.

Read [CPU material evaluation](./cpu-material-evaluation) to inspect a compiled program with explicit uniform values and, for UV profiles, dimensionless coordinates. That guide states the newer API version and its three supported material families.

For authored `@fn` expressions, use [the reusable easing and palette guide](./reusable-shader) with its separate `363f583c` source profile. It adds bounded float/color-return declarations before locals; this page's older grammar, complete programs and public mesh contract retain their stated source snapshot.

Read [Discrete threshold selection](./discrete-material) for the separate newer `select()` profile. Its strict `<` comparison, equality branch and public CPU RGB evaluation use an application 2D canvas display; `bindingShader` and `materialShader` on this page do not accept that IR.

## Procedural UV plasma

The [advanced shader example](./advanced-shader) combines UV wrapping, domain distortion, interference waves and diagonal highlights. Edit the full shader, adjust four uniforms, or use its host Play/Pause controls. Its separate API version and example WebGL2 host are stated in the guide.

## Combine functions in a complete material

The [transition-window material](./composition-examples#material-transition-window) combines `clamp`, `smoothstep`, `rgb` and `mix` with one explicit uniform. Compare complete input, source-derived ratios and actual output images.

## Inspect the compilation stages

<MaterialBench />

This bench uses the same fixed `5f5ad866205a21510ac69552e704cc162fa253b5` public source profile as this guide. It runs ordinary `compileMeshMaterial`, explicitly calls `validateMeshMaterialIR`, then calls `lowerMeshMaterial`. It emits trusted GLSL **text**, without creating a viewer, evaluating color, executing GLSL or requesting a GPU device. The viewer itself draws the WGSL lowering (`lowerMeshMaterialWGSL`, used by `bindingShader` and `materialShader`).

The initial complete blend is compiled once on client mount. Try **unknown()** to obtain a real source-offset diagnostic: the entire last accepted compiled IR, reconstructed IR and GLSL stay unchanged. **Correct blend, default .5** adopts a new candidate in the same model. Across those three attempts the direct application call counts are compile **3**, validate **2**, lower **2**. Editing the draft and selecting Source / IR / Validated IR / GLSL make no API calls. The Source view shows the current draft; the other views show the last accepted result.

The public compiler deeply freezes its IR; validation reconstructs a fresh frozen IR. Reports copied for the application UI have separate ownership and are not themselves the public frozen values. Validation reparses source, and lowering invokes validation again. The displayed counters count only explicit application calls, not internal work, cache hits or measured latency. Final expression-tree statistics count expanded tree occurrences, including repeated subtrees; they are not parser allocation counts.

The static SVG is a topology aid, not a timing animation. Use Left/Right, Home/End within the stage tabs and Tab to leave the tablist. Reduced-motion removes the optional highlight transition. Server rendering provides the explanation and loading state; the real CPU model starts on the client. Browser keyboard/reduced-motion acceptance and a screenshot remain pending in the cloud delivery; source checks do not replace those observations.

## Complete blend material

```css
@shader #blend {
  @uniform amount: float(0,1,0);
  @let ratio: float(smoothstep(0,1,amount));
  @fragment {
    color: mix(#2060D0,#F09030,ratio);
  }
}
```

`amount` is a host-supplied scalar from0 to1 with default0. `ratio` is a float local. The output interpolates between blue and orange in linear color. At amount0, the shader uses the blue endpoint. At amount1, it uses the orange endpoint. At amount.5, `smoothstep(0,1,.5)` is .5. See the [image, mesh input and execution flow](./examples#host-controlled-material-blend).

This source creates no mesh. Compile the material before adding the mesh it colours. A refused compilation then changes nothing on screen. The host needs a range input such as `<input id="amount" type="range" min="0" max="1" step=".01" value="0">`:

```ts
import { compileMeshMaterial, validateMeshMaterialBinding, bindingShader } from '@barocss/gpu';
import type { Mesh } from '@barocss/gpu';

// source is the complete blend text above.
// mesh is what viewer.add returned in the CAD-to-mesh example.
declare const mesh: Mesh;
const compiled = compileMeshMaterial(source);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
const amountInput = document.querySelector<HTMLInputElement>('#amount');
if (!amountInput) throw new Error('Material amount input is missing');

// Throws MeshMaterialError (code UNIFORM) for an unknown or out-of-range value.
const shaderFor = (amount: number) =>
  bindingShader(validateMeshMaterialBinding({ material: compiled.material, uniforms: { amount } }));
// White: the viewer multiplies the shader's colour by the mesh colour.
mesh.material = { color: [1, 1, 1], shader: shaderFor(0) };

let acceptedAmount = 0;
amountInput.value = String(acceptedAmount);
function onAmountInput() {
  const amount = Number(amountInput!.value);
  try {
    mesh.material = { shader: shaderFor(amount) };
    acceptedAmount = amount;
  } catch (error) {
    console.error((error as Error).message);
    amountInput!.value = String(acceptedAmount);
  }
}
amountInput.addEventListener('input', onAmountInput);

function disposePreview() {
  amountInput!.removeEventListener('input', onAmountInput);
  mesh.material = { shader: null };
}
// Call disposePreview() when the host removes this control.
```

The same compiled material can be used with different in-range uniform values. A refused value throws before the mesh changes, so the accepted shader stays drawn; the host restores its input value rather than treating the candidate as accepted.

Assigning a new binding of the same material keeps the same WGSL, so the viewer reuses its compiled pipeline and only rewrites the material's 64 bytes of params on the next frame. Remove the named listener before disposing the viewer; viewer disposal does not remove caller-owned event listeners. `materialShader(source, { amount })` compiles, lowers and binds in one call, clamping params into their declared ranges instead of refusing them.

## Program structure

```text
program   = "@shader" shader-id "{" uniform* local* fragment "}"
uniform   = "@uniform" name ": float(" min "," max "," default ");"
local     = "@let" name ":" ("float" | "color") "(" expression ");"
fragment  = "@fragment { color:" color-expression "; }"
shader-id = "#" ASCII identifier, length1..64 without "#"
name      = ASCII identifier, length1..32
```

Uniforms must come first. Locals follow uniforms. The fragment block comes last. There is exactly one fragment color declaration and no text after the closing shader block. Keywords and names are case sensitive.

Shader IDs allow letters, digits, `_` and `-`, with a letter or `_` first. Uniform/local names allow letters, digits and `_`, with a letter or `_` first. They do not allow `-`. Shader IDs identify the material; they are not scene selectors.

Both `//` line comments and `/* ... */` comments are accepted. The compiler preserves diagnostic offsets into the original source. An unclosed comment is refused.

## Types

| Type | Sources | Valid operations |
| --- | --- | --- |
| `float` | Numeric literals, uniforms, float locals, scalar functions | Numeric operators and the scalar functions below |
| `color` | Hex colors, `rgb` literals, color locals, color `mix` | Final output and color `mix` |

Numeric literals must be finite and within `[-1000,1000]`. They can use decimals, signs and exponent notation. The compiler normalizes negative zero. It accepts `1`, `.5`, `-2` and `1e-3`.

Colors accept `#RGB`, `#RRGGBB` or three literal integer bytes in `rgb(r,g,b)`. `rgb(32,96,208)` equals `#2060D0`. There is no alpha channel. Colors are converted to linear channel values using `(byte / 255) ** 2.2`.

You cannot add a float to a color, multiply a color by a scalar or return a float as fragment color. Use `mix` for color interpolation.

## Uniforms and local definitions

```css
@shader #pulse {
  @uniform timeSeconds: float(0,2,0);
  @let phase: float(timeSeconds * 1.5707963267948966);
  @let ratio: float(sin(phase) * .5 + .5);
  @let cold: color(rgb(32,64,128));
  @let warm: color(#E08020);
  @fragment { color: mix(cold,warm,ratio); }
}
```

The uniform declaration is `float(min,max,default)`. It requires `min <= default <= max`. The host can omit a declared uniform from the binding; the compiler-declared default is then used. An unknown uniform name or out-of-range value is refused.

A local may refer to earlier locals and previously declared uniforms. It cannot refer forward to a later local. Local type must match its expression type. Names must be unique and cannot collide with a uniform. `sin`, `cos`, `mix`, `clamp`, `float` and `color` are reserved local names in this parser. Use descriptive names such as `phase` and `ratio`.

Locals are expanded into the final expression. They are not mutable variables, GPU buffers or execution steps. Repeated references charge the expanded expression budget. There are no assignments, loops, conditionals, imports or user-defined functions.

## Operators and precedence

| Operator | Operands | Meaning |
| --- | --- | --- |
| Unary `+`, `-` | One float | Sign |
| `*` | Two floats | Multiply |
| `/` | Float and signed numeric literal | Multiply by a checked literal reciprocal |
| `+`, `-` | Two floats | Add or subtract |
| `( ... )` | One expression | Explicit grouping |

Multiplication/division bind before addition/subtraction. Operators at the same precedence associate left to right. `a + b * 2` means `a + (b * 2)`.

Division is deliberately restricted. `amount / 2` is valid. `amount / -2` is valid. `amount / otherUniform`, `amount / (2)` and `amount / 0` are refused. The divisor reciprocal must be finite and have magnitude at most1000. Use a multiplication for a general admitted expression.

## Complete function reference

The source language supports the functions below. Several lower to the smaller IR vocabulary. The generated IR function names therefore do not enumerate all accepted source functions.

Use the [individual function examples](./function-examples) for complete material inputs, their amount values and expected results. These examples cover all11source functions, including the distinct cosine blend and explicit clamp threshold. Each material uses the admitted mesh path; the function language does not create geometry.

| Function | Arguments → result | Conditions |
| --- | --- | --- |
| `rgb(r,g,b)` | Three numeric literals → color | Integer bytes0..255; expressions and uniforms cannot be channels |
| `sin(x)` | float → float | Complete inferred argument range within±1000; radians |
| `cos(x)` | float → float | Complete inferred argument range within±1000; radians |
| `radians(x)` | float → float | Argument range within±1000 degrees; converts by π/180 |
| `pow(x,n)` | float, unsigned literal → float | `n` is an integer2..8; lowers to repeated multiplication |
| `abs(x)` | float → float | Argument range within±1000 |
| `min(a,b)` | float,float → float | Both ranges within±1000 |
| `max(a,b)` | float,float → float | Both ranges within±1000 |
| `clamp(x,lo,hi)` | float,float,float → float | The inferred upper bound of `lo` must not exceed the inferred lower bound of `hi` |
| `smoothstep(lo,hi,x)` | float,float,float → float | Signed literal edges, `lo < hi`, `1/(hi-lo) <= 1000`, input range within±1000 |
| `mix(a,b,t)` | color,color,float → color, or float,float,float → float | First two types match; complete ratio range lies within0..1 |

### Smoothstep and easing

```css
@shader #ease {
  @uniform amount: float(0,1,0);
  @let eased: float(smoothstep(.2,.8,amount));
  @fragment { color: mix(#2060D0,#F09030,eased); }
}
```

Below.2 the ratio is0. Above.8 the ratio is1. Between the edges the compiler expands the expression to the clamped polynomial `t*t*(3-2*t)`, where `t = clamp((amount-.2)/(.8-.2),0,1)`. Edges must be literal constants; a uniform edge is refused. A gap below.001 is refused by the reciprocal bound.

### Powers and scalar shaping

```css
@shader #shape {
  @uniform amount: float(0,1,0);
  @let squared: float(pow(amount,2));
  @let limited: float(min(max(squared,.1),.9));
  @fragment { color: mix(#2060D0,#F09030,limited); }
}
```

`pow` accepts a single unsigned numeric literal exponent whose value is an integer from2 to8. `pow(amount,2)` is valid. A uniform exponent, `pow(amount,-2)` or `pow(amount,1)` is refused. Repeated multiplication increases expression size and depth.

### Angle conversion and symmetric pulses

```css
@shader #angle {
  @uniform angleDegrees: float(-180,180,0);
  @let phase: float(radians(angleDegrees));
  @let ratio: float(abs(sin(phase)));
  @fragment { color: mix(#2060D0,#F09030,ratio); }
}
```

`sin` and `cos` use radians. `radians` performs the conversion. `abs` turns the admitted sine range `[-1,1]` into `[0,1]`, which is a valid `mix` ratio.

## Range analysis explains refusals

The compiler checks the entire declared uniform range. It does not validate only the default or the current host value. Arithmetic uses conservative interval bounds. Intermediate bounds must remain finite and within±1,000,000.

```css
@shader #refused {
  @uniform amount: float(-1,1,0);
  @fragment { color: mix(#2060D0,#F09030,amount); }
}
```

This shader is refused even when the host plans to bind amount0. The declared ratio may be negative. Change the range to0..1 or use `clamp(amount,0,1)`.

```css
@shader #accepted {
  @uniform amount: float(-1,1,0);
  @let ratio: float(clamp(amount,0,1));
  @fragment { color: mix(#2060D0,#F09030,ratio); }
}
```

The compiler's intervals can overestimate an expression because it does not preserve correlations between repeated terms. Rewrite an expression into a bounded admitted form if its inferred range is too broad. Do not widen the uniform range simply to bypass a host refusal.

## Compilation, IR validation and lowering

```ts
import {
  compileMeshMaterial,
  validateMeshMaterialIR,
  lowerMeshMaterial
} from '@barocss/gpu';

const compiled = compileMeshMaterial(`
@shader #blend {
  @uniform amount: float(0,1,0);
  @fragment { color: mix(#2060D0,#F09030,amount); }
}`);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));

const material = validateMeshMaterialIR(compiled.material);
const lowered = lowerMeshMaterial(material);
console.log(material.profile); // 'mesh-opaque-fragment-v0'
console.log(material.shaderId); // 'blend'
console.log(lowered.uniformLayout[0].glslName); // 'mat_u_0'
```

`compileMeshMaterial` returns frozen owned IR on success, or diagnostic data on failure. It does not call WebGL. `validateMeshMaterialIR` reconstructs the IR from its retained source and compares the entire canonical structure. Editing an expression field while retaining the original source causes validation failure.

`lowerMeshMaterial` validates first, then emits trusted fragment-expression text and a uniform layout. A declaration's order determines its generated name (`mat_u_0`, `mat_u_1`, and so on). Host bindings use original names such as `amount`, not generated GLSL names. Lowering alone draws nothing.

## Viewer adoption and lifetime

A shader material is part of a mesh's `Material`: `mesh.material = { shader }` merges it with the mesh's colour, roughness and the other fields. The base colour is the mesh colour times the colour map texel times the shader's colour, so set `color: [1, 1, 1]` to draw the material's own colour. The viewer lights that base colour unless the material is `unlit`. Edge lines are separate meshes (`topology: 'lines'`) and selection is `mesh.outline`, so both can coexist with a shader material.

```ts
const before = mesh.material.shader;
try {
  mesh.material = { shader: bindingShader(validateMeshMaterialBinding({
    material: compiled.material,
    uniforms: { amount: 2 } // declared maximum is1
  })) };
} catch (error) {
  console.log((error as Error).message);
  console.assert(mesh.material.shader === before); // The accepted material is still drawn.
}

mesh.material = { shader: null }; // Back to the plain colour.
```

`validateMeshMaterialBinding` checks the binding on the CPU; `bindingShader` lowers it to WGSL declarations, a colour expression and params. The viewer compiles a shader module the first time a WGSL text is drawn. A shader that fails to compile is reported through the viewer's `onError` (default `console.error`). A lost device is replaced by the viewer, which re-uploads the scene; `viewer.dispose()` ends the viewer lifetime.

There is no implicit timer, time uniform or animation loop. The host owns time and must bind it explicitly. Each assignment requests one frame; schedule repeated assignments yourself.

### Supply caller time on demand

This host recipe colours a mesh with a pulse material and draws a new time sample only when the user selects a button. Pass a host-owned `<button type="button">Sample elapsed time</button>` and a mesh that `viewer.add` returned. The mesh can come from the [complete CAD-to-mesh example](./examples#cad-surface-to-a-rendered-mesh).

```ts
import { compileMeshMaterial, validateMeshMaterialBinding, bindingShader } from '@barocss/gpu';
import type { Mesh } from '@barocss/gpu';

function pulseMesh(mesh: Mesh, sampleButton: HTMLButtonElement): () => void {
  const compiled = compileMeshMaterial(`
@shader #pulse {
  @uniform timeSeconds: float(0,2,0);
  @let ratio: float(sin(timeSeconds * 1.5707963267948966) * .5 + .5);
  @fragment { color: mix(#204080,#E08020,ratio); }
}`);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
  const shaderAt = (timeSeconds: number) =>
    bindingShader(validateMeshMaterialBinding({ material: compiled.material, uniforms: { timeSeconds } }));
  mesh.material = { color: [1, 1, 1], shader: shaderAt(0) };

  const startedAt = performance.now();
  let stopped = false;
  function onSampleTime() {
    if (stopped) return;
    const elapsedSeconds = (performance.now() - startedAt) / 1000;
    // Wrap elapsed time into [0,2), inside the declared inclusive [0,2].
    const timeSeconds = elapsedSeconds % 2;
    try { mesh.material = { shader: shaderAt(timeSeconds) }; }
    catch (error) { console.error((error as Error).message); }
  }
  sampleButton.addEventListener('click', onSampleTime);
  return function stopPulse() {
    if (stopped) return;
    stopped = true;
    sampleButton.removeEventListener('click', onSampleTime);
    mesh.material = { shader: null };
  };
}
// const stopPulse = pulseMesh(mesh, sampleButton);
// On host teardown: stopPulse(), then viewer.dispose() if the host owns the viewer.
```

For an elapsed time of5.25seconds, the supplied value is1.25. The host's modulo policy repeats a two-second interval; it does not extend the declared range. Passing5.25directly would be refused. This example schedules no automatic callback and makes no per-frame performance claim.

The returned cleanup removes the host listener and clears the shader material. A later failed time sample does not replace the accepted material. A lost device needs no action from the host: the viewer replaces it and redraws the accepted material. Compare the [interactive material example](./examples#host-controlled-material-blend) when adding controls to your own host.

## Diagnostics and budgets

| Code | Meaning | Example |
| --- | --- | --- |
| `SYNTAX` | Unsupported token/function or malformed structure | `color: unknown();` |
| `TYPE` | Wrong type, unresolved name or argument shape | Float fragment output |
| `RANGE` | Numeric value or inferred range outside its contract | `mix(...,amount)` with range-1..1 |
| `BUDGET` | Source, token, declaration or expanded expression budget | More than16 uniforms |
| `INPUT` | Invalid source/data shape | Foreign prototypes or accessor data during validation |
| `IR` | Retained source and supplied IR disagree | Modified expression without matching source |
| `UNIFORM` | Invalid runtime uniform binding | Unknown name or out-of-range value |

Compile diagnostics have `code`, `message`, `start` and `end`. Offsets refer to the original source. The compiler reports the first failure. IR/binding validation throws `MeshMaterialError` with one of these codes; `materialShader` returns `{ok:false,diagnostics}` for a source that does not compile.

| Boundary | Limit |
| --- | --- |
| UTF-8 source | 64KiB |
| Tokens | 4,096 |
| Uniforms / locals | 16 / 16 |
| Shader ID / uniform or local name | 64 / 32 ASCII characters |
| Literal magnitude | 1,000 |
| Intermediate interval magnitude | 1,000,000 |
| Definition plus expanded expression nodes | 256 |
| Expression depth / parser nesting | 16 / 16 |

Function expansion and local reuse consume these same node/depth budgets. A short source can exceed the budget if it repeats a large local expression.

## Supported boundary

This profile changes opaque fragment color. It has no arbitrary GLSL, texture sampling, UVs, alpha, discard, lighting-language blocks or vertex displacement. It does not apply to `showScene` objects, which take their scene colour. The CPU Engine material/texture binding types are a separate API.

Read the [material binding guide](./guides#bind-a-material-and-retain-accepted-state), [scene language](./language) and [examples](./examples) for this API profile.
