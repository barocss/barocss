# GPU mesh material language

The material language computes the opaque fragment color of an admitted mesh. It accepts a small typed expression language and bounded scalar uniforms. Use the [live material example](/playground#gpu-material) to change the host-controlled blend and see the mesh color change.

This page describes `mesh-opaque-fragment-v0` for local experimental `@barocss/gpu` version0.0.0 at source snapshot `5f5ad866205a21510ac69552e704cc162fa253b5`. The CPU compiler runs before the mesh renderer adopts the result. The browser host needs WebGL2 and a TypeScript-capable bundler for this local source package.

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

This source creates no mesh. Compile the material before mounting the admitted mesh. A refused compilation then allocates no renderer. The host needs a range input such as `<input id="amount" type="range" min="0" max="1" step=".01" value="0">`:

```ts
import { compileMeshMaterial, mountMesh } from '@barocss/gpu';

// source is the complete blend text above.
// canvas, packet and options come from the CAD-to-mesh example.
const compiled = compileMeshMaterial(source);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
const amountInput = document.querySelector<HTMLInputElement>('#amount');
if (!amountInput) throw new Error('Material amount input is missing');

const renderer = mountMesh(canvas, packet, options);

const adopted = renderer.setMaterial({
  material: compiled.material,
  uniforms: { amount: 0 }
});
if (!adopted.ok) {
  renderer.dispose(); // Initial setup did not complete.
  throw adopted.error;
}

let acceptedAmount = 0;
amountInput.value = String(acceptedAmount);
function onAmountInput() {
  const amount = Number(amountInput!.value);
  const changed = renderer.setMaterial({
    material: compiled.material,
    uniforms: { amount }
  });
  if (changed.ok) {
    acceptedAmount = amount;
  } else {
    console.error(changed.error.message);
    amountInput!.value = String(acceptedAmount);
  }
}
amountInput.addEventListener('input', onAmountInput);

function disposePreview() {
  amountInput!.removeEventListener('input', onAmountInput);
  renderer.dispose();
}
// Call disposePreview() when the host removes this view.
```

The same compiled material can be used with different in-range uniform values. A later refusal retains the accepted binding; the host restores its input value rather than treating the candidate as accepted. The handler reports errors, including context loss. After context loss, stop input handling and remount from retained data.

`setMaterial` restages a renderer candidate; this source snapshot does not expose a separate fast uniform-only setter. Remove the named listener before disposing the renderer. Renderer disposal does not remove caller-owned event listeners.

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

## Renderer adoption and lifetime

The mesh renderer requires an accepted nonempty mesh before material adoption. Clear edge overlays and face/object selection before setting a material. A material and those overlay/selection passes cannot coexist in this profile.

```ts
const before = renderer.material;
const refused = renderer.setMaterial({
  material: compiled.material,
  uniforms: { amount: 2 } // declared maximum is1
});
if (!refused.ok) console.log(refused.error.message);
// The previous accepted material remains active if the context is live.

const cleared = renderer.setMaterial(null);
if (!cleared.ok) throw cleared.error;
```

The renderer validates a binding, creates a candidate shader/resources, presents it, then adopts it and releases the previous resources. On refusal it releases candidate resources and attempts to present the accepted state. Context loss may prevent restoration. Mount a new renderer after context loss. Disposal ends the renderer lifetime.

The material getter returns a clone of accepted binding data. Mutating that clone does not change the live material. An accepted mesh update retains the current material. Clear the material with `setMaterial(null)` before adding an overlay or selection.

There is no implicit timer, time uniform or animation loop. The host owns time and must bind it explicitly. Repeated material adoption should be scheduled according to the actual renderer contract; do not infer a zero-cost per-frame uniform path.

### Supply caller time on demand

This host recipe creates a pulse preview and draws a new time sample only when the user selects a button. Pass a host-owned `<button type="button">Sample elapsed time</button>`, canvas and admitted mesh packet/options. The packet/options can come from the [complete CAD-to-mesh example](./examples#cad-surface-to-a-rendered-mesh).

```ts
import { compileMeshMaterial, mountMesh } from '@barocss/gpu';
import type { MeshOptions, PreviewPacket } from '@barocss/gpu';

function mountPulsePreview(
  canvas: HTMLCanvasElement,
  packet: PreviewPacket,
  options: MeshOptions,
  sampleButton: HTMLButtonElement
): () => void {
  const compiled = compileMeshMaterial(`
@shader #pulse {
  @uniform timeSeconds: float(0,2,0);
  @let ratio: float(sin(timeSeconds * 1.5707963267948966) * .5 + .5);
  @fragment { color: mix(#204080,#E08020,ratio); }
}`);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
  const renderer = mountMesh(canvas, packet, options);
  const initial = renderer.setMaterial({
    material: compiled.material, uniforms: { timeSeconds: 0 }
  });
  if (!initial.ok) {
    renderer.dispose();
    throw initial.error;
  }

  const startedAt = performance.now();
  let stopped = false;
  function onSampleTime() {
    if (stopped) return;
    const elapsedSeconds = (performance.now() - startedAt) / 1000;
    // Wrap elapsed time into [0,2), inside the declared inclusive [0,2].
    const timeSeconds = elapsedSeconds % 2;
    const changed = renderer.setMaterial({
      material: compiled.material, uniforms: { timeSeconds }
    });
    if (!changed.ok) console.error(changed.error.message);
  }
  sampleButton.addEventListener('click', onSampleTime);
  return function disposePulsePreview() {
    if (stopped) return;
    stopped = true;
    sampleButton.removeEventListener('click', onSampleTime);
    renderer.dispose();
  };
}
// Use a separate renderer lifecycle for this preview.
// const disposePulse = mountPulsePreview(canvas, packet, options, sampleButton);
// On host teardown: disposePulse();
```

For an elapsed time of5.25seconds, the supplied value is1.25. The host's modulo policy repeats a two-second interval; it does not extend the declared range. Passing5.25directly would be refused. This example schedules no automatic callback and makes no per-frame performance claim.

The returned cleanup removes the host listener before disposing GPU resources. A later failed time sample does not replace the accepted material binding. If the context is lost, call cleanup and remount. Compare the [interactive material example](./examples#host-controlled-material-blend) when adding controls to your own host.

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

Compile diagnostics have `code`, `message`, `start` and `end`. Offsets refer to the original source. The compiler reports the first failure. IR/binding validation can throw `MeshMaterialError`; `setMaterial` returns `{ok:false,error}` when adoption is refused.

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

This profile changes opaque fragment color. It has no arbitrary GLSL, texture sampling, UVs, alpha, discard, lighting-language blocks or vertex displacement. It does not apply to `mountScene` SDF objects. The CPU Engine material/texture binding types are a separate API and do not establish a general Engine renderer in this source snapshot.

Read the [public material signatures](./reference#declarations-0b26a7625574), [scene language](./language) and [examples](./examples) for this API profile.
