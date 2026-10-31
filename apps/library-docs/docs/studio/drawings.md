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

Changing the drawing scope is refused with `DRAWING_SCOPE_REFERENCES` while the sheet has manual dimensions,
datums, point datum targets, control frames or notes with leaders. Keep the scope, or remove those references explicitly first.
A permitted scope change clears automatic dimensions; it does not transfer their references to the new part.

Without an explicit scope, sheets with balloons or a BOM table use assembly scope. Other sheets use the base part. A part sheet normally draws made bodies only. Assembly scope keeps bought elements, and enabling
balloons on a part sheet keeps those elements visible so the balloon can point to them.

### First angle and third angle

Projection changes where the orthographic views are placed. In **Third angle**, the top view is above the
front view and the right view is to its right. In **First angle**, the top view is below the front view and the
right view is to its left. The front and top views keep the same horizontal mapping; the front and right
views keep the same vertical mapping.

For an unbroken box measuring 40 mm along X, 20 mm along Y and 10 mm along Z, use the default front view
looking from −Y. At a fixed scale of **1:2**, the projected outlines have these sizes:

| View | Model width × height | Size on the sheet at 1:2 |
|---|---|---|
| Front | 40 × 10 mm | 20 × 5 mm |
| Top | 40 × 20 mm | 20 × 10 mm |
| Right | 20 × 10 mm | 10 × 5 mm |

These sizes are the same in both projection arrangements. They exclude labels, dimensions and the gaps
between views. A different front orientation changes which model axes form the view's width and depth.

![Third-angle placement with top above front and right to its right, compared with first-angle placement with top below front and right to its left](/diagrams/drawing-projection-layout.svg)

[Open the diagram at full size](/diagrams/drawing-projection-layout.svg).

The diagram is a calculated layout schematic, not a captured drawing or a print-size reference. Its rectangles
show the relative outline sizes; the app also reserves space for annotations when laying out the sheet.

### Title blocks and revision history

- **Title block** chooses **Basic** or **Extended**. Basic keeps the original layout. Extended adds **Organization**,
  **Drawing number**, **Drawn by**, **Checked by**, **Material** and **Finish** under **Title block fields**.
  These are entered text, not values taken from the part's material or process. The templates make no standards claim.
- The extended block needs more sheet space. Long values are reduced in size and then shortened with an ellipsis to
  fit their cell; the full text stays in the document. Switching back to Basic keeps the fields for later use.
- **Revision history** stores records you enter. Set the drawing's revision, enter **Date**, **Change** and optionally
  **By**, then click **Record revision**. This also turns on **Revision table**. Each revision label can appear once,
  with at most 50 records. **Remove** deletes one record; clearing the table checkbox hides the table and keeps its records.
- The table shows revision, date, description and author in the order entered. It uses the same placement and issue
  checks as other drawing tables. The fields and table are included in the sheet's SVG, DXF and PDF exports.
- Changing the active revision or clicking **Next revision** does not add a history record. A record does not change
  the active revision or establish approval. **Checked by** is also entered text, not a recorded approval action.
- The agent sets `titleBlock` and `revisions` through `drawing.set` (`set_drawing`). The title block has a `template`
  of `basic` or `extended`, plus optional `organization`, `number`, `drawnBy`, `checkedBy`, `material` and `finish`.
  It replaces the previous title block. Each revision record has `revision`, `date` (`YYYY-MM-DD`), `description`
  and optional `by`. The list replaces the history; `[]` clears it, and omission keeps it. To show it, include a table
  with `from: 'revisions'`. Invalid fields, dates, duplicate labels and multiline text are refused with `DRAWING_OPTIONS`.

For authored revision history, supply a dense list with no empty slots. One invalid record refuses the update; it
does not silently remove that record or clear the history. Revision labels allow 1–6 characters, descriptions
1–120 and authors 1–60. Optional title-block fields allow 1–120 characters. Omit an optional field if unused; an
explicit empty or whitespace-only value is refused. Text must be single-line. Leading and trailing spaces count
toward the length limit and are retained. Dates must be real calendar dates in `YYYY-MM-DD` form. Saved-file readers filter invalid or duplicate records.
An authored update must pass the stricter checks above.

## Sections

**Add section** places a cut through the part: section A–A, B–B and on, each with its cutting line in the view where
the plane is edge-on, and the cut faces hatched.

- A principal section is square to the front, top or right view.
- An aligned section follows an off-axis feature, for example a keyway in a tilted bore. Its plane is square to the
  feature's axis, and its cutting line is drawn inclined.
- **Export section DXF** writes one section on its own.

