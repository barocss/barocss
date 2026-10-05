# @barocss/cad (private experiment)

CSS-shaped model source becomes native rational B-spline geometry and ASCII IGES.
This package contains an original parser, local basis evaluator and writer. It has
no runtime dependencies. OCP is an independent test consumer, never a product kernel.
The private package is not registered for release or publication.

```js
import { parseModel, evaluateCurve, exportIGES } from '@barocss/cad';
const model = parseModel(source);
const point = evaluateCurve(model.objects[0], 0.5);
const { iges, report } = exportIGES(model, ['arc']);
// The host retains source and report, hashes iges, and writes the bytes.
```

## Exact language v0

One `@model name { ... }` contains required `version: 0;` and `length-unit: mm;`
declarations, plus 1..16 `@curve #id { ... }` or `@surface #id { ... }` blocks.
Field/block order is free. Fields and IDs cannot repeat. Names/IDs use
`[A-Za-z_][A-Za-z0-9_-]*`. Whitespace and `/* comments */` are accepted.
Every field declaration ends with `;`. Arrays use commas, with no trailing comma.
Numbers are signed finite decimal literals (`10`, `-1.25`, `.5`, `1.`);
exponents, strings, expressions, imports, selectors and arbitrary functions fail.

Curves require `type: nurbs; degree: <integer>; knots: [numbers];
control-points: [[x,y,z],...]; weights: [numbers];`.
Surfaces require `type: nurbs; degree-u: <integer>; degree-v: <integer>;
knots-u: [numbers]; knots-v: [numbers]; control-points: [[[x,y,z],...],...];
weights: [[numbers],...];`. The grid is `controlPoints[uIndex][vIndex]`.
Coordinates are millimetres; knots, parameters and weights are dimensionless.
No other fields, units, object kinds, periodic forms or trim definitions are accepted.
See the three fixtures in `examples/cad-nurbs`.

`parseModel` throws `CadSyntaxError` with code, offset (UTF-16 source index), line
and column (1-based). Geometry errors point to the object's declaration.
The parsed result includes each object's source span. Other public APIs throw on
invalid geometry or requests. No failed geometry is clamped or substituted.

## Fixed bounds and mathematical semantics

| Input | Bound |
| --- | --- |
| Source | 256 KiB UTF-8 |
| Objects | 1..16, unique IDs |
| Degree | 1..5 and smaller than pole count |
| Curve poles | 2..64 |
| Surface poles | 2..16 per direction, at most 256 |
| XYZ coordinate | finite, absolute value at most 1e6 mm |
| Weight | finite, in [1e-6, 1e6] |
| Requested samples | 2..4096; surface countU × countV at most 4096 |

Array nesting and element counts are checked while parsing, before additional
array allocation. Source bytes are checked before tokenization. No `eval`, file
access, network call or executable expression is driven by model source.

For N poles and degree p, knots have N+p+1 entries. They are finite,
nondecreasing, with exactly p+1 equal entries at each endpoint, interior
multiplicity at most p, and positive domain `[knots[p], knots[N]]`.
The local Cox–de Boor basis uses zero contributions for zero denominators.
An exact right endpoint selects the final span. Outside-domain parameters fail.
Rational evaluation weights both coordinates and denominator. Surface evaluation
uses the product of U and V bases. Sampling is uniform in parameter space,
includes endpoints and is deterministic; it is not arc-length sampling.

`validateCurve`, `validateSurface`, `validateModel`, `curveDomain`, `surfaceDomain`,
`evaluateCurve`, `evaluateSurface`, `sampleCurve` and `sampleSurface` are exported.
Curve samples are `{parameter, point}`. Surface samples are U rows of `{u,v,point}`.
Typed native objects can be used directly without parsing.

## IGES delivery

`exportIGES(model, ids)` requires explicit unique IDs. It writes deterministic
IGES 5.3 ASCII S/G/D/P/T records, entity 126 or 128 only, model scale 1 and MM units.
U varies fastest in surface weights and XYZ poles. The final 128 parameters are
U0,U1,V0,V1. Open/nonperiodic flags remain open; there is no solid claim.
Metadata uses printable ASCII, at most 256 characters per string. Directory
labels retain the first eight ID characters; the report retains the full ID map.
Timestamps are fixed at `20000101.000000`. The report includes domains,
record counts/pointers, selected IDs, format, units, and no geometric loss.
Native source/history is separate from exchange bytes. The test harness retains
source, parsed model, evaluated samples, IGES bytes and SHA-256 provenance.

