<script setup>
import FilletSection from '../.vitepress/components/algorithms/FilletSection.vue';
import FilletRolling from '../.vitepress/components/algorithms/FilletRolling.vue';
import FilletNewton from '../.vitepress/components/algorithms/FilletNewton.vue';
</script>

# Fillets: the rolling ball

A fillet rounds an edge. Its surface is the one a ball of radius r sweeps as it rolls along the edge, touching both of
the edge's faces. The kernel never edits the faces in place. It builds a *tool*, the region between the two faces and
that rounded surface, grown a little outside the corner, and applies it with one [Boolean](/how/boolean): removed from a
convex edge, added to a concave one. This is the path [B-rep, robustness and refusals](/packages/cad/robustness#booleans-fillets-and-offsets-on-exact-surfaces)
names *roll a ball along the named edges*.

What changes from edge to edge is how the tool is made. Where both faces cut a section as lines and circles, the section
is solved exactly and extruded or revolved. Otherwise the ball is solved at stations along the edge and the tool is
lofted through the sections it leaves. The methods, formulas and constants below are the kernel's, in
`packages/barocss-cad/src/blend/`.

## Which path an edge takes

The named edges are taken together with the edges that continue them tangentially (a slot's rim, the top of a rounded
box): each such chain is one fillet.

| Edge | Its two faces | Section | Tool | Source |
|---|---|---|---|---|
| Straight | Two planes, at any angle | Two lines | Extruded along the edge (the fillet is a cylinder) | `straightTool`, `cornerProfile` |
| Circular | A plane and a cylinder standing square on it | Two lines | Revolved about the axis (a torus patch) | `arcTool` |
| Straight, *translational* (R10.1) | Planes along the edge, cylinders whose axis runs along it | Lines and circles | Extruded | `translationalTool`, `filletSection` |
| Circular, *coaxial* (R10.1) | Surfaces of revolution about the circle's axis: planes square to it, cylinders, cones, spheres, tori | Lines and circles in the meridian | Revolved | `coaxialTool`, `filletSection` |
| Any other (R10.2) | Any two faces | Solved at each station | Lofted NURBS patches | `ringFillet`, `solveStation`, `sectionOf`, `loftTool` |

Three cases go to the rolling ball even where a closed form exists: a variable radius (R10.5, D100), a conic or G2
section (R10.5b, D103), and a closed-form section that would reach past a smooth edge onto another surface, such as a
round already made (R10.4a, D95).

## 1. The section in closed form

For the translational and coaxial pairs (R10.1, D88), the cut square to the edge (or the meridian, round a circle) shows
each face as a line or a circle. The ball's centre is r from both. So each face is offset by r towards the corner, and
the centre is where the two offsets meet. Lines offset to lines and circles to circles, so every step is exact.

<FilletSection />

The two plane faces of an ordinary straight edge are the simplest case of the same picture. Their contacts lie
t = r / tan(α/2) from the edge along each face (α the angle between the faces), and the centre lies r / sin(α/2) from
the edge along the bisector.

Every finish must fit on its faces. The reach the check uses is the face's least extent across the edge over the edge's
whole length, measured in the face's own terms (a distance along a line, an angle round a circle). It comes from the
face's boundary edges beside the edge, each sampled 64 times, then refined to rounding: crossings by bisection, minima
by golden section. This replaced an upper bound taken from the face's farthest control point, which let a fillet past
the face through (D88).

## 2. Rolling the ball along any edge

Where no closed form fits, the kernel follows the ball itself (R10.2, D89). The figure runs it on the pipe tee of
conformance case `r10/general-tee`: a tube of radius 10, a branch of radius 5, their junction filleted 2 mm.

<FilletRolling />

The sequence, as `ringFillet` runs it:

1. **Stations.** About one per r/4 of the chain's length, at least 64, evenly by length. At each, the plane through
   the station square to the chain holds the ball's centre.
2. **The ball.** Its centre c = S<sub>A</sub> + σ r n<sub>A</sub> = S<sub>B</sub> + σ r n<sub>B</sub>, with σ = −1
   inside the material (a convex edge) and +1 outside (a concave one). Three equations say the two candidate centres
   agree and one puts c in the station's plane: four equations in the contacts' four surface parameters, solved by
   Newton (section 3).
3. **The section.** In the ball's plane through both contacts: the contacts T<sub>1</sub> and T<sub>2</sub>, each grown
   g = r/2 outside the corner along its face's normal, the corner of the faces' lines there, and the fillet arc. The arc
   is a rational quadratic with weight w = cos(θ/2), θ the angle the arc turns through.
4. **The loft.** Every other section is lofted through; the ones between measure it. Along the chain each row of the
   section (its five corners, and the arc's middle pole in homogeneous coordinates) is a C² cubic B-spline through the
   lofted sections, its end tangents from five-point stencils, so the error falls as h⁴. A patch has at most 13 spans
   (within the 16-pole limit) and five faces: the fillet `<id>.face`, the two walls at the contacts `<id>.wall`, and two
   along the grown corner `<id>.tool`.
5. **Refinement.** The loft is accepted when its contacts lie within a quarter of the Boolean's tolerance of their
   faces (2.5 × 10⁻⁷ mm at modeling sizes) and its fillet within four times that (10⁻⁶ mm) of the true sections.
   Otherwise the station count grows as the h⁴ rate predicts and the loft is made again. Past 4096 stations the fillet
   is refused with `APPROX_TOLERANCE_NOT_MET`.
6. **The Boolean.** Each rolling-ball tool goes in a Boolean of its own, before any other tool. The Boolean is told the
   tool's contact faces (the fillet and the two walls). They meet the body only along their own edges lying on it, so
   those edges become the cuts and nothing is marched there.

On the tee, the kernel's report reads: 64 stations first, leaving the contacts 9.5 × 10⁻⁴ mm off; then 578 stations in
24 patches, contacts 1.4 × 10⁻⁷ mm off their faces, the fillet 2.2 × 10⁻⁷ mm off the true sections, the solved balls'
|c − p| − r 6.4 × 10⁻¹⁰ mm, and the fillet's normal within 6.5 × 10⁻⁵ ° of the faces' at the contacts.

## 3. Solving one station

Each station is a small nonlinear solve. Its unknowns are where the ball touches each face, in that face's own
parameters.

<FilletNewton />

Two more checks follow each solve. A contact must lie inside its face's trimmed region: its (u, v) inside the face's
outline in that face's domain (by ray parity), or on it within 10⁻⁷ of the domain's size. The side faces are tried in
turn, the last pair first. Where a contact crosses from one face to the next (two halves of a cylinder, say), the
crossing is found by bisection (60 halvings) and the tool's patches break there, so no patch edge crosses a seam of the
body.

## 4. When the ball runs off its faces

A station whose contacts fall off every face of a side is not refused at once (R10.4):

- **Over a smooth edge** (R10.4a, D95). The faces beyond smooth edges of the last contacts' faces join that side, and
  the station is solved again, up to three times. A smooth edge here is one whose two faces have the same normal at its
  middle, within 10⁻⁶. This is how a boss's foot, filleted larger than the wall below a round on its top, rolls on over
  the round.
- **Onto a sharp edge** (R10.4b, D96). Where the face ends at a sharp edge instead, the ball rolls on touching the
  other face and that edge, its way from the edge kept within the wedge outside the edge's two faces. The fillet then
  meets the edge along a curve, and the face beyond is untouched.
- **Neither:** the fillet is refused, `CONTACT_LEAVES_FACE`. The same code refuses a result that has more bodies than
  the part had: the fillet ran off its faces near an end and cut a piece free.

Only the rolling ball rolls on. A closed-form section that would reach past a smooth edge onto another surface hands its
chain to the rolling ball (D95). One larger than a face ending at a sharp edge is refused, `RADIUS_EXCEEDS_FACE` (D96).

## 5. Face fillets

The `face-fillet` feature rounds between two named faces that need not share an edge. Two planes are solved in closed
form along the line where their planes meet: the contacts r / tan(θ/2) from that line, the round extruded over the length
both faces run beside it, filled at an inside corner and cut at an outside one. The change in volume must match the
closed form to 10⁻⁷ of the part's volume, else it is refused (`FACE_FILLET_NOT_CLEAR`). A plane and a cylinder across its axis, cones, spheres
and tori about one axis are revolved; a plane along a cylinder and two parallel cylinders are extruded. A pair none of these
sections takes goes to the rolling ball of the sections above: faces that meet, by every edge they share; faces apart, once the corner
between them has been restored (what lies there removed or filled).

An open rolling-ball chain can also run past a polynomial Bezier face end (degree 2–5, one clamped span in that
direction). Its solve surface carries the same polynomial one quarter of the parameter range beyond each end;
the body's original surfaces and trims stay intact, and the trim/contact tolerances do not grow. A quintic guided
loft's meeting plane and curved side are covered, including native and Studio save/open.

A bounded non-adjacent path can replace a smaller round between one planar support and one polynomial translational
support (linear across, one degree2–5 Bezier span along the guide). The charts must pass exact coefficient and
orientation checks. The corner must be convex and square, with a simple regular guide and two flat end caps normal
to its end tangents. Its old bridge must be one disk strip, without holes or branches, bounded by alternating
side/cap/side/cap chains. The new tool must touch only the selected pair. Conservative Boolean input-face tracing
must show that every old bridge face is gone. Other faces retain their represented surfaces and oriented trims;
uniquely matched protected vertex representatives keep their original coordinates within existing bounds. Both the
raw Boolean and final body pass the existing strict checks. An ambiguous trace or unmatched trim is refused.
The quintic loft's r0.25→r0.5 replacement is covered by an independent volume oracle and Studio Save/Open.

General free-form pairs, concave replacement, rational/multi-span end extension and rolling onto another face
remain outside this bounded path. Existing typed solve/fit refusals still apply.

## Where it is in the code

| File | Responsibility |
|---|---|
| `packages/barocss-cad/src/blend/edge-finish.ts` | `finishBrepEdges`: the chains, which path each edge takes (`pairOf`), the closed-form tools (`straightTool`, `arcTool`, `translationalTool`, `coaxialTool`), the reach check (`fitsFaces`, `trueReach`), the Booleans |
| `packages/barocss-cad/src/blend/fillet-section.ts` | `filletSection`: the closed-form section (offsets, centre, contacts, arc, grown tool profile); `refuseFillet` and its typed codes |
| `packages/barocss-cad/src/blend/rolling-ball.ts` | `solveStation` (the ball), `sectionOf`, `loftTool` (the lofted tool and its deviation), `ringFillet` (stations, breaks, refinement), `growSides` (R10.4a), `cornerFillet` and `solveCliff` (corners and sharp edges) |
| `packages/barocss-cad/src/brep/analytic-boolean.ts` | The Boolean that trims the tool in; its `contactFaces` option |
| `packages/barocss-cad/src/part/part-model.ts` | The `fillet` and `face-fillet` features: documents to these calls, typed part errors |

## How it is checked

| Test | What it covers |
|---|---|
| `packages/barocss-cad/test/r10-1.test.mjs` | Translational (rod on plate, D shaft, parallel rods) and coaxial (cylinder × cone, cone × plane, cylinder × sphere) fillets against volumes worked out by hand, to 1e-9 or better; each typed refusal; face names across radius edits |
| `packages/barocss-cad/test/r10-2.test.mjs` | The rolling ball forced on closed-form cases (boss foot, hole rim, cone rim) against the closed forms; the pipe tee and crossing rods: valid, contacts, sections, G1, volume against a loft through twice the stations |
| `packages/barocss-cad/test/r10-2b.test.mjs` | Open chains of general edges, run past their ends and trimmed or cut there |
| `packages/barocss-cad/test/r10-b.test.mjs` | The Boolean with tool faces on or along body faces (D99): fillets ending square on a face or past a round, a coaxial tool tangent to a cone, rounded box corners |
| `packages/barocss-cad/test/r10-4a.test.mjs`, `r10-4b.test.mjs` | Rolling over a round already made; rolling onto a sharp edge (a boss's foot larger than the boss, a tee with a short branch) |
| `packages/barocss-cad/test/r10-reach.test.mjs` | The reach of plane faces past a round (D97) |
| `packages/barocss-cad/test/face-fillet.test.mjs`, `packages/barocss-cad-model/test/api-face-fillet.test.ts` | Face fillets: closed forms, the rolling-ball pairs, refusals, save and open |
| `packages/barocss-cad/conformance/r10/` | Fixed cases with expected volumes or refusals, among them `translational-rod-on-plate`, `general-tee`, `overflow-boss-rounded-top`, `cliff-tee-short-branch`, `refuse-radius-exceeds-face`, `refuse-radius-exceeds-curvature`, `refuse-tangent-faces` |

## Limits

Refusals are typed, as `B-rep: <KIND>: [<code>] <detail>`, and mapped to the part error.

| Code | Kind | When |
|---|---|---|
| `TANGENT_FACES` | SELECTION | The faces meet tangentially (a round's own tangent edge): there is no corner. Also when a lofted section degenerates for that reason |
| `RADIUS_EXCEEDS_FACE` | PARAMETER | A contact lies past its face's reach across the edge |
| `RADIUS_EXCEEDS_CURVATURE` | PARAMETER | The offset would shrink a face's circle to nothing (the ball does not fit inside it), or the offsets do not meet: no ball touches both faces |
| `CONTACT_LEAVES_FACE` | PARAMETER (CAPABILITY where a case is not supported yet) | The rolling ball's contacts run off their faces where it cannot roll on, or the result has a new body |
| `APPROX_TOLERANCE_NOT_MET` | CAPABILITY | The loft is not within its tolerances at 4096 stations |
| `NOT_ANALYTIC_PAIR` | CAPABILITY | A closed-form path cannot read a face. The cases it used to refuse (two crossing rods, an oblique groove's rim) are now built by the rolling ball (D89, D90) |
| `VERTEX_BLEND_UNSUPPORTED` | CAPABILITY | More than three finished edges meet at a corner, or an edge is the odd one out at one corner and not at another |

Also refused for now: chamfers between general faces; a chain that branches; a variable radius, conic or G2 section
where the ball rolls round an edge at a corner. The lofted tool is an approximation, held to the tolerances in section 2;
the closed-form tools are exact lines, circles, cylinders and tori.
