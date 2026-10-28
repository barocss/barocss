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

The `engine/font/trueType` reader takes a copied, bounded static TTF input and returns metrics and unhinted
quadratic contours. `engine/font/source` stores original bytes with supplied filename/source/license metadata;
`engine/font/profiles` converts admitted glyphs to component profiles at an explicit chord tolerance. The
`kind: 'text'` recipe and `part().text()` build an independent native solid that stays editable after Save/Open.
One authored output can hold several physical bodies. No top-level font registry or new document/container
version is added. Studio supplies font upload and the Text HUD; the original test fonts are not runtime defaults.
Shaping, kerning, bidi, normalization and text emboss/wrap remain outside this feature. See
[Text from font outlines](/how/text) and the [Text API example](/packages/api#text-from-a-font-file).

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

## Reading saved render settings

Import `readRender` and `validateRenderShadowLights` from `@barocss/cad-model/engine/render`.
`readRender(value)` returns `RenderSettings` with the reader's existing defaults and clamps.
For a supplied `lights` array, it reads only the first 12 input entries,
before skipping unknown light kinds. It then applies the shadow-field checks.
Invalid shadow fields or caster counts throw `VALUE`.

`validateRenderShadowLights(lights)` returns `void` without changing the supplied lights.
It checks point/spot shadow fields and eligible caster counts.
It does not validate GPU position, direction or range inputs.
Invalid shadow fields or caster counts throw `VALUE`.
See [Saved render light fields](/reference/document#saved-render-light-fields) for the stored fields,
eligibility limits and radius rules.

## Transforming one body

A studio part inherits `moved(location)` from the shared Part API. It returns a new part with transform features;
it does not set an absolute assembly placement. Keep the returned part. Calling `moved` on that returned part
applies the transform again to its current geometry, while the original part stays unchanged.

Use `part.bodies()` to obtain current body keys. With several bodies, first choose `part.body(key)`;
`moved` acts on that body, not every body in the document. A missing body gives `NO_BODY`, no choice among several
gives `BODY_AMBIGUOUS`, and an unknown key passed to `body(key)` gives `BODY_UNKNOWN`.

```ts
import { Location, type StudioPart } from '@barocss/cad-model/api';

function turnAndMove(part: StudioPart, bodyKey: string): StudioPart {
  return part.body(bodyKey).moved(Location.of({
    rotation: [0, 0, 90], position: [30, 0, 0],
  }));
}
```

`Location` rotations use degrees about the document origin, in X, then Y, then Z order. Translation follows in
world XYZ millimetres. It does not rotate about the body's centre or use its bounding box as a pivot.
For the location above, an illustrative point on the body follows this calculation:

| Step | Point in mm |
|---|---|
| Input | `[10, 0, 0]` |
| Rotate +90° about Z | `[0, 10, 0]` |
| Translate by `[30, 0, 0]` | `[30, 10, 0]` |
| Apply the same location again | `[20, 30, 0]` |

![A body point is rotated about the origin before translation; repeating moved applies another transform](/diagrams/part-transform-order.svg)

[Open the diagram at full size](/diagrams/part-transform-order.svg).

The diagram is a coordinate calculation, not an API render or a construction check. For placement of an assembly
instance, use [the assembly API](/packages/api#assemblies); for other body transforms, see
[Object API](/packages/api#parts).

## Writing a root body's STL

Import `evaluateDoc` and `stlFor` from `@barocss/cad-model/engine/evaluate`. `stlFor` takes a `StudioDoc`,
a root body's key from that document's evaluated bodies, and optional `segmentsPerQuarter` settings.
This helper selects only the first evaluated root body:

```ts
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluateDoc, stlFor } from '@barocss/cad-model/engine/evaluate';

function firstRootStl(doc: StudioDoc, revision: number): Uint8Array | null {
  const r = evaluateDoc(doc, revision);
  if (!r.ok || r.bodies.length === 0) return null;
  return stlFor(doc, r.bodies[0].key, { segmentsPerQuarter: 16 });
}
```

Supply `revision` as the caller's numeric evaluation tag; it is not the saved source-record revision.
A successful evaluation can still produce `null` from `stlFor`, so check the helper's result before writing a file.
A missing root body, a non-finite `segmentsPerQuarter`, or a caught evaluation/export failure returns `null`;
this result does not identify which cause occurred. The studio's [display-mesh fallback](/studio/files#exports)
is a separate UI policy; this helper does not provide it or create a `.source.json` record.

### STL and its source record

To keep an STL with its source information, create both from the same document and pass the STL's exact filename
to `sourceRecord`. The following helper returns two named files in memory; it does not write or download them.
It returns `null` if evaluation fails, there is no root body, or `stlFor` cannot produce the STL.

```ts
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluateDoc, stlFor } from '@barocss/cad-model/engine/evaluate';
import { sourceRecord, sourceBytes, sourceName } from '@barocss/cad-model/team/source';

type MemoryFile = { name: string; bytes: Uint8Array };

function firstRootStlFiles(
  doc: StudioDoc,
  revision: number,
  stlName = 'part.stl',
): [MemoryFile, MemoryFile] | null {
  const result = evaluateDoc(doc, revision);
  if (!result.ok || result.bodies.length === 0) return null;
  const bytes = stlFor(doc, result.bodies[0].key, { segmentsPerQuarter: 16 });
  if (bytes === null) return null;
  const source = sourceRecord(doc, [stlName]);
  return [
    { name: stlName, bytes },
    { name: sourceName(stlName), bytes: sourceBytes(source) },
  ];
}
```

The caller's numeric `revision` tags the evaluation. The source record's string `revision` instead identifies
the document's canonical revision content. Its `digest` is the SHA-256 of that input content, not a checksum of
the STL bytes or a certificate of geometric accuracy. `sourceName('part.stl')` gives `part.source.json`.
Keep the returned pair together; after changing the document, produce a new pair rather than reusing the old record.

![STL bytes and their separate source-record JSON from the same document](/diagrams/stl-source-pair.svg)

### Reading a source record

`sourceRecord(doc, files, options)` from `@barocss/cad-model/team/source` returns these fields:

| Field | Meaning |
|---|---|
| `format` | The literal `barocss-source`. |
| `version` | Record version `1`. |
| `revision` | The 16-character hexadecimal revision from `revisionOf(doc)`, for detecting stale input. It covers the revision fields, not every saved document field. |
| `digest` | SHA-256 of the UTF-8 canonical content used for that revision. It is not a checksum of the exported files. |
| `files` | A copy of the supplied file-name list. It contains names, not file contents or checksums. |
| `handSet` | Robot base-link and joint settings, included only with `{ robot: true }`. It is omitted by default. |

`sourceBytes(record)` encodes the record as JSON bytes. `sourceName(name)` replaces the last extension with
`.source.json`, or appends that suffix when there is no matching extension. It only derives a name; it does not
validate a file name or make it safe for a destination path.

When reading the JSON, treat `revision` and `digest` as identifiers for the recorded input content. Reading the
record does not verify the named export files, authenticate the author, or establish physical accuracy.
For robot exports, read `handSet` when present; its omission does not mean the robot used zero limits or ratings.

Keep the record with the files it names and keep the editable `.bcad` document separately. The record is not a
saved document and cannot reconstruct the model from its revision or digest.

## Solid lofts with a copied guide

`part(...).loft(sections, options)` builds a solid from closed sketches. It returns a new part with the new body
selected. Use that returned part or its `.doc`. The separate `directOps.loft()` operation below adds a surface
to direct geometry.

Supply sections in the intended order. Each section takes a `sketch` and exactly one of `z` or `frame`.
A legacy `z` is a finite height in mm. Use one sketch plane and strictly increasing `z` values for that form.
An explicit frame gives a world-mm `origin` and perpendicular unit `xAxis` and `yAxis` vectors. A guide requires explicit frames on both sections; its control points are already
in world mm.

```ts
import { part, sketch, Plane } from '@barocss/cad-model/api';

const frame = (z: number) => ({
  origin: [0, 0, z] as [number, number, number],
  xAxis: [1, 0, 0] as [number, number, number],
  yAxis: [0, 1, 0] as [number, number, number],
});
const model = part('Cubic guided loft').loft([
  { sketch: sketch(Plane.XY).circle({ r: 1 }), frame: frame(0) },
  { sketch: sketch(Plane.XY.offset(3)).circle({ r: 4 }), frame: frame(3) },
], {
  guide: {
    kind: 'cubic-bezier',
    controlPoints: [[1, 0, 0], [4, 0, 1], [2, 0, 2], [4, 0, 3]],
  },
});
const doc = model.doc;
```

The circles have radii of 1 and 4 mm on parallel caps 3 mm apart. The guide starts at `[1, 0, 0]` and ends at
`[4, 0, 3]`, exactly at the caps' +X seams. Its inner controls lie on the planes at one-third and two-thirds
of the cap separation: here, z = 1 and 2 mm.

A `quadratic-bezier` guide takes exactly three finite control points, with its middle control on the exact cap
midplane. A `cubic-bezier` guide takes exactly four, with its inner controls on the exact one-third and two-thirds
planes. Both require exact seam endpoints. This is one bounded seam guide for two sections on parallel frames
with identical axes. The Kernel checks the supported conic or homothetic mixed line/arc profiles and the existing
coordinate limits. Arbitrary rails, multiple guides, surfaces as sections, and smooth interpolation with a guide
are outside this contract. A refused loft leaves the previous part and inputs unchanged.

To use the existing height-based path without a guide, omit the API `guide` option and supply `z` sections.
Do not pass `null` or the string `'None'` as an API guide.

In Studio, Shift-click two finished section sketches in the intended order, open **Loft**, then choose an available
curve from **Guide (copied)**. Use that list: picking the curve separately in the viewport clears the sketch selection.
A guided loft keeps the picked section order and their frames. **None**, the default, uses the existing section
heights and height sorting. An imported guide must be one world-mm quadratic or cubic Bézier span, with exactly
three or four controls, clamped end knots, no internal knots, and finite positive equal weights. Trimmed objects,
unbaked transforms, and nonconstant rational weights are refused.

Frames and guide controls are copied snapshots. A separately imported source curve does not become a live
reference. Later changes to that curve or the caller's arrays do not update the stored loft. This construction
does not certify manufacturing suitability.

## Direct sweep and loft surfaces

`directOps` from `@barocss/cad-model/engine/direct` works on direct curves. Its sweep and loft add a
surface and return a new `DirectGeometry`; use the returned value. These operations differ from the
[solid features made from sketches](/studio/features#from-a-sketch).

- `directOps.sweep(direct, profileId, railId)` uses the first curve as the profile and the second as the rail.
  In authored XYZ coordinates, in mm, its surface follows `P(u) + R(v) - R(vMin)`. The profile translates
  without turning to follow the rail. This is not the feature Sweep that keeps a sketch square to its path.
- `directOps.loft(direct, curveIds)` passes through 2–15 curves in the supplied order. It aligns degrees and
  interior knots, but the parameter-domain endpoints must already match within `1e-12`. This tolerance is in
  parameter values, not mm. A mismatch gives `DIRECT_RANGE`; trim or rebuild the curves to one parameter range.
  A curve count outside 2–15 gives `DIRECT_LOFT`.

```ts
import { directOps, type DirectGeometry } from '@barocss/cad-model/engine/direct';

export function sweptSurface(direct: DirectGeometry, profileId: string, railId: string): DirectGeometry {
  return directOps.sweep(direct, profileId, railId);
}

export function loftedSurface(direct: DirectGeometry, orderedCurveIds: string[]): DirectGeometry {
  return directOps.loft(direct, orderedCurveIds);
}
```

Supply IDs from the current direct geometry. Neither helper above commits a Studio document.

![A straight profile keeps its X direction as a curved rail translates it through three world-coordinate positions](/diagrams/direct-sweep-surface.svg)

[Open the direct sweep diagram at full size](/diagrams/direct-sweep-surface.svg).

The diagram is a calculated coordinate example, not an API render. For `P(u) = [10u, 0, 0]` and
`R(v) = [0, 20v, 20v²]`, with `u` and `v` from 0 to 1, the rail starts at `[0, 0, 0]` mm. At `v = 0.5`,
the profile runs from `[0, 10, 5]` to `[10, 10, 5]` mm; at `v = 1`, it runs from `[0, 20, 20]` to
`[10, 20, 20]` mm. Its direction stays along X. This calculation does not establish that arbitrary input curves
will pass the construction checks.

## Route bundles in code

Import the route-bundle helpers from `@barocss/cad-model/engine/routeBundle`. A bundle ties one interior control pole on each of two curves to one translation in world millimetres. It does not join the curves or move each whole curve.

The input must contain exactly two distinct direct curves. Each curve must be an open, clamped cubic with positive weights. Each member selects an existing interior pole by its numeric string `handleKey` and names an existing active `sweep-curve` feature and its earlier circular sketch profile. The profile must have a finite positive radius; associated or placed profiles, extra regions, and holes are outside this contract. Each copied sweep path must already match its direct curve. Members must use distinct curves, source geometries, profiles, and sweeps. A document can contain one bundle; nested bundle metadata is not supported.

| Helper | Result and meaning |
| --- | --- |
| `createRouteBundle(doc, input)` | Returns a copied `StudioDoc` candidate with schema `4`, one tie, two members, and markers on the two sweeps. It uses existing inputs; it does not create the curves, profiles, or sweeps. |
| `moveRouteBundle(frozenStart, bundleId, totalDeltaMM, expectedDocumentIdentity)` | Returns a candidate measured from the unchanged drag-start document. Both selected poles and the tie anchor receive the same total delta. Endpoints and all other poles remain fixed. The copied sweep paths are updated to match. |
| `detachRouteBundle(doc, bundleId, expectedDocumentIdentity)` | Removes the bundle and its sweep markers, and returns a schema `3` candidate. It keeps the current curve coordinates and copied sweep paths. |
| `assertRouteBundleDocument(input)` | Returns `void` if the route-bundle admission checks accept the input. It does not evaluate the whole model. |
| `routeBundleDocumentIdentity(doc)` | Returns the full canonical document identity used by these helpers. Use this exact string, not `revisionOf(doc)` or a revision label. |

`createRouteBundle` receives `expectedDocumentIdentity` in its input object. Move and detach receive it as their last argument. A stale identity or an invalid bundle input is refused with `BAD_REFERENCE`. The stored source binding and copied path must still match the current direct curve.

The following helpers take IDs and selections from the caller's existing document. They return candidates only. Evaluate the whole candidate and commit it only after that evaluation succeeds. For a drag, also check that the accepted document still has `baseIdentity` before commit; discard the candidate if the document has changed.

```ts
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import {
  assertRouteBundleDocument,
  createRouteBundle,
  detachRouteBundle,
  moveRouteBundle,
  routeBundleDocumentIdentity,
  type CreateRouteBundleInput,
} from '@barocss/cad-model/engine/routeBundle';

type DeltaMM = [number, number, number];
type NewBundle = Omit<CreateRouteBundleInput, 'expectedDocumentIdentity'>;

export function createRouteCandidate(
  accepted: StudioDoc,
  input: NewBundle,
): StudioDoc {
  assertRouteBundleDocument(accepted);
  return createRouteBundle(accepted, {
    ...input,
    expectedDocumentIdentity: routeBundleDocumentIdentity(accepted),
  });
}

// Call once at drag start, after the bundle candidate has been accepted.
export function beginRouteDrag(accepted: StudioDoc, bundleId: string) {
  const frozenStart = structuredClone(accepted);
  const baseIdentity = routeBundleDocumentIdentity(frozenStart);
  return {
    baseIdentity,
    candidateFromTotal(totalDeltaMM: DeltaMM): StudioDoc {
      return moveRouteBundle(
        frozenStart, bundleId, totalDeltaMM, baseIdentity,
      );
    },
  };
}

export function detachRouteCandidate(
  accepted: StudioDoc,
  bundleId: string,
): StudioDoc {
  return detachRouteBundle(
    accepted, bundleId, routeBundleDocumentIdentity(accepted),
  );
}
```

For every drag update, call the same `candidateFromTotal` function with displacement from the drag start. Do not add frame deltas or use the previous candidate as a new start. The tie stores each selected pole's offset from its anchor; it does not force both poles onto the anchor. These helpers do not certify clearance, bend radius, sweep validity, or manufacturing suitability.

See [the control-point diagram and Studio steps](/studio/features#route-bundles) and [the saved fields](/reference/document#route-bundle-fields).

### When a route edit is refused

Route helper admission failures use `BAD_REFERENCE` with a `Route bundle:` message. They reject an invalid
binding or candidate; they are not results from evaluating the complete model.

| What failed | What to change |
|---|---|
| The accepted document identity changed, or a captured curve/source binding is stale. | Discard the old candidate. Start from the current accepted document and select the current curve and copied sweep again. Do not replace only the stored revision or canonical string to bypass the check. |
| A copied sweep path does not match its current direct curve, or its sweep/profile ID is missing or ambiguous. | Restore a consistent document, make a matching copied sweep from the current curve, and select its current independent circular profile. An old copied path is not a fallback. |
| The selected point is an endpoint, or the source is not an open clamped cubic with finite coordinates, valid knots and positive matching weights. | Choose an existing interior control point on a supported millimetre curve. Correct the source geometry before creating the binding. |
| Members repeat an ID, curve, sweep, profile, or the same source/geometry pair through different object names. | Choose two distinct curve sources, each with its own sweep and profile. Renaming an alias does not make it a second source. |
| Bundle data has the wrong schema, is nested in a placed/pending part, or has missing or orphan member markers. | Keep bundle data in one valid schema-4 base document with two matching members and markers. Detach a valid bundle before placing its document as a part; changing the schema number alone does not repair the bindings. |
| Binding admission succeeds, but complete candidate evaluation fails. | Keep the accepted document and inspect the evaluation error. Correct the model or reduce the proposed edit, then evaluate the whole candidate again before committing. This failure is not necessarily a route admission `BAD_REFERENCE`. |

The helpers return private candidates. The caller owns complete evaluation and commit; the Studio keeps the
accepted document when a route preview or final check fails. These checks do not establish collision clearance,
general constraint solvability or manufacturing suitability.

## Assembly and robot motions

Use the `api/` facade's `assembly(...).robot()` to read an assembly as a robot. `robot.path(...)` takes at least
two waypoints; `robot.motion(name)` reads a saved path. Joint inputs use degrees for turns and mm for slides.
Velocity and acceleration limits use deg/s and deg/s², or mm/s and mm/s².

### Checking assembly clearance

Call `clearance()` on an existing assembly to read its current clearance map. The method is asynchronous:

```js
const result = await myAssembly.clearance({ near: 2 }); // mm
console.log(result.map);
console.log(result.files.find(file => file.path === 'clearance.json'));
```

Omit `near` to use 1 mm. A supplied value must be finite, greater than 0 and at most 10,000 mm;
otherwise the call rejects with `OUTPUT_INPUT`. Evaluation failures also reject the call. It includes the
base and visible placed parts; hidden placed parts are excluded.

| Result | Meaning |
|---|---|
| `revision` | The document revision used for this output. |
| `shopRows` | The resolved shop-row provenance for the assembly. |
| `map` | The clearance map: its own `revision`, `near`, `pairs`, `pending` count and `timing`. The map revision identifies the pair poses; it is separate from the document revision. |
| `files` | One `clearance.json` file with map fields, document revision and shop-row provenance. Its entry includes UTF-8 `text`, byte count and SHA-256 digest. The file's `revision` is the document revision: it replaces the map revision. Keep `result.map.revision` separately if you need the map revision. |

The map measures the least gap on display meshes. It first selects candidates using bounding boxes expanded
by the near distance. A candidate can have state `clear` when its measured gap is greater than `near`, so do
not assume that every returned pair is within the band. Each pair identifies its bodies as `a` and `b` and
includes `minGap` in mm, closest points in the respective body-local frames, face names and a pose key.

`near` means the measured gap is positive and within the requested distance. `contact` means the mesh gap is
zero, but it does not yet distinguish touching from a volume overlap. When exact solids are available,
`overlap.pending` is `true` until a separate exact overlap check fills it; awaiting `clearance()` does not run
that fill. If an exact solid is unavailable, `overlap.refused` explains why the distinction was not made.
A `designed` pair identifies a declared seat or fit; it is not an approval of the assembly. Inspect both the
pair states and pending or refused overlap fields. An empty pending count alone does not establish that an
assembly has no interference.

### Reading pose and path results

`poseAt(t)` returns joint inputs, not link placements. Pass that record to `robot.pose(...)` to obtain the pose.
A pose reply has no overall `ok` flag; inspect the fields needed by your caller:

| Result | Read it as |
|---|---|
| `robot.pose(values).values` | The resolved joint values, including followers, in degrees or mm. |
| `links`, optional `frames` | Named link/frame positions in mm and rotations in degrees, in the assembly coordinates. |
| `out_of_limits` | Joint keys outside their stored limits. A direct pose preview keeps those values rather than clamping them; a returned pose alone is not a readiness check. |
| `path.check()` | An array with one sweep reply for each adjacent waypoint pair, in waypoint order, for supported open-chain paths. Read each reply's `clear`, optional `contact`, and `minClearance`. |

Given a robot and waypoints from the caller's current joint keys:

```ts
import type { Robot } from '@barocss/cad-model/api/robot';

function sampleMotion(
  robot: Robot,
  waypoints: Record<string, number>[],
  limits: Record<string, { velocity: number; acceleration: number; jerk?: number }>,
  seconds: number,
) {
  const path = robot.path(waypoints, { limits });
  const values = path.poseAt(seconds);
  return robot.pose(values);
}
```

Supply positive velocity and acceleration limits for each moving joint, or a `default` entry. Use deg/s and
deg/s² for turns, or mm/s and mm/s² for slides. Path timing does not read those rates from the document's joint settings.
`poseAt` can refuse invalid paths; inspect `path.problems()` before playback.

The two coordinates returned by these APIs have different meanings: `poseAt` takes time in seconds, while a
sweep's `contact.s` and `minClearance.fraction` locate a dimensionless fraction of that waypoint segment.
`contact.values` uses degrees/mm; `minClearance.value` is in mm. They do not give elapsed contact time.
`minClearance` can be `null`, and `contact` is absent when no contact is returned. Do not treat missing data as zero.

![Robot path inputs become a pose reply; separate per-segment checks use a fraction rather than time](/diagrams/robot-motion-result-flow.svg)

[Open the motion result diagram at full size](/diagrams/robot-motion-result-flow.svg).

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

Use **Pin this record** to keep the displayed record for comparison, **Replace pinned record** to replace it explicitly, and **Unpin record** to clear it. Expand **Compare records** to inspect the pinned and current entries.
Each entry checks the current document at that record's own saved inputs; the panel's Match/Stale status instead compares the current form inputs too.
A finite recorded torque difference (current − pinned), in N·mm, appears only when joint, occurrence, coordinate frame, axis origin and axis direction match exactly.
Historical records remain **not recalculated** even when document and inputs match. A difference does not establish cause, accuracy, measured validation or producer compatibility.
The pin is local to the mounted panel and is cleared when that panel is removed. It is separate from document Save and record Download/Open.

### Experiment setup

| Artifact | Save | Open |
|---|---|---|
| Studio document | Document Save keeps the model document. | Document Open restores it separately from experiment setups and records. |
| Experiment setup | **Save setup** downloads the current form inputs and their document binding as JSON. | **Open setup** previews settings without changing the form, results or pinned record. |
| Past result record | The existing record Download keeps a past calculation. | **Open gravity record** restores that historical record; it does not calculate again. |

Under **Experiment setup**, the steps remain separate:

- **Use inputs** copies the loaded setup inputs into the form without calculating.
- **Run saved setup** uses the loaded inputs even when the form differs. After a document match and a successful calculation, it replaces the current result and updates the form to those inputs. A failed run keeps the previous form and result.
- **Bind setup to current design** makes new loaded settings bound to the current document, keeping their inputs. It does not change the form, download a file or calculate.
- **Save setup** always uses the form. To download rebound settings with the loaded inputs, first choose **Use inputs**, then **Save setup**.

An invalid setup file keeps the previous loaded setup, form and result. Loaded settings are local to the panel and are lost when it is removed. Past record objects and the pinned record remain unchanged.

In code, `create` and `parse` do not calculate. `toJSON()` and `options` return independent copies.
For caller-supplied Studio documents and the explicit options described above:

```js
import { GravityExperimentDefinition } from '@barocss/cad-model/api/experimentDefinition';

const definition = GravityExperimentDefinition.create(doc, options);
const text = JSON.stringify(definition.toJSON());
const opened = GravityExperimentDefinition.parse(text);
const copiedInputs = opened.options;
if (opened.matches(currentDoc)) {
  const freshResult = opened.run(currentDoc); // Explicit calculation; it can still refuse.
  const newRecord = freshResult.record();
}
const rebound = opened.rebind(changedDoc); // New settings, no calculation; opened is unchanged.
```

`matches(doc)` compares the full canonical document using the saved inputs; it does not establish execution readiness.
`run(doc)` uses the caller's current document and refuses a mismatch with `VALUE` before calculation. It does not execute the stored document text.
`rebind(doc)` keeps the inputs in a new definition. Only explicit `run` attempts a new result under the existing static-gravity limits; past records are unchanged.

Setup input `units` has exactly two keys: `angle: 'degree'` and `gravity: 'mm/s²'`.
The result report has six: `angle: 'degree'`, `length: 'mm'`, `mass: 'g'`, `inertia: 'g·mm²'`, `gravity: 'mm/s²'` and `torque: 'N·mm'`.
Keep result units and calculated fields out of a setup. The existing result-record schema `1` and parser are unchanged.

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

The document is a `barocss-cad-model` file in millimetres. Ordinary documents use schema 3; an explicit route bundle uses schema 4:

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
