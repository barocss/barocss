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
| `assembly/` | Parts placed and mated: mate solving, faces, drag, exploded views, flattening |
| `subd/` | Editing a SubD cage |
| `chat/` | The agent tool layer: the handlers, the 13 v2 tools (`toolset`, `groups`), their contract, the script language, briefs, questions, proposals, references |
| `drawing/` | The 2D drawing: views, sections, dimensions, callouts, tolerances, tables, issues, SVG, PDF and DXF |
| `print/` | The manufacturability report and the printing rules: walls, holes, overhang, warp, orientation, hollowing |
| `mould/` | Injection moulding: draft, undercuts, walls, the parting line, the quote package |
| `machining/` | CNC milling and turning: holes, cavities, access and setups, features, stock, the drawing check, a 2.5D CAM preview (not for production) |
| `casting/` | Die and sand casting: limits by the alloy's casting family |
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

## Status

Version `0.0.0-experimental`. The API may change between versions: there is no compatibility promise yet. The
package is configured for public scoped-package access. Publishing goes through the repository's release process,
when the owner asks. Before a real publish, the exports, which point at the `.ts` sources, need a build step to
JavaScript and `.d.ts` files.
