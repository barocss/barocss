# Drawings

The **Drawing** tab turns the part, or the assembly, into a dimensioned sheet. The sheet is computed from the model,
so it follows every change; the dimensions and notes you add are kept with it.

## The sheet

- **Drawing scope** chooses what is drawn: the base part, one placed part, or the assembly.
- **Sheet size** is **A4 landscape** or **A3 landscape**. **Scale** is **Auto** or a fixed scale. **Projection** is
  **Third angle** or **First angle**.
- The views are front, top, right and an isometric view, drawn as hidden-line projections. **Hidden lines**,
  **Tangent edges** and **Centre lines** toggle what they show.
- The title block carries the drawing's title and revision. **Next revision** steps it (A, B, …). When the model has
  changed since that revision, **Revision out of date** says so.
- Beside your REV, the title block's **SRC** line names the document revision the sheet was drawn from, in every
  export of the sheet. See [Revisions and sources](/guide/concepts#revisions-and-sources).

## Sections

**Add section** places a cut through the part: section A–A, B–B and on, each with its cutting line in the view where
the plane is edge-on, and the cut faces hatched.

- A principal section is square to the front, top or right view.
- An aligned section follows an off-axis feature, for example a keyway in a tilted bore. Its plane is square to the
  feature's axis, and its cutting line is drawn inclined.
- **Export section DXF** writes one section on its own.

## Dimensions and notes

| Key | Tool | How |
|---|---|---|
| <kbd>V</kbd> | Select | Click a dimension to select it, drag to move it; <kbd>Delete</kbd> removes it |
| <kbd>D</kbd> | Linear dimension | Click two points or one straight edge, then where the dimension goes |
| <kbd>O</kbd> | Diameter (Ø) | Click a circle, then where its diameter goes |
| <kbd>R</kbd> | Radius | Click a circle or an arc, then where its radius goes |
| <kbd>A</kbd> | Angle | Click two straight edges, then the side of their corner |
| <kbd>N</kbd> | Note | Click the paper for a note, or a view for a leader |

**Auto-dimension** lays out the views with room, picks a scale and sheet that read cleanly, then adds the overall
sizes, steps, hole positions and callouts. It replaces its own earlier dimensions and keeps yours. A dimension goes
where both its ends are visible: in a section when the section shows more than the view.

## Tolerances

**Tolerancing** is **± dimensions** or **Geometric (datums, position)**. **Tolerance suggestions** proposes the
tolerances the part needs, such as hole positions and fits; **Accept** takes one and **Accept all suggestions** takes
them all.

- A tolerance from your fit or fastener rows cites the row.
- One without a row is an estimate and says so.

## Issues

**Drawing issues** lists what the sheet is missing or gets wrong: a feature with no dimension, a dimension that was
lost after a model change, a feature a section would show better. Each issue can carry a **Fix**. **Fix all issues**
applies them all, and **Issue count** shows how many are left.

## Tables and balloons

The sheet can carry the tables that the part's features need:

- **BOM table**, with **Balloons** linking each line to its parts;
- **Weld list table** and **Weld symbols** for weldments;
- **Cut list table** for frames;
- **Bend table** for sheet metal;
- **Gland table**, **Spring data table** and **Element list table** for those features.

## Export

- **Export SVG** and **Export PDF** write the sheet as shown.
- **Export DXF** writes it as AutoCAD 2000 or R12, chosen in **DXF version**.
