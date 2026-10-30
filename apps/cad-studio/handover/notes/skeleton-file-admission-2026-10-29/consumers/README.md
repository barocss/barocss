# D318 actual Studio skeleton file consumer evidence

Baseline `73c6085171f7d9b6931c395917742211f0266cbb` plus scoped D318 source/test changes. The selected real Studio
flow passes on its second run, Chrome WebGPU/DPR 1, Node 22.19.0. The post-flow script syntax check also passes.
The browser and its two fresh contexts are closed; the serial heavy gate is returned. Model/Studio full suites
are not repeated here. The separate focused source receipts are not relabelled as browser proof.

## Genuine UI files and fresh readers

The first document is made through the existing 3D sketch palette command: one point is clicked, Apply writes one
skeleton with no segments, and real Save downloads it. A new browser context opens that actual file. The context
has separate storage, recovery records and page module state. Exact document equality passes. History's real
`Edit in 3D sketch` action opens the one-point/zero-segment draft; Apply preserves the skeleton ID. A single point
has no solid body; its screenshot is not presented as evidence of a visible solid.

The main polyline is also made through the real UI. Three clicked points form segments (0,1) and (1,2). Fix,
Along X, Length 40, Along Y and Length 20 constraints make it fully defined. Apply and real Save retain the actual
points, two segments, five constraints and ID `n0`. Two ordinary frame follower nodes are then explicitly authored
in a real input file based on that UI Save. Each includes the required independent points/segments cache, skeleton
index 0, rect-tube width/height 10 or 20, wall 1, outer radius 0 and corners `none`. Their four output refs are
explicit. This is an authored file fixture, not a document/selection staging hook.

A second new browser context opens the follower file through the real file input. History's 3D sketch editor
changes Length 40 to 50 and applies it. The original skeleton ID, five constraints, nextId and every raw follower
field remain. Evaluation resolves the changed skeleton rather than depending on rewritten cached frame points.

## Independent geometry and persistence checks

The two tube areas are 10²−8²=36 and 20²−18²=76 mm². Their two uncropped segments give four actual member bodies.
Expected total volume is (36+76)×(40+20)=6720 mm³ before editing and (36+76)×(50+20)=7840 mm³ afterward. The flow
checks each producer's separate A×L sum and the total within 1e-6 mm³, with exactly four fresh finite-volume bodies
and deferred mass readiness. Actual raw body records are retained for both lengths. No viewport error occurs.

Real Undo restores the complete original follower document and its volume; Redo restores the complete edited
one. Real Save downloads current-schema asset-free JSON. Parsed full-document equality passes. New part and real
Open restore that accepted document, ID, followers and volume. The downloaded bytes are preserved unchanged;
semantic JSON equality is distinguished from byte identity between separate saves, which is not asserted.

The consumer agent directly inspected four actual final-run PNGs: the single-point fresh Open (zero solids), the
fully-defined polyline UI with all five constraints, and the edited/reopened four-member frame geometry. These
fresh pages used separate browser contexts with viewport 1440×900; the runner's measured main canvas metadata is
retained in `display.json`. Other browsers/DPR values, schema4 actual UI, bound-parameter UI and additional
exploration are NOT_RUN. The separate schema4 structural tests are not actual UI evidence.

## First failure, preserved

`flow-first-failure.txt` preserves the original failure: the newly authored follower fixture had `outputs: {}`,
but normal evaluation populated `b1_part0`, `b1_part1`, `b2_part0`, `b2_part1`. Strict full-document equality found
that difference after the single-point fresh-reader case had passed. The fixture was repaired by explicitly
writing those four existing-schema output refs. All original equality, ID, volume and persistence assertions
remain. No production source, geometry tolerance or reader rule was changed for this repair. First-run files and
screenshots remain unmodified in `first-run/`; final files, raw body records and actual PNGs are in `final-run/`.

No full suite, commit, push or release was made by this consumer lane. `validation.json` preserves the scope and
`artifact-manifest.json` records exact byte lengths and SHA-256 values for every retained artifact.
