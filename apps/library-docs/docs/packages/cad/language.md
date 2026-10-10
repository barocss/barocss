# CAD model language

The CAD language describes native rational B-spline geometry and bounded construction intent. It is data for `compileCadModel`, not browser CSS. Use the selected source dialect explicitly. All dialects produce native `Model` version 0 in millimetres.

[Run the examples](./examples) · [Open the live playground](/playground) · [Public compiler signature](./reference#compilecadmodel)

## Choose a source dialect

| Source dialect | Admitted declarations | Numeric fields | Returned IR |
| --- | --- | --- | --- |
| 0 | `@curve`, `@surface` | Finite signed decimal literals | schemaVersion 1,sourceVersion 0 |
| 1 | `@curve`, `@extrude` | Finite signed decimal literals | schemaVersion 1,sourceVersion 1 |
| 2 | `@curve`, `@surface`, `@extrude`, `@parameter` | Bounded typed expressions | schemaVersion 2,sourceVersion 2 |

**Source1 is not a superset of source0.** A literal `@surface` block is refused in source1. Use source0 for literal Surfaces or source2 for literal/expression-driven Surfaces. Source1 produces Surfaces through `@extrude`.

```ts
import { compileCadModel } from '@barocss/cad';
const compiled = compileCadModel(source, { sourceVersion: 2 });
if (!compiled.ok) {
  console.log(compiled.diagnostics[0]);
}
```

`source` is the authored string, with a matching `version:2` header. The options record must contain exactly the own enumerable data field `sourceVersion:0`, `1` or `2`. Plain and null-prototype records are accepted. Getters, symbols, extra options and unsupported versions refuse. A source header does not select the compiler option automatically.

## Common model structure

A file contains one model. Fields and declarations can appear in any order inside it:

```text
model        = "@model" modelName "{" (modelField | declaration)* "}"
modelField   = "version" ":" versionNumber ";"
             | "length-unit" ":" "mm" ";"
declaration  = a declaration admitted by the selected dialect
```

This grammar describes structure. Semantic checks also require both model fields, unique fields, 1..16 geometry declarations and valid geometry. Parameters do not count as geometry. Extra text or a second model after the closing brace refuses.

```css
@model part_name {
  version: 0;
  length-unit: mm;
  /* Geometry declarations go here. */
}
```

The block above shows the header only. It does not compile until geometry is added. `length-unit:mm` remains required in source2, even when an individual expression uses `cm` or `m`.

### Names, IDs and references

| Name | Syntax | Meaning |
| --- | --- | --- |
| Model name | `[A-Za-z_][A-Za-z0-9_-]*` | Names the model |
| Geometry ID | `#` followed by `[A-Za-z_][A-Za-z0-9_-]*` | Names a Curve, Surface or extrusion output |
| Parameter ID | `#` followed by `[A-Za-z_][A-Za-z0-9_]*` | Names a source2 parameter; hyphens are excluded |
| Geometry reference | `#profile` in `curve` | Must name a Curve declaration |
| Parameter reference | `$width` inside an expression | Must name a Parameter declaration |

Declaration IDs are globally unique across parameters and geometry. `#width` cannot name a Parameter and a Curve in the same model. Case is significant. `$width` does not refer to geometry named `#width`. A hyphen in a parameter expression is subtraction: `$a-$b`.

References may point forward. Compilation checks the complete parameter reference graph and cycles before evaluating parameter quantities. Native objects retain authored geometry declaration order, even when an extrusion appears before its input Curve. Parameter declarations are absent from `model.objects`.

### Punctuation and literals

Every field ends with `;`. Arrays use commas. Trailing commas refuse. Spaces, newlines and `/* block comments */` are accepted; `//` is outside the comment grammar. Declarations close with `}` and have no trailing semicolon.

Source0/1 numeric literals use this form:

```text
signedDecimal = ("+" | "-")? (digits ("." digits?)? | "." digits)
```

Examples: `10`, `-1.25`, `+.5`, `1.`. Values must be finite. Exponent spelling such as `1e2`, quoted numbers, unit suffixes, arithmetic, function calls and substitutions refuse in source0/1. In source2, a sign is a unary expression rather than part of the unsigned numeric leaf.

## Curves in source0, source1 and source2

Each Curve requires these five fields:

```css
@curve #edge {
  type: nurbs;
  degree: 1;
  knots: [0,0,1,1];
  control-points: [[0,0,0],[20,0,0]];
  weights: [1,1];
}
```

`type:nurbs` is the only accepted type. Poles are ordered XYZ triples in mm. Knots and weights are dimensionless. The number of weights equals the number of poles. Source2 permits a numeric expression in each numeric leaf, with the quantity requirements below.

For N poles and degree p:

- Degree is an integer 1..5 and is smaller than N.
- N is 2..64.
- Knot count is N+p+1. Knots are finite and nondecreasing.
- Both endpoint values repeat exactly p+1 times. Interior multiplicity is at most p.
- The original parameter domain `[knots[p],knots[N]]` has positive length.
- Each coordinate is finite and within ±1e6 mm. Every weight is 1e-6..1e6.

### Complete source0 Curve

```css
@model original_domain {
  version: 0;
  length-unit: mm;
  @curve #edge {
    type: nurbs;
    degree: 1;
    knots: [2,2,7,7];
    control-points: [[0,0,0],[20,0,0]];
    weights: [1,1];
  }
}
```

Compile with `{sourceVersion:0}`. `curveDomain(curve)` returns `[2,7]`; `evaluateCurve(curve,4.5)` returns `[10,0,0]` mm. A parameter of 0 is outside this native domain. Sampling this Curve uses its original parameter range, not an assumed0..1 range.

A rational Curve's control polygon is not its sampled shape. Endpoint closure does not itself certify a topological wire, region or Solid.

## Surfaces in source0 and source2

A literal Surface requires seven fields:

```css
@surface #plane {
  type: nurbs;
  degree-u: 1;
  degree-v: 1;
  knots-u: [0,0,1,1];
  knots-v: [0,0,1,1];
  control-points: [[[0,0,0],[0,10,0]],[[20,0,0],[20,10,0]]];
  weights: [[1,1],[1,1]];
}
```

The outer control-point index is U; the inner index is V. Weight rows match that same rectangular grid. Each direction has 2..16 poles and at most 256 poles exist in total. Degree/knot rules apply independently in U and V.

Wrap this block in the matching source0 or source2 model header. For the example, `evaluateSurface(surface,0.5,0.5)` gives `[10,5,0]` mm. Increasing U follows+X; increasing V follows+Y. A display tessellation retains this authored XYZ; it does not infer a native up axis.

Fields for trims, periodic flags, textures or materials are not accepted by this model language. Specialized public native operations/documents can support their own families without adding a declaration here.

## Extrusions in source1 and source2

`@extrude` requires a Curve reference and a three-component vector:

```css
@model raised_edge {
  version: 1;
  length-unit: mm;
  @curve #profile {
    type: nurbs;
    degree: 1;
    knots: [0,0,1,1];
    control-points: [[0,0,0],[20,0,0]];
    weights: [1,1];
  }
  @extrude #wall { curve: #profile; vector: [0,0,30]; }
}
```

Compile with `{sourceVersion:1}`. Output objects are `profile` Curve and `wall` Surface. The resulting Surface satisfies `S(u,v)=C(u)+vD`, with original U domain and V domain 0..1. `evaluateSurface(wall,0.5,0.5)` gives `[10,0,15]` mm.

Each Curve pole becomes two Surface poles, `[Pi,Pi+D]`; each weight becomes `[wi,wi]`. U degree/knots are copied; V degree is1 and knots are `[0,0,1,1]`. At most16 Curve poles fit the Surface envelope. The finite vector must be nonzero, translated poles must remain within ±1e6 mm, and displacement must change at least one represented pole.

References to another extrusion or a literal Surface refuse. A Curve whose poles are wholly collinear with the extrusion vector produces a collapsed construction and refuses. This extrusion creates an open Surface. It creates no caps or Solid topology.

## Parameters and expressions in source2

### Complete parameter-driven model

```css
@model driven {
  version: 2;
  length-unit: mm;
  @parameter #width { type: length; value: 10 cm; }
  @parameter #height { type: length; value: $width / 2; }
  @parameter #scale { type: scalar; value: 2; }
  @curve #profile {
    type: nurbs;
    degree: 1;
    knots: [0,0,1,1];
    control-points: [[0,0,0],[$width,0,0]];
    weights: [1,1];
  }
  @extrude #wall { curve: #profile; vector: [0,0,$height * $scale]; }
}
```

Compile with `{sourceVersion:2}`. Parameter values are width100mm,height50mm and scale2. The native profile endpoint is `[100,0,0]`; the wall reaches z100mm. Change `10 cm` to `12 cm` and recompile: width120mm,height60mm and wall height120mm. Geometry IDs and declaration order remain stable. A previously returned model/report does not change when source text is edited.

### Expression grammar and precedence

```text
expression = sum
sum        = product (("+" | "-") product)*
product    = unary (("*" | "/") unary)*
unary      = ("+" | "-") unary | primary
primary    = unsignedDecimal lengthUnit?
           | "$" parameterName
           | "(" expression ")"
lengthUnit = "mm" | "cm" | "m"
```

Signs bind first, then multiplication/division, then addition/subtraction. Binary operators at the same level are left associative: `20/2/2` is5. Parentheses change grouping: `(2+3)*4` is20; `2+3*4` is14. Unit suffixes can follow a decimal directly or after whitespace: `10cm` and `10 cm` are equivalent.

No function, exponent literal, percentage, member/index access, string, import, interpolation or arbitrary source execution is admitted. `calc(2)`, `Math.PI`, `1e2`, `10%`, `"10mm"` and `${width}` are examples outside the grammar.

### Quantity rules

| Operation | Admitted operand kinds | Result |
| --- | --- | --- |
| Unary `+`/`-` | length or scalar | Same kind |
| `+`/`-` | Same kind on both sides | Same kind |
| `*` | scalar/scalar | scalar |
| `*` | length/scalar or scalar/length | length |
| `/` | scalar/scalar | scalar |
| `/` | length/scalar | length |
| `/` | length/length | scalar |

Length×length and scalar÷length refuse. Division by positive or negative zero refuses. Numeric leaf and evaluated intermediate magnitudes are finite and at most1e12. Normalization uses1mm=1,1 cm=10 mm,1 m=1000 mm. A valid parameter quantity can still exceed the narrower native coordinate/weight/degree limit when used in geometry.

A Parameter requires `type:length` or `type:scalar` and a value of that same kind. `@parameter #width {type:length;value:2;}` refuses; write `2mm`. Parameters have no implicit unit.

### Quantity requirements by field

| Numeric field | Required kind |
| --- | --- |
| `control-points` components | length |
| `vector` components | length |
| `degree`, `degree-u`, `degree-v` | scalar integer, then native degree limits |
| `knots`, `knots-u`, `knots-v` | scalar |
| `weights` | scalar, then positive native weight limits |

For coordinate/vector fields only, a single bare decimal with unary signs or parentheses retains the mm shorthand. Thus `10`,`(-10)` and `+(.5)` are lengths in those fields. This rule does not convert a compound scalar expression or scalar Parameter to length.

| Coordinate expression | Admission |
| --- | --- |
| `10` | 10 mm literal shorthand |
| `1mm+2mm` | length3mm |
| `$width/2` | length when width is a length Parameter |
| `1+2` | Refused: compound scalar |
| `$scale` | Refused when scale is a scalar Parameter |
| `1mm*2mm` | Refused: length product |

### References, cycles and result records

All Parameter references resolve before quantity evaluation. Missing Parameters, references to geometry and cycles refuse, including unused cyclic Parameters. Source2 accepts at most 64 Parameters and 16 geometry declarations.

IR schema2 retains authored-order `parameters` and field/index-order `bindings`. A binding records owning object ID, field, array indices, original expression/range, resolved value/kind and Parameter references. Repeated references remain separate dependency occurrences. The native Model contains resolved numbers; its geometry version remains 0. Compile again after editing. No public API adopts this IR as an executable cache or accepts a Parameter override without recompilation.

## Refusal examples and diagnostics

| Candidate | Typical diagnostic boundary |
| --- | --- |
| Header version differs from sourceVersion | VERSION |
| Unsupported declaration, including source1 Surface | KIND |
| Missing/unknown field | FIELD |
| Duplicate field or globally duplicate ID | DUPLICATE |
| Unsupported unit or incompatible quantity | UNIT |
| Undefined/wrong-kind reference | REFERENCE |
| Parameter cycle | CYCLE |
| Division by either signed zero | DIVISION_ZERO |
| Fractional/out-of-domain degree | DEGREE |
| Invalid knot sequence/domain | KNOTS |
| Invalid native weight | WEIGHTS |
| Array shape/nesting | DIMENSION or the reported parser boundary |
| Malformed token, trailing comma or extra model | SYNTAX |
| Source/parser/expression allocation cap | LIMIT |

The first reported boundary depends on the actual candidate and compiler stage. Inspect its real code/message/range rather than assuming every invalid string reaches semantic validation.

```ts
const rejected = compileCadModel(
  '@model bad { version: 0; length-unit: cm; }',
  { sourceVersion: 0 },
);
if (!rejected.ok) {
  const diagnostic = rejected.diagnostics[0];
  console.log(diagnostic.code, diagnostic.range, diagnostic.message);
}
```

This candidate has an unsupported root unit. Failure returns diagnostics and no partial AST, IR or Model. Source ranges use half-open UTF-16 offsets and one-based line/column coordinates, including endLine/endColumn. Get the highlighted text with `source.slice(range.start,range.end)`.

## Allocation and geometry bounds

| Resource | Limit |
| --- | --- |
| Source | 262144 UTF-8 bytes |
| Geometry declarations | 16 |
| Source2 Parameters | 64 |
| Array depth | 3 |
| Shared AST nodes/values | 65536 |
| Tokens | 131072 |
| Nodes per expression | 256 |
| Expression tree depth | 32 |
| Aggregate expression nodes | 32768 |
| Expression literal/intermediate magnitude | 1e12 |
| Curve poles / Surface poles | 64 / 16×16 |
| Native coordinate magnitude | 1e6mm |
| Native weight | 1e-6..1e6 |

Parsing checks bounds before further growth. Native validation still applies after expression evaluation. Acceptance does not certify regularity, general topology, Solid validity or display quality. Tessellation can refuse geometry that compiles as a native model. Keep source, native geometry, sampled mesh and image as separate records.

## Source evidence

This language reference follows local source snapshot `5f5ad866205a21510ac69552e704cc162fa253b5`. Its CAD parser/compiler/test blobs remain unchanged at docs parent `83d3ceede9b97df1ec6bbd4da7feab9757f0f75d`.

Implementation evidence: `packages/barocss-cad/src/source-ast.ts`, `expression-parser.ts`, `parameter-semantics.ts`, `semantic-model.ts`, `model-compiler.ts`, `math.ts` and `extrusion-validation.ts`. These are implementation provenance, not additional public parser APIs.

Test source evidence: `packages/barocss-cad/test/model-compiler.test.mjs`, `parameters.test.mjs`, `expression-ast.test.mjs`, `source-ast.test.mjs` and `compiler-regressions.test.mjs`. The manual author inspected these files; that inspection does not claim execution of their suites. [Public compiler/types](./reference#declarations-f70a5b13ba9d), [native math signatures](./reference#declarations-96418e2ec250) and [expression data types](./reference#declarations-d66dfcde533b) are available in this portal.

[Overview](./) · [Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits](./limits)
