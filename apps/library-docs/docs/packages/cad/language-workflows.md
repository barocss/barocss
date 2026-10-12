# Compile, edit and inspect CAD source

These complete inputs were compiled and numerically evaluated against adopted source `0c9aa7e159d3713a70a4b67631715e027da28fef`. Copy one entire program and pass its matching `sourceVersion`. They exercise the pure compiler and native Curve/Surface evaluator, without a Solid engine campaign or a renderer.

Start with the [authoring coverage table](./language#what-can-the-model-language-express-today) if your task involves sketches, cuts, chamfer or Solid queries. The text compiler does not accept those operations merely because the engine exports APIs for them.

## 1. Source0: a literal Curve

<<< ../../public/examples/source0.cad.css{css}

Compile with `{sourceVersion:0}`. The native Model contains one Curve named `profile`. Its original domain is `[0,1]`; evaluating U = 0.5 yields `[10,0,0]` mm. The IR uses schemaVersion 1; the native Model uses version 0.

<a :href="withBase('/examples/source0.cad.css')" download>Download complete Source0 input</a>

## 2. Source1: extrude that Curve into a Surface

<<< ../../public/examples/source1.cad.css{css}

Compile with `{sourceVersion:1}`. The Model contains `profile` Curve followed by `wall` Surface. At U/V = 0.5/0.5 the Surface is `[10,0,15]` mm. `wall` has no caps, thickness or occupied Solid volume. Source1 does **not** admit a literal `@surface` declaration; use Source0, 2 or 3 for that input.

<a :href="withBase('/examples/source1.cad.css')" download>Download complete Source1 input</a>

## 3. Source2: drive coordinates with a typed Parameter

<<< ../../public/examples/source2.cad.css{css}

Compile with `{sourceVersion:2}`. `width` resolves from 10 cm to 100 mm. The profile endpoint becomes `[100,0,0]`; the extrusion vector is still `[0,0,30]`. The Surface midpoint is `[50,0,15]` mm. The Parameter is retained in IR schemaVersion 2, not added to `model.objects`.

<a :href="withBase('/examples/source2.cad.css')" download>Download complete Source2 input</a>

## 4. Source3: calculate a dimension with a function

<<< ../../public/examples/source3.cad.css{css}

Compile with `{sourceVersion:3}`. `scaleLength` accepts a length and an optional scalar factor. Its default factor is 2, so the wall height is 200 mm and midpoint is `[50,0,100]` mm. The function returns a number with a quantity kind; it does not return geometry. Read [the complete function contract](./quantity-functions#declare-and-call-quantity-functions) for named calls, closed defaults and lexical scope.

<a :href="withBase('/examples/source3.cad.css')" download>Download complete Source3 input</a>

## Compile and evaluate through the public API

In a source-compatible local workspace, supply one complete string above to this function. The inputs do not imply that the experimental package is published to npm.

```ts
import { compileCadModel, evaluateCurve, evaluateSurface } from '@barocss/cad';

function inspect(sourceText: string, sourceVersion: 0 | 1 | 2 | 3) {
  const result = compileCadModel(sourceText, { sourceVersion });
  if (!result.ok) {
    return { ok: false as const, diagnostics: result.diagnostics.map(d => ({
      ...d, text: sourceText.slice(d.range.start, d.range.end),
    })) };
  }
  const wall = result.model.objects.find(object => object.id === 'wall');
  const profile = result.model.objects.find(object => object.id === 'profile');
  const midpointMM = wall?.kind === 'surface'
    ? evaluateSurface(wall, 0.5, 0.5)
    : profile?.kind === 'curve' ? evaluateCurve(profile, 0.5) : null;
  return { ok: true as const, result, midpointMM };
}
```

This selected example uses domain `[0,1]`. In a general model, query original domains instead of assuming a normalized U/V range. `inspect` performs no sampling or drawing; add an explicitly supported renderer/mesh path only after native success.

## Edit a Parameter without mutating the prior result

For the complete Source3 input above, recompile the entire candidate after changing width:

```ts
const before = inspect(sourceText, 3);
if (!before.ok) throw new Error('Expected the complete original input');
const candidateText = sourceText.replace('10 cm', '12 cm');
const candidate = inspect(candidateText, 3);
if (candidate.ok) {
  // The host may now adopt candidateText and candidate.result together.
  console.log(candidate.midpointMM); // [60, 0, 120]
}
console.log(before.midpointMM); // [50, 0, 100], unchanged
```

The replacement is unambiguous in this exact example; it is not a general source-editing algorithm. Production editors should preserve the complete accepted text and use the correct source spans or their own editing model. A refusal leaves the host's previous accepted result available; the compiler does not manage editor history or the display for you.

| Complete Source3 input | Width | Wall vector | Midpoint U/V = 0.5/0.5 |
| --- | --- | --- | --- |
| Original `10 cm`, default factor 2 | 100 mm | `[0,0,200]` mm | `[50,0,100]` mm |
| Edited `12 cm`, default factor 2 | 120 mm | `[0,0,240]` mm | `[60,0,120]` mm |

This is source replacement followed by compilation, not the separate feature-document parameter-update transaction API.

## Read actual refusals

These are exact diagnostic messages observed by the checked compiler. Apply each change independently to the corresponding original input above.

| Candidate | Actual code | Actual message |
| --- | --- | --- |
| Append `@sketch #operation {}` inside the Source3 model | `KIND` | `Unsupported declaration sketch` |
| Likewise append `@chamfer #operation {}` | `KIND` | `Unsupported declaration chamfer` |
| Compile the Source3 input with option `{sourceVersion:2}` | `KIND` | `Unsupported declaration function` |
| Change Source0's header to `version:1`, retain option 0 | `VERSION` | `Declared source version must match sourceVersion: 0` |
| Source3: change width `10 cm` to `10` | `UNIT` | `Parameter value does not match its declared quantity kind` |
| Source3: change the call to `scaleLength(value:2)` | `FUNCTION_TYPE` | `Named argument does not match its formal quantity kind` |
| Source3: change function return `$value*$factor` to `$width*$factor` | `FUNCTION_CAPTURE` | `A function may reference only its own formal arguments` |
| Source2: change width to `10 cm / 0` | `DIVISION_ZERO` | `Division by zero is unsupported` |

The Source2-option example reaches the declaration parser before a header mismatch diagnostic. Do not assume a specific semantic error wins when multiple boundaries are violated. The same bounded check also refused `@constraint`, `@split`, `@intersection`, `@subtract`, `@mass` and `@mesh` with `KIND` and `Unsupported declaration <name>`.

The scalar call argument `2` is highlighted at line 6, column 66 in the exact downloadable Source3 candidate, with half-open UTF-16 offsets `[365,366)`. Formatting changes those offsets. Keep the exact candidate text and its diagnostic together.

## JSON feature documents are another input contract

<a :href="withBase('/examples/cad-prism-feature-v0-authored.json')" download>Download the complete authored prism feature-document v0 fixture</a>

This JSON includes all required fields: the `barocss-xy-affine-prism-feature-document` format, version 0, document ID/revision/mm units, two complete constrained sketches, two prism recipes with original segment order and charts, subtraction references and literal-mm parameter bindings. It is the complete initial fixture extracted from the [adopted native example](https://github.com/barocss/barocss/blob/0c9aa7e159d3713a70a4b67631715e027da28fef/examples/cad-nurbs/xy-affine-prism-feature-document-demo.mjs), not a shortened schema fragment.

Do not send this JSON to `compileCadModel`. Its entry point is `parseXYAffinePrismFeatureDocument(text)`, which parses and evaluates the authored recipe. The [already executed API/JSON recipe](./exact-prism-modeling#_2-cut-edit-and-reopen), pinned separately at `31b3033f`, demonstrates `evaluateXYAffinePrismFeatureDocument`, `updateXYAffinePrismFeatureDocument`, serialization and reopening, including remaining volume 5120 → 3328 mm³ when upperX changes 16 → 24. This manual increment extracted the download without running a new Solid-engine roundtrip; the prior recipe's evidence is retained, not relabelled as a fresh run.

Feature-document v1 separately allows an optional original-parent-prism chamfer as a sibling to subtraction. It is not Source1, does not migrate v0 implicitly, and is not a general arbitrary feature graph. [`CadDocumentV1`](https://github.com/barocss/barocss/blob/0c9aa7e159d3713a70a4b67631715e027da28fef/packages/barocss-cad/src/cad-document.ts) is yet another direct-geometry format: its authored assets are Source0 and its `features`, `parameters` and `constraints` arrays must be empty. Its body records reference Curve/Surface objects; they are not Solid certificates. Matching version numbers do not make these codecs interchangeable. Consumers must explicitly admit each format/profile. The editor at this audited checkpoint uses the v0 prism-feature path; compiler or native v1 support alone does not establish editor support.

## Reproduce this page's source checks

With repository Git history and existing workspace dependencies, run:

```sh
node apps/library-docs/scripts/check-cad-language.mjs
```

The runner reads the fixed adopted Git blobs, bundles only the compiler/evaluator import closure, compiles the four downloadable inputs, asserts their numeric results and the independent Source3 edit, and checks the exact refusals above. It does not bundle the full package index or change the source pin to current `develop`. The retained result is `apps/library-docs/evidence/cad-language-source-coverage.json`.

This check establishes compiler and numeric-evaluator behavior. It does not establish a full documentation build, browser/GPU pixels, editor save/open, feature-document reevaluation or npm publication.

[Language reference](./language) · [Quantity functions](./quantity-functions) · [Solid capability map](./capabilities) · [Executed sketch/cut recipe](./exact-prism-modeling)

<script setup>
import { withBase } from 'vitepress'
</script>
