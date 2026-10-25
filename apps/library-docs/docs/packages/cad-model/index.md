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
| `api/` | The object facade over the data-and-functions core, imported as `@barocss/cad-model/api`. `part()` makes an immutable studio part and `assembly()` an immutable assembly, each method returning a new one, with typed edge and face selectors, `.doc`, plain results and one error class, `BarocssError`. See [Object API](/packages/api) |
| `engine/` | The studio document (`doc`), its evaluation into bodies and meshes, ids, mesh blobs, the `.bcad` container, shop rows and their sources, flattening an assembly |
| `engine/schema/` | The types of the brief, questions, references, drafts, requirements and proposals; their functions are in `chat/` |
| `sketch/` | Sketch profiles, constraints, trim, offset, corners, splines, reading a DXF and its underlay |
| `app/` | The modelling commands as data: shapes, edits, holes, fasteners and threads, sheet metal, mass, measure, materials |
| `assembly/` | Placed parts and mates: solving, shared definitions and revisions, drag, exploded views |
| `subd/` | Editing a SubD cage |
| `frames/` | Frames and weldments: sections, skeletons and 3D sketches, welds, nesting into stock lengths |
| `chat/` | The agent's tool layer: the handlers, the 13 tools (`toolset`, `groups`), the contract, the script language, and the brief's, questions' and proposals' functions |
| `drawing/` | The 2D drawing: views, sections, dimensions, tolerances, tables, issues |
| `print/` | The manufacturability report, 3D printing's rules and preparation, and 3MF |
| `mould/` | Injection moulding: draft, undercuts, walls, the parting line, the quote package |
| `machining/` | CNC milling and turning: holes, pockets, access and setups, stock, a 2.5D preview (not for production) |
| `casting/` | Die and sand casting: the report and the pattern, from your casting rules |
| `robot/` | The mates as a robot: joints, kinematics, inertia, dynamics, actuator sizing, URDF, MJCF, SDF and USD |
| `library/` | Materials, process profiles, and standard and team part libraries, as data |
| `standards/` | Values derived from standards, with their sources and licences |
| `versions/` | Named versions of a document and its branches: making, listing and restoring versions, compare (what changed, feature by feature) and a three-way merge with typed conflicts |
| `team/` | Export sources, several agents on one part, baselines, freshness, change requests, bundles |
| `analysis/` | The analyses the agent asks for (mass properties, interference and clearance, sections, wall thickness, draft), and alignment against a reference part |
| `bom/` | The bill of materials |
| `io/` | Output formats: the drawing's SVG, PDF and DXF, and a zip writer with no dependencies |
| `util/` | Small shared helpers: unit factors, guards, ids, rounding, SHA-256 digests, the document revision |
| `rb9/` | The AI scenario ladder: its rungs, a scripted agent, its measures and report |

## Assembly and robot motions

Use the `api/` facade's `assembly(...).robot()` to read an assembly as a robot. `robot.path(...)` takes at least
two waypoints; `robot.motion(name)` reads a saved path. Joint inputs use degrees for turns and mm for slides.
Velocity and acceleration limits use deg/s and deg/s², or mm/s and mm/s².

For supported looped paths, supply driving-joint values only. `duration()` returns seconds. `poseAt(t)` returns
the driving values at time `t` in seconds; pass them to `robot.pose(...)` to obtain solved passive-joint values
and link placements. `problems()` returns `[]` for a supported, closable path or reports a typed refusal.
Extra passive-joint waypoint inputs give `LOOP_PASSIVE`; finite passive loop-joint bounds remain unsupported.

