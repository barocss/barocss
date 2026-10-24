# Concepts

A few rules run through every part of BaroCSS CAD. Knowing them makes the rest of these pages, and the studio's
messages, easier to read.

## Units and coordinates

- **Lengths are millimetres.** A document records `units: 'mm'`, and every length field and readout in the studio
  is in millimetres.
- **Angles are degrees** in the studio's fields. A few machine-facing outputs convert, for example robot exports,
  which write metres and radians as their formats expect.
- **Z is up.** The XY plane is the ground, and the camera orbits about Z. **Top** looks down Z, and a box's
  **Height Z** grows upward.

## Correct or refused

When the kernel or the document model can't produce a result it can stand behind, it refuses with a reason. It
doesn't return an approximate body or quietly skip a step.

- **Kernel refusals.** These are a `CadPartError` with a code, such as `RADIUS_EXCEEDS_FACE`, and a category:
  `FORMAT`, `INPUT`, `PARAMETER`, `REFERENCE`, `SELECTION`, `CAPABILITY` or `GEOMETRY`. They name the feature they come
  from, and their message says what went wrong, for example that two inputs graze within the merge radius.
- **Typed refusals** from the document model and the agent's tools begin with a code in brackets, so people and
  agents can both act on them. For example, `[FASTENER_SIZE_ROW] no row for M6 — load your fastener sizes …`.
- **Unknown, not passed.** A check that lacks what it needs reports `unknown`, never `pass`. For example, a casting
  check with no casting rules loaded.

[Refusal codes](/reference/refusals) lists them, and [How it is verified](/reference/verification) describes how
results are checked against independent answers.

## Sizes come from your rows

Nothing standard-like is built in: no thread table, no fastener catalogue, no casting allowances. Sizes come from
**shop rows**, JSON files a person supplies, with each value naming its source.

- In the studio, you load rows in **Library**, from your own file or from the samples that ship with
  `@barocss/cad-model` (`samples/rows/`).
- In the chat, you attach the file.
- The agent can suggest a file, but it can't load rows no person supplied. It is refused with
  `[ROWS_NOT_FROM_PERSON]`.
- Each loaded row keeps a receipt naming its file. A placed part uses the rows of the document it is placed in.
- Without the row a command needs, it is refused. A reading that has no row says so: no thread is drawn, no tap
  drill is given, and the position tolerance is an estimate.

The samples are examples taken from the sources each row names, not a standard. Check them against your supplier
before you use a part for manufacture. [Shop rows](/studio/rows) covers every row kind.

## The library's own values

Library parts, such as an extrusion profile, a slot nut or an enclosure boss, carry their own dimensions, marked as
the library's own estimates. They are not read from your rows. The T-slot parts' holes equal common M5 sizes; when
your loaded fastener sizes give a different M5 value, the part's notes say so and name both.

## Revisions and sources

- **A revision** is a 16-digit hex name for the state of the document that results depend on:
  - its features, parameters and outputs;
  - its rows, including fastener sizes and casting rules;
  - its frames and placed parts;
  - its brief, requirements and references;
  - its process, printing, moulding, machining and casting settings.
  
  Looks, such as appearances and render settings, aren't part of it. The same content always has the same revision.
- **Every export names the revision it was made from.**
  - **STEP** has it in its `FILE_DESCRIPTION`.
  - **3MF** has it as `barocss:SourceRevision` metadata.
  - **A drawing's** title block has it as an **SRC** line beside your own REV.
  - **STL**, and the **URDF**, **MJCF**, **SDF** and **USD** robot exports, can't carry it in their bytes. They get a
    `.source.json` record beside them instead, which holds:
    - the revision;
    - a SHA-256 of the content it covers;
    - the files it describes;
    - for a robot, the values set by hand: the base link and the joints' limits and ratings.

  Exporting the same part twice gives the same source. A STEP file differs only in its time stamp.
- **A late result never replaces a newer one.** Each request to the modelling engine is tied to the thing it
  replaces: a command's preview, the section view, a part's drawing, one placed part's bodies. When a newer request
  for the same thing goes out, an older reply comes back stale and is dropped, whatever order the replies arrive
  in. Dragging a section plane fast leaves the last cut on screen, not an earlier one.
