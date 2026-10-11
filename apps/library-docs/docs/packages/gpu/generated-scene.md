# Generate a scene with typed inputs

[Open Generated scene](/examples/language#generated-scene) to edit typed parameters, two repeated studs and a conditional marker. The [playground link](/playground#generated-scene) opens the same complete input. The application draws diagnostic boxes from the selected coefficients; it does not execute the compiled shader text.

![Five selected Scene2 records displayed as application diagnostic boxes](/examples/generated-scene.jpg)

The actual image shows the three-stud variant with the marker included: one plate and four sphere records produce five diagnostic boxes. Sphere boxes use ±radius local corners. This is an application Canvas2D wireframe, not primitive surfaces, shader output or a GPU-rendered scene.

This guide uses experimental `@barocss/gpu` version `0.0.0` at fixed source profile `4dcb0ebb67ac25f94a9f9e0b84d921f54ab468e8`. Its public entry is `compileGeneratedAffineSceneSource`, with profile `source2-typed-mixed-generation-v0`. Use the matching TypeScript-capable consumer. The older [scene language](./language) and [composition examples](./composition-examples) keep their separate `5f5ad866` Source0/1 scope. Source availability does not establish publication or renderer admission.

## Complete Source2 input

```css
/* 설계 π 😀: authored repeats and conditions; preserve CRLF. */
@scene generated_plate {
  version:2;
  background:#102030;
  @param used:length(2scene);
  @param limit:length(3scene);
  @param gain:scalar(.15);
  box #plate;
  @repeat studs:sphere(2);
  @when marker:sphere($used < $limit);
}
box {
  color:#294560;
  size:6 .5 3;
  translate:0 -.6 0;
}
sphere {
  color:#42C8D5;
  radius:calc($limit * $gain);
  translate:-0 0 0;
}
#studs_0 { translate:-2 -0 0; }
#studs_1 { translate:2 0 0; }
#marker_0 {
  color:#F6C453;
  translate:0 1.5 0;
}
```

The actual input retains CRLF and its Unicode comment. `version:2` selects the authored source dialect inside this new compiler entry. There is no `length-unit` header. Length parameters use `scene`; they are not native CAD millimetres.

`plate` is explicit. `studs` declares two generated spheres. `marker` declares one potential sphere whose inclusion depends on two length values. Shared sphere styling supplies a radius of `limit * gain`, approximately .45 scene units. In binary64, `3 * .15` is `0.44999999999999996`. ID rules place the two studs at X=−2 and X=2; the gold marker is at Y=1.5.

## Read the three declaration forms

```text
@param name: length(numberScene);
@param name: scalar(number);
@param name: angle(numberDeg);
@repeat prefix:shape(positiveInteger);
@when prefix:shape($left < $right);
```

The suffixes are literal units: for example `length(2scene)` and `angle(15deg)`. Scalar has no suffix. Parameter initializers are single bounded literals, not shader uniforms or arbitrary expressions. Parameters precede explicit objects, repeats and conditions.

A style reference `$name` must match the quantity required by that field. The radius expression `calc($limit * $gain)` multiplies a length by a scalar and therefore produces a length. This profile also admits bounded flat arithmetic between parameter references. It is not JavaScript and has no nested general expression language or runtime clock.

A repeat count is a canonical positive decimal literal 1..32. It is not a parameter, computed count, loop body or index variable. Every generated object receives the same type rules unless an ID rule overrides a property. The prefix creates `studs_0`, `studs_1`, and so on; it does not position them automatically.

A condition compares exactly two parameter references with the same quantity. Only strict `<` is supported, with whitespace or comments on both sides. Equality is false. There is no else branch, nested condition or runtime boolean. The decision is made when the whole source is compiled.

## Follow the complete edit sequence

| Step | Source edit | Selected IDs expected from this input |
| --- | --- | --- |
| Initial | `used:length(2scene)` and two studs | `plate`, `studs_0`, `studs_1`, `marker_0` |
| Exclude marker | Set used to `3scene`, equal to limit | `plate`, `studs_0`, `studs_1` |
| Include marker | Restore used to `2scene` | The original four IDs |
| Add a stud | Change literal repeat count 2→3 | `plate`, `studs_0`, `studs_1`, `studs_2`, `marker_0` |

Choose **Exclude marker · used = limit**, **Include marker · used < limit**, then **Use three studs**. These controls edit the current public AST's literal tokens and recompile the complete source. Their labels describe the starting `limit:3scene`; the first two actions set used to 3scene or 2scene. If you edit limit, inspect the actual comparison rather than assuming a button forces true or false.

The third stud inherits `sphere { translate:-0 0 0; }`, so it appears at the common origin in the diagnostic view. There is no implicit spacing formula. Keep the existing ID rules to retain the first two positions. Changing the repeat count does not renumber them.

Try changing gain from `.15` to `.1`: every sphere's radius becomes approximately .3 scene units. This is a compile-time parameter edit. The selected object count stays governed by the repeat and predicate, not by the radius.

### Actual selected observations

The CPU source flow and recorded development-browser example admitted the initial four IDs, with sphere radius `0.44999999999999996`. Equality excluded only `marker_0`, leaving three selected objects and a false decision while preserving its authored `#marker_0` rule. Including the marker restored the complete original source. Repeat count 3 added `studs_2` at `[0,0,0]`, giving five selected IDs with the marker included.

A quantity mismatch produced `TYPE`, repeat count 33 produced `RANGE`, and a negative marker radius under a false predicate produced delegated `SCENE`. The complete displayed accepted report remained unchanged after these refusals. A separately valid torus source compiled successfully but refused in this application's box/sphere-only diagnostic display; it retained the same accepted report. Reset restored the initial ready view.

The selected CPU checks compared whole Scene2 and shader values, fresh frozen copies and exact public token slices. Those checks and the Canvas2D image do not execute shader text or qualify a GPU backend. No public bounds or native geometry output is supplied by the diagnostic drawing.

## Preserve authored intent and read selected data

The returned object keeps the full original `source`, authored `ast`, typed `parameters`, repeat `generation`, conditional `decisions`, selected `scene` and derived `shaders`. The result wrapper has version 0; the authored AST has sourceVersion 2/schemaVersion 0, and the selected scene has version 2. Those version fields have different roles.

`generation` contains each actual repeat ID, prefix, index and original declaration range. `decisions` retains `marker_0`, its prefix, inclusion flag and original declaration range even when the marker is excluded. The selected `scene.objects` contains only active objects. A retained decision is not a hidden rendered object.

Every potential conditional object reserves its ID and consumes admission budget. False candidates still pass shape and style validation before selection. A false predicate does not hide a bad radius, conflicting ID or invalid field. Only the genuine false object's own ID rules are removed from the selected lowering view after that admission.

Source comments, CRLF, spelling and original token ranges remain authored data. Resolved Numbers and generated shader text are derived data. Number zeros can be canonicalized by this compiler while the source and AST retain their signed spelling. This is not native CAD coefficient-bit authority. Do not substitute the selected scene for the original source when saving repeat or condition intent.

## Use public token ranges for a source edit

Ranges are half-open UTF-16 offsets into the returned complete source. JavaScript `slice` uses those same units. UTF-8 byte counts and Unicode code-point indices are different, especially with the emoji in this input.

A safe edit checks that the token still names the exact source slice, replaces that slice, and recompiles the new full string. Re-find tokens after every successful edit. Old ranges belong to their old source. Do not mutate a frozen AST, replace text by an unchecked global match or submit generated AST records as new public authority.

The complete CPU module below preserves the actual input and changes its used literal through the public AST:

```ts
import {
  compileGeneratedAffineSceneSource, SceneParameterSourceError,
} from '@barocss/gpu';
import type { CompiledGeneratedAffineSceneSource } from '@barocss/gpu';

export const source = [
  "/* 설계 π 😀: authored repeats and conditions; preserve CRLF. */",
  "@scene generated_plate {",
  "  version:2;",
  "  background:#102030;",
  "  @param used:length(2scene);",
  "  @param limit:length(3scene);",
  "  @param gain:scalar(.15);",
  "  box #plate;",
  "  @repeat studs:sphere(2);",
  "  @when marker:sphere($used < $limit);",
  "}",
  "box {",
  "  color:#294560;",
  "  size:6 .5 3;",
  "  translate:0 -.6 0;",
  "}",
  "sphere {",
  "  color:#42C8D5;",
  "  radius:calc($limit * $gain);",
  "  translate:-0 0 0;",
  "}",
  "#studs_0 { translate:-2 -0 0; }",
  "#studs_1 { translate:2 0 0; }",
  "#marker_0 {",
  "  color:#F6C453;",
  "  translate:0 1.5 0;",
  "}",
].join('\r\n') + '\r\n';

export function setUsed(compiled: CompiledGeneratedAffineSceneSource, value: string) {
  const declaration = compiled.ast.declarations.find(item =>
    item.kind === 'parameter' && item.name.text === 'used');
  if (!declaration || declaration.kind !== 'parameter') {
    throw new Error('The authored used parameter is missing');
  }
  const token = declaration.literal;
  const { start, end } = token.range;
  if (compiled.source.slice(start,end) !== token.text) {
    throw new Error('The source token no longer matches');
  }
  const candidateSource = compiled.source.slice(0,start) + value + compiled.source.slice(end);
  return compileGeneratedAffineSceneSource(candidateSource);
}

const initial = compileGeneratedAffineSceneSource(source);
const excluded = setUsed(initial,'3scene');
const included = setUsed(excluded,'2scene');
console.log(initial.scene.objects.map(object => object.id));
console.log(excluded.decisions);
console.log(included.generation);

let accepted = included;
try {
  const candidate = compileGeneratedAffineSceneSource(source.replace(
    '@param used:length(2scene)', '@param used:scalar(2)',
  ));
  accepted = candidate;
} catch (error) {
  if (!(error instanceof SceneParameterSourceError)) throw error;
  console.log(error.code); // TYPE: the predicate quantities differ.
}
console.log(accepted === included); // The refused call supplied no replacement.
```

This public compiler throws `SceneParameterSourceError` on refusal; it does not return the older `compileGpu` success/diagnostics union. Diagnostics carry their actual code, original UTF-16 ranges and one-based line/column, with a delegated cause when applicable.

## Interpret the diagnostic boxes

The live example needs browser Canvas2D. Its display uses only box and sphere rows from the actual selected Scene2 coefficients. A box's local half-extents are half its size. A sphere row uses a cube with half-extents equal to its radius: that cube is a diagnostic surrogate, not a rendered sphere.

For each row, the application constructs eight local corners and twelve edges. It applies `scaleXYZ`, local X/Y/Z rotations in degrees, then translation. It projects the transformed XYZ to `x + .45*z` and `y + .25*z`, using a fixed origin `(160,132)` and 35 logical pixels per scene unit. The logical viewport is 320×210, with a fixed backing scale of 2 and a 640×420 bitmap. That scale is supplied by the example; it does not measure the device pixel ratio. The program's colors identify the records in this oblique wireframe.

This drawing is neither a public bounds-API result nor a mesh or native geometry. Rotation of a sphere's diagnostic cube does not demonstrate a change to an actual sphere surface. The viewport/clipping information refers to these projected corners; it is not a shader visibility test or certified containment result.

The host retains the whole compiled result and both shader strings. It does not link or execute those shaders and initializes no WebGL or WebGPU backend. The existing `mountScene` overloads retain Source0/1 support; passing `{sourceVersion:2}` or casting this scene into that renderer is not a supported bridge. An independently admitted rendering host would need its own contract and execution evidence.

## Refusal, copies and lifetime

The host must compile the full candidate and prepare its complete diagnostic drawing before adopting source, result and canvas state. A typed comparison refusal, shape refusal or application-display refusal must leave the previous accepted candidate available. The compiler returning shader text alone does not prove a successful drawing.

Results are fresh independent recursively frozen graphs. Reassigning a source variable or inspecting copied fields does not edit an earlier result. Release compiled-result references when finished. The public CPU compiler has no renderer instance or `dispose()` method. The application separately owns its canvas, listeners and draw lifecycle.

Do not confuse a compiler refusal with the host's supported display subset. The compiler supports the six admitted primitive types; this diagnostic host draws only box and sphere rows. A valid cylinder, capsule, rounded-box or torus source can therefore need another display host. It does not expand the current example's drawing support.

## Keep source and runtime limits separate

| Source/compiler boundary | Bound |
| --- | --- |
| Authored source | 64KiB UTF-16 units and UTF-8 bytes |
| Typed parameters | 16; length/scalar magnitude at most 1000, angle at most 360° |
| Generation | Repeats and conditions share eight declarations |
| Objects | Explicit plus all potential generated objects at most 32, including false candidates |
| Repeat count | Canonical literal 1..32; zero is outside this mixed profile |
| References / styles | 1536 reference uses; 128 rules; 512 fields |
| Cumulative work | 4096, including authored records, expansions, references and selected-view preparation |
| Local scale | Positive XYZ components .01..100 |
| Shader strings | Each derived shader at most 64KiB UTF-16 units and UTF-8 bytes |
| Whole compiled result | 2MiB UTF-16 units and UTF-8 bytes before copying/freezing |

The source stages reuse bounded primitive dimensions, rotations, field relationships and stable identity checks. `INPUT`, `SYNTAX`, `TYPE`, `RANGE`, `BUDGET` and delegated `SCENE` errors retain their own meanings. A computed repeat count, missing comparison whitespace or unknown parameter is not an ignored extension.

Source limits do not establish GPU performance, general Engine rendering, CAD Boolean/topology support, an editable document/history codec or publication. The diagnostic host's fixed viewport and box-only representation are a separate application choice.

[GPU scene language](./language) · [Scene compositions](./composition-examples) · [GPU examples](./examples)