When setting sections through the agent, a changed or removed section with dimensions gives
`DRAWING_SECTION_REFERENCES`. Remove those dimensions explicitly before changing the section definition.

### Half and offset sections

Each principal section's **Kind** includes **Full**, **Half** and **Offset (stepped)**. Half and offset sections are
put together from exact plain sections, so each part is what a plain section or the uncut view shows there.

- **Half.** The section on one side of a centreline and the uncut view on the other. Set the centreline's direction,
  where it lies and which side is cut; by default it runs up the middle of the view, cut to the right. The cutting
  line stays whole, and a centreline is drawn through the view, 3 mm past it.
- **Offset (stepped).** The cut steps to other depths along the way, to pass through features that don't lie on one
  plane. Each step has where it starts and its depth; **Add step** adds one, and the steps run across or up the view.
  Each band is the plain section at its depth, and nothing is drawn where two bands meet. The cutting line steps with
  it, square across at each step, thick at its ends and bends.
- **The agent.** It gives a section `half` or `steps` (with `along`) in `set_drawing`'s `sections`. Not both on one
  section, not on an aligned section, and steps must increase; otherwise the change is refused.
- **Turning the drawing.** Choosing another front view is refused with `SECTION_KIND` while a half or offset section
  is on it.
- **Not yet:** a half section's cutting line drawn over the cut half only, steps not square to the view's axis, and
  turning such sections with the drawing.

### Removed and revolved sections

Choose **Removed** or **Revolved** in the section's **Kind** control to show only the cut face, with its outline and
hatch. Geometry behind the cutting plane is left out.

- **Removed.** The cut face is placed apart from the views, in free room on the sheet. Its cutting line stays on the
  view that shows the plane edge-on. The section's scale control uses **The sheet’s** scale by default, or a scale you
  choose. Its name includes the scale when it differs from the sheet's.
- **Moving a removed section.** With **Select** (<kbd>V</kbd>), drag inside its box, away from a dimension. Its centre
  is saved at the new sheet position. Moving or rescaling it keeps the same cut, and its dimensions read model sizes.
- **Revolved.** The cut face is turned a quarter turn about the cutting plane's trace and drawn on the view, centred
  on that trace. A front section is drawn on the top view; a top or right section is drawn on the front view. It uses
  that view's scale and has a centreline, with no separate section name or cutting line.
- **Which sections.** A removed section can be principal or aligned. A revolved section must be principal. Neither
  can also be half or offset, and a section cannot be both removed and revolved.
- **The agent.** In `set_drawing`'s `sections`, `removed` holds optional `at` and `scale` fields. Its `at` is the
  section centre, `[x, y]` in sheet mm; without it, placement is automatic. Its scale is absolute: 2 means 2:1,
  regardless of the sheet's scale. Without it, the sheet's scale is used. A section's outer `at` still sets the cutting
  depth in model mm. For a revolved section, set `revolved` to true instead. Invalid combinations are refused with
  `DRAWING_OPTIONS`.
- **Issues.** `SECTION_NO_ROOM` means a removed section has no free room. Use a larger sheet, a smaller section scale,
  or place it by hand. `SECTION_NO_VIEW` means a revolved section has no view to receive it, so it is not drawn; use a
  removed section to show the same cut face. These issues have no automatic fix.
- **Turning the drawing.** Choosing another front view is refused with `SECTION_KIND` while a removed or revolved
  section is present. Change it to **Full** first.

## Detail views

A detail view enlarges a small region of a view or a section: the parent's exact projection, cut to a circle and drawn
at its own scale. Nothing is approximated except a section's hatch boundary.

![Detail B of a plate's hole at 5:1, at the sheet's top right; its circle and letter on the top view, and the DETAILS card with its scale](/shots/studio/drawings/detail-view.jpg)

- **Adding one.** The **Detail view** tool (<kbd>E</kbd>): click the centre of what to enlarge on a view or a section,
  then how far its circle reaches. It takes the next free letter from B; A stays the front section's.
- **What is drawn.** On the parent, a thin circle and the detail's letter. The detail itself shows the parent's hidden
  lines and a section's hatch, inside its circle, named as `DETAIL B (5:1)`.
- **Its scale.** **Auto** is the smallest standard scale at least twice the sheet's. Past 10:1 it is twice the sheet's.
  The **DETAILS** card lists each detail with its scale, which you can set, and a button to remove it.
- **Its place.** It's laid out in the first free room from the frame's top right. Drag it anywhere in its square to
  move it.
