# Convex polygon intersection example

Build `@barocss/canvas2d`, serve the repository, and open `boolean-v5.html?convex=1`.
The original page without this query keeps the orthogonal Boolean and result-file flow.

The new mode displays two authored polygon outlines and an unrelated green marker.
Compute intersection creates copied result geometry through the public API. The result's
`sourceIds` records both input IDs in caller order; it is not boundary-edge lineage.
Only simple strictly convex integer polygons with 3–32 points are admitted. Coordinates
are within ±4096. Touching vertices/edges, collinear vertices, repeated points and
nonconvex rings refuse. Empty intersection is a normal result. Rational predicates
and intersections use bounded BigInt arithmetic; converting result coordinates to
Number does not certify CAD coordinates or renderer Float32 equality.

Save Scene29 JSON saves both complete original source paths and the result, not a
custom Boolean result envelope. Open stages a fresh canvas/tree/renderer, restores
all original commands, and does not call the intersection helper. Edit restored operand
changes its two left X coordinates from65 to72 and explicitly recalculates. Candidate
admission precedes the accepted host swap. Refuse touching input keeps accepted state
and its complete frame. Dispose releases all owned canvas bindings and renderer handles.

The bounded native flow uses260×240 logical pixels/DPR2 and selected interior tolerance2.
It includes one genuine Save/physical Open and native cleanup; PNG0. Source/emitted
geometry probes use independent rational intersection/hull and halfplane witnesses.
Actual native, local adoption, broader integration acceptance and publication are separate.
