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
