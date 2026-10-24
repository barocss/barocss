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
| **Coincident** | Two flat faces on one plane, a straight edge on a plane, or two straight edges on one line |
| **Distance** | Two flat faces at a distance |
| **Angle** | Two flat faces at an angle |
| **Concentric** | Axes aligned for cylinders, cones, circular edges or straight edges; or two spheres with one centre |
| **Tangent** | A cylinder touching a plane or another cylinder; or a sphere touching a plane |
| **Lock** | One part fixed to another |
| **Cam** | A follower's flat face riding a cam's lobe, from a face of the cam: see [Robots](/studio/robots#the-joint-tree) |

Only compatible kinds are admitted. **Cam** is also admitted when the moving face is flat. **Mate flip** changes the
side or orientation for the chosen kind. The panel's **Freedom** line says what the picked part can still do: fixed
in place, placed by typed numbers, or the motion its mates leave free. A mate that can't be solved is refused, and
**Mate refused** says why.

### Face and edge references

The reference table includes planar, cylindrical, spherical and conical faces, plus straight and circular edges.
The mate editor labels them as a sphere or socket, cone or conical seat, straight edge, arc edge or circular edge.
The agent reads the table with `assembly.get` and `faces_of`, then passes the persistent name in each mate end's
`face` field to `assembly.add_mate`. Edge names join their two face names with `|`. This does not add direct vertex
references or a new viewport edge-picking workflow.

A cone or edge supplies an axis for a concentric mate; it does not impose contact along its whole shape. Two
concentric spheres share a centre and retain three rotations. A sphere tangent to a plane retains three rotations
and two slides. Unsupported pairs, such as a cone tangent to a circular edge, are refused with `MATE_FACES`.

Spheres, cones and edges are classified from the B-rep with finite geometric samples and tolerance checks. This is
not a proof that every arbitrary NURBS surface has one of those shapes. Stored signatures are checked on reopening.
An assembly mate can be valid while its motion is unsupported: a sphere/plane tangent is refused by the motion tree
with `MOTION_UNSUPPORTED`; unsupported loop mates use `LOOP_MATE_UNSUPPORTED`.

The agent locks a part with `assembly.lock` (`part`, `to`): a lock mate that keeps the part where it stands in the
other's coordinates, proposed for you to accept as its other assembly changes are.

The freedom that mates leave is also what makes a mechanism move. [Robots](/studio/robots) reads the mates as joints.

## Interference and clearance

![Interference: a cylinder through a box, with the overlap's volume](/shots/studio/assemblies/interference.jpg)

- **Interference** finds where bodies overlap and by how much. For example, a cylinder through a box gives
  `Box ∩ Cylinder` and its overlap volume.
- **Clearance**, in the dock's **Preview & analysis**, classes every pair of bodies and draws it on the model:

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

## Variants

An assembly can have **inputs**, each driving a few things explicitly, and **variants**, named sets of input values.

**Variants**, among the inspect tools, opens the **Variants** card in the dock:

- **The list.** **Master** and each variant, the active one marked. **Show** shows one; **×** deletes a variant.
- **Showing a variant.**
  - It is regenerated from the master, and the master isn't changed.
  - While it is shown, every modelling edit is refused: commands, the feature editor's **Apply**, moving placed parts,
    and **Parameters** edits. The message is **Can't change the part now**, with
    `Showing <name>: show the master to edit.` **Show the master** goes back.
- **The inputs.** Each input's value, with what it drives under it. Editing values doesn't write anything yet: the card
  counts the values that differ.
  - **Save these values as…** and **Save** keep them as a new variant.
  - **Update** writes them into the variant shown.
  - **Reset to** drops the edits.
- **Unmet mates.** A mate the shown variant leaves unmet is listed, its reason behind a click.
- **Undo.** Saving, updating, deleting and switching each go through the same action the agent uses, and are one
  undoable step.

With no inputs yet, the card says so. Inputs are added by the agent's `assembly.inputs`, or written in the document.
A part's own configurations stay in **Parameters** (see [Parameters and configurations](/studio/parameters)).

- **The agent's actions:**
  - `assembly.inputs` sets the inputs. It changes the assembly's structure, so at L1 and L2 the agent proposes it, and
    from L3 it applies.
  - `assembly.variants` sets the named variants and which one is active. It applies from L2, and is proposed at L1.
  - The agent's summary of the part (`query.summary`) includes its variability.

  See [Tools](/agent/tools) and [Proposals and autonomy](/agent/proposals).
- **In code:** `@barocss/cad-model/assembly/variability` regenerates a variant from the inputs: `variantOf` takes its
  values and `variantNamed` its name.

- **Inputs.** An input has a name, a type (`number`, `boolean` or `choice`), an optional unit (`mm` or `deg`) and
  range, and a default. It drives one or more targets:
  - a part's **parameter**, as `scale · value + offset`;
  - a feature's **suppression**, when the value is the one given;
  - **which part** a placed instance uses, per choice: like another instance's part, or a part from a shipped library;
  - a **mate's** distance or angle.
- **The master is the default.** The document as saved is the variant where every input is at its default.
  - A variant is made from the master by setting what its values drive, then solving the mates again.
  - It is never stored as a model of its own, and the master is never changed.
  - With every value at its default, the master itself comes back.
- **What is refused.** The inputs are checked against the document, each refusal with its code:
  - two inputs with one name, or a variant naming an input that isn't there (`[INPUT_NAME]`);
  - a value outside its type or range (`[INPUT_RANGE]`), or a choice that isn't offered (`[INPUT_CHOICE]`);
  - an input that can't drive its target (`[INPUT_TYPE]`), or a target that isn't there (`[INPUT_TARGET]`);
  - two inputs driving one target (`[INPUT_CONFLICT]`);
  - a master that isn't what the defaults give (`[INPUT_DEFAULT]`);
  - a variant name that isn't there (`[VARIANT_UNKNOWN]`).

  See [Refusal codes](/reference/refusals).

