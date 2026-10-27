# Manufacturing

A part is checked against the process you choose. Rules use the model's geometry and measurements; some printing
checks also use its mesh. A check says what it cannot judge instead of passing it.

## Choosing the process

Open **Library** and set **Process**:

- injection moulding;
- 3D printing: FDM, resin (SLA), powder-bed sintering (SLS), multi-jet fusion (MJF);
- CNC milling and CNC turning;
- die casting and sand casting.

With no process chosen, the rules are unknown. Printing also takes a **Printer**, from generic FDM, SLA, SLS and MJF
build volumes. Moulding and casting take a **Pull direction**, and moulding takes a **Mould finish**, which sets the
least draft.

Choose a material as well: machining uses its family to select wall limits, and missing material leaves those
rules unknown. For printing, choose the build direction and printer before judging orientation and bed fit.
The report names missing inputs; a generic printer profile is not a measurement of your machine.

## The manufacturability report

Ask the agent to check the part. Its manufacturability query gives the report for the chosen process, for example
"check this for milling". The report gives each rule `pass`, `warn`, `fail`, `unknown` or `n/a`, with the faces or features it is about:

`pass` means that rule meets its stated limit. `warn` marks an unmet recommendation; `fail` marks an unmet feasible
limit. `unknown` means required information or a measurement is missing. `n/a` means the rule does not apply.
Read the rule's value, limit, source and reason before deciding what to change.

| Process | What it checks |
|---|---|
| CNC milling | Material, wall, size; holes (depth, size, threads deeper than 3 × d warned); pockets' inside corners against the tool radius; which faces each of the six directions reaches, and the setups; stock from your stock rows |
| CNC turning | Every surface turned; a milled feature on a turned part warned for live tools |
| Injection moulding | Draft on every side face, from the exact surface; undercuts and the side actions that free them; ribs and walls; sharp inside corners; the parting line, with the mould's two halves and shut-offs |
| Die and sand casting | Wall, draft, tolerance and section changes against your casting rules; hot spots for the gate you choose; for sand casting, the pattern's shrinkage scale and machining allowances |
| 3D printing | On the printer you chose: fit on the bed, overhangs, walls, holes (horizontal ones too), gaps, bosses, tips, warping, enclosed cavities, and pieces that only touch |

Casting needs your casting rules (see [Shop rows](/studio/rows)). Without them, every rule that reads a limit or an
allowance is unknown, and a sand pattern is refused.

## Previews in the viewport

![The CNC preview at the end of a pocket's program, NOT FOR PRODUCTION at its top](/shots/studio/manufacturing/cnc-preview.jpg)

The dock's **Preview & analysis** section shows one preview at a time: **CNC**, **Print**, **Clearance** or
**Analysis**. See [Display, sections and analysis](/studio/display#preview-analysis).

- **Analysis** colours the model with a map: wall thickness, draft or 3-axis access, with a legend. The maps draw only
  with WebGPU.

  ![The wall-thickness map on a moulded plate, with its legend (WebGPU)](/shots/studio/manufacturing/thickness-map.jpg)
- **CNC** steps through the milling program's moves for a pocket from its stock:
  - **Setup**;
  - a **Progress** slider with **End**;
  - **Grid**, the pitch it removes material on;
  - **Set tool**, the tool's shape and size.

  It opens with `NOT FOR PRODUCTION` and shows material removal and overcut. It is a display estimate, with no G-code,
  feeds, speeds or collision check.
- **Print** slices the part into its layers:
  - **Direction**;
  - **Set height** for the layer height;
  - a **Layer** slider;
  - **Printed up to layer**;
  - **Supports**.

  The settings are saved with the document.

  ![Print layers on the same plate: the layers drawn, with the Print layers panel](/shots/studio/manufacturing/print-layers.jpg)
- **Clearance** and the 3D annotations are in the same section; see
  [Display, sections and analysis](/studio/display).

## Preparing a print

**Hollow for printing** shells a part to a wall thickness with a drain into each cavity. **Fill with a lattice** fills
the cavity with a gyroid lattice as a separate mesh body. **Split to fit the bed** cuts a part too big for the printer
into pieces joined by dowels or plugs. **Export 3MF** writes the bodies, materials, colours and print orientation for a
slicer.

Writing a 3MF file does not run or pass the manufacturability report. Check the report separately before sending
the file to the slicer; exported bodies and orientation do not certify the print settings or machine program.

## Quote package

**Quote package** in the library panel downloads the part as STEP, its manufacturability report and the request
(material, finish, pull and quantity) in one zip. See [BOM and quotes](/studio/bom).

This package is for injection moulding. It can contain open items, including missing request inputs, failed or
unknown rules, or a failed STEP export. Read the package's `open` list and `complete` flag; a downloaded zip alone
does not mean the request is complete.