- **Dimensions.** They work in a detail as in a view. Their values come from the model, so a detail's dimension reads the true
  size, not the enlarged one.
- **Issues.** `DETAIL_PARENT_MISSING`, when its view or section isn't on the sheet, and `DETAIL_EMPTY`, when its circle
  holds nothing. Both are fixed by removing the detail with its dimensions. `DETAIL_NO_ROOM` has no automatic fix.
- **The agent.** It sets them with `set_drawing`'s `details`, each `{ id, view, center, radius, scale?, at? }`. A list
  replaces the details, and `[]` clears them. A detail's parent, centre or radius can't change while it has dimensions.
- **Not yet:** centre and thread marks inside a detail, a rectangular or jagged boundary, a detail of the isometric
  view, and a detail on another sheet.

## Broken views

A long part, such as a shaft or a bar, can be drawn with a band of its length left out, so the views fit the sheet at
a larger scale.

![A 500 × 20 × 20 bar broken from X 100 to 400, drawn at 1:1 on A4 without the isometric view: its front and top views shortened, break lines at the gap, the length dimension reading 500](/shots/studio/drawings/broken-view.jpg)

- **The BREAKS card.** **Add break** leaves out the middle third of the part's longest axis, in whole millimetres.
  Each break then has its axis and its two ends, in model mm, which you can change, and a button to remove it. A change
  that would reverse a break or make two meet on one axis is refused.
- **A break is along a model axis, not a view.** It applies to every orthographic view whose horizontal or vertical
  axis it is, and to their principal sections, so the views stay in projection. A view looking along that axis, the
  isometric view and aligned sections aren't broken.
- **What is drawn.** The band is left out and closed to a 6 mm gap. A thin break line, with a small zig-zag, crosses
  the view at each side of the gap.
- **Dimensions across a break.** They read the true length, though drawn shorter. So does everything placed on the
  view: centre marks, datums, leaders and balloons.
- **The layout.** Each scale is worked out with the breaks, so **Auto** takes the larger scale a broken part allows.
- **Issues.** `BREAK_NO_VIEW` when a break shortens no view on the sheet; its fix removes the break.
- **The agent.** It sets them with `set_drawing`'s `breaks`, each `{ axis, from, to }`. A list replaces the breaks, and
  `[]` clears them.
- **Not yet:** breaks in the isometric view, the curved break symbol for round bars, and a break inside a detail.

## Dimensions and notes

