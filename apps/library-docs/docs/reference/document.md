# The .bcad document

A `.bcad` file holds one studio document: the part's model and everything else saved with it. The document model reads
and writes it (`@barocss/cad-model/engine/doc` and `engine/container`).

## The file

- **Plain JSON.** A document with no referenced binary blobs is written as JSON.
- **The `BCADPACK` container.** A document with binary blobs, such as an imported mesh or original Text font, is written as a small
  binary container, all little-endian:
  - the 8 bytes `BCADPACK`, a `u32` version (1) and a `u32` chunk count;
  - then each chunk: a `u32` header length, a `u32` payload length, the header as UTF-8 JSON, then the payload, each
    padded to a multiple of 8 bytes;
  - chunk 0 is the document's JSON (`{"kind":"document"}`), which names its binary blobs by hash;
  - each further chunk is one array (`{"kind":"blob","sha256":…,"dtype":"f64"|"f32"|"u32"|"i32"|"u8","count":…}`).

  Reading checks each array's SHA-256 against its name before using it. Font imports supply `u8` arrays.
  Identical bytes may share an older stored array class; font readers use its raw byte view. The current chunk
  data types are extended without changing container version 1.
- **Both open.** Either kind opens. A plain JSON file's inline mesh arrays are read as they are.
- **What isn't opened.** A container that can't be trusted is refused, with its code in front:
  - `[CONTAINER_DAMAGED]` for a file cut short, a malformed blob chunk, a chunk that doesn't match its hash, or no
    document, for example `[CONTAINER_DAMAGED] This model file could not be read: the file is cut short.`;
  - `[CONTAINER_NEWER]` for a container version newer than this cad-studio reads.

## Schema version

Documents use `"format": "barocss-cad-model"` and `"units": "mm"`. Ordinary documents use `"schema": 3`, which keys bodies by stable ids. Explicit route bundles use `"schema": 4`.

- **Supported schemas.** The reader reads only schemas 3 and 4. A file with a missing `schema`, or schema 0, 1 or 2,
  is refused with a message to re-save it with a studio that reads it. A valid explicit route-bundle document keeps schema 4.
- **Fields filled on read.** Missing units are read as millimetres, and a missing parameters list starts empty.
  Features without stable ids are given ids.
- **Open and Save.** When **Open** fills older fields, **Opened an older model** lists the changes. Opening does not
  rewrite the source file. Save the opened document to keep its current form.
- **Refusals.** Older and newer schemas, invalid schemas, unknown features and explicit
  non-mm units are refused. This does not guarantee compatibility between all unreleased versions.
- **Separate version fields.** `BCADPACK` version 1 describes the binary container. The document's `schema` describes
  its model data; it is not the container version.
