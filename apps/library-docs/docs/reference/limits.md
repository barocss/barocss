# Limits

What isn't supported, or is refused, gathered from the other pages. Each item links to where it is explained.

## Status

- **Unreleased.** Everything is unreleased, at `0.0.0`: nothing is on npm, and APIs can change.
- **No migrations.** Documents follow the latest schema. Older unreleased documents aren't migrated.
  ([The .bcad document](/reference/document))
- **Not covered.** Electronics CAD (PCBs) and finite-element analysis aren't part of this stack.

## Sizes and rows

- **No standards built in.** There are no built-in thread sizes, fastener catalogues, fit tables, bearings, casting
  allowances or stock lists. ([Shop rows](/studio/rows))
- **What needs rows.**
  - A tapped hole, a fastener, or fitting a fastener to a hole needs your fastener sizes; without them it is refused
    with `[FASTENER_SIZE_ROW]`.
  - A casting report without your casting rules marks its limits `unknown`, and a sand pattern is refused.
- **Rows come from people.** The agent can't load rows it wrote itself (`[ROWS_NOT_FROM_PERSON]`).
- **File limits.** A rows file is at most 256 KiB, and a conversation takes at most 32 files and 1 MiB.
  ([Rows file formats](/reference/rows))

## Files

- **Not read.** DWG files are refused. ([Files and exports](/studio/files))
- **IGES** opens as curves and surfaces to edit directly, not as solids. The kernel reads one IGES profile:
  untransformed rational B-spline curves and surfaces. ([Exchange formats](/packages/cad/formats))
- **STL** carries triangles only: no units, colours, names or exact curves.
- **STEP.**
  - Entities the kernel doesn't take, such as offset surfaces, are refused by name.
  - A mesh body written as planar faces is refused past 250,000 triangles.
- **DXF R12** has no ellipses, splines, hatches or multi-line text. They are rewritten within a tolerance you give, or
  refused.
- **Unsaved work.** The recovery copy is kept only in this browser. There is none in private browsing, or when the
  part is too large for the browser's storage.
- **Not exported yet.** A part that is still evaluating, or that failed, isn't exported. A quote package also waits
  for the part's masses, which arrive a moment after the shape.

## Modelling

- **Holes on a circle.** The first hole must sit away from the circle's centre.
  ([Part features](/studio/features))
- **Frames.**
  - A positive weld gap together with a notch isn't supported.
  - Weld beads on oblique member ends are refused until there's an independent check for them.
  ([Frames and weldments](/studio/frames))
- **Robots.**
  - Motions such as a screw, or two turns about different axes, are refused.
  - A loop in the mates keeps one path.
  - Revolute and prismatic joints need their limits, effort and velocity before they export.
    ([Robots](/studio/robots))
- **Unsupported cases.** The kernel refuses a case it doesn't support yet, in the category `CAPABILITY`, rather than
  building an approximate body. ([B-rep, robustness and refusals](/packages/cad/robustness))
- **Part documents.** The kernel's `loadCadPart` reads a part document of at most 4 MiB.
- **Mass.** A few curved bodies' mass properties fall back to the tessellation, and say so, with an error bound.
  ([@barocss/cad](/packages/cad/))

## Manufacturing

- **The CNC preview** is not for production: a 2.5D display estimate, with no G-code, feeds, speeds or collision
  check. `cad-cli cam-preview` is the same. ([Manufacturing](/studio/manufacturing))
- **One preview at a time.** The dock's **Preview & analysis** shows one of CNC, Print, Clearance or Analysis at a
  time.
- **Unknown, not passed.** A check that lacks what it needs reports `unknown`, never `pass`.

## Drawings

- **Auto-dimension** works on a part's sheet. An assembly's sheet keeps its BOM table and balloons.
  ([Drawings](/studio/drawings))

## The agent

- **What waits for you.**
  - At the default autonomy, L2, the agent changes values and builds an empty part directly. Anything more waits for
    you as a proposal.
  - The assembly, mates, the drawing, the robot's settings and locked parts always wait for you.
  ([Proposals and autonomy](/agent/proposals))
- **Turns.** A message takes at most 24 steps and four images. The chat takes images and JSON rows files, not
  drawings. ([Designing with the agent](/agent/))
- **No live examples.** This site's agent examples come from scripted runs, not a live model.

## WebGPU only

- **The analysis maps** (wall thickness, draft and 3-axis access) and **the mould's parting line and halves**. On
  WebGL2 their buttons are disabled and say why.
- **The Render workspace.** It renders only with WebGPU, and **Export image** says it needs WebGPU.

([Tour of the studio](/studio/tour), [@barocss/gpu](/packages/gpu/))

## Not in the interface yet

- **Frame costs.** The viewer counts each body's draw work, but the studio doesn't show it.
  ([Display, sections and analysis](/studio/display))
- **GPU compute** (`computeExperimental`) is experimental, and may change without a version bump.
