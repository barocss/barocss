# Rows file formats

Rows are JSON files a person supplies: in the studio's **Library**, or attached in the chat. [Shop rows](/studio/rows)
explains why, and what uses each kind.

## The file

- **Its shape.** A rows file is one of:
  - an array of rows;
  - an object with a `rows` array (not for fits or bend tables);
  - for fits, an object with a `tables` array.

  It holds 1 to 4,096 rows.
- **Limits.** A file must be named `.json` and is at most 256 KiB. A conversation takes at most 32 files and 1 MiB in
  all.
- **Sources.** Every row names its `source`, or is marked `"estimate": true`. Where a kind requires a source, an
  estimate isn't enough.
- **Units.** Lengths are in millimetres. Angles are in degrees. Fields ending in `UM` are in micrometres,
  including fit and bearing deviations. The mount row fields are listed separately below.
- **Validation.** A row is checked when it is loaded. A row with a missing or out-of-range value is refused, and the
  refusal says which row and why.
- **Provenance.** Each loaded row keeps a receipt naming its file, its turn in the conversation and the file's SHA-256.

## Row kinds

### `fastener-sizes`

One row per metric thread size. It says how that size is drawn and holed.

| Field | Meaning (mm unless noted) |
|---|---|
| `id` | The size, as `M6` |
| `d`, `pitch` | Nominal diameter (must match the id), coarse pitch |
| `s` | Hex across flats, for bolt heads and nuts |
| `k`, `m` | Hex bolt head height, nut height |
| `dk`, `ks`, `socket` | Socket head diameter and height, hex key size |
| `wd1`, `wd2`, `wh` | Washer inside and outside diameters, thickness |
| `cdk`, `ck`, `csocket` | Countersunk head diameter, height, socket size |
| `lengths`, `capLengths`, `cskLengths` | Lengths offered, shortest first: hex bolts, cap screws, countersunk screws (overall) |
| `clearance` | Clearance holes: fine, medium, coarse |
| `tap` | Tap drill for the internal thread |
| `source` or `estimate` | Where the row comes from |
| `fieldSources` | Where a field comes from, when not the row's source |
| `unchecked` | Fields not cross-checked against a second source |

### `fasteners`

Bought screws, bolts, nuts and washers, as your supplier lists them:

- `id`;
- `kind`: `hex-bolt`, `socket-screw`, `csk-screw`, `hex-nut` or `washer`;
- `size`, such as `M6`;
- `length`, for screws and bolts;
- optional `designation`, `partNumber` and `supplier`;
- `source` or `estimate`.

### `casting-rules`

Two shapes, each for `die-casting` or `sand-casting`:

- **A limit:** `id`, `process`, `key`, `value`, `unit`, `description`, `source`, and optional `page`.
- **A pattern allowance table:**
  - `allowance`: `shrink` (by alloy family, in inches per foot by size band) or `machining` (by class, in inches by
    size band);
  - with its `label`, `bands` and `page`.

A `page` is `{ url, read, label }`: the address, the date read, and the page's own label for the value.

### `fits`

Fit tables. Each table has an `id`, optional `sources` (`{ id, label, url?, read?, note? }`) and `rows`. Each row is:

- `class`: an ISO 286 class such as `H7` or `g6`;
- `over` and `upTo`: the size range, over < size ≤ up to;
- `upperUM` and `lowerUM`: the deviations;
- and `source` or `estimate`.

### `bearings`

- `id`, optional `designation`;
- `bore`, `outside`, `width`, optional `chamfer`;
- the shoulder limits `daMin`, `daMax`, `DaMax`, `raMax`;
- the deviations `boreDeviationUM` and `outsideDeviationUM`, each `[upper, lower]`;
- `source` or `estimate`.

### `orings`

`id`, optional `dash`, `insideDiameter`, `crossSection`, and `source` or `estimate`.

### `rings`

Retaining rings: `id`, optional `designation`, `shaftDiameter`, `grooveDiameter`, `grooveWidth`, and `source` or
`estimate`.

### `drives`

Belts, chains and couplings, by `kind`:

| `kind` | Required | Optional |
|---|---|---|
| `chain` | `pitch`, `rollerDiameter` | `innerWidth`, `plateHeight` |
| `timing-belt` | `pitch`, `pitchLineOffset`, `groove` | `thickness` |
| `v-belt` | `angle`, `datumWidth`, `aboveDatum`, `belowDatum`, `spacing`, `edge` | `thickness` |
| `flat-belt` | `width`, `thickness` | — |
| `coupling` | `bore`, `outside`, `length` | `type`, `boreStep`, `partNumber`, `supplier` |

Each also has an `id`, and `source` or `estimate`.

### `connectors`

- `id`, optional `name`;
- `opening`: `{ shape, width, height, cornerRadius?, depth }`, where `shape` is `stadium`, `rect` or `round`;
- an optional mating `body` (the same section, with `length`);
- an optional `keepOut`: `{ margin, depth }`;
- `source` or `estimate`.

### `sections`

Your frame section library: `id`, optional `name`, `section`, and `source` or `estimate`. The `section` is one of the
typed sections that [Frames and weldments](/studio/frames) lists (a rectangular or round tube, an angle, a channel, an
I/H beam or a T-slot), by its dimensions.

### `mounts`

How a motor, a servo or a bearing unit fixes to a flat face, one row per model from its datasheet.

| Field | Meaning (mm; `start` in degrees) |
|---|---|
| `id`, `type`, `designation?` | The row; `type` is `motor`, `servo` or `bearing-unit` |
| `holes` | The bolt pattern, with each hole's `diameter`: `{ pattern: "square", spacing }`, `{ pattern: "rect", spacing: [along, across] }`, or `{ pattern: "circle", pcd, count, start? }` |
| `pilot`, `pilotDepth` | The register diameter on the mounting face, and how far it stands out |
| `shaft`, `shaftOffset`, `shaftHeight` | The shaft's diameter; where it stands from the pattern's centre, `[along, across]`; its axis above the face |
| `body` | A servo's body cut-out sizes, `[along, across]`, through the face. A servo requires it; other types may not have it |
| `clearance` | Added all round to the pilot, shaft and body cut-outs |
| `bearing` | For a bearing unit, a `bearings` row id. Its bore must equal `shaft` |
| `source` or `estimate`, `fieldSources`, `unchecked` | As for fastener sizes |

The limits:

- **Sizes.** A hole's diameter is 1 to 30 mm, `clearance` is 0 to 5 mm, a circle has 2 to 12 holes, and lengths are
  at most 2,000 mm.
- **Holes.** They must be further apart than their diameter.
- **Pilot and shaft.** A pilot must be wider than the shaft, and `pilotDepth` needs a `pilot`.
- **Clearance.** The pilot's or shaft's cut, with its clearance, must stay clear of the holes.

Each refusal is `[MOUNT_RANGE]`, and names the row and the field. A placed part uses the mount rows of the document it
is placed in.

The shipped mount example keeps its estimates, unchecked fields and field sources. This check reads those existing
rows; it does not supply a new hardware row:

<<< @/../samples/rows.test.mjs#mounts

### `stock`

Stock for machining, each with a `source`:

- a block: `{ id, kind: "block", size: [x, y, z] }`;
- a bar: `{ id, kind: "bar", diameter, maxLength? }`.

### `frame-stock`

Stock lengths for frame members: `id`, `length`, optional `count` and `section`, and `source`.

### `bend`

A sheet-metal bend table. It has an `id`, optional `material` and `sources`, and `rows`. Each row is:

- `thickness` and `radius`, with optional `angle`;
- one of `kFactor`, `allowance` or `deduction`;
- `source` or `estimate`.

## The shipped samples

`@barocss/cad-model` ships three samples, at `samples/rows/`:

- `fastener-sizes.json`: M3 to M12;
- `casting-rules.json`: die and sand casting;
- `mounts.json`: mounts, described in [Shop rows](/studio/rows#loading-rows-in-the-studio).

Each file has an `about` note and its `rows`. They are examples taken from the sources each row names, not a
standard.

<<< @/../samples/rows.test.mjs#samples

<<< @/../samples/rows.test.mjs#refused