- **Revisions.** A document's revision names the content results depend on. See
  [Revisions and sources](/guide/concepts#revisions-and-sources).

## Fields

Only `format`, `schema`, `units`, `parameters`, `nodes` and `outputs` are always there. The rest appear when used.

### The model

| Field | What it holds |
|---|---|
| `format`, `schema`, `units` | `barocss-cad-model`, 3 or 4 for an explicit route bundle, `mm` |
| `nextId` | The next feature serial (`n<nextId>`). Ids are never used twice |
| `parameters` | Named values the features' dimensions can be bound to |
| `configurations` | Saved sets of parameter values, by name |
| `nodes` | The features, in order, each with its stable id |
| `outputs` | The bodies, by key, and the feature and side each comes from |
| `bodies` | Each body's own name, colour and visibility, kept with it as features change |
| `direct` | NURBS curves and surfaces beside the model: imported sources and what tools made of them |
| `routeBundles` | One explicit tie between two interior curve control points and their matching copied sweeps; schema 4 |
| `underlays` | Imported drawings' outlines and text, to trace over. They are never geometry |
| `drafts` | Features made from an image or a drawing, and their dimensions still to confirm |
| `render` | The Render workspace's settings: appearances, lights, environment, camera, props, animation |

### Text recipe and font source

A standalone Text node keeps its authoritative inputs as `kind: 'text'`, `text`, `font`, `size`, `height`,
`tolerance`, optional `tracking` and optional `plane`, plus the existing feature metadata. `size`, `height` and
`tracking` are dimensions or parameter bindings. `plane` stores `origin`, `normal` and `xAxis`. No new document
schema or top-level `fonts` registry is added.

`font` contains `{ blob, filename, source?, license? }`. `blob` is the original byte content key. Supplied metadata
and the original Unicode scalar sequence are kept unchanged. Derived line profiles are regenerated from those
bytes at the explicit tolerance; they do not replace the recipe. One Text output can contain multiple physical
bodies. Font sources in instances, pending parts and open prepared Text proposals use the existing blob collection,
worker, recovery and container paths. The same paths collect Text relief nodes and prepared `text-relief`
commands. Closed proposals do not keep an asset alive by themselves.

A Text relief modifier keeps `kind:'text-relief'`, `parent:BodyRef`, exactly one persistent `faces` name,
original `text`/`font`, em `size`, `at:[x,y]`, positive `depth`, `mode:'emboss'|'engrave'`, explicit `tolerance` and
optional `tracking`, plus the existing feature metadata and `sigs`. Size/depth/baseline/tracking can retain Dim
parameter bindings. It has no plane or generated-profile authority. The current parent cap supplies its top Z,
so an ordinary source-height edit can keep the same authored face. Supplied source metadata stays opaque.

A raw relief recipe without its selected-face signature can be read structurally, but native expansion refuses
it with `BAD_REFERENCE`. Creating a modifier through the editor/API captures an individual signature before
evaluation. A merged face signature does not silently become an unchecked selection. General face admission and
actual material/trim support are recomputed by the native feature. A work-budget refusal keeps the requested
tolerance unchanged; a later admitted result at a different explicit tolerance is a different request.
No schema/container version is added.

Container/content-address integrity checks protect saved bytes. They are separate from functional glyph and
geometry tests. The descriptor carries supplied metadata; supported glyphs are checked separately.
See [Text from font outlines](/how/text).

### Saved render light fields

Point and spot entries in `render.lights` may store `castShadow` and `shadowRadius`; the radius uses world mm.
This JSON is a field excerpt, not a complete `.bcad` document:

```json
{
  "render": {
    "lights": [{
      "kind": "point", "position": [0, 0, 100], "color": "#ffffff",
      "intensity": 1, "range": 0, "castShadow": false, "shadowRadius": 0
    }]
  }
}
```

The reader keeps explicit `false` and `0`; omitted optional shadow fields remain omitted. A radius does not enable
its shadow. Supplied flags must be boolean, and supplied radii must be finite and nonnegative, even when the
shadow is off. Invalid shadow fields give `VALUE`.

The render reader reads only the first 12 input light entries, then skips unknown light kinds and applies its
existing defaults and clamps. Within the resulting list, shadow admission counts point and spot entries separately,
in order: the first eight points and first four spots are eligible. Entries with shadows off still occupy those
positions. For eligible enabled shadows, a supplied radius must stay finite in GPU f32 and stay nonzero when
positive. A second enabled point caster gives `VALUE`, even if its intensity is zero.
These checks cover shadow fields and caster counts, not all GPU position, direction or range inputs.
See [Studio light controls](/studio/rendering#lights-environment-and-tone-mapping) for editing the settings.

### Route bundle fields

Explicit route bundles use document `schema: 4`, with `format: 'barocss-cad-model'` and `units: 'mm'`.
Older documents without bundle metadata keep their existing copied-sweep behaviour; reading them does not
automatically link their curves. The current route profile permits exactly one bundle with exactly two members.

| Field | Stored meaning |
|---|---|
| `routeBundles` | The explicit bundle array on the base Studio document. Nested route bundles are not supported. |
| `routeBundles[0].id` | The bundle's nonempty identifier. |
| `version`, `kind`, `frame` | The fixed values `1`, `'two-open-curves-one-translation-tie'`, and `'world-mm'`. |
| `tie.id`, `tie.anchorMM` | The tie identifier and its three finite world XYZ coordinates in mm. |
| `members` | Two distinct bindings, each with a member `id`. |
| `curveObjectId`, `sourceKey`, `geometryId` | The direct curve object and its source/geometry selectors. The loaded source is a millimetre CAD geometry model, not another Studio document. |
| `handleKey` | The selected interior control-point index as a string. Endpoints cannot be tied. |
| `sourceCanonical`, `sourceRevision` | The captured source/object/curve canonical content and its revision. They detect changed or stale source bindings; they do not provide automatic rematching. |
| `offsetMM` | Three finite values giving the selected control point's offset from the tie anchor, in world mm. Moving the tie preserves this offset. |
| `sweepFeatureId`, `profileFeatureId` | Stable IDs for the matching active copied sweep and its earlier independent circular sketch. |
| `nodes[].routeBundleMember` | On each linked `sweep-curve` node, `{ bundleId, memberId }` identifies the matching bundle member. Its copied `path` must match the current direct curve. |

The reader checks these bindings, source captures and markers. Missing, ambiguous, stale or orphan bindings are
refused with `BAD_REFERENCE`; it does not silently use an old sweep path. Bundle metadata requires schema 4 and
cannot be added to a schema-3 record. Removing the only bundle also removes its member markers and returns the
document to schema 3, while preserving the current curves and copied sweeps.

Route helpers return candidate documents; their binding checks do not run a complete model evaluation. The caller
must evaluate the whole candidate before accepting it. Linked route documents cannot be inserted as placed parts,
and rollback to a partial feature history requires detaching the bundle first.

### Assemblies, drawings and robots

| Field | What it holds |
|---|---|
| `instances` | Parts placed beside this one, each with its own document, position and rotation. An instance may also hold `joints` (its sub-assembly's joint values, offsets from the saved pose), `looks` (its own colour, material, face colours or visibility over the definition's) and, on a pattern's copies, `pattern` (the pattern and the copy's number) |
| `instancePatterns` | Linear and circular patterns of a placed part: the seed, the count, the spacing or angle, and the copies left out |
| `pendingParts` | New revisions of placed parts, waiting to be accepted |
| `variability` | The assembly's inputs, what each drives, and its named variants. See [Variants](/studio/assemblies#variants) |
| `mates` | Mates placing instances by their faces |
| `robot` | The assembly as a robot: its base link, joint limits and ratings |
| `drawing` | The 2D drawing's settings and annotations |
| `frames` | Frames: stock lengths, the kerf, the section library, welds and bead ownership |

### Manufacturing

| Field | What it holds |
|---|---|
| `process` | The process the part is made by |
| `printer` | The printer profile |
| `print` | The build direction |
| `printPreview` | The print preview's display settings |
| `mould` | The pull direction, the finish, and the halves you set |
| `machining` | Your stock list and the allowance |
| `casting` | The machined faces, your allowances, the shrinkage and the gate |

### Your rows

Each holds rows a person loaded, with their sources. See [Rows file formats](/reference/rows).

| Field | Rows |
|---|---|
| `fastenerSizes` | Thread sizes |
| `fasteners` | Bought fasteners |
| `castingRules` | Casting limits and allowance tables |
| `fits` | Fit tables, and the classes set on faces |
| `bearings`, `orings`, `rings`, `drives`, `connectors` | Bearings, O-rings, retaining rings, belts and chains, connectors |
| `mounts` | How motors, servos and bearing units fix to a face, from datasheets. See [`mounts`](/reference/rows#mounts) |
| `rowSources` | Which file of the conversation each loaded row came from |
| `libraries` | Libraries written for this document, by an agent or a person. An agent's stays marked until a person confirms it |

### Intent, agents and history

| Field | What it holds |
|---|---|
| `brief` | Purpose, process, material and the rest, each with its basis and your words |
| `questions` | The clarifying questions asked, and their answers |
| `requirements` | The brief as checks the kernel runs, each hard or soft |
| `references` | Locked reference bodies, datums and keep-outs |
| `interfaces` | The assembly's contract: datums, keep-outs, hole patterns, envelopes, budgets |
| `ecrs` | Change requests to the interfaces, decided by you |
| `baselines` | Approval baselines: the BOM and interfaces pinned by digest |
| `proposals` | Changes proposed and not made; accepted and rejected ones are kept |
| `history` | The design history: prompts, changes, proposals and decisions |

The docs check verifies that this page names every field the document model lists, so a new field can't go
unmentioned.
