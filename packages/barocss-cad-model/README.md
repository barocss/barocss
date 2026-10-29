# @barocss/cad-model (experimental)

The CAD document model and engineering domain logic, layered on [`@barocss/cad`](../barocss-cad), the kernel:
the studio document and its evaluation, analyses, manufacturability checks, libraries, drawings' data and the agent
tools. It has no UI. There is no React, no DOM and no browser storage. An app such as `apps/cad-studio` supplies those.

## Public API

The package is fully public. Every module under `src/` is public API, imported by its path:

```ts
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { printability } from '@barocss/cad-model/print/rules';
import MATERIALS from '@barocss/cad-model/library/builtin/materials.json';
```

There is no curated entry and no internal/public split. `src/index.ts` exports nothing; import the module you need.

| Module | What it holds |
|---|---|
| `engine/` | The studio document (`doc`), its evaluation into bodies and meshes, ids, blobs, the `.bcad` container, migrations, STL and STEP units |
| `sketch/` | Sketch profiles, constraints and rules, trim, offset, corners, splines, DXF read and underlay |
| `app/` | The modelling commands as data: primitives, edits, holes, fasteners and threads, frames, sheet metal, mass, measure, materials |
| `frames/` | Frames and weldments: shared skeletons and the 3D skeleton sketch, the section library and section tables, weld joints and bead ownership, T-slot interfaces, stock nesting |
| `assembly/` | Parts placed and mated: mate solving, faces, drag, exploded views, flattening |
| `subd/` | Editing a SubD cage |
| `chat/` | The agent tool layer: the handlers, the 13 v2 tools (`toolset`, `groups`), their contract, the script language, briefs, questions, proposals, references |
| `drawing/` | The 2D drawing: views, sections, dimensions, callouts, tolerances, tables, issues, SVG, PDF and DXF |
| `print/` | The manufacturability report and the printing rules: walls, holes, overhang, warp, orientation, hollowing |
| `mould/` | Injection moulding: draft, undercuts, walls, the parting line, the quote package |
| `machining/` | CNC milling and turning: holes, cavities, access and setups, features, stock, the drawing check, a 2.5D CAM preview (not for production) |
| `casting/` | Die and sand casting: the castability report and the pattern, by the limits and allowances in the person's casting rules (rows they load; `samples/rows/casting-rules.json` is an example) |
| `robot/` | The mate graph as a robot: joints, FK and IK, inertia, dynamics, actuator sizing, URDF, MJCF and USD |
| `library/` | Materials and process profiles, and standard and team part libraries, as data (`builtin/*.json`) |
| `standards/` | Standards-derived values with their provenance and licences |
| `team/` | Several agents on one part: candidates, baselines, freshness, change requests, bundles |
| `rb9/` | The AI scenario ladder (rungs, a scripted agent, measures and the report) |
| `io/` | A dependency-free zip writer |

Data rules:
- Every catalogue or standard value names its source: a public page (with its URL and the date read), a value derived by a stated rule, or a BaroCSS estimate flagged as one.
- Lists a shop owns, such as stock, are the user's to load; none is built in.
- No standard's text or tables are copied.

### Rectangular cut patterns

`part.rectangularFeaturePattern({ axis: 'x', spacing: 16, count: 3, axis2: 'y', spacing2: 16, count2: 2 })`
repeats the tool of the current unsuppressed subtract feature. It keeps the original stock and cut.
It adds one editable `rectangular-feature-pattern` document node. The two directions are distinct global
X, Y or Z axes. Each count is a whole number from 1 to 64. Their product is at most 64, including the
original cut. Both spacings must be positive and at most 10000. Both spacings can bind to parameters;
the two counts cannot. The command defaults to a 3 × 2 grid on global X and Y. Existing schema-3 files
store the node, its stable ID, body reference and spacing bindings without a migration.

### Path cut patterns

`part.curveFeaturePattern({ path, spacing: 8, count: 5 })` repeats the tool of the current
unsuppressed subtract result. It keeps the original cut. Copies use the offset from the path start
to each spacing distance. Their orientation stays fixed. `path` is either a literal raw NURBS path
(`degree`, `knots`, `controlPoints`, `weights`) or `{ objectId }`, which resolves the current direct
curve in the base document on every build. Hidden and renamed objects keep their reference.
Nested and placed parts must use literal paths. The GUI Path choice stores a stable object reference.

Use an open degree 1 polyline or degree 2 straight spans with double interior knots and exact midpoint
controls. Weights must equal 1. There are 2 to 64 finite control points, each coordinate within
±10000 mm. Each span has positive length. Spacing is positive and at most 10000 mm. Count is a whole
number from 1 to 64, including the original cut. `(count - 1) * spacing` must fit the current path
without extrapolation or tolerance. Spacing can bind to a parameter. Count cannot. The saved
`curve-feature-pattern` node keeps its parent, literal path or object reference, spacing and count
in the existing file schema. Missing, ambiguous, mixed or unsupported paths refuse the operation.

