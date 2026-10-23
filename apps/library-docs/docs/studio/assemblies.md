# Assemblies and mates

An assembly is a document that places other parts as instances, positioned by mates or by typed values. The document's
own bodies are the **base part**.

## Placing parts

- **Insert part** in the top bar places another `.bcad` as an instance.
- **Library** inserts catalogue parts and snaps them by their interfaces.
- Pick an instance in the **Browser** to open its panel: its definition, its bodies and volume, **Duplicate** and
  **Remove**.
- Drag an instance with its gizmo along an axis or round one, or type its position. Undo puts it back.

## Shared definitions and revisions

Copies of a part share one definition. The instance panel says so, for example `Rev A · shared by 2`.

- Load a newer file with **New revision file**. The panel shows **Revision waiting**, and nothing changes until you
  click **Accept Rev B**. Then every copy takes the new revision where it stands. **Keep Rev A** keeps the current one.
- **Make independent** gives one copy a definition of its own, so later revisions of the shared one leave it as it is.

## Mates

A mate ties a face of one part to a face of another. The **Mates** panel lists them; pick one to edit or delete it.
To add one, pick a face that stays, then a face on the part to move.

| Mate | What it holds |
|---|---|
| **Coincident** | Two flat faces on one plane |
| **Distance** | Two flat faces at a distance |
| **Angle** | Two flat faces at an angle |
| **Concentric** | Two round faces on one axis |
| **Tangent** | A round face touching a flat face or another round face |
| **Lock** | One part fixed to another |

Only the kinds a pair of faces admits are offered (two flat faces: coincident, distance, angle; two round faces:
concentric, tangent; a flat and a round face: tangent), and **Mate flip** turns the moving part to face the other way. The
panel's **Freedom** line says what the picked part can still do: fixed in place, placed by typed numbers, or the
motion its mates leave free. A mate that can't be solved is refused, and **Mate refused** says why.

The freedom that mates leave is also what makes a mechanism move. [Robots](/studio/robots) reads the mates as joints.

## Interference and clearance

- **Interference** finds where bodies overlap and by how much. For example, a cylinder through a box gives
  `Box ∩ Cylinder` and its overlap volume.
- **Assembly clearance**, in **Display**, classes every pair of bodies and draws it on the model:

  | State | Meaning |
  |---|---|
  | designed | A contact the design intends, such as a key in its keyseat |
  | touching | Faces meet with no gap |
  | overlap | The bodies overlap, with the volume |
  | near | Closer than the clearance threshold |
  | clear | Farther than the threshold |

## Exploded view

**Explode** spreads the parts apart for display; each click steps the factor (`×0.5`, …), and the last turns it off.
The placements don't change, so mates and exports are unaffected.
