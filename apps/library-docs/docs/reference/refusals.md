# Refusal codes

When BaroCSS CAD can't do something correctly, it refuses and says why. A refusal leaves the part as it was. This
page lists the codes refusals carry.

## How a refusal looks

- **In the kernel**, a `CadPartError` with a `code`, the `feature` it comes from, and a message. The message often
  starts with a more specific code in brackets.
- **In the document model and the agent's tools**, a message that starts with a code in brackets, such as
  `[FASTENER_SIZE_ROW] no row for M6 — load your fastener sizes …`.
- **In a tool result**, `isError: true` with the message, and sometimes a `code` field the agent acts on:
  - `needs_proposal`: the change goes past the autonomy level, so the agent should propose it;
  - `needs_approval`: the change is the person's to make (the assembly, mates, the drawing, the robot or a locked
    part).

  See [Proposals and autonomy](/agent/proposals).
- **Merge conflicts.** When the agent's changes are merged onto your own edits, the ones that collide wait in a
  proposal, each with a `TURN_…` reason. For example, `TURN_SAME_NODE` means it changes a feature you changed.

## The kernel's error codes

| Code | What it means | For example |
|---|---|---|
| `FORMAT` | The input isn't a part document it can read | `a part document of at most 4 MiB is required` |
| `INPUT` | A field is missing or malformed | — |
| `PARAMETER` | A value is out of range, or doesn't fit the geometry | `[RADIUS_EXCEEDS_FACE] edge a.side0\|a.top: fillet 50 mm is too large for walls of 10 and 10 mm` |
| `REFERENCE` | A feature, output or named face it refers to isn't there, or is ambiguous | an extrude of a sketch id that doesn't exist |
| `SELECTION` | A selection doesn't exist or doesn't apply | `no edge named a.side9\|a.top; edges: …` |
| `CAPABILITY` | A case the kernel doesn't support yet | `… on a body mixing mesh and other faces is not supported yet` |
| `GEOMETRY` | The result can't be built as a valid body | a face that can't be triangulated |

The `PARAMETER`, `REFERENCE` and `SELECTION` examples are from this site's samples
(`samples/cad-robust.test.mjs`, `samples/cad-part.test.mjs`).

## Every bracketed code

These tables are generated from the sources by `scripts/refusals.mjs`, and the docs check fails if they fall behind.
For each code they give the folders that raise it and one of its messages as written: `…` stands for a value filled in
when it is raised. A code raised in several places has more messages than the one shown.

<!--@include: ./_refusals.md-->
