# BOM and quotes

## The bill of materials

**BOM** in the top bar opens the bill of materials of the part or the assembly.

- **Lines.** Each line has an **Item**, a **Qty**, the **Row** it came from and its **Source**.
  - The placed parts' lines come first, then the bought elements: fasteners, bearings, O-rings, rings and the like.
  - Bought elements are merged over copies by kind, size and row, so four M6 screws are one line of 4.
  - A placed fastener is a bought line of its own.
- **Bought or made.** Every element line can be marked bought or made. Made elements are listed under
  **MADE ELEMENTS**. The choice is one undoable change.
- **Estimates.** A line with no row behind it says **estimate**, so you know which numbers are not yet from your
  shop data.
- **Separate pieces.** A body made of separate pieces that only touch along an edge or a point shows its count under
  **Lumps**.
- **Totals.** The totals line counts the parts and bought elements and adds up the parts' mass.
- **Purchase list.** **Export purchase list** downloads the bought lines as CSV. Tick **With made parts** to add
  the made parts.

## Masses

Each part's mass is its volume times its material's density. The kernel integrates the volume exactly when it can.
When it has to work from the display mesh, for example on some freeform bodies, the body's properties say
**From the mesh** with the volume's error bound. The BOM's and the quote's masses then carry that bound and are marked
as estimates.

## Quote package

**Quote package**, in the library panel, downloads one zip for a supplier:

- the part as STEP;
- its manufacturability report;
- the request: material, finish, pull direction and quantity.

It contains no price. What is still open, such as a missing row or an unknown rule, is said in the request rather
than left out.
