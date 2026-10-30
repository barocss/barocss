# D317 actual Studio consumer evidence

The first selected real Studio flow passes on Node 22.19.0, Chrome WebGPU and DPR 1. The measured CSS/backing
viewport is 1140×900. The starter also passes. The browser runner exits 0 and its post-run syntax check exits 0.
The serial heavy gate is returned. Original first stdout, syntax stdout, gate receipt and exit codes are retained.
No failed consumer run occurred; no full unit suite is repeated by this lane.

## Accepted-state refusal

The fixture is a genuine 1000 mm-side cube from public `evaluateCadPart` and `exportStep`. Its AP242 counterpart
uses public tessellation/facet construction and tessellated STEP export. Both original MILLI STEP files remain.
Each NANO file changes exactly one `SI_UNIT(.MILLI.,.METRE.)` to `SI_UNIT(.NANO.,.METRE.)`, with all other bytes
unchanged. This exact byte relation is verified on the retained files.

The existing accepted part is opened from a current-schema file as a 10×10×10 block. A real History profile Width
edit makes it 12×10×10, with an actual Undo step. NANO B-rep Open is then refused while the accepted part is dirty.
A real Save makes the accepted part clean; NANO AP242 Open is refused while it is clean. Both show
`[NOT_READ] STEP declares an unsupported SI length prefix NANO. The file is not read as millimetres.`

Assertions compare the complete document, raw body state, history text, file name, dirty flag and Undo/Redo
availability before and after each refusal. Neither opens a mesh repair dialog or viewport error. Real Undo after
each refusal restores volume 1000 mm³ and real Redo restores 1200 mm³ and the edited nodes. This checks retained
history through product controls. It does not instrument worker call counts; the before-worker placement is the
source/focused-test proof supplied by the Model lane.

## Positive Open and persistence

The supported MICRO B-rep control retains the same 1000-side coordinates and declares factor 0.001. Actual Open
shows bounds 1×1×1 mm, volume 1 mm³ and centroid (0.5,0.5,0.5) mm. The AP242 undeclared control removes the
length-unit entity and global unit/uncertainty context references while keeping all geometric entities. Its actual
Open says no length unit declared, reads millimetres and shows bounds 1000×1000×1000 mm, volume 1e9 mm³ and centroid
(500,500,500) mm. Both wait for one fresh body and deferred mass readiness and check no viewport error.

Both positive paths retain their exact original STEP text in the accepted import node. Real Save downloads are
strictly decoded as current-schema asset-free JSON and compared with the complete accepted document. New part and
real Open restore the same complete document, STEP text, raw volume and visible shape. Semantic document equality
is distinct from file byte identity; the downloaded bytes are retained unchanged.

The consumer agent directly inspected all six actual refusal/opened/reopened PNGs. The dirty point is visible for
the B-rep refusal and absent for the clean AP242 refusal, while the same accepted12×10×10 block remains. Positive
screens show one actual cube body, the expected bounds/COM and reopened shapes. The tiny MICRO cube's displayed
mass rounds to 0 g; browser assertions prove raw volume/COM rather than a new mass result.

## Limits and artifacts

This is the existing file-level SI matcher policy, not representation-context unit mapping or a general STEP
parser. Other prefixes, INCH/FOOT, other browsers/DPR values, mixed contexts, performance and extra exploration are
NOT_RUN in the actual UI lane. Focused Model/type/lint receipts are supplied separately and are not relabelled as
browser evidence. No commit, push or release was made here.

`browser/` retains six PNGs, source STEP variants, accepted/input/downloaded `.bcad` files and measured display
metadata. `validation.json` states the proof boundary. `artifact-manifest.json` records exact bytes and SHA-256.
