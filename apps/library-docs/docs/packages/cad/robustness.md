# B-rep, robustness and refusals

## Booleans, fillets and offsets on exact surfaces

Every output of a part is one B-rep, with its faces on exact surfaces and its edges on exact curves.

- **Booleans.** `union`, `difference` and `intersect` work three ways, by what the inputs are:
  - **planar bodies** take exact polyhedral Booleans;
  - **curved bodies** take analytic Booleans: planes and cylinders at any angle exactly, and other surfaces, such as
    revolved cones and tori or B-splines, by tracing their intersection curves onto both surfaces;
  - **mesh bodies** take faceted Booleans of their own.
- **Fillets and chamfers** roll a ball along the named edges, or cut them back, on the exact faces either side.
- **Offsets.** `shell`, `thicken` and `draft` offset or tilt faces on their surfaces.

## Strict validity and typed refusals

`validate()` runs the strict check on an output. It checks:

- the topology: closed shells, each edge used twice;
- that edges lie on their surfaces;
- that loops don't cross;
- that there are no slivers;
- that tolerances stay under their cap.

The report gives `valid`, the first issues, the counts, each body's topology (shells and genus) and the largest gaps.

An operation the kernel can't complete correctly throws a `CadPartError` instead. It has:

- **`code`**: one of `FORMAT`, `INPUT`, `PARAMETER`, `REFERENCE`, `SELECTION`, `CAPABILITY` or `GEOMETRY`;
- **`feature`**: the id of the feature it comes from;
- **a message** saying what went wrong, often with a code of its own in brackets and what would work.

<<< @/../samples/cad-robust.test.mjs#refusals

The kernel doesn't return an approximate body in place of a refusal.

## Touching lumps as separate bodies

When a Boolean leaves pieces that touch only along an edge or at a point, they stay separate bodies of one output.
They aren't welded into a body whose edge is shared by four faces, and they aren't refused.

<<< @/../samples/cad-robust.test.mjs#touching

The studio carries this through: such a body exports as one STL file per piece, or as separate 3MF objects.

## How it is checked

- **Conformance.** `conformance/` holds over 400 cases in folders named by the roadmap step that added them. A case
  that a later step superseded is kept as the record, but not run.
  - Each case is a part document and what any correct implementation must produce: volume, centroid, area, bodies,
    topology, face names, a watertight tessellation, a STEP round trip, sheet-metal and frame reports, or the error it
    is refused with.
  - Each case says where its expected values come from: closed form, an independent tool, or this kernel.
  - `test/conformance.test.mjs` checks every case.
- **The robustness runner** (`pnpm rb`) puts every conformance case and the seed corpus (`robustness/corpus/`)
  through the kernel. Each case runs in a worker under a time limit. The runner prints pass rates by stage and
  category, marks known failures as TODO, and fails on any failure that is new.
- **Properties** (`pnpm rb:props`): generated inputs checked against stated properties, with the smallest
  counterexample when one fails.
- **The fuzz** (`pnpm rb:fuzz`):
  - It runs seeded random CSG trees, each checked against an independent ray-casting oracle: valid, watertight, and
    with its volume and centroid within the oracle's bounds.
  - Each case is OK, KNOWN or REFUSED (counted by code). Anything else is a finding: WRONG, INVALID, CRASH or TIMEOUT.
  - A finding is shrunk to its smallest tree and can be saved as a replayable case.

These need the built package (`pnpm build:library`). [How it is verified](/reference/verification) covers the
studio's checks too.
