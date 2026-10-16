# Select a color at an exact threshold

[Open Discrete threshold palette](/examples/language#discrete-material), or use the [playground link](/playground#discrete-material). Change `level` across .5. The output switches palettes at the threshold; it does not blend continuously across that boundary. A pure color function chooses the palette, and a scalar local chooses its strength.

This example uses experimental `@barocss/gpu` version `0.0.0` at source profile `23321ac563f7ec5335d755239534d0a17da303d2`. The public compiler, complete-IR validator, GLSL text lowerer and CPU evaluator must come from that matching provider. The older [mesh material examples](./material-language) and [reusable UV shader](./reusable-shader) keep their stated providers. Source availability does not establish package publication.

The example needs a browser 2D canvas context to display its CPU results. It does not need WebGL2 or WebGPU. The lowered GLSL is available in the accepted report, but this host does not link or execute it.

![Actual CPU threshold palette: dark reference at .49 and light references/current color at .5 and .51](/examples/discrete-material.jpg)

The actual browser image uses default `level:.5`. Reference .49 displays sRGB8 `[9,19,28]`; references .5 and .51 and the current swatch display `[225,210,195]`. The application converts public CPU linear RGB into 2D canvas colors. This image shows no GL shader execution and supplies no bit-level pixel parity claim.

## Complete editable source

```css
@shader #threshold_palette {
  @uniform level: float(0,1,.5);
  @fn palette(t: float(0,1)): color(select(t,.5,#203040,#FFEEDD));
  @let strength: float(select(level,.5,.25,.75));
  @fragment { color: mix(#000000,palette(level),strength); }
}
```

Choose the example, then select **Run input** after editing the complete source. The `level` control has minimum 0, maximum 1, step .01 and initial value .5. Choose .49, .5 and .51 to inspect the two sides and equality. **Reset example** restores the original source and initial value.

The source declares a default .5. The example host also starts with an explicit .5 override. Later source edits retain the current explicit level. Changing a source default alone therefore does not change that override.

## Read the selection grammar

```text
select(value, threshold, below, otherwise)
```

`value` must be a float expression. `threshold` must be exactly one signed numeric literal, finite and within −1000..1000. A computed threshold such as `.5+.1`, a uniform reference or a parenthesized expression is not accepted in that position. Both branches must have the same float or color type.

Selection uses strict `value < threshold`. A value below the threshold chooses `below`. Equality chooses `otherwise`, as does a larger value. There is no tolerance band, interpolation or implicit `<=` comparison.

In `palette`, .49 chooses `#203040`; .5 and .51 choose `#FFEEDD`. The scalar `strength` uses the same comparison to choose .25 or .75. The final `mix` interpolates from black to the chosen palette color at that strength. Thus the boundary changes both the selected color and its strength.

Both branches must pass compilation, type, range and work checks, even if a constant selector makes one branch unreachable. Scalar branch intervals are joined; the declared function parameter interval must be safe for the whole body. At CPU evaluation time, the selector and literal threshold are evaluated once, then only the selected branch executes. Runtime branch selection does not skip source validation.

`select` is reserved as a uniform, local, function or function-parameter name in this discrete profile. It is not added to the older mesh or repeating-UV profiles. The name `step` is not a new built-in here.

## Use a pure function and a local

`palette` takes one bounded float parameter and returns a color. It can read `t` and literals in its body. It cannot capture `level`, UV inputs or another local. The caller passes the current level explicitly.

Declarations are ordered: uniforms, pure functions, locals, then the fragment. A pure function body cannot call another authored function, call itself or read resources. Caller expressions can compose already-declared pure functions within the existing bounds. This is the same bounded function model described in [Reuse an easing function and color palette](./reusable-shader); it has no runtime closure or hidden state.

The discrete material has no UV input, repeating `fract`, texture sampling, light input or clock. A changed color is a new caller-supplied uniform evaluation.

## Compile, reconstruct, lower and evaluate

Use the full source above as `source` in a TypeScript-capable consumer that resolves the matching public package entry:

```ts
import {
  compileDiscreteMeshMaterial,
  validateDiscreteMeshMaterialIR,
  lowerDiscreteMeshMaterial,
  evaluateDiscreteAuthoredMaterial,
  AuthoredMaterialEvaluationError,
} from '@barocss/gpu';

export function inspectThresholdPalette(source: string) {
  const compiled = compileDiscreteMeshMaterial(source);
  if (!compiled.ok) throw new Error(compiled.diagnostics[0].message);

  const material = validateDiscreteMeshMaterialIR(compiled.material);
  const lowered = lowerDiscreteMeshMaterial(material);
  const defaults = evaluateDiscreteAuthoredMaterial({ material, uniforms: {} });
  const references = [.49, .5, .51].map(level =>
    evaluateDiscreteAuthoredMaterial({ material, uniforms: { level } }),
  );

  let accepted = defaults;
  try {
    const candidate = evaluateDiscreteAuthoredMaterial({
      material, uniforms: { level: 2 },
    });
    accepted = candidate;
  } catch (error) {
    if (!(error instanceof AuthoredMaterialEvaluationError)) throw error;
    console.log(error.code); // UNIFORM; accepted still holds defaults.
  }
  return { material, lowered, defaults, references, accepted };
}
```

The compiler returns `{ok:true,material}` or `{ok:false,diagnostics}`. Its material is format `barocss-gpu-discrete-mesh-material`, version 0, profile `mesh-opaque-discrete-fragment-v0`. It retains the complete original source, shader ID, ordered uniforms and complete canonical expression.

`validateDiscreteMeshMaterialIR` copies own data, recompiles its retained source and compares the whole IR. A modified expression or profile does not become authority merely because it has the expected fields. `lowerDiscreteMeshMaterial` performs validation and returns `expression`, `uniformDeclarations` and `uniformLayout`. Selection lowers to a parenthesized GLSL ternary, with stable `mat_u_N` uniform names and final RGB clamping. It allocates no shader program.

`evaluateDiscreteAuthoredMaterial` accepts exactly `{material,uniforms}`. The uniform record is required; `{}` resolves declared defaults. No `uv` field is accepted. The returned sample retains source, reconstructed material and resolved uniforms alongside `linearRGB`. Its profile is `binary64-discrete-linear-rgb-v0`, version 0, color space `linear-rgb`.

## Compare actual numeric results with display swatches

| Level | Selected palette / strength | CPU linear RGB |
| --- | --- | --- |
| .49 | `#203040` / .25 | `[0.002599450573138822, 0.006342819226183646, 0.01194393838904266]` |
| .5 | `#FFEEDD` / .75 | `[0.75, 0.6443801772438993, 0.547439170014053]` |
| .51 | `#FFEEDD` / .75 | `[0.75, 0.6443801772438993, 0.547439170014053]` |

The table records the selected Node 22.22.0 CPU run. In the actual browser run, the blue output at .5/.51 was `0.5474391700140528`. The light literal's blue coefficient was `0.7299188933520705` in the browser and `0.7299188933520706` in Node. These last-bit differences remain separate observations. Both runs selected the same branches and the application displayed the same sRGB8 values. This does not establish bit equality between runtimes.

Material color literals use the existing coefficient rule `(byte/255)^2.2`. Black has zero channels, so the final `mix` multiplies the selected linear palette channels by .25 or .75. These independent values explain the equality jump.

The application displays three reference swatches and one current swatch. It converts each CPU channel `c` with the standard piecewise linear-RGB-to-sRGB transfer: `12.92*c` for `c ≤ .0031308`; otherwise `1.055*c^(1/2.4)−.055`. It then rounds `255*encoded` to an 8-bit channel. This display transfer does not change the compiler's historical literal coefficient rule. The full numeric result remains available beside the display.

Canvas swatches are a visualization of CPU values. They are not GPU pixels, lighting output, texture colors or a CPU/Float32 shader parity proof. Lowered GLSL text alone supplies no rendered frame.

## Keep accepted state after refusal

The example computes the compiled material, full reconstruction, lowered text, current sample and three reference samples before painting a staged canvas. It adopts the new report only after displaying that completed candidate. Public compilation or uniform refusals leave the previous accepted report and visible swatches in place.

Try replacing `select(t,.5,#203040,#FFEEDD)` with `select(t,.5,1,#FFEEDD)`: the branch types differ, so compilation returns `TYPE`. Try threshold `.5+.1`: compilation returns `SYNTAX` at the original unexpected token. The diagnostics retain original half-open UTF-16 ranges.

An override `level:2` produces `UNIFORM`. A valid source edit can also refuse a retained override: for example, declare `level:float(0,.4,.25)` while the current explicit level is .5. The host does not silently replace it with .25. It also evaluates the fixed .49/.5/.51 reference inputs against each candidate, so all three references must remain admitted. Keep their range valid to compare an edited threshold program.

Do not rename the example's `level` uniform while keeping its fixed level control. The public evaluator refuses an unknown override. A separate consumer can choose other declared uniform names.

## Copies, zero handling and bounded work

Compilation, reconstruction and evaluation return fresh, independent, recursively frozen data. They do not freeze caller inputs. Mutating a caller-owned uniform record after a call does not change the returned sample. Uniform −0 resolves to +0; the original source retains its spelling. CPU intermediate arithmetic follows Number operation order, and final clamped RGB zeros are canonical +0. Release references when finished. These CPU APIs have no GPU resource or `dispose()` method; the example controller's idempotent disposal stops further host updates.

The public source limits are 64KiB UTF-8, 4096 tokens, 256 definition/expanded work nodes, expression depth 16, 16 uniforms, 16 locals and 8 pure functions. Literal magnitude is at most 1000; admitted intermediate bounds are within ±1e6. This complete program has 12 final canonical nodes and depth 3. That final count does not replace the compiler's definition and reuse accounting.

Own-data validation admits bounded ordinary records and dense arrays: 8192 values, depth 24, arrays up to 256 entries and records up to 16 keys. Accessors, hidden or symbol fields, cycles, foreign prototypes and nonfinite values refuse. Complete IR and samples each have a 2MiB UTF-16/UTF-8 envelope; lowered expression and declaration strings each have 64KiB bounds, and the complete lowered output has a 128KiB bound.

Compiler diagnostics use `SYNTAX`, `TYPE`, `RANGE`, `BUDGET` or `INPUT`. IR validation can throw `IR`. Evaluation distinguishes `INPUT`, `PROFILE`, `MATERIAL`, `UNIFORM`, `NUMERICAL` and `BUDGET`; a genuine provider reconstruction budget error remains `BUDGET`, while other provider reconstruction failures are `MATERIAL` with their actual cause. A CPU failure supplies no partial sample to adopt.

[GPU examples](./examples) · [Material function gallery](./function-examples) · [CPU material evaluation](./cpu-material-evaluation)
