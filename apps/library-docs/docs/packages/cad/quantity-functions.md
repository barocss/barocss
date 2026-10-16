# Compute CAD dimensions with Source3 quantity functions

[Open CAD quantity functions](/examples/language#cad-quantity-functions) to edit a typed width and a function default, then read their native millimetre results beside a sampled open Surface. The complete model retains an unrelated Curve and Surface as well as the dependent profile and extrusion.

![Sampled open Surface after changing the quantity function default](/examples/cad-quantity-functions.jpg)

The picture uses width 10 cm and the edited default factor 1: width/depth/height are 100/25/50 mm, the extrusion vector is `[0,25,50]` and its midpoint is `[50,12.5,25]` mm. The starting program below uses default factor 2, giving height 100 mm and midpoint Z = 50 mm. Only the sampled `wall` Surface is displayed; it is not a closed Body or wall thickness.

This example uses experimental `@barocss/cad` version `0.0.0-experimental`. Source3 was introduced at source profile `4f93558d77c980fcb4e04ea21d76589466839c47`; the live example now bundles the CAD and GPU sources of `e532fc3037f9c1e13819b61d63de06164c50128f`. Source3 is an explicit new compiler dialect here: `compileCadModel(source,{sourceVersion:3})`, with `version:3; length-unit:mm;` in the source. Returned IR has `schemaVersion:3` and `sourceVersion:3`; native geometry remains Model version 0. Existing Source0/1/2 examples keep their original grammar, source profiles and compiler options.

## Complete initial Source3 input

```css
/* 설계 π: preserve complete original Source, CRLF and odd literals. */
@model quantity_functions {
version: 3; length-unit: mm;
@function #scaleLength(value: length, factor: scalar = 2): length { return: $value * $factor; }
@function #half(value: length): length { return: scaleLength(value: $value, factor: .5); }
@parameter #width { type: length; value: 10 cm; }
@parameter #height { type: length; value: scaleLength(value: half(value: $width)); }
@parameter #depth { type: length; value: scaleLength(factor: .25, value: $width); }
@curve #untouched_curve { type:nurbs; degree:2; knots:[-2.000,-2,-2,3,3.0,3]; control-points:[[-0,2,1],[3,4,2],[6,2,1]]; weights:[1,2,1]; }
@curve #profile { type:nurbs; degree:1; knots:[0,0,1,1]; control-points:[[0,0,0],[$width,0,0]]; weights:[1,1]; }
@extrude #wall { curve:#profile; vector:[0,$depth,$height]; }
@surface #untouched_surface { type:nurbs; degree-u:1; degree-v:1; knots-u:[0.000,0,1,1.00]; knots-v:[-1,-1,2,2]; control-points:[[[2,3,-0],[2,5,1]],[[4,3,2],[4,5,4]]]; weights:[[1,2],[3,4]]; }
/* Keep Ω and every unrelated original coefficient. */
}
```

<a :href="withBase('/examples/cad-quantity-functions.cad.css')" download>Download the complete initial Source3 input</a>.

The download matches the initial preset and **Reset example**, including its original CRLF line endings, comments, Unicode and numeric spellings. The source block shows the same complete program. This link does not save your current source draft or edited accepted state.

Select this preset before editing. **Run input** compiles the complete candidate with sourceVersion 3. Merely changing a version header in a Source2 preset does not change that preset's compiler selection.

## Follow the length and scalar calculations

`width` is a global length Parameter. Its initial 10 cm resolves to 100 mm. `scaleLength` takes a length and a scalar factor, then returns their product as a length. Omitting `factor` uses the closed scalar default 2.

`half` calls `scaleLength` with an explicit .5 factor. `height` first computes half of width, then passes that length into an outer `scaleLength` call that omits factor. The initial result is therefore `100 mm × .5 × 2 = 100 mm`. The `depth` call supplies factor .25 explicitly, giving 25 mm. Its named arguments are written in the reverse formal order; names still bind the intended values.

The profile runs from `[0,0,0]` to `[width,0,0]` mm. The extrusion vector is `[0,depth,height]`, so its Surface is `C(u)+v*[0,depth,height]`. Both original U/V domains are `[0,1]`. Its midpoint is `[width/2,depth/2,height/2]`. This is one open Surface, without caps, closed Body or wall-thickness semantics.

## Change a width or a default independently

| Complete source state | Width / depth / height in mm | Surface midpoint in mm |
| --- | --- | --- |
| Initial width 10 cm, default factor 2 | 100 / 25 / 100 | `[50,12.5,50]` |
| Width 12 cm, default still 2 | 120 / 30 / 120 | `[60,15,60]` |
| Reset, then change default factor 2→1 | 100 / 25 / 50 | `[50,12.5,25]` |
| Combine width 12 cm and default factor 1 | 120 / 30 / 60 | `[60,15,30]` |
| Width 8 cm with default factor still 1 | 80 / 20 / 40 | `[40,10,20]` |

1. Change only the `width` Parameter's `value: 10 cm` to `value: 12 cm`. All three dimensions grow proportionally. Read the native numbers even if the fitted image keeps a similar appearance.
2. Select **Reset example** before testing the default independently.
3. Change only `factor: scalar = 2` to `factor: scalar = 1`. Height halves, while width and depth retain their initial values. The explicit .5 and .25 arguments do not use the edited default.
4. Combine these edits only when intended. Keeping factor 1 while changing width to 12 cm produces height 60 mm, not 120 mm.

The native Model keeps four objects in authored order: `untouched_curve`, `profile`, `wall`, `untouched_surface`. The unrelated Curve and Surface retain their native values. The profile keeps its ID, role and order, but its endpoint changes when width changes; it is not a third bit-unchanged object. The wall changes with its computed dimensions.

## Declare and call quantity functions

```text
function = "@function #" id "(" formals? "):" quantity "{"
           "return:" expression "; }"
formal   = name ":" quantity ("=" closed-expression)?
quantity = "length" | "scalar"
call     = function-name "(" named-arguments? ")"
argument = name ":" expression
```

A function has zero to four typed formals and exactly one return expression. Function/formal/call names use ASCII letters, digits and `_`, start with a letter or `_`, and are at most 48 characters. Function declarations use `#name`; calls use bare `name(...)`. `$value` in a body refers to its local formal. Function IDs share the model's unique declaration-ID namespace with Parameters and geometry.

Only named arguments are admitted. Their written order may differ from formal order, but explicit argument expressions are evaluated eagerly in source order. Required arguments must be supplied; unknown or repeated names and positional arguments refuse. Trailing commas are unsupported.

Bodies are pure quantity expressions. They may use their own immutable formals and call other declared quantity functions. They cannot capture global Parameters, geometry, caller formals or resources. A formal with the same name as a global Parameter resolves to that formal in the function's lexical frame. There are no statements, assignment, conditions, loops, geometry-return types or callbacks to JavaScript.

Declarations and acyclic calls may refer forward. The compiler checks the complete function-call graph for recursion and the global Parameter dependency graph for cycles before native lowering. Function declaration order is not execution order, and forward references do not permit recursive calls.

### Defaults are closed quantities

A default can use literal arithmetic and units, but no references or function calls. It cannot read an earlier formal or a global Parameter. Every default is admitted once, even if a caller supplies an explicit argument. An omitted argument then evaluates its default in the new call frame. Admission and runtime default evaluations have separate counts.

Unitless numbers are scalars inside signatures, defaults and call arguments. A length default or explicit length argument needs a length expression such as `5 mm` or `$width`. `length-unit:mm` does not turn `scaleLength(value:5)` into a typed length call. The existing bare-literal mm compatibility in coordinate/vector leaves is separate from function argument typing.

| Operation | Admitted quantity result |
| --- | --- |
| Length +/− length; scalar +/− scalar | Same kind |
| Length × scalar, or scalar × length | Length |
| Scalar × scalar | Scalar |
| Length ÷ scalar | Length |
| Length ÷ length; scalar ÷ scalar | Scalar |
| Length × length; scalar ÷ length | Unsupported quantity combination |

Length literals admit `mm`, `cm` and `m`, normalized to mm. Division by zero refuses. Numeric values must remain finite within the quantity bounds, and the resulting native geometry must still pass its own coordinate, weight, degree and knot rules.

## Compile and inspect complete native data

Pass the complete source above to this public-API application function. It returns compiler diagnostics without adopting a partial result, selects `wall` by ID, evaluates its midpoint and creates a separate 17×17 preview packet.

```ts
import {
  compileCadModel, surfaceDomain, evaluateSurface, tessellateSurface,
} from '@barocss/cad';

function inspectQuantitySource(sourceText:string) {
  const compiled=compileCadModel(sourceText,{sourceVersion:3});
  if (!compiled.ok) return {ok:false,diagnostics:compiled.diagnostics};
  if (compiled.ir.schemaVersion!==3) throw new Error('Expected Source3 IR');
  const wall=compiled.model.objects.find(object=>object.id==='wall');
  if (!wall || wall.kind!=='surface') throw new Error('Expected wall Surface');
  const preview=tessellateSurface(wall,{countU:17,countV:17,revision:0});
  return {
    ok:true,
    ast:compiled.ast,
    nativeModel:compiled.model,
    objectIds:compiled.model.objects.map(object=>object.id),
    parameters:compiled.ir.parameters,
    functions:compiled.ir.functions,
    calls:compiled.ir.calls,
    work:compiled.ir.work,
    bindings:compiled.ir.bindings,
    dependencies:compiled.ir.dependencies,
    constructions:compiled.constructions,
    domain:surfaceDomain(wall),
    midpointMM:evaluateSurface(wall,.5,.5),
    packet:preview.packet,
    samplingReport:preview.report,
  };
}
```

The native Model contains geometry only. Parameters and functions stay in IR3, which retains complete definitions, expressions, typed bindings, source ranges and call receipts. Returned compiler records are independent mutable CPU data, not live handles or a running function environment. Recompile the complete source after a literal/default edit; the previous result remains separate.

The packet has 289 vertices and 512 triangles. The display host draws 17 rows and 17 columns of evaluated U/V grid paths. Those 34 paths are samples, not the two-pole Curve control polygon, Surface control net or topological Edges. Sampling returns `certified:false`; measured local deviation is not a global shape-error certificate.

The application draws the sampled wall and its U/V grid lines with the `@barocss/gpu` WebGPU viewer (`createViewer`, then `viewer.add`) and fits sampled bounds for presentation. Native packet XYZ stays in mm; the display converts mm to scene units once and centers the sampled bounds. A proportional width edit can therefore yield similar fitted pixels despite different native dimensions. The independent default-factor edit changes proportions while the width remains 100 mm. Compilation and CPU sampling do not themselves establish a rendered frame or native editor admission.

## Read lexical calls and bounded work

Each call receipt identifies its frame, parent frame, depth, function ID, original call/definition spans and owning Parameter or geometry field. Its bindings name the formals, resolved quantity, explicit/default origin and relevant source spans; its result records `length/mm` or `scalar/1`.

For `scaleLength(value:half(value:$width))`, the eager `half` argument completes before the outer `scaleLength` frame becomes active. The call inside `half` has that half frame as parent; the outer call starts from its caller after argument evaluation. Count active frame depth from the receipt and work report, not simply from parentheses in the source. Each frame has a separate memo, so results for one set of formal values cannot leak into another call.

`ir.work.preflight` counts bounded call/expression work before numerical evaluation. `ir.work.actual` reports actual call entries, expression visits, default admission/runtime evaluations and maximum active depth. These are different scopes; memoized evaluation can differ from the conservative preflight count. They are not timing, renderer work or performance promises.

For the initial program, the actual receipts are:

| Frame / parent | Function | Explicit bindings / default | Result |
| --- | --- | --- | --- |
| 0 / null | `half` | value 100 mm | 50 mm |
| 1 / 0 | `scaleLength` inside `half` | value 100 mm, factor .5 | 50 mm |
| 2 / null | Outer `scaleLength` for height | value 50 mm; default factor 2 | 100 mm |
| 3 / null | `scaleLength` for depth | value 100 mm, factor .25 | 25 mm |

The selected compilations recorded four call entries, seven formal bindings, one default admission, one runtime default evaluation and maximum active depth 2. Preflight and actual runtime expression visits were both 88 for these inputs. Default admission has its own count rather than being added to runtime expression visits. Frame IDs identify that compilation's call receipts; they are not persistent naming or execution-history IDs.

## Download raw source and compile it fresh

The public download is the initial source. To retain an edited accepted source, your application must save that complete raw text itself. Neither the download link nor this example supplies a native editor Save UI or a new project codec. IR and native Model JSON do not replace the complete authored source, its comments or its original spelling.

Use a real selected raw source File for a fresh compile:

```ts
async function compileSource3File(file:File) {
  if (file.size>262144) throw new Error('Raw source exceeds 262144 UTF-8 bytes');
  const sourceText=await file.text();
  return {sourceText,result:compileCadModel(sourceText,{sourceVersion:3})};
}
// Pass the File from a real input[type=file]; adopt only a successful result.
```

The raw text retains the `version:3` header, but the caller still passes explicit sourceVersion 3 on every fresh compile. Keep that dialect choice with application state. Preserve the accepted current source on failure and discard stale asynchronous File reads before adoption. Formatting source can change diagnostic offsets even when numeric intent is unchanged.

The selected current-source save/reopen sequence uses width 12 cm with factor default 1, then changes the freshly read source to width 8 cm. It is separate from the served initial download. The fresh native values are `[120,30,60]` mm with midpoint `[60,15,30]`, then `[80,20,40]` mm with midpoint `[40,10,20]`.

## Refuse invalid calls before replacing accepted state

Compile a candidate into a local variable and update accepted source/model/display only after all required stages succeed. A compiler failure contains diagnostics only, with no partial AST, IR or Model to adopt. Each diagnostic has `code`, `severity`, `message`, an actual UTF-16 source range with line/column coordinates, and an optional owning `objectId`.

| Candidate | Relevant refusal |
| --- | --- |
| Positional, missing, duplicate or unknown named argument | `FUNCTION_ARGUMENT` |
| Length/scalar argument, default or return mismatch | `FUNCTION_TYPE` |
| Body captures global `$width`, or a default references a formal/global or calls a function | `FUNCTION_CAPTURE` |
| Call names no declared function | `FUNCTION_REFERENCE` |
| Direct or indirect recursive call | `FUNCTION_RECURSION` |
| Cyclic global Parameter dependency | `CYCLE` |
| Invalid quantity arithmetic such as length × length | `UNIT` |
| Zero divisor in an evaluated expression/default | `DIVISION_ZERO` |
| Nonfinite or excessive quantity | `VALUE` |
| Source, expression, call/frame or full-success budget exceeded | `LIMIT` |

The selected refused edits changed depth's scalar factor `.25` to the length `1 mm`, producing `FUNCTION_TYPE`, and replaced a function's local `$value` with global `$width`, producing `FUNCTION_CAPTURE`. The accepted result's reference and complete values remained retained.

Native geometry validation can separately report coordinate, degree, knots, weights or extrusion errors. Source3 still excludes geometry-return functions and new Sketch/Face declarations. Source0-only Loader paths and existing file/editor envelopes do not become Source3 consumers merely because this compiler accepts it. Retaining accepted CPU data also cannot promise pixel restoration after graphics context loss.

## Bounds for the selected dialect

| Resource | Bound |
| --- | --- |
| Source / AST | 262144 UTF-8 bytes; 131072 tokens; 65536 AST nodes/values; geometry array depth 3 |
| Declarations | At most 8 functions, 4 formals per function, 64 global Parameters and 16 geometry objects |
| Expression parsing | At most 256 nodes per expression, depth 32 and 32768 aggregate expression nodes |
| Runtime calls | At most 256 call entries and 8 active function frames |
| Evaluation | At most 65536 expression visits and 32 default admission evaluations |
| Quantities | Finite literal/resolved magnitude at most `1e12`; native geometry limits still apply after conversion |
| Complete success | At most 16,777,216 UTF-16 code units and UTF-8 bytes, counted separately across every retained occurrence |
| Success own data | At most 4,194,304 values, depth 128, array length 65536 and 64 fields per record |

Preflight refuses excessive expansion before allocating numerical call frames. A short source can still exceed evaluation or complete-success limits through calls and retained receipts. Bounds authorize complete accepted results, not truncated calls, partial native geometry or a wider declaration family.

[Source0/1/2 language](./language) · [CAD language examples](./language-examples) · [CAD examples](./examples) · [CAD guides](./guides)

<script setup>
import { withBase } from 'vitepress'
</script>