![A sheet after Auto-dimension: overall sizes, the hole's position and its callout](/shots/studio/drawings/auto-dimension.jpg)

| Key | Tool | How |
|---|---|---|
| <kbd>V</kbd> | Select | Click a dimension to select it, drag to move it; <kbd>Delete</kbd> removes it |
| <kbd>D</kbd> | Linear dimension | Click two points or one straight edge, then where the dimension goes |
| <kbd>O</kbd> | Diameter (Ø) | Click a circle, then where its diameter goes |
| <kbd>R</kbd> | Radius | Click a circle or an arc, then where its radius goes |
| <kbd>A</kbd> | Angle | Click two straight edges, then the side of their corner |
| <kbd>N</kbd> | Note | Click the paper for a note, or a view for a leader |
| <kbd>T</kbd> | Point datum target | Click a straight edge endpoint, then place the target symbol |

**Auto** under **Dimensions** (Auto-dimension) lays out the views with room, picks a scale and sheet that read cleanly, then adds the overall
sizes, steps, hole positions and callouts. It replaces its own earlier dimensions and keeps yours. A dimension goes
where both its ends are visible: in a section when the section shows more than the view.

For authored drawing data, a dimension's `place` uses the view's model coordinates in mm. A note's `at` instead
uses sheet mm, while its optional `leader.at` uses the view's model coordinates. Do not scale model coordinates
to match the sheet: the drawing applies the view scale. A leader follows its view; a note's text position stays on
the sheet.

### Hole callouts from parameter values

For code that prepares drawing annotations, `holeCallout` from `@barocss/cad-model/drawing/callout` takes the document's model nodes, a current edge name, and an optional numeric parameter map. Pass `doc.parameters` when a hole radius or depth refers to a parameter. The same map resolves the radius and depth of a following counterbore. Omitting the map uses an empty map; it does not read parameters from the document automatically.

The result is annotation text or `null`, not a measured dimension or a drawing update. Lengths are in model mm, independent of sheet scale. The text uses diameter, `THRU` or depth, and available pattern, thread, counterbore, and countersink information. Resolved hole and counterbore radii and depths are rounded to three decimal places before formatting; the diameter is twice the rounded radius. A non-hole edge, an unresolved required parameter, or a required hole or counterbore length that is non-finite or non-positive before rounding gives `null`. Very small positive lengths can round to zero; the text is not a geometry-validity check.

```ts
import type { ModelNode } from '@barocss/cad-model/engine/doc';
import { holeCallout } from '@barocss/cad-model/drawing/callout';

// Supply the current document's nodes and doc.parameters, plus an edge name
// selected from that same model. No feature or geometry is created here.
export function currentHoleAnnotation(
  nodes: readonly ModelNode[],
  parameters: Readonly<Record<string, number>>,
  edgeName: string,
): string | null {
  const text = holeCallout(nodes, edgeName, parameters);
  if (text === null) return null; // Leave this edge without a hole callout.
  return text;
}
```

## Tolerances

**Tolerancing** is **± dimensions** or **Geometric (datums, position)**. **Tolerance suggestions** proposes the
tolerances the part needs, such as hole positions and fits; **Accept** takes one and **Accept all suggestions** takes
them all.

- A tolerance from your fit or fastener rows cites the row.
- One without a row is an estimate and says so.

### Datum references and control frames

A datum stores one edge reference or one face reference. A face reference keeps the exact face name, including its
assembly occurrence prefix. Its `near` point selects the nearest current boundary vertex of that face. A missing
or ambiguous face stays unresolved; the drawing does not substitute another face or reuse the old point.

A point datum target marks one endpoint of a straight B-rep edge in a base view. Choose **Point datum target**
or press **T**, click the endpoint, then click where the symbol goes. If endpoints overlap, choose the exact edge
and endpoint in **Point datum targets**. Each target has a unique letter-number pair, such as A1. Circle centres
and curved edges are not supported.

The target records the endpoint and the current edge signature. If the edge changes, is missing, or cannot be
identified, the saved target stays unresolved; it does not move to another edge or use the old hint as its point.
Show its view and choose **Reselect endpoint** to confirm a current endpoint. **Move symbol** changes only the
symbol's position.

Each datum has an `id` and a letter. A geometric control frame has its own `id` and names its datums by letter.
An attached frame refers to a dimension by `dim`; there can be at most one frame per dimension. A standalone
frame instead has a view and a position in that view's model mm. In **Standalone geometric controls**, choose
a visible view, select **Add standalone frame**, then click where the frame goes. **Frame details** edits its
characteristic, tolerance and datums; the controls also let you move or remove it. If its view is hidden, the
frame is kept at its saved position, is not drawn and cannot be moved, and `VIEW_NEEDED` says which view to show.
Saved files and the SVG export keep the frame at its position in the view. Authored inputs require unique datum
ids, datum letters and frame ids. These symbols and modifiers are annotations; they do not solve or verify the
part's geometric tolerances.

A frame can also carry a spherical zone (`sphere`, drawn SØ, position only), a statistical tolerance (`statistical`,
ST in a hexagon), an unequally disposed profile (`unequal`, the outward amount from 0 up to the value, drawn as a circled U
and the amount) and `around` (`all-around` or `all-over`, a circle or double circle beside the frame; profile only).
A profile frame can have a `composite` second segment like position, or a `stacked` frame: a second, independent frame of the
same position or profile characteristic, drawn as a full frame with its own symbol directly below the first. A frame is
composite or stacked, not both. In the frame editor the options that fit the chosen characteristic are shown; the rarer ones
(statistical tolerance, the unequal amount) are under **Details**, and the problem with the frame is written under the controls.

New and edited frames must follow the rules that ASME Y14.5 and ISO 1101 share, and are refused in plain words when they do not:

- Form tolerances (straightness, flatness, circularity, cylindricity) take no datums. Maximum or least material is allowed on straightness and flatness only.
- Orientation (parallelism, perpendicularity, angularity), concentricity, symmetry and runout need at least one datum.
- Runout takes no material modifier on the tolerance or the datums; profile takes none on the tolerance; circularity and cylindricity take none.
- A diameter zone is for position, straightness, orientation and concentricity. Runout takes none.
- A projected zone is for position and orientation. A tangent plane is for orientation and profile, and is not combined with a diameter zone or a projected zone.
- A composite second segment names some of the first segment's datums in the same order and has a smaller tolerance.

Only rules that ASME Y14.5 and ISO 1101 share are enforced; standard-specific rules (for example concentricity and symmetry, which ISO keeps and ASME dropped) come with the standard setting of roadmap 11③.
A frame is refused only for a rule break it did not already have, so an old frame can be repaired one field at a time. Frame numbers show as authored, up to 4 decimals.

A saved drawing that breaks one of these still opens unchanged: `FRAME_RULE` lists each broken rule, with no automatic fix.
`DATUM_UNDEFINED` also counts a point datum
target set as defining its letter.

## Issues

**Drawing issues** lists what the sheet is missing or gets wrong: a feature with no dimension, a dimension that was
lost after a model change, a feature a section would show better. Each issue can carry a **Fix**. **Fix all issues**
applies them all, and **Issue count** shows how many are left.

`DATUM_LOST` reports a datum with no current anchor in a visible view. `DATUM_TWICE` reports a repeated datum
letter. `FRAME_LOST` reports a frame whose dimension is lost or missing, and `DATUM_UNDEFINED` reports a frame
that names a datum with no datum feature or point target set. `FRAME_RULE` reports a frame that breaks a rule above. `FRAME_VIEW_MISSING` reports a standalone frame whose view is missing;
its saved position is kept. `TEXT_OVER_LINES` reports annotation text, such as a dimension's, a table's or a
standalone frame's, that lies over drawing lines. `DATUM_TARGET_UNVERIFIED` reports a point target that needs its endpoint selected
again. `DATUM_UNDEFINED` has no automatic fix: define the datum or edit the frame.

## Tables and balloons

The sheet can carry the tables that the part's features need:

- **BOM table**, with **Balloons** linking each line to its parts;
- **Weld list table** and **Weld symbols** for weldments;
- **Cut list table** for frames;
- **Bend table** for sheet metal;
- **Gland table**, **Spring data table** and **Element list table** for those features.

A table column's `unit` is a header label, not a conversion: supply numbers in the unit you name. Numeric cells
use up to two decimal places by default, dropping trailing zeros. `digits` accepts an integer from 0 to 6 and
requests that many decimal places; very large numbers can still use exponent notation. A `null` cell shows an em dash.
Table positions use sheet mm with Y increasing downward; `corner`
selects which table corner sits on `at`. These positions do not use model coordinates or the model's scale.

## Export

- **Export SVG** and **Export PDF** write the sheet as shown.
- **Export DXF** writes it as AutoCAD 2000 or R12, chosen in **DXF version**.

R12 converts unsupported curve forms to polylines with a chord tolerance of 0.001 mm on the sheet.
This is a drawing-export setting, not a model or manufacturing tolerance.

If PDF export warns that some characters became `?`, review the notes and title block before sending the file.
The warning appears after the PDF download; it does not cancel it. Use **Export SVG** to keep those characters.

Check **Drawing issues** as well as the exported sheet. The issue list reports unresolved references separately
from the marks drawn on the sheet; an exported file alone does not establish that every annotation is resolved.

### Drawing files from code

Use the `StudioPart` facade to set up a drawing and get its files. This example makes a pin with an 8 mm
diameter and a 30 mm length:

```ts
import { part } from '@barocss/cad-model/api';

const pin = part('pin')
  .cylinder({ r: 4, h: 30 })
  .material('steel')
  .process('cnc-turning')
  .drawingSettings({ title: 'pin', sheet: 'A4' })
  .autoDimension();

const drawing = pin.drawing();
console.log(drawing.issues, drawing.pdfMissing);
// drawing.svg and drawing.dxf are text; drawing.pdf is a Uint8Array.
```

`drawingSettings` and `autoDimension` return a new part. The default `autoDimension()` can choose the front
view and change the sheet, scale and view layout to fit the dimensions. To keep the current sheet, scale and
views, call `autoDimension({ layout: false })`. It adds dimensions to the current layout. Both options keep
manually placed dimensions. Automatic component dimensioning is refused for assembly drawing scope with
`DRAWING_SCOPE_AUTO`.

`pin.drawing()` is synchronous and returns the same fields as `drawingOf(doc)` from
`@barocss/cad-model/api/outputs`:

| Field | Result |
|---|---|
| `sheet` | The drawing report's sheet data |
| `issues` | Issue records with `code`, `severity`, `message` and an optional `fix` |
| `svg` | SVG file text |
| `dxf` | AutoCAD 2000 (`AC1015`) DXF file text |
| `pdf` | PDF file bytes as `Uint8Array` |
| `pdfMissing` | Characters the PDF font cannot show; these print as `?` |

The function does not download files or change the document. Check `issues` and `pdfMissing` before writing
these files. It has no DXF-version argument; the Studio's R12 choice is separate.
Drawing-input refusals throw `BarocssError`, preserving a reported bracketed code or using `DRAWING` when none
is present. An issue in a returned report does not by itself mean the export was refused.
