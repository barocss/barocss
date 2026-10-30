# D316 Model and Studio consumer evidence

The existing raw explicit-frame document and public API routes are tested. This evidence does not claim a dedicated
frame/guide HUD. The existing generic loft profile editor changes the shared rectangle while its min corner stays
fixed on the guide. The original frame/guide encoding remains intact. Existing non-XY height and Bezier routes are
not changed by this consumer lane.

The new Model file passes four focused tests, type checking and changed-file lint on the first run. Its matrix
covers every section count from 2 through 8 with quadratic 17-control and cubic 64-control guides. The non-XY
unit prism has independent volume 1 mm³, centroid (-1.5,3.5,4.5) mm and mass 0.001 g at density 1 g/cm³. Shared-profile
Width 2 and Depth 3 edits give volume 6 mm³ and centroid (-1.5,4,5.5) mm. Profile edits keep the original min corner,
all frames and every guide coefficient. Plain JSON and existing container roundtrips preserve the complete document.
The public API checks its own mass/codec route. Incompatible axes produce a typed failure and retain accepted data.
The browser script syntax check also passes. Empty successful type/lint/syntax stdout is preserved byte-for-byte;
`exits.tsv` records their zero exit codes. No Model/Studio full suite is repeated.

Actual Studio first execution passes the starter and both selected D316 flows: 2 sections / 17 quadratic controls
and 8 sections / 64 cubic controls. They use real file Open, History feature selection and the generic profile
Width/Depth editor, Apply, Undo/Redo, real Save download, New part and Open. No selection staging hook supplies
inputs. No dedicated frame/guide authoring controls are assumed.

Both runs assert exactly one fresh body from the actual producer `b1`, wait for deferred `massReady: true`, check
finite raw volume 1 -> 6 mm³ and the independent world centroids above within 1e-9, and assert no viewport error.
Undo restores the original body and Redo restores the complete edited document. The original guide coefficients
and all section frames remain unchanged. Asset-free Save uses the existing strict-decoded current-schema JSON
writer: the full accepted semantic document equals the saved and reopened document. On fresh Open, the real generic
editor still reads Width 2 and Depth 3. Raw input/saved `.bcad` files and display metadata are retained in `browser/`.

The consumer agent directly inspected all six opened/edited/reopened screenshots. They show the actual unit prism,
the 1×2×3 edited prism, one body, the expected world COM and reopened generic profile fields for both cases. This is
Chrome WebGPU at DPR 1, measured viewport/backing 1140×900. The tiny fixture's UI shows rounded mass 0 g. This is a
display rounding boundary, separate from the public API's independent raw mass proof and the browser's raw
volume/COM assertions. Other browsers, other DPR values and additional exploratory UI cases are NOT_RUN.
No failed consumer check occurred. All first-run logs and six actual PNGs are preserved unmodified. The heavy gate
was released after the browser runner exited 0. No commit, push or PR was made by this lane.
