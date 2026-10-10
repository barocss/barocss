# Evaluate authored material color on the CPU

Use `evaluateAuthoredMaterial` to inspect a material's color at a chosen uniform value and, where required, a UV coordinate. It returns authored linear RGB through JavaScript binary64 arithmetic. It needs no canvas, DOM or WebGL context.

This API is available from local provider `7e96b959746a3fee957644fd1b5ccaf79c992c6c` for `@barocss/gpu` version `0.0.0`. It is newer than the portal's earlier `5f5ad866205a21510ac69552e704cc162fa253b5` material examples. Use this matching source package with a TypeScript-capable bundler, or its matching compiled public build. Package availability does not establish npm publication.

## Choose the material family

All three families use version0. Compile the complete shader source with the matching compiler before evaluating its result.

| Compiler | Material profile | Evaluation UV |
| --- | --- | --- |
| `compileMeshMaterial` | `mesh-opaque-fragment-v0` | Omit it; even an explicit `uv: undefined` is refused |
| `compileEngineUVMaterial` | `engine-opaque-uv-fragment-v0` | Required `[u,v]`; source can read `uv_u` and `uv_v` |
| `compileEngineUVRepeatingMaterial` | `engine-opaque-uv-repeating-fragment-v0` | Required `[u,v]`; also supports `fract` |

The shader computes a color, not geometry. These names identify material formats; they do not mount an Engine renderer.

## Evaluate a mesh material with uniform defaults

