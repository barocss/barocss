# The .bcad document

A `.bcad` file holds one studio document: the part's model and everything else saved with it. The document model reads
and writes it (`@barocss/cad-model/engine/doc` and `engine/container`).

## The file

- **Plain JSON.** A document with no mesh data is written as JSON.
- **The `BCADPACK` container.** A document with mesh data, such as an imported STL or scan, is written as a small
  binary container, all little-endian:
  - the 8 bytes `BCADPACK`, a `u32` version (1) and a `u32` chunk count;
  - then each chunk: a `u32` header length, a `u32` payload length, the header as UTF-8 JSON, then the payload, each
    padded to a multiple of 8 bytes;
  - chunk 0 is the document's JSON (`{"kind":"document"}`), which names its mesh arrays by hash;
  - each further chunk is one array (`{"kind":"blob","sha256":…,"dtype":"f64"|"f32"|"u32","count":…}`).

  Reading checks each array's SHA-256 against its name before using it.
- **Both open.** Either kind opens. A plain JSON file's inline mesh arrays are read as they are.
- **What isn't opened.** A container that can't be trusted is refused, with its code in front:
  - `[CONTAINER_DAMAGED]` for a file cut short, a malformed mesh chunk, a chunk that doesn't match its hash, or no
    document, for example `[CONTAINER_DAMAGED] This model file could not be read: the file is cut short.`;
  - `[CONTAINER_NEWER]` for a container version newer than this cad-studio reads.

## Schema version

Documents are `"format": "barocss-cad-model"`, `"schema": 3`, `"units": "mm"`. Schema 3 keys bodies by stable ids.

- **No migrations yet.** Until the first release, documents follow the latest schema. Unreleased versions aren't
  migrated between, and fixtures are updated instead.
- **Revisions.** A document's revision names the content results depend on. See
  [Revisions and sources](/guide/concepts#revisions-and-sources).

## Fields

Only `format`, `schema`, `units`, `parameters`, `nodes` and `outputs` are always there. The rest appear when used.

### The model

| Field | What it holds |
|---|---|
| `format`, `schema`, `units` | `barocss-cad-model`, 3, `mm` |
| `nextId` | The next feature serial (`n<nextId>`). Ids are never used twice |
| `parameters` | Named values the features' dimensions can be bound to |
| `configurations` | Saved sets of parameter values, by name |
| `nodes` | The features, in order, each with its stable id |
| `outputs` | The bodies, by key, and the feature and side each comes from |
| `bodies` | Each body's own name, colour and visibility, kept with it as features change |
| `direct` | NURBS curves and surfaces beside the model: imported sources and what tools made of them |
| `underlays` | Imported drawings' outlines and text, to trace over. They are never geometry |
| `drafts` | Features made from an image or a drawing, and their dimensions still to confirm |
| `render` | The Render workspace's settings: appearances, lights, environment, camera, props, animation |

### Assemblies, drawings and robots

| Field | What it holds |
|---|---|
| `instances` | Parts placed beside this one, each with its own document, position and rotation |
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
