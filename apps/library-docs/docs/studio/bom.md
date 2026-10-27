# BOM and quotes

## The bill of materials

![The bill of materials for a shaft and its key: the part made, the key bought](/shots/studio/bom/bom.jpg)

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

Placed parts with the same shape and material share a line; **Qty** counts their occurrences, not their faces or
display triangles. The BOM lists the current document's placed parts. Do not treat that list as a recursively
expanded purchase list for every child of a nested assembly.

The default purchase CSV also includes library catalogue parts. **With made parts** adds made part lines and the
made element list; it does not change their bought/made settings. CSV item numbers retain their BOM line numbers,
so the filtered purchase list can have gaps. It is a quantity and sourcing list, not a price calculation.

## Masses

Each part's mass is its volume times its material's density. The kernel integrates the volume exactly when it can.
When it has to work from the display mesh, for example on some freeform bodies, the body's properties say
**From the mesh** with the volume's error bound. The BOM's and the quote's masses then carry that bound and are marked
as estimates.

An element line's mass is already included in its part's mass. Do not add every displayed line mass together to
recalculate the total. An unknown mesh mass bound remains unknown, rather than zero. If weld-bead accounting is
incomplete, the reported mass is a subtotal of valid bodies; it is not a complete welded-part total.

## Quote package

**Quote package**, in the library panel, downloads one zip for a supplier:

- the part as STEP;
- its manufacturability report;
- the request: material, finish, pull direction and quantity.

It contains no price. What is still open, such as a missing row or an unknown rule, is said in the request rather
than left out.

This package is for an injection-moulding request. Read `manifest.json`: `open` lists missing inputs, failed or
unknown checks and a STEP export failure, and `complete` is true only when that list is empty. A ZIP can therefore
be written while the request is incomplete, and can omit `part.step` if STEP export fails. A complete package is
still a request for a supplier's quote, not manufacturing approval.

Right after an edit, while the part's masses are still being worked out, it isn't written yet: export again in a
moment.