```ts
import { compileMeshMaterial, evaluateAuthoredMaterial } from '@barocss/gpu';

const compiled = compileMeshMaterial(`
@shader #gain {
  @uniform gain: float(0,1,.25);
  @fragment { color: mix(#000000,#FFFFFF,gain); }
}`);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));

const defaults = evaluateAuthoredMaterial({
  material: compiled.material,
  uniforms: {}
});
const override = evaluateAuthoredMaterial({
  material: compiled.material,
  uniforms: { gain: .75 }
});
console.log(defaults.linearRGB); // [.25,.25,.25]
console.log(override.linearRGB); // [.75,.75,.75]
console.log(defaults.uv);        // null
```

`uniforms` is required. An empty record selects declared defaults. Overrides must use declared names and finite values inside each declared range. Changing a binding does not change the compiled source or create a clock.

## Evaluate an explicit UV coordinate

```ts
import { compileEngineUVMaterial, evaluateAuthoredMaterial } from '@barocss/gpu';

const compiled = compileEngineUVMaterial(`
@shader #vertical {
  @fragment { color: mix(#000000,#FFFFFF,clamp(uv_v,0,1)); }
}`);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));

const sample = evaluateAuthoredMaterial({
  material: compiled.material,
  uniforms: {},
  uv: [-0,.25]
});
console.log(sample.linearRGB);       // [.25,.25,.25]
console.log(Object.is(sample.uv?.[0], -0)); // true
```

UV is a dimensionless input, not a texture lookup. Supply a dense two-element array with finite coordinates in `[-1000,1000]`. UV is required even when the source does not read it. This profile does not imply texture data, lighting or a relation to CAD parameters.

## Evaluate a repeating coordinate with a phase

```ts
import {
  compileEngineUVRepeatingMaterial,
  evaluateAuthoredMaterial
} from '@barocss/gpu';

const compiled = compileEngineUVRepeatingMaterial(`
@shader #phase {
  @uniform phase: float(-1,1,0);
  @let ratio: float(fract(clamp(uv_u,-999,999)+phase));
  @fragment { color: mix(#000000,#FFFFFF,ratio); }
}`);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));

const defaults = evaluateAuthoredMaterial({
  material: compiled.material, uniforms: {}, uv: [-.25,0]
});
const shifted = evaluateAuthoredMaterial({
  material: compiled.material, uniforms: { phase: .5 }, uv: [-.25,0]
});
console.log(defaults.linearRGB); // [.75,.75,.75]
console.log(shifted.linearRGB);  // [.25,.25,.25]

const zero = evaluateAuthoredMaterial({
  material: compiled.material, uniforms: { phase: -0 }, uv: [-0,-0]
});
console.log(Object.is(zero.uv?.[0], -0));   // true
console.log(Object.is(zero.uv?.[1], -0));   // true
console.log(Object.is(zero.uniforms.phase, 0)); // true: resolved +0
console.log(Object.is(zero.linearRGB[0], 0));  // true: final +0
```

`fract(x)` is `x - floor(x)`. Thus `fract(-.25)` is`.75`, while `fract(-.25+.5)` is`.25`.

The clamp leaves room for the complete phase range. `fract(uv_u+phase)` is refused during compilation because its inferred input range reaches±1001. Passing a small UV later does not make that source safe. The compiler checks the entire declared interval.

![CPU evaluation values for the authored repeating material](/examples/cpu-material-evaluation.svg)

This diagram shows numeric CPU channel values. It is not a gamma-converted color swatch or an image rendered by the GPU. Hex colors convert to linear channels with `(byte/255)^2.2`; a linear value`.25` is not an instruction to use RGB byte64 on screen.

## Read the returned sample

The exact public function is `evaluateAuthoredMaterial(input: unknown): AuthoredMaterialSample`. `AuthoredMaterialRequest` describes the valid request union shown above. Success returns these ten fields:

| Field | Meaning |
| --- | --- |
| `format` | `barocss-gpu-authored-material-sample` |
| `version` | 0 |
| `profile` | `binary64-linear-rgb-v0` |
| `colorSpace` | `linear-rgb` |
| `uvUnit` | `dimensionless` |
| `source` | Retained complete shader text |
| `material` | Independently reconstructed canonical material |
| `uniforms` | Resolved declared defaults and overrides |
| `uv` | Copied coordinate tuple, or `null` for mesh materials |
| `linearRGB` | Three final channel values in `[0,1]` |

The evaluator reconstructs the material from its retained source through the family's binder. Supplied expression fields cannot replace that authority. It evaluates canonical operations in their recorded order, then clamps final RGB. It applies no lighting, gamma, alpha, texture or GPU Float32 conversion.

Every call returns fresh copied data. The complete sample, including nested material, uniforms, UV and RGB, is deeply frozen. Caller mutation does not change it. Create a new request to inspect a new value. CPU data uses garbage collection; there is no `dispose()` method, cache or implicit renderer adoption. This API adds no public sample-file codec.

## Handle a refused request

`AuthoredMaterialEvaluationError` exposes `code`, a message of at most1024characters and the actual `cause` when present. Catch this error separately from compiler diagnostics:

```ts
import { AuthoredMaterialEvaluationError, evaluateAuthoredMaterial } from '@barocss/gpu';
import type { AuthoredMaterialRequest } from '@barocss/gpu';

function createMaterialInspector(initialRequest: AuthoredMaterialRequest) {
  let accepted = evaluateAuthoredMaterial(initialRequest);
  return (candidate: unknown) => {
    try {
      accepted = evaluateAuthoredMaterial(candidate);
    } catch (error) {
      if (!(error instanceof AuthoredMaterialEvaluationError)) throw error;
      console.error(error.code, error.message, error.cause);
    }
    return accepted;
  };
}
```

Supply a complete valid request from one of the examples to `createMaterialInspector`. With the repeating material above, a candidate `phase:2` exceeds its declared range and produces `UNIFORM`. A refused request returns no partial sample. Assignment after success keeps the previous accepted sample intact.

| Code | Typical cause |
| --- | --- |
| `INPUT` | Wrong outer record, extra fields, accessors or hidden request fields |
| `PROFILE` | Unsupported material format, profile or version |
| `MATERIAL` | Material data fails source reconstruction or binding validation |
| `UNIFORM` | Unknown/out-of-range override or unsafe own `__proto__` name |
| `UV` | Missing/extra UV, wrong tuple shape or out-of-range coordinate |
| `BUDGET` | Inherited material admission or expression traversal limit |
| `NUMERICAL` | Invalid canonical value or nonfinite/excess intermediate |

Use ordinary own data. Sparse arrays, getters, hidden fields and foreign prototypes are refused at their applicable boundaries. Reflection errors retain a cause; proxy traps have no side-effect guarantee. An inherited error does not necessarily include usable source offsets.

## Limits and precision

Canonical traversal admits at most256node occurrences and depth16. Intermediate magnitude must remain at most1,000,000. Material admission retains its source64KiB, tokens4096, uniforms16, locals16 and expanded-expression budgets. Its own-data snapshots independently admit8192visits and depth24, with dense arrays at most256elements.

The sample is an authored binary64 result. It does not certify GPU precision, rendered pixels, device equivalence or a rendering backend. Read the [material language](./material-language), [function examples](./function-examples) and [public API](./api) to connect these inputs with the separate rendering lifecycle.