## Reproducible independent consumer

Use modern bundled Node and pnpm. Run `pnpm --filter @barocss/cad` followed by
`lint`, `type-check`, `build:library`, `test`, or `test:consumer`.
Build first before unit/consumer/exchange tests. The packed-consumer test extracts
an actual tarball outside the workspace and checks ESM and TypeScript imports.
The existing release package checker still covers the four release packages.
No shared workspace registration patch is needed: `packages/*` already includes CAD.
No root manifest or lockfile edit is required because CAD adds no dependencies.

The test-only environment is `/Users/user/.barocss-ai/v3/verify-cad-ocp-8.0.1.1.0`.
Create it with Homebrew Python 3.13. Binary-only macOS arm64 wheel versions and
SHA-256 hashes are pinned in `test/consumer-requirements.txt`. To replay setup:

```sh
/opt/homebrew/bin/python3.13 -m venv /Users/user/.barocss-ai/v3/verify-cad-ocp-8.0.1.1.0
/Users/user/.barocss-ai/v3/verify-cad-ocp-8.0.1.1.0/bin/python -m pip install --only-binary=:all: --require-hashes -r packages/barocss-cad/test/consumer-requirements.txt
/Users/user/.barocss-ai/v3/verify-cad-ocp-8.0.1.1.0/bin/python -m pip check
BAROCSS_CAD_PYTHON=/Users/user/.barocss-ai/v3/verify-cad-ocp-8.0.1.1.0/bin/python pnpm --filter @barocss/cad test:exchange
```

Missing Python/OCP fails the gate. There is no skip or alternate self-reader path.
`scripts/read-ocp.py` reads actual bytes, checks complete model diagnostics,
transfers one intended root, checks edge/face B-spline kinds, MM/scale, and samples
17 curve parameters and 9×9 grids for both surfaces, including boundaries.
It independently checks circle/cylinder and asymmetric bilinear formulas.
The named healing sequence is disabled. Precision mode stays file-derived;
no tolerance override is used. Serialized domains and transferred BRep domains
must match. Two negative controls break a pointer and a real pole. The latter
passes structural checks and must fail OCCT geometric comparison.

**Consumer limitation:** OCP 8.0.1.1.0's raw IGES128 entity accessors swap U1/V0
when reading the standard U0,U1,V0,V1 fields. This is also visible in the
[OCCT reader source](https://github.com/Open-Cascade-SAS/OCCT/blob/V7_9_0/src/IGESGeom/IGESGeom_ToolBSplineSurface.cxx).
The report records serialized, raw and transferred domains separately. Actual
transferred BRep domains and all geometric samples are checked against the
source. The writer does not change the standard order to mask this discrepancy.
This establishes the transferred geometry path, not correctness of that raw
consumer metadata API or all CAD consumers.

Default evidence is outside the checkout in the consumer environment's
`evidence/`; `BAROCSS_CAD_EVIDENCE` selects another directory. Reports retain
versions, settings, diagnostics, hashes, task/base SHA and measured maxima.
The tolerances (1e-9 mm analytic, 1e-7 mm exchange) apply only to bounded fixtures.
No universal accuracy, manufacturing, watertight-solid, STEP, trimming, B-Rep
operation, GPU compatibility, performance or AI-authoring claim follows.

## Source and license boundaries

Product source is original MIT code. The independent test consumer is
[cadquery-ocp 8.0.1.1.0](https://pypi.org/project/cadquery-ocp/8.0.1.1.0/) and its
proxy (Apache-2.0 metadata), with VTK 9.6.2 (BSD metadata). OCCT itself uses LGPL
2.1 with the OCCT exception; see [OCCT license](https://github.com/Open-Cascade-SAS/OCCT/blob/V7_9_0/LICENSE_LGPL_21.txt).
Consumer wheels and their license files remain in the isolated environment.
No consumer implementation is included in the product bundle.
