# Manufacturing

A part is checked against the process you choose. The checks read the exact model, not the display mesh, and say
what they can't judge instead of passing it.

## Choosing the process

Open **Library** and set **Process**:

- injection moulding;
- 3D printing: FDM, resin (SLA), powder-bed sintering (SLS), multi-jet fusion (MJF);
- CNC milling and CNC turning;
- die casting and sand casting.

With no process chosen, the rules are unknown. Printing also takes a **Printer**, from generic FDM, SLA, SLS and MJF
build volumes. Moulding and casting take a **Pull direction**, and moulding takes a **Mould finish**, which sets the
least draft.

## The manufacturability report

Ask the agent to check the part. Its manufacturability query gives the report for the chosen process, for example
"check this for milling". The report gives each rule `pass`, `warn`, `fail`, `unknown` or `n/a`, with the faces or features it is about:

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

**Display** in the viewport holds the previews:

- **Analysis map** (**Maps**) colours the model by wall thickness, draft or 3-axis access, with a legend. It draws only
  with WebGPU.
- **CNC preview** steps through the milling program's moves for a pocket from its stock: **CNC setup**, **CNC
  progress**, the tool's shape and size, and the grid pitch. It opens with `NOT FOR PRODUCTION`. It shows material
  removal and overcut; it is not a post-processed program for a machine.
- **Print layers** slices the part: **Print direction**, the layer height, and a **Print layer** slider with **Printed
  up to layer**. The settings are saved with the document.
- **Assembly clearance**, **3D annotations** and the section view are here too; see
  [Display, sections and analysis](/studio/display).

## Preparing a print

**Hollow for printing** shells a part to a wall thickness with a drain into each cavity. **Fill with a lattice** fills
the cavity with a gyroid lattice as a separate mesh body. **Split to fit the bed** cuts a part too big for the printer
into pieces joined by dowels or plugs. **Export 3MF** writes the bodies, materials, colours and print orientation for a
slicer.

## Quote package

**Quote package** in the library panel downloads the part as STEP, its manufacturability report and the request
(material, finish, pull and quantity) in one zip. See [BOM and quotes](/studio/bom).
