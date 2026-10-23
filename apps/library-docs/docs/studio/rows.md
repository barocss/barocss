# Shop rows

## Why sizes come from your files

BaroCSS has no standards built in: no thread table, no fastener catalogue, no bearing list, no casting allowances.
Sizes like these depend on the edition of a standard and on what your supplier stocks. A design built on numbers
nobody supplied can't be trusted. So these sizes come from **rows**: JSON files that you supply, each value naming
where it came from, or saying it is an estimate.

- **The person loads them.** Rows are loaded only from a file a person supplies, in the studio or attached in the
  chat. The agent can suggest a file, but rows it wrote itself are refused with `[ROWS_NOT_FROM_PERSON]`.
- **A receipt is kept.** Every loaded row keeps a receipt naming its file.
- **Placed parts inherit them.** A placed part uses the rows of the document it is placed in.
- **Rows in use stay.** A row something uses stays loaded. A frame section row, when edited, moves every frame
  built on it.

## Row kinds

| Kind | What it gives | Used by |
|---|---|---|
| `fastener-sizes` | Metric thread sizes: pitch, head and nut sizes, washers, the lengths offered, clearance holes and the tap drill | Tapped holes, **Fastener**, thread callouts, hole position tolerances, machining holes |
| `fasteners` | Bought screws, bolts, nuts and washers as your supplier lists them | The BOM's bought lines |
| `casting-rules` | Die and sand casting limits by alloy (least wall and draft, tolerance, section change) and sand casting's pattern allowances | The casting report and the sand pattern |
| `sections` | Frame sections by their dimensions | **Frame**, **Structural member** |
| `frame-stock` | Stock lengths for frame members | The cut list's nesting |
| `stock` | Stock blocks for machining | The CNC report's stock choice |
| `fits` | Fit tables: tolerance classes and their limits | **Fit class**, **Fit pair**, fit callouts on drawings |
| `bearings` | Bearings: bore, outside diameter, width, shoulder limits | **Bearing** and its housing |
| `orings` | O-rings | **O-ring gland** |
| `rings` | Retaining rings | **Retaining ring** |
| `drives` | Belts, chains and their wheels | **Pulley**, **Sprocket**, **Belt or chain** |
| `connectors` | Connector openings | **Connector opening** |
| `bend` | A sheet-metal bend table | A sheet part's bends |

## Loading rows in the studio

![The library with the sample fastener sizes loaded](/shots/guide/getting-started/library-rows.jpg)

**Library** lists each kind with what is loaded, for example **Fastener sizes** with the sizes it holds. Load your own file there.
Two kinds ship with samples you can load in one click: **Load sample fastener sizes** and **Load sample casting rules**.

The samples are in `@barocss/cad-model` at `samples/rows/`:

- `fastener-sizes.json`: metric coarse M3 to M12, with the fields not cross-checked listed in `unchecked`;
- `casting-rules.json`: die and sand casting rules, each with the page it was read from.

They are examples taken from the sources each row names, not a standard. Check them against your supplier before you
use a part for manufacture.

## Loading rows in the chat

Attach the file to your message and ask the agent to load it. The agent's `load_rows` action takes the kind and the
file from your conversation.

## Without rows

A command that needs a row it doesn't have is refused with the row it is missing:

- `[FASTENER_SIZE_ROW] no row for M6 — load your fastener sizes …`, for a tapped hole, a fastener or fitting a
  fastener to a hole;
- `[CASTING_RULE_ROW]` in a casting report, where every rule that reads a limit or an allowance is `unknown` and a
  sand pattern is refused.

A reading that only shows something carries on, and says what it lacks: no thread is drawn, no tap drill is given,
and the position tolerance is an estimate.
