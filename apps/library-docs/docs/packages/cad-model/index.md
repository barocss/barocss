# @barocss/cad-model

The studio's model layer, on top of [the kernel](/packages/cad/). It holds:

- the document and its evaluation;
- the modelling commands;
- the analyses and manufacturability checks;
- drawings, BOMs, robots and libraries;
- the agent's tools.

It has no UI: no React, no DOM and no browser storage. An app, such as the studio, supplies those.

## Importing by path

The package is public module by module. Import each module by its path; the package's own entry exports nothing.

<<< @/../samples/cad-model.test.mjs#import

- **Version.** It is `0.0.0-experimental` and unreleased. Its API can change between versions: there is no
  compatibility promise yet.
- **TypeScript sources.** Its modules are the TypeScript sources themselves, as with the kernel.
- **Data files.** JSON data is imported by path too, such as `@barocss/cad-model/library/builtin/materials.json`, and
  the shipped sample rows are under `@barocss/cad-model/samples/rows/`.

| Module | What it holds |
|---|---|
| `engine/` | The studio document (`doc`), its evaluation into bodies and meshes, ids, mesh blobs, the `.bcad` container, shop rows |
| `sketch/` | Sketch profiles, constraints, trim, offset, corners, splines, reading a DXF and its underlay |
| `app/` | The modelling commands as data: shapes, edits, holes, fasteners and threads, sheet metal, mass, measure, materials |
| `assembly/` | Placed parts and mates: solving, shared definitions and revisions, drag, exploded views |
| `subd/` | Editing a SubD cage |
| `frames/` | Frames and weldments: sections, skeletons and 3D sketches, welds, nesting into stock lengths |
| `chat/` | The agent's tool layer: the handlers, the 13 tools (`toolset`, `groups`), the contract, the script language, the brief, questions, proposals |
| `drawing/` | The 2D drawing: views, sections, dimensions, tolerances, tables, issues, and SVG, PDF and DXF output |
| `print/` | The manufacturability report, 3D printing's rules and preparation, and 3MF |
| `mould/` | Injection moulding: draft, undercuts, walls, the parting line, the quote package |
| `machining/` | CNC milling and turning: holes, pockets, access and setups, stock, a 2.5D preview (not for production) |
| `casting/` | Die and sand casting: the report and the pattern, from your casting rules |
| `robot/` | The mates as a robot: joints, kinematics, inertia, dynamics, actuator sizing, URDF, MJCF, SDF and USD |
| `library/` | Materials, process profiles, and standard and team part libraries, as data |
| `standards/` | Values derived from standards, with their sources and licences |
| `team/` | Revisions and sources, several agents on one part, baselines, freshness, change requests, bundles |
| `io/` | A zip writer with no dependencies |
| `rb9/` | The AI scenario ladder: its rungs, a scripted agent, its measures and report |

## The studio document

The document is a `barocss-cad-model` file, schema 3, in millimetres:

- **The model.** Its `nodes` are the features in order, with its parameters and outputs.
- **Everything else on the part:**
  - placed parts and mates;
  - the drawing;
  - shop rows with their sources;
  - the process settings;
  - the brief and requirements;
  - proposals and history.

[The .bcad document](/reference/document) lists the fields. The model converts to the kernel's part document to
evaluate.

<<< @/../samples/cad-model.test.mjs#doc

## Evaluation and its caches

`evaluateDoc(doc, revision)` evaluates a document into bodies. Each body has:

- its key (`b<k>`, from the feature that made it);
- its display mesh, with its faces and edges;
- its volume, mass and centroid;
- its surface area;
- its notes.

The last evaluation is kept, and the next one reuses every kernel feature whose definition is unchanged, so editing
one value re-runs only what depends on it. In the studio this runs in a worker, and a newer request makes an older
reply stale (see [Revisions and sources](/guide/concepts#revisions-and-sources)).

<<< @/../samples/cad-model.test.mjs#file

## Data rules

- **Sources.** Every catalogue or standard value names its source: a public page with its address and the date
  read, a value derived by a stated rule, or an estimate marked as one.
- **Your lists.** Lists a shop owns, such as stock, fastener sizes or casting rules, are yours to load. None is built
  in (see [Shop rows](/studio/rows)).
- **No copied standards.** No standard's text or tables are copied.

## The agent's tools

`chat/` is the tool layer the chat, `cad-mcp` and `cad-cli` serve:

- `chat/toolset`: the 13 tools and the system prompt;
- `chat/groups`: each action and its handler;
- `chat/tools`: the dispatcher, with its autonomy and approval gates.

See [Tools](/agent/tools).