## Status

Version `0.0.0-experimental`. The API may change between versions: there is no compatibility promise yet. The
package is configured for public scoped-package access. Publishing goes through the repository's release process,
when the owner asks. Before a real publish, the exports, which point at the `.ts` sources, need a build step to
JavaScript and `.d.ts` files.


### Worker wire lifetime

`WireSender` owns a blob-eviction subscription and retains the nodes and blob identifiers it has sent.
Call `dispose()` when that sender is retired. Disposal is idempotent, releases the subscription and
retained tables, and leaves the shared blob store unchanged. A disposed sender rejects `pack()`;
late `forget()` calls are harmless. Use a new sender for a new worker protocol session.

### Drawing location ownership

Equal dimension values do not identify the same measurement. Duplicate checks and automatic
placement retain each independent hole target and both measurement endpoints. Counted pitches
retain their extension direction. Explicit pattern, pitch-circle and compound-hole relationships
are checked separately from displayed callout text.

`SheetInputs.locationOwner` supplies an optional authored-hole identity for compound locations.
Pass the same resolver to the trailing `autoDimensions` argument when using that function directly.
The normal document/Studio pipelines supply it. A custom string formatter alone does not establish
compound ownership; absent or unresolved ownership keeps independent locations conservative.

### Fill cut patterns

`part.fillFeaturePattern({ region: { points }, anchor: [8.5, 8.5], spacing: 12,
count: 4, spacing2: 10, count2: 3 })` repeats the current difference's original CUT tool
on a finite world XY grid. The simple straight region has 3–16 finite vertices.
Each count is 1–64, including the original; their product is at most 64 before masking.
Both positive spacings can bind to parameters. Counts and reference coordinates cannot bind.

The region tests authored reference points, including exact boundary points. A cutter can cross
the region boundary. The original CUT always remains, even when its reference lies outside.
Stable names use original grid indices, `@i,j`.

The command's **Region snapshot** captures resolved points from one eligible closed straight
world XY sketch. Later sketch edits do not change the pattern. The feature editor can capture
a new snapshot. Curved, holed, multiple, unresolved and unsupported framed regions are refused.
The copied inline region and reference survive native Save/Open and nested part placement.

### Trimmed direct surfaces

`directOps.reverseSurface` preserves one simple stored trim loop of 3..160 UV points on
an affine planar degree-1, 2-by-2 support with equal positive weights. Both axes and
nonunit domains are supported. It keeps the loop order and keep flag, maps the UV
coordinates, and checks topology and world binding under the existing 1e-7 mm limit.
The new object owns its trim arrays. The hidden original retains its source, name,
ID and trims. Unsupported trimmed inputs refuse with `DIRECT_VALUE` before publication.
This operation preserves the stored polyline, not an ideal trimming curve or a solid.

`splitSurface`, `surfaceRegion` and `extendSurface` still refuse surfaces with trims.
`surfaceIntersection` refuses either trimmed operand. These operations do not yet map
or clip trim boundaries.

`directIGES` refuses the whole export when any visible surface has trims. Hidden trimmed
objects do not block export of the other visible curves and surfaces. Explicit `Untrim`
removes trims when that is intended; ordinary untrimmed operations remain available.

### Whole-surface Thicken

`part().thicken(surface, { t, side })` creates a new body from an owned raw NURBS
snapshot. `surface` has exactly `degreeU`, `degreeV`, `knotsU`, `knotsV`,
`controlPoints` and `weights`. The command works on an empty part and retains
existing bodies. `t` is the total positive thickness in mm and can use `param(name)`.
Only `t` binds to a parameter. `side` is `normal` (default), `reverse` or `both`.
The normal is `du × dv`; `both` offsets half the thickness in each direction.

The Studio Thicken command copies one selected whole surface through the same
snapshot checks and uses Preview, Apply and Cancel. The source stays independent:
later source edits or deletion do not change an accepted body. Trimmed selections
and malformed trim containers refuse before the snapshot is copied. API-created
nodes use the label `Whole surface snapshot`; selected sources retain their name.
The saved feature exposes Thickness and Side in the editor after reopening.

The existing construction uses 40 samples per direction. Curved results are
faceted approximations. Existing fold and geometry refusals still apply.

```ts
import { part, param, type RawNurbsSurface } from '@barocss/cad-model/api';

const surface: RawNurbsSurface = {
  degreeU: 1, degreeV: 1,
  knotsU: [-2, -2, 6, 6], knotsV: [1, 1, 7, 7],
  controlPoints: [[[10, -6, 3], [10, 24, 3]], [[50, -6, 3], [50, 24, 3]]],
  weights: [[1, 1], [1, 1]],
};
const wall = part('Wall').parameter('wall', 2).thicken(surface, { t: param('wall') });
const wider = wall.withParameters({ wall: 3 });
```