Timing and loop closure do not certify collision clearance. `RobotPath.check()` still refuses looped paths
with `LOOP_OPEN`: its sweep and continuous collision checks do not follow the closed motion. See
[Robots in code](/studio/robots#in-code) for the motion contract and
[Moving it](/studio/robots#moving-it) for the agent's supported loop checks and playback limits.

`robot.inertia()` returns `{ links }`. Each link's `mass` and counted `bodies[].mass` use g; `centroid` uses mm.
`inertia` is a nested 3×3 matrix about the centre of mass, expressed in the link frame, in g·mm².
The centroid uses that same link frame. `principal.moments` uses g·mm²; `frame.origin` uses mm in the part's coordinates.
Check each link's `bodies` and `issues` before using its totals. A body is excluded with `NO_VOLUME` when `volume` is `null`, or centroid or inertia data is absent.
If no bodies are counted or their total mass is not positive, `NO_BODY` accompanies an empty `bodies` list and zero mass and inertia.
Other issues identify assumed materials or failed inertia checks; a returned total alone does not establish a usable model.
`robot.gravity(values, g)` returns joint-keyed `torques` and `generalized`; read `units[key]` for N·mm on turns or N on slides.
Its returned `gravity` is a magnitude in mm/s², not the input vector. See [Robot unit boundaries](/studio/robots#robot-unit-boundaries) for the full public unit contract.

### Static gravity experiment

`robot.gravityExperiment({ values, gravity })` captures one prescribed static pose and its gravity holding-torque
report. Supply exactly one joint angle in degrees and an explicit finite three-component gravity vector in mm/s²;
there is no gravity default. The profile admits exactly one connected open revolute or continuous joint, with no
loops or couplings. Nested part occurrences in the moving part are outside this profile. Every moving body needs an explicit known material and positive finite mass. The moving link must have resolved
inertia with finite components and no reported issues. The report's torque uses N·mm. It uses the existing Model
link-inertia and gravity calculation.

In this report, `inputs.gravity` is the supplied document world XYZ vector in mm/s², while `result.gravity` is its scalar magnitude in mm/s².

The returned object's `report` getter gives a deep copy. Use `matches(doc, options)` to compare the complete captured
document and explicit inputs with the current ones. If their canonical contents differ, `matches` returns false and the report is stale. This check
does not rerun the calculation or certify integrity. The profile reports static holding torque, not free motion,
contact, actuator suitability or physical validation. It does not change the Studio document schema.
Studio's STATIC GRAVITY panel requires explicit joint, angle and world XYZ gravity inputs. Calculation leaves the viewport pose unchanged.
Results stay local to the panel. Changed document or input contents mark them stale; a refused calculation can keep the previous result visible.
This control calculates holding torque at a prescribed static pose; it does not simulate free motion.

Call `record()` to keep an independent JSON record of the past calculation. Its envelope has format
`barocss-gravity-experiment-record` and schema `1`. `toJSON()` returns an object; serialize it with
`JSON.stringify()` and restore the text with `GravityExperimentRecord.parse()`. Studio document Save and Open
are separate from this record JSON. With the supported `robot` and explicit `options` described above:

```js
import { GravityExperimentRecord } from '@barocss/cad-model/api/experimentRecord';

const record = robot.gravityExperiment(options).record();
const data = record.toJSON();
const text = JSON.stringify(data);
const restored = GravityExperimentRecord.parse(text);
const preview = restored.preview; // Typed display fields, including torque in N·mm.
const pastReport = restored.report; // unknown; the full past report.
const inputsMatch = restored.matches(robot.doc, options);
```

`preview` and `report` return copies. Parsing rejects unsupported format, schema, calculation profile or units,
non-finite JSON numbers, and invalid required structure or inconsistent bindings. It does not validate the complete
inertia schema. A record describes a past calculation: parsing does not recalculate it, prove authenticity, or check
compatibility with the current producer code or material catalogue. Consistent finite changes to numerical results
can pass these checks. `matches(doc, options)` compares the full canonical document and explicit inputs; if either
canonical content differs, it returns false and the record is stale. A matching record does not establish a new result.

When present, a counted body's optional `materialSnapshot` retains `bodyMaterialId`, `inputMaterialId`,
`resolvedMaterialId` and `fallback` (`none`, `unset` or `unknown-id`) from the calculation.
`densityGPerCm3` is the density used, in g/cm³; it can differ from the declared `catalogueDensityGPerCm3` (number or null).
The catalogue 0.7.0 version, source ID/text/page and estimate fields describe the declared row; they do not certify the used density, authenticity or measured properties.
`inertiaSource` distinguishes `mmgs-density-scaled` from an actually applied `callback-override`.
The mass density does not establish the source of the callback's inertia tensor.
Older schema 1 records can omit these fields: no current catalogue values are filled in. The full `report` remains `unknown`.
Each read of the separate `record.materialPreview` getter returns a detached typed copy of recorded material fields with link and body IDs.
It returns `null` when `inertia.links` is absent. Missing per-body `materialSnapshot` or `inertiaSource` becomes `null`; empty bodies stay empty.
For otherwise accepted records, material-field shape errors raise `VALUE` on getter access; `parse` keeps its existing finite-JSON checks.
The existing `preview`, unknown `report`, `matches` and schema `1` remain unchanged.
The getter does not fill missing fields from the current catalogue or certify authenticity, measured properties or current compatibility.
Reading or displaying these historical fields does not recalculate the result or turn it into a new measurement.

In Studio's STATIC GRAVITY panel, use the Download button to export the displayed record as independent JSON.
Use `Open gravity record` to load it as a historical record, not a recalculated result, even when document and inputs match.
Opening a valid record fills the joint, angle and world XYZ gravity fields. Choose `Calculate holding torque` to calculate again.
An invalid file reports an error and preserves the previous record and input fields. These controls do not save or open a Studio document.
Expand **Recorded material inputs** to read the recorded metadata. Missing metadata is marked **Not recorded**; invalid material metadata makes only this section unavailable.
This does not change the existing Historical/Match/Stale status or the record operations.

### Input contracts

Constructors, getters and operations follow the input rules below.
These rules do not extend the supported motion contract above.

- Direct `RobotPath` construction copies nested waypoints and limits; its getters return copies.
- `Robot`, `RobotPath` and `Assembly` constructors also copy their input document. Changing that input later does
  not change the stored snapshot. `Robot.doc` and `Assembly.doc` return copies, as do the path's motion getters.
  Copying cost has not been measured. Inputs that cannot be cloned may fail at construction rather than later use.
- Open-chain `duration()` checks the path on its robot's tree before timing it, as `poseAt()` does. Typed refusals
  use the first finding's code and message, with the findings in `details.problems`.
- `robot.withMotion(name, path)` checks the destination robot's tree, including paths from another robot.
  It permits zero- or one-waypoint and untimed recording drafts; saving does not make them ready to play.
  For loops, it checks closure at each saved waypoint separately. This does not certify the intervening path,
  continuation through earlier seams, finite passive-joint bounds or sweep/CCD.
- Motion waypoints must be records of finite numeric joint values. Malformed paths and path options give `VALUE`;
  malformed limits or explicitly supplied non-finite `velocity`, `acceleration` or `jerk` give `LIMITS_BAD`.
  Missing recording limits remain absent; this does not remove the draft allowance above or certify a whole path.
- A studio part's `meshes()` returns copies of positions, normals, indices and lines. Editing those typed arrays
  does not change the core's cached mesh data. Passing them to a GPU Scene still shares those returned arrays
  with that Scene, as described in the [Scene input contract](/packages/gpu/#scene-geometry-input-candidate).
- A process `pull` must have exactly three finite coordinates and match one of the existing six unit directions:
  positive or negative X, Y or Z. Other vectors give `VALUE`; this does not add arbitrary pull directions.
- Material lookup for an unknown body gives `NO_BODY`. Locking an unknown child or target gives `NO_PART`;
  an unknown target is not treated as the base part.
- Library-part options must be a non-null object, not an array, with a non-empty `face` string. `point` and an
  optional `xDirection` each require exactly three finite numbers. Malformed inputs give `VALUE`.

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

In code, the [object facade](/packages/api) writes the document as the studio's own commands do, and the core
evaluates it:

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
