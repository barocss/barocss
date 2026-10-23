# Frames and weldments

A frame is a set of structural members along a skeleton, each member a body of its own. The members share their
section, and their joints are cut to fit.

## A frame

**Frame** builds members along a skeleton:

- **Skeleton:** **Table (top and legs)**, **Box (12 edges)**, **Rectangle**, **L (two members)**,
  **T (through and branch)**, or **Picked edges** — the straight edges you pick on bodies, such as a layout box or a
  sketch.
- **Width (X)**, **Depth (Y)** and the height size a preset skeleton.
- **Section:** the member's profile (below).
- **Corners:** **Mitre**, **Butt** (the larger section runs through) or **None (overlap)**.
- A weld gap holds member ends apart.
- Hole-saw and V cutters can replace the cope at one joint. A positive gap together with a notch isn't supported.

**Structural member** places one member on its own:

- **Member path:** **Straight**, **Arc by center**, **Arc through point** or **Tangent bend** (with its
  **Bend radius**).
- **Start** and **End** points.
- **Line through:** which point of the section the path runs through.
- **Roll:** the section's turn about the path.

## Sections

A section is either typed or taken from your library:

- **Typed:** a **Rectangular tube**, **Round tube**, **Angle**, **Channel**, **I/H beam** or **T-slot** profile, by
  its dimensions. Corner, root and toe radii are prefilled as estimates and say so.
- **From your library:** a row of your own frame sections. The section library holds your rows; you add, edit or
  load them from a file, each row with where its sizes come from or flagged as an estimate. None is built in.
  - Editing a row moves every frame that uses it.
  - A row a frame still uses can't be removed.

## Skeletons

**Skeletons** edits a frame's 3D sketch:

- draw and select on a work plane, with an axis lock;
- the diagnosis says what is free, redundant or unmet;
- add constraints and bind values to parameters;
- **Apply** or **Cancel** the session.

## Gussets, end caps and welds

- **Gusset** puts a triangular plate in the corner of two picked members, with its legs, thickness, corner clip and
  offset.
- **End cap** closes a member's end, either **Over the end** or **In the bore (a plug)**.
- Weld beads are added through the agent's weld action. Each joint's bead is owned once, so shared seams aren't
  counted twice. Oblique-end beads are refused until there's an independent check for them.

## The cut list

**Cut list** groups identical members into rows: quantity, section, material, axis length, long point, each end's cut
and mass, with the totals and a CSV. The densities are the materials library's estimates. With your stock lengths
loaded, the pieces are nested into bars, with the waste and the kerf.

On a drawing, the **Cut list table**, **Weld list table** and **Weld symbols** put the same information on the sheet.
