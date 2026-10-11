# Material function sample gallery

Choose an independent sample to inspect its full source and change its host input. All eleven supported source functions have one target sample. Each material computes an opaque mesh color from the scalar `amount`; it does not create geometry, read texture/UV data or start a clock.

The examples use public `compileMeshMaterial`, `validateMeshMaterialIR` and `lowerMeshMaterial` for local experimental `@barocss/gpu` version0.0.0 at source snapshot `5f5ad866205a21510ac69552e704cc162fa253b5`, profile `mesh-opaque-fragment-v0`. Several source functions expand to arithmetic or the smaller sin/cos/mix/clamp IR. The source function and its lowered form can therefore have different names.

These eleven original samples cover built-ins at that snapshot. For authored reusable functions, read [the separate `@fn` easing and palette guide](./reusable-shader) and [open its language example](/examples/language#reusable-shader). Its newer profile allows one bounded float parameter with a float or color result; it does not alter the complete programs below.

For a discontinuous decision, use [the separate `select()` palette example](./discrete-material) and [open its CPU language sample](/examples/language#discrete-material). It covers color and scalar branches, equality and retained uniform refusals without upgrading the eleven programs below.

## Run and interpret a sample

Use the Open sample links below to run a program in the browser. See [Use the interactive examples](/concepts/run-examples) for input selection, browser requirements and result interpretation. Each standalone program declares `amount:float(0,1,0)`. The shared host control has step .05 and initial value 0. Choose .5 and 1 to compare the midpoint and endpoint. Changes are explicit input adoption; there is no timer or per-frame performance promise.

The tables give the scalar ratio computed by each expression. The images show the rendered mesh at the displayed amount. Lighting and linear-color conversion affect its appearance: a ratio.5 pixel is not an arithmetic average of the two hex colors. Compilation computes material data; the mesh renderer draws its result.

The cold literal is `#2060D0` (rgb(32,96,208)) and the warm literal is `#F09030` (rgb(240,144,48)). Color literals convert each byte to a linear channel using `(byte/255)^2.2`. A ratio 0 chooses cold; ratio 1 chooses warm. Other values interpolate linear channels.

## Coverage map

| Target source function | Independent sample | Authored ratio at amount 0 / .5 / 1 |
| --- | --- | --- |
| `rgb` | [Open material-rgb](/playground#material-rgb) | 0 / 0.5 / 1 |
| `sin` | [Open material-sin](/playground#material-sin) | 0.5 / 0.5 / 0.5 |
| `cos` | [Open material-cos](/playground#material-cos) | 1 / 0 / 1 |
| `radians` | [Open material-radians](/playground#material-radians) | 0 / 0.5 / 1 |
| `pow` | [Open material-pow](/playground#material-pow) | 0 / 0.25 / 1 |
| `abs` | [Open material-abs](/playground#material-abs) | 1 / 0 / 1 |
| `min` | [Open material-min](/playground#material-min) | 0 / 0.5 / 0.6 |
| `max` | [Open material-max](/playground#material-max) | 0.4 / 0.5 / 1 |
| `clamp` | [Open material-clamp](/playground#material-clamp) | 0.25 / 0.5 / 0.75 |
| `smoothstep` | [Open material-smoothstep](/playground#material-smoothstep) | 0 / 0.5 / 1 |
| `mix` | [Open material-mix](/playground#material-mix) | 0.2 / 0.5 / 0.8 |

`mix` is also the common color helper for the other function samples. The dedicated mix sample additionally demonstrates the float overload. `rgb` is a literal color constructor; its sample's scalar ratio is the `amount` passed to the common color mix. The table describes the source functions and their color ratios.

## rgb — RGB bytes to linear color {#material-rgb}

[Open this sample](/playground#material-rgb). The target rgb calls admit only literal integer bytes. Their colors are then mixed using amount. rgb(32,96,208) equals #2060D0; rgb(240,144,48) equals #F09030.

```css
@shader #function_rgb {
  @uniform amount: float(0,1,0);
  @fragment { color: mix(rgb(32,96,208),rgb(240,144,48),amount); }
}
```

| amount | Expected scalar ratio |
| --- | --- |
| 0 | 0 |
| 0.5 | 0.5 |
| 1 | 1 |

Admitted ratio envelope: `0..1`. Scalar ratios describe the authored function; screen pixels also include actual mesh lighting and framebuffer conversion.

![Actual browser capture for the rgb material sample](/examples/material-rgb.png)

The material changes the color of the same CAD-derived mesh. Compare the displayed amount with the table, then change the amount in the playground. Geometry stays unchanged.

### Refused input

```css
@shader #refused_rgb {
  @uniform amount: float(0,1,0);
  @fragment { color: rgb(256,0,0); }
}
```

Expected compiler diagnostic: `RANGE`. A channel above 255 is outside the literal byte range. Compile the complete candidate before renderer adoption. A refused compiler result supplies no new material; keep the accepted one. A later binding/presentation refusal is a separate host result.

## sin — One explicit scalar cycle {#material-sin}

[Open this sample](/playground#material-sin). amount maps to an authored angle from 0 to2π radians. Remapping sin from[-1,1] to[0,1] admits a color mix. This is an input curve, not an automatic clock.

```css
@shader #function_sin {
  @uniform amount: float(0,1,0);
  @let ratio: float(sin(amount*6.283185307179586)*.5+.5);
  @fragment { color: mix(#2060D0,#F09030,ratio); }
}
```

| amount | Expected scalar ratio |
| --- | --- |
| 0 | 0.5 |
| 0.25 | 1 |
| 0.5 | 0.5 |
| 0.75 | 0 |
| 1 | 0.5 |

Admitted ratio envelope: `0..1`. Trigonometric entries are approximate mathematical values; do not assert bitwise shader equality.

![Actual browser capture for the sin material sample](/examples/material-sin.png)

The material changes the color of the same CAD-derived mesh. Compare the displayed amount with the table, then change the amount in the playground. Geometry stays unchanged.

### Refused input

```css
@shader #refused_sin {
  @uniform amount: float(0,1,0);
  @fragment { color: mix(#2060D0,#F09030,sin(#FFF)); }
}
```

Expected compiler diagnostic: `TYPE`. sin requires a float argument, not a color. Compile the complete candidate before renderer adoption. A refused compiler result supplies no new material; keep the accepted one. A later binding/presentation refusal is a separate host result.

## cos — Start at the warm endpoint {#material-cos}

[Open this sample](/playground#material-cos). The same authored0..2π angle starts at the cosine peak. amount 0 and1 give the warm endpoint; amount .5 gives the cold endpoint.

```css
@shader #function_cos {
  @uniform amount: float(0,1,0);
  @let ratio: float(cos(amount*6.283185307179586)*.5+.5);
  @fragment { color: mix(#2060D0,#F09030,ratio); }
}
```

| amount | Expected scalar ratio |
| --- | --- |
| 0 | 1 |
| 0.25 | 0.5 |
| 0.5 | 0 |
| 0.75 | 0.5 |
| 1 | 1 |

Admitted ratio envelope: `0..1`. Trigonometric entries are approximate mathematical values; do not assert bitwise shader equality.

![Actual browser capture for the cos material sample](/examples/material-cos.png)

The material changes the color of the same CAD-derived mesh. Compare the displayed amount with the table, then change the amount in the playground. Geometry stays unchanged.

### Refused input

```css
@shader #refused_cos {
  @uniform amount: float(0,1,0);
  @fragment { color: mix(#2060D0,#F09030,cos(1000*2)); }
}
```

Expected compiler diagnostic: `RANGE`. The inferred argument 2000 exceeds the ±1000-radian function limit. Compile the complete candidate before renderer adoption. A refused compiler result supplies no new material; keep the accepted one. A later binding/presentation refusal is a separate host result.

## radians — Normalize a half turn {#material-radians}

[Open this sample](/playground#material-radians). amount 0..1 represents0..180 degrees. radians converts that angle to0..π; division by the admitted nonzero literalπ normalizes the mix ratio. The final clamp retains the declared0..1 envelope.

```css
@shader #function_radians {
  @uniform amount: float(0,1,0);
  @let ratio: float(clamp(radians(amount*180)/3.141592653589793,0,1));
  @fragment { color: mix(#2060D0,#F09030,ratio); }
}
```

| amount | Expected scalar ratio |
| --- | --- |
| 0 | 0 |
| 0.5 | 0.5 |
| 1 | 1 |

Admitted ratio envelope: `0..1`. Trigonometric entries are approximate mathematical values; do not assert bitwise shader equality.

![Actual browser capture for the radians material sample](/examples/material-radians.png)

The material changes the color of the same CAD-derived mesh. Compare the displayed amount with the table, then change the amount in the playground. Geometry stays unchanged.

### Refused input

```css
@shader #refused_radians {
  @uniform amount: float(0,1,0);
  @fragment { color: mix(#2060D0,#F09030,radians(1000*2)); }
}
```

Expected compiler diagnostic: `RANGE`. The inferred argument 2000 exceeds the ±1000-degree conversion limit. Compile the complete candidate before renderer adoption. A refused compiler result supplies no new material; keep the accepted one. A later binding/presentation refusal is a separate host result.

## pow — Square an admitted amount {#material-pow}

[Open this sample](/playground#material-pow). The unsigned literal exponent 2 lowers to repeated multiplication. Half input gives quarter ratio, so the response begins more slowly than the linear palette.

```css
@shader #function_pow {
  @uniform amount: float(0,1,0);
  @let ratio: float(pow(amount,2));
  @fragment { color: mix(#2060D0,#F09030,ratio); }
}
```

| amount | Expected scalar ratio |
| --- | --- |
| 0 | 0 |
| 0.5 | 0.25 |
| 1 | 1 |

Admitted ratio envelope: `0..1`. Scalar ratios describe the authored function; screen pixels also include actual mesh lighting and framebuffer conversion.

![Actual browser capture for the pow material sample](/examples/material-pow.png)

The material changes the color of the same CAD-derived mesh. Compare the displayed amount with the table, then change the amount in the playground. Geometry stays unchanged.

### Refused input

```css
@shader #refused_pow {
  @uniform amount: float(0,1,0);
  @fragment { color: mix(#2060D0,#F09030,pow(amount,1)); }
}
```

Expected compiler diagnostic: `RANGE`. The exponent must be an unsigned integer literal from 2 through 8. Compile the complete candidate before renderer adoption. A refused compiler result supplies no new material; keep the accepted one. A later binding/presentation refusal is a separate host result.

## abs — Cold center and warm ends {#material-abs}

[Open this sample](/playground#material-abs). The authored input first maps to[-1,1]. abs returns its magnitude; the midpoint is zero and both endpoints are one. This does not introduce an exact-distance field or a geometry operation.

```css
@shader #function_abs {
  @uniform amount: float(0,1,0);
  @let ratio: float(abs(amount*2-1));
  @fragment { color: mix(#2060D0,#F09030,ratio); }
}
```

| amount | Expected scalar ratio |
| --- | --- |
| 0 | 1 |
| 0.5 | 0 |
| 1 | 1 |

Admitted ratio envelope: `0..1`. Scalar ratios describe the authored function; screen pixels also include actual mesh lighting and framebuffer conversion.

![Actual browser capture for the abs material sample](/examples/material-abs.png)

The material changes the color of the same CAD-derived mesh. Compare the displayed amount with the table, then change the amount in the playground. Geometry stays unchanged.

### Refused input

```css
@shader #refused_abs {
  @uniform amount: float(0,1,0);
  @fragment { color: mix(#2060D0,#F09030,abs(1000*2)); }
}
```

Expected compiler diagnostic: `RANGE`. abs refuses an inferred argument outside±1000. Compile the complete candidate before renderer adoption. A refused compiler result supplies no new material; keep the accepted one. A later binding/presentation refusal is a separate host result.

## min — Stop at sixty percent {#material-min}

[Open this sample](/playground#material-min). min takes the smaller scalar. Inputs above .6 keep ratio .6 rather than reaching the warm endpoint. This is a scalar upper cap, not a shader conditional.

```css
@shader #function_min {
  @uniform amount: float(0,1,0);
  @let ratio: float(min(amount,.6));
  @fragment { color: mix(#2060D0,#F09030,ratio); }
}
```

| amount | Expected scalar ratio |
| --- | --- |
| 0 | 0 |
| 0.5 | 0.5 |
| 1 | 0.6 |

Admitted ratio envelope: `0..0.6`. Scalar ratios describe the authored function; screen pixels also include actual mesh lighting and framebuffer conversion.

![Actual browser capture for the min material sample](/examples/material-min.png)

The material changes the color of the same CAD-derived mesh. Compare the displayed amount with the table, then change the amount in the playground. Geometry stays unchanged.

### Refused input

```css
@shader #refused_min {
  @uniform amount: float(0,1,0);
  @fragment { color: mix(#2060D0,#F09030,min(1000*2,0)); }
}
```

Expected compiler diagnostic: `RANGE`. Both inferred min argument ranges must remain within±1000. Compile the complete candidate before renderer adoption. A refused compiler result supplies no new material; keep the accepted one. A later binding/presentation refusal is a separate host result.

## max — Start at forty percent {#material-max}

[Open this sample](/playground#material-max). max takes the larger scalar. Inputs below .4 keep ratio .4; the cold endpoint is unreachable with this admitted input range.

```css
@shader #function_max {
  @uniform amount: float(0,1,0);
  @let ratio: float(max(amount,.4));
  @fragment { color: mix(#2060D0,#F09030,ratio); }
}
```

| amount | Expected scalar ratio |
| --- | --- |
| 0 | 0.4 |
| 0.5 | 0.5 |
| 1 | 1 |

Admitted ratio envelope: `0.4..1`. Scalar ratios describe the authored function; screen pixels also include actual mesh lighting and framebuffer conversion.

![Actual browser capture for the max material sample](/examples/material-max.png)

The material changes the color of the same CAD-derived mesh. Compare the displayed amount with the table, then change the amount in the playground. Geometry stays unchanged.

### Refused input

```css
@shader #refused_max {
  @uniform amount: float(0,1,0);
  @fragment { color: mix(#2060D0,#F09030,max(1000*2,0)); }
}
```

Expected compiler diagnostic: `RANGE`. Both inferred max argument ranges must remain within±1000. Compile the complete candidate before renderer adoption. A refused compiler result supplies no new material; keep the accepted one. A later binding/presentation refusal is a separate host result.

## clamp — Keep quarter-to-three-quarter color {#material-clamp}

[Open this sample](/playground#material-clamp). The scalar stays within the explicit ordered limits. Neither source endpoint color is reached: amount 0 produces ratio.25 and amount 1 produces ratio.75.

```css
@shader #function_clamp {
  @uniform amount: float(0,1,0);
  @let ratio: float(clamp(amount,.25,.75));
  @fragment { color: mix(#2060D0,#F09030,ratio); }
}
```

| amount | Expected scalar ratio |
| --- | --- |
| 0 | 0.25 |
| 0.5 | 0.5 |
| 1 | 0.75 |

Admitted ratio envelope: `0.25..0.75`. Scalar ratios describe the authored function; screen pixels also include actual mesh lighting and framebuffer conversion.

![Actual browser capture for the clamp material sample](/examples/material-clamp.png)

The material changes the color of the same CAD-derived mesh. Compare the displayed amount with the table, then change the amount in the playground. Geometry stays unchanged.

### Refused input

```css
@shader #refused_clamp {
  @uniform amount: float(0,1,0);
  @fragment { color: mix(#2060D0,#F09030,clamp(amount,1,0)); }
}
```

Expected compiler diagnostic: `RANGE`. The lower inferred bound cannot exceed the upper inferred bound. Compile the complete candidate before renderer adoption. A refused compiler result supplies no new material; keep the accepted one. A later binding/presentation refusal is a separate host result.

## smoothstep — Literal edges and flat endpoints {#material-smoothstep}

[Open this sample](/playground#material-smoothstep). The literal edges .2 and .8 normalize and clamp the input before the t*t*(3-2*t) polynomial. The response stays at zero below .2 and at one above .8.

```css
@shader #function_smoothstep {
  @uniform amount: float(0,1,0);
  @let ratio: float(smoothstep(.2,.8,amount));
  @fragment { color: mix(#2060D0,#F09030,ratio); }
}
```

| amount | Expected scalar ratio |
| --- | --- |
| 0 | 0 |
| 0.2 | 0 |
| 0.5 | 0.5 |
| 0.8 | 1 |
| 1 | 1 |

Admitted ratio envelope: `0..1`. Scalar ratios describe the authored function; screen pixels also include actual mesh lighting and framebuffer conversion.

![Actual browser capture for the smoothstep material sample](/examples/material-smoothstep.png)

The material changes the color of the same CAD-derived mesh. Compare the displayed amount with the table, then change the amount in the playground. Geometry stays unchanged.

### Refused input

```css
@shader #refused_smoothstep {
  @uniform amount: float(0,1,0);
  @fragment { color: mix(#2060D0,#F09030,smoothstep(.5,.5,amount)); }
}
```

Expected compiler diagnostic: `RANGE`. Edges must be ordered with reciprocal 1/(hi-lo) at most 1000; equal edges refuse. Compile the complete candidate before renderer adoption. A refused compiler result supplies no new material; keep the accepted one. A later binding/presentation refusal is a separate host result.

## mix — Inset endpoints using both overloads {#material-mix}

[Open this sample](/playground#material-mix). The target float mix interpolates constants .2 and .8 into a scalar ratio. The fragment then uses the color mix overload. This example deliberately stays inside the full color-mix0..1 contract.

```css
@shader #function_mix {
  @uniform amount: float(0,1,0);
  @let ratio: float(mix(.2,.8,amount));
  @fragment { color: mix(#2060D0,#F09030,ratio); }
}
```

| amount | Expected scalar ratio |
| --- | --- |
| 0 | 0.2 |
| 0.5 | 0.5 |
| 1 | 0.8 |

Admitted ratio envelope: `0.2..0.8`. Scalar ratios describe the authored function; screen pixels also include actual mesh lighting and framebuffer conversion.

![Actual browser capture for the mix material sample](/examples/material-mix.png)

The material changes the color of the same CAD-derived mesh. Compare the displayed amount with the table, then change the amount in the playground. Geometry stays unchanged.

### Refused input

```css
@shader #refused_mix {
  @uniform amount: float(0,1,0);
  @fragment { color: mix(#2060D0,#F09030,-.1); }
}
```

Expected compiler diagnostic: `RANGE`. A color mix ratio with inferred value -.1 is outside0..1. Compile the complete candidate before renderer adoption. A refused compiler result supplies no new material; keep the accepted one. A later binding/presentation refusal is a separate host result.

## Compiler, lowering and host lifetime

`compileMeshMaterial(source)` returns an ok/material or diagnostics result. Validate its returned material with `validateMeshMaterialIR`; `lowerMeshMaterial` reconstructs/validates before emitting trusted expression text and uniform layout. These CPU operations allocate no canvas or renderer. Host bindings use the declared name `amount`, not the generated `mat_u_0` name.

Compile before mounting an admitted mesh. If initial material adoption fails after mount, dispose that candidate renderer. Later rejected edits keep the accepted binding under the renderer's actual update result. The host owns listeners, the control, source editing and renderer lifetime. Remove listeners before disposal; context loss and restoration must use the supported recovery path.

The compiler admits the complete declared input interval. It does not accept an unsafe source merely because the host currently binds amount 0. Float mix can infer a wider interval through its arithmetic expansion; the dedicated constant-endpoint sample keeps that expansion safe. A general float mixture of varying inputs can require an explicit final clamp before color mix.

These eleven programs cover the current source-function set only. They do not extend types, variables, alpha output, loops, user-defined functions, texture access or material publication. Read [material grammar and bounds](./material-language), [GPU examples](./examples), [public API](./api) and [limits](./limits) when adapting a sample.
