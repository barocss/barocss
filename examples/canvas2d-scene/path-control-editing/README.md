# Path control editing

Serve the repository through an ordinary local HTTP server after building
`@barocss/canvas2d`, then open this directory's `index.html`. Its import map uses
the local emitted public package and document entry. No engine or dependency
installation is included in this example.

Select the blue quadratic or pink cubic by clicking its fill or choosing Path.
Drag Q, first cubic control1 or second cubic control2. Coordinates are path-local
logical pixels. One completed drag adds one history step. Undo/Redo operates on
completed steps. Escape, cancellation, capture loss, blur or stale viewport state
cancels the gesture. Numeric coordinate drafts remain visible on refusal.

The example uses public PathHandle.setPath/toLocal/toWorld and renderer
viewportToWorld/worldToViewport. DOM points are mapped through actual canvas
CSS/backing dimensions and the fixed DPR2/view. Overlays are persistent DOM
buttons, not scene objects, and are excluded from files. Fixed view is pan12,8,
zoom1.1; the Curves parent translates40,32, rotates PI/12 and scales1.2,1.
No snapping, point insertion, degree conversion or arbitrary topology editing
is supplied. Native scene/command/coordinate caps remain in force.

Accepted BASE tree/canvas/renderer remain untouched during a gesture. The first
valid move creates one fresh preview renderer after copied candidate admission.
Later moves validate fresh copied CPU trees and reuse that preview. Preview
update/render is not an atomic transaction: failure discards it and returns to
the retained BASE. Successful pointerup promotes the last successful preview
and records one CPU history step. The unchanged SceneHistory50-entry class uses
a validation/no-op presentation facade after external GPU admission. Undo/Redo
admits a fresh renderer before moving the history cursor. There is no core
renderer/history rollback guarantee.

Save stores Scene29 commands, IDs, parent order, paint and transforms in the
existing document-v1 format. Open creates a fresh tree/renderer and resets
history; no overlay or editor selection is stored. The view and renderer
background are the current fixed host profile, not inferred file metadata.
Document canonicalization follows the public codec; signed-bit preservation
is not promised. Dispose cancels capture, removes exact host callbacks,
disconnects the ResizeObserver and releases every owned renderer.

Pointer precision is reported from actual received client coordinates.
Independent affine inversion is compared at1e-8; requested native-driver
coordinates can be quantized by the platform and are recorded separately.
Controlled stale-token evidence is not a claim of pixel retention after an
external caller changes live transforms or view/presentation.

Evidence is in `evidence/`; source/emitted controlled adapter checks and the
one actual browser/file flow have separate scopes. Existing engine primitives
and other examples were not replayed or modified. Native completion, adoption,
current-root1254/674 acceptance and publication are separate.
