# Rolling-ball face fillet between tilted cylinders — research and plan (2026-10-27)

Roadmap item 07. Plan only; no product code changed for it. Probes live in the session scratchpad (not committed);
the numbers below are theirs, at `local/cad-dev` `8b71c2d85`.

## 1. What `face-fillet` covers now

Two planes; a plane and a cylinder across or along its axis; two parallel cylinders; planes, cylinders, cones,
spheres and tori about one axis. All of these reduce to a 2D construction (lines and circles) that is extruded or
revolved, with exact volume checks. Faces whose section is not one 2D curve — two cylinders with tilted or
skew axes (a T-pipe, a 60° branch), free-form faces — are refused.

## 2. What the kernel already has

- **Rolling-ball edge fillet between any two faces** (`blend/rolling-ball.ts`, R10.2; called through
  `blend/edge-finish.ts` `generalRing`). At stations along an edge chain the ball touching both faces is solved by
  Newton in the plane square to the chain; sections (contacts, the faces' lines grown past the corner, the corner,
  the arc) are lofted into a tool (cubic Hermite along the chain, rational quadratic across); the tool is joined
  (inside corner) or cut (outside) with `booleanAnalytic(…, { contactFaces, contactWith })`. A report gives the
  stations, patches and deviations.
- **Surface–surface intersection by marching** (`intersect/surface-intersection.ts` `intersectPatches`, exported):
  takes evaluators over boxes, so surfaces can be taken past their faces' edges.
- **Recognition of cones, spheres and tori** (`surface-revolution.ts` `revolutionOf`). The revolved face fillet
  re-derives this with its own sampling and should switch to it.
- Gaps: chamfers between general faces are refused ("not supported yet"); a fillet whose ball runs off the faces
  next to its edge onto neighbouring faces is refused (`CONTACT_LEAVES_FACE`, R10.4 not built).

## 3. Probes (a main pipe Ø20 along X, a branch Ø12 at 90° and at 60°, solid)

| probe | result |
|---|---|
| Edge fillet r 2 on the junction (90°, 60°) | valid, 1.2 s / 1.8 s. The junction is 12–14 edge pieces; all must be named. |
| Edge chamfer on the junction | refused (general faces) |
| SSI of the two cylinders, extended (`intersectPatches`) | one chain, 85 points, 13 ms (open at the branch's seam, ends 3e-13 apart) |
| `ringFillet` with that chain as guide on the r 2 body (non-adjacent faces), r 4 | the ball solves (128 stations, residual 1e-10, contact error 0.0009 mm); the tool's Boolean with the body fails: "the surfaces of b.side0 and ff.face meet along a curve that cannot be traced" |
| Restore the corner, then the edge fillet (§4) | r 4 across the r 2 round: **20537.05729 mm³ = the edge fillet r 4 on the bare tee, to 5 decimals**, valid. Restore 17.9 s, fillet 6.6 s. |

Two findings from the restore probe:
- With W only 4 mm thick (= r), the restored corner faces are 4 mm strips and the r 4 ball's contacts fall on their
  edge: `CONTACT_LEAVES_FACE`. W 12 mm thick (3r) works.
- The restored corner faces come from W and carry W's names (`A0.side0`, `B0.side0`), so the junction is not
  found by the faces' own names until they are renamed.

## 4. Chosen approach: restore the corner, then the edge fillet

A face fillet between non-adjacent faces A and B is defined as in the 2D cases: whatever lies between them in their
corner is replaced by the round. That splits into two steps that the kernel can each already do:

1. **Restore the sharp corner.** W = the region within d of both faces' surfaces, on the corner's side: for an
   inside corner outside both solids (`shell(A, d) ∩ shell(B, d)`, shell = the surface offset by d outward minus
   the solid), for an outside corner inside both. Inside corner: body − W (the old round, chamfer or step is
   removed); outside corner: body ∪ W. Offsets of planes, cylinders, cones, spheres and tori are exact analytic
   surfaces of the same kinds, so W is built from primitives (extrude/revolve) placed by the faces' geometry.
   d ≥ 3r, bounded to the faces' overlap. W's faces lying on A's or B's surface are renamed to A's or B's.
2. **Edge fillet** the restored junction (its edges between A's and B's surfaces, all pieces) with the existing
   rolling ball.

Adjacent faces skip step 1. Why not the direct route (guide = SSI curve, the ball tool joined straight onto the
non-adjacent body): the ball and the tool already work, but the tool's contact faces then overlap the old faces
between A and B, and the analytic Boolean cannot trace that contact. Fixing that Boolean is open-ended; the restore
route only uses Booleans that the probe showed exact.

## 5. Plan

| step | what | done when |
|---|---|---|
| F0 | Adjacent faces that the 2D paths do not take (tilted cylinders, cylinder with cone, general faces meeting): `face-fillet` finds the edges A and B share (every piece) and runs the edge fillet on them. | T-pipe 90° and 60°: volume equal to `fillet` on the same edges; refusals of the edge fillet passed through. |
| F1 | Non-adjacent analytic faces: build W (offset shells for plane, cylinder, cone, sphere, torus; d = 3r, clipped to the overlap), restore, rename, then F0. Checks: the restored body valid and one body; the restore's volume change equals −V(body ∩ W) (inside) or V(W − body) (outside). | r 4 across an r 2 round on the 90° and 60° tees equals `fillet` r 4 on the bare tee (oracle by an independent path); a cone or a sphere against a cylinder at an angle; refusals when W meets something else that must stay (reported, not guessed). |
| F2 | Speed. The restore Boolean takes 17.9 s against the old round's 33 lofted faces; the probe suggests most of it is surface–surface work on faces that lie wholly inside W. Try a broad phase that classifies such faces whole (sampled points strictly inside W) before intersecting; measure. | Restore under 3 s on the probe, same volume. |
| F3 | Model and Studio: no new node (the `face-fillet` node already stores two faces and a radius). Studio's command already hands curved faces to the kernel; add tilted cylinders to its text; a browser check on a T-pipe. | Studio check: pick the two pipes, preview, Apply, Undo, Save/Open. |
| F4 | Clean-up: switch the revolved fillet's own cone/sphere/torus recognition to `revolutionOf`. | Face-fillet suite unchanged. |
| Later | Free-form faces (offset surfaces are approximations; W from `extendedSurface` and offset fits), variable radius face fillets, R10.4 (a ball rolling onto the next face), which would also remove the need for d ≥ 3r. | — |

Estimated size: F0 small (hours); F1 the main work (one to two days with tests); F2 open (kernel Boolean
performance); F3, F4 small.

## 6. Risks and limits

- **Time.** 24.5 s for the probe's non-adjacent case; F0 alone is 1.2–2.4 s, comparable to today's edge fillets.
  Interactive previews will be slow until F2; this belongs with the UI batch's performance work (roadmap 20 ③).
- **W replaces everything in the corner zone.** Material within d of both faces that is not part of the old
  corner (a rib, a boss nearby) would be removed or filled too. This is the face fillet's meaning in the 2D cases as
  well; the check reports what changed, it cannot tell intent.
- **The edge fillet's own limits apply**: R10.4 refusals, its deviation tolerances, and junction curves split into
  many pieces (names grow with each feature).
- Coincident surfaces in the restore Boolean (W's inner faces lie on A and B exactly) were exact for cylinders;
  cones, spheres and tori need the same probe in F1.
