<script setup>
import MfgDraft from '../.vitepress/components/algorithms/MfgDraft.vue';
import MfgPrint from '../.vitepress/components/algorithms/MfgPrint.vue';
import MfgAccess from '../.vitepress/components/algorithms/MfgAccess.vue';
</script>

# Machining, printing and moulding checks

A part that can be modelled cannot always be made. A mould has to open, a print has to stand on its layers, a cutter has
to reach the surface it cuts. The manufacturability report checks a part against the process chosen for it, rule by
rule, and the studio's previews colour the same measurements onto the model. This page explains the methods behind
[Manufacturing](/studio/manufacturing): the draft field and the parting line of a moulding, the overhangs, support and
walls of a print, a mill's access, and a casting's hot spots.

The code is in `packages/barocss-cad-model/src`: `mould/`, `print/`, `machining/`, `casting/` and `analysis/`. Most
checks run on a body's display mesh and cast rays through the kernel's triangle hierarchy (`triangleBvh`, `rayHit`;
see [Meshes, native tools and the BVH](/how/mesh-boolean#_6-the-triangle-hierarchy)). The draft uses the exact
surfaces instead. Use **Play**/**Pause**, the arrows or a step's number to go through each figure.

## The checks at a glance

| Process | Check | Method | Source |
|---|---|---|---|
| Injection moulding, casting | Draft | asin(n·d) at mesh samples from the exact normal | `mould/draft.ts` |
| Injection moulding | Undercuts | Rays along +d and −d from samples on every triangle | `mould/undercut.ts` |
| Injection moulding | Parting line | Faces sorted into halves; edges between them and isoclines chained into loops | `mould/parting.ts`, `mould/tooling.ts` |
| Injection moulding, casting, milling | Walls, ribs, bosses, inside corners | Rays inward; the ball at the ray's middle; exact planes and cylinders | `analysis/analysis.ts`, `mould/walls.ts` |
| 3D printing | Overhangs, support, orientation, layers | −n·b against the limit; vertical rays to the bed | `print/overhang.ts`, `print/orient.ts`, `print/layers.ts` |
| 3D printing | Walls, holes, gaps, cavities, bed fit, warp, tip | Per rule, against the process and printer | `print/rules.ts` |
| CNC milling | Access and setups | Rays along ±X, ±Y, ±Z on the face's side; greedy setups | `machining/access.ts` |
| CNC milling | Inside corners, pockets, small features, tall walls | Exact fillets and planes; rays; rotating calipers | `machining/cavities.ts` |
| CNC milling | Holes, threads, walls, size | Exact cylinders against the drill table and the limits | `machining/holes.ts`, `machining/report.ts` |
| Die and sand casting | Hot spots, feeding, section change | A distance field on a voxel grid | `casting/solidification.ts` |

## How a rule reports

Every rule returns one of five statuses with its value, its limit and the limit's source:

| Status | Meaning |
|---|---|
| `pass` | The limit is met |
| `warn` | A recommended limit is not met |
| `fail` | A feasible limit is not met: the process cannot make it as it is |
| `unknown` | An input is missing (no process, no pull, no material, no printer, no rows): the reason is given |
| `n/a` | The process has no such rule (a powder bed does not tip a part) |

A rule is `feasible` or `recommended`; the same unmet test fails the first and warns on the second. The limits come
from the process profiles in `library/builtin/materials.json`, each with its source (a public page, read on a date, or a
rule derived from one). Casting limits come from rows the person loads; none are built in. The worst of a report is
ranked fail, warn, unknown, pass, n/a.

## 1. Draft: the angle to the pull

A mould opens along the pull d. Every face must lean a little away from the half it touches, or it drags as the part
comes out: that lean is its draft. The draft at a point is the angle between the face and d,
asin(n·d): 0° for a wall along the pull, ±90° for a face across it.

The draft is measured at the display mesh's vertices and triangle centres, but with the exact normal at each point,
because the mesh's normals are wrong by its chord error: on a 3° cone they are off by 0.014°. A plane gives its own
normal and a cylinder the radial direction from its axis. Any other face (a cone, a fillet, a torus, a NURBS patch) is
found on the B-rep and the point projected onto its surface with `closestPointOnSurface`, from a 25 × 25 grid of seeds
([Closest points](/how/closest-point#_1-the-nearest-point-of-a-surface)). A face made of facets, as on an imported
mesh, has only its triangles' normals.

<MfgDraft />

For each face the field keeps the least and the greatest draft, the steepest sample, its side (+ along d, − against it,
± both, 0 a wall along the pull), its area and the area of triangles whose centre is under the least draft. The classes
are tested in order:

| Class | Test |
|---|---|
| straddle | some n·d &gt; 10⁻¹² and some n·d &lt; −10⁻¹²; its isocline points are found |
| steep | min \|n·d\| &lt; sin(least draft) − 10⁻¹² |
| drafted | otherwise |

The least draft comes from the mould's surface finish; casting takes it from the alloy's family:

| Process | Least draft | Fails | Warns |
|---|---|---|---|
| Injection, finish Smooth | 0.5° (1° recommended) | — | any steep or straddling face |
| Injection, finish PM-T1 (light bead blast) | 3° | — | any steep or straddling face |
| Injection, finish PM-T2 (medium bead blast) | 5° | — | any steep or straddling face |
| Die or sand casting | the family's least, from the rows | a face under the least | a face under the achievable draft, or straddling |

Without a pull or a finish the draft rule is unknown: no pull is assumed. The agent's draft query (`draftAnalysis`)
lists the faces within 45° of the pull, and the straddling ones, with their draft. The studio's draft map colours every
display vertex by the same value (`draftSamples`); the isocline lines it draws are `isoclinePolylines`.

## 2. Undercuts and the parting line

An undercut is a surface neither half of the mould can pull away from: anything in the way along +d and along −d.
`undercuts` cuts every display triangle into n² equal parts, n = ⌈longest edge / h⌉ and at most 64, with the step h
the part's diagonal over 400 (at least 0.05 mm) unless given. Each part's centre is moved 0.01 mm off the triangle along
its normal, so that a point on a face's rim, which also lies on the next face, does not hit it. A ray goes from it along
+d and along −d. A sample hidden both ways is an undercut, and its share of the triangle's area goes with it, so a large
flat face under a small overhang is caught, not only its centre.

Triangles with hidden samples are joined into regions where they share a position (rounded to 10⁻⁴ mm, since the
display mesh repeats a vertex for each face). For each region the four directions across the pull (the two axes square
to d, both ways: ±X and ±Y for a pull along Z) are tried as a side action's. A direction that frees every hidden sample
is reported as the side action; the rule then warns. A region no direction frees fails the rule, with the share the best
one frees. The rule's message states the coarsest spacing used: an undercut smaller than that may be missed.

The parting line is where the two halves meet. `partingLine` gives each face a half from its draft: + to the half moving
along d, − to the other; a face along the pull throughout goes to −, unless the person sets its half. Each display edge
whose two faces lie in different halves is on the line, judged at its middle. A straddling face is crossed along its
isocline, traced by marching its triangles (each crossing bisected on the exact normal, as in the figure). The pieces are
chained into loops, each end joined to the nearest free end within half the longest piece; a loop stops growing when it
comes back within 10⁻⁴ mm of its start, and is flat when its extent along d is at most 10⁻⁴ mm. The rule warns on a
straddling face, an open loop or no loop.

The tooling plan then lays out the halves, for one body pulled along ±X, ±Y or ±Z. A straddling face is first split
along its isocline with the kernel's `split-face` (D149). A block 10 mm larger than the part on every side (an estimate)
is cut at each loop's height across the pull; loops at several heights are joined on risers, the part's flat walls
along the pull between them. Inner loops in the plane are shut-offs; undercut regions freed by a side action give the
side cores' directions, and those freed by none are listed. A loop that is not flat across the pull, or a riser off the
axis planes, is refused with `MOULD_STEPPED`.

## 3. Walls, ribs and corners of a moulding

Wall thickness starts with a ray inward from each display triangle's centre, against its normal, to the next wall; its
length is the depth. A ray along a rim runs the length of the wall, so the local thickness takes the ball at the ray's
middle: twice its distance to the nearest surface, at most the depth (`wallSamples`). The printing figure in section 4 shows both. From
these, for each body (`wallsOf`):

- the nominal wall: the area-weighted median of the local thickness;
- the thinnest: the least ray depth (the ball reads less than the wall by a concave corner);
- the 95 % thickness: the local thickness that 95 % of the area is within;
- the thick sections: the area whose local thickness passes the nominal over the adjacent-wall ratio (0.6);
- ribs: two opposite exact planes closer than 3 × the nominal, their boxes overlapping, each facing into the part (a ray
  out of its largest triangle hits the body);
- bosses: an outer cylinder with a bore on the same axis (to 10⁻⁹), the wall their radii's difference;
- inside corners: concave fillets (inner exact cylinders around less than half a turn) with their radius, and sharp
  concave edges between planes, their lengths summed per pair of face names.

The injection profile judges them:

| Rule | Level | Test |
|---|---|---|
| `wall` | feasible | thinnest ≥ 0.6 mm (fills) |
| `wall-material` | recommended | thinnest and the 95 % thickness within the material's moulding range |
| `wall-uniform` | recommended | min(thinnest / nominal, nominal / 95 % thickness) ≥ 0.6 |
| `rib` | recommended | each rib's thickness ≤ 0.6 × nominal |
| `boss` | recommended | each boss's wall within 0.6 … 1.0 × nominal |
| `inside-radius` | recommended | no sharp inside corner; each fillet's radius ≥ 0.5 × nominal |
| `sink` | recommended | no section thicker than nominal / 0.6 |
| `size` | feasible | within 751 × 480 mm across the pull and 203 mm along it |

## 4. Printing: overhangs, support and walls

A printer lays a part in layers along its build direction b. A face that leans down too far has nothing below it to be
laid on and needs support. `overhangOf` measures the angle from the vertical, asin(−n·b), and flags a face when
−n·b &gt; sin θ + 10⁻¹², θ the process's limit. A planar face is judged whole by its exact normal; a curved face triangle by
triangle on the display mesh, and the total is then marked approximate. A face facing straight down
(n·b &lt; −1 + 10⁻⁹) at the part's lowest point rests on the bed: it is not an overhang but bed contact.

<MfgPrint />

The printing processes' limits, from `materials.json`:

| | FDM | Resin (SLA) | SLS, MJF |
|---|---|---|---|
| Overhang θ from the vertical | 45° | 30° | 90° (none) |
| Thinnest wall (fails) / recommended (warns) | 0.8 / 1.2 mm | 0.5 / 1.0 mm | 0.8 / 1.2 mm |
| Smallest hole that prints open | 2.0 mm | 0.5 mm | 1.5 mm |
| Largest horizontal hole printed round | 6 mm | 10 mm | — |
| Least gap between bodies printed together | 0.3 mm | 0.2 mm | 0.5 mm |
| Escape holes for an enclosed cavity | none needed | 2, at least Ø3.5 mm | 2, at least Ø5 mm |
| Tip ratio (height / √bed contact) | 4 | 6 | n/a |

The other printing rules: the smallest inner cylinder against the smallest hole; a hole whose axis lies across b
(|axis·b| &lt; 10⁻⁶) wider than the horizontal limit sags at its top (warned); bodies that overlap fail, closer than the gap
warn; enclosed cavities (the B-rep's inner shells, else the mesh's enclosed pieces) fail where the process needs escape
holes; the part's extents, across the bed either way round and in height, against the printer's build volume. Warp is a
heuristic: the material's warp risk × (the longest footprint / the profile's reference length, 100 mm for FDM) × (bed
contact / the footprint's box, at most 1), warned above 0.5. Without a build direction the orientation's rules are unknown.

**Which way up.** `searchOrientation` tries 64 directions spread on a sphere (the golden-angle spiral), and each planar
face of at least 1 % of the area (up to 32) set down on the bed. Each is scored, lower better:

score = 1 · overhang / area + 0.5 · height / diagonal − 0.5 · contact / area

The best eight are scored again with the support volume of the figure's step 4 added, weighted 2 and divided by area ×
diagonal. Ties go to the lower height, then the earlier candidate, so the same model always gets the same answer; the
top three are reported.

**Layers.** `printLayers` turns the part so b is +Z and sets its lowest point on the bed. Its layers are h thick (0.2 mm
unless set, said to be an estimate); layer k is cut at z = (k + ½) h, its closed contours from the display mesh (outer
loops anticlockwise, holes clockwise), with the overhanging and supported areas the layer crosses. The support columns
are the orientation search's own, so their volume is its support volume. It is a display preview: no slicer, no
toolpaths.

## 5. Milling: access, corners and holes

A 3-axis mill cuts along the directions the part is set up in. `accessOf` samples every triangle as the undercut check
does (n at most 48 a side, step the diagonal over 200, at least 0.1 mm) and tries the six axis directions on the face's
side.

<MfgAccess />

Area that no direction reaches warns the `access` rule; no feasible limit is sourced, so it does not fail. The setups
are counted greedily from the 64 mask bins, so the count is exact for the samples.

What a rotating tool leaves (`machining/cavities.ts`):

- **Inside corners.** A concave fillet (an exact cylinder around half a turn or less) whose axis line, in the cavity,
  leads out of the part is a corner a straight tool comes down. Its radius must be at least ⅓ of its depth (warned
  otherwise). A sharp concave edge in such a corner has radius 0 and is warned: a rotating tool leaves its radius. A
  sharp edge between square planes where one face looks out (a ray from beside the edge leaves the part) is cut sharp by
  the end mill's end and passes. A fillet beside a plane that looks out is an edge fillet, cut by a corner-radius or ball
  tool, and is not judged. Corners reached along no direction, or between planes not square, are unknown.
- **Pockets.** A floor is a plane that looks out, with a neighbour rising above it across a concave edge; its depth is the
  highest neighbour, its width the narrowest extent of its hull (rotating calipers), across walls that rise on both sides.
  Depth / width over 4 warns. A step, open on one side, is not a pocket.
- **Small features and tall walls.** The narrowest floor fails under 0.5 mm and warns under 2.5 mm; a rib's height over
  its thickness warns at 4 or more.

Holes are exact inner cylinders. Each step's depth from its nearer open end over its diameter warns over 4 and fails over
6; the drilled diameter fails under 0.5 mm, warns under 2.5 mm or off the drill table (0.35 to 2.75 mm by 0.05, to
10 mm by 0.1 with the quarter sizes, to 25 mm by 0.5; larger ones are milled). A tapped hole fails off its tap drill
(d − P, from the person's fastener rows) or under M2, and warns under M6 or longer than 3 × d. Walls fail under 0.5 mm in metal and 1.0 mm in
plastic and warn under 0.8 and 1.5 mm; the part must fit 400 × 250 × 150 mm. Turning checks the axis of revolution, the
lathe's size, grooves, holes by their axes and points instead.

## 6. Casting: draft, walls and hot spots

Casting reads its limits from the person's casting rows, by the alloy's family (zinc, aluminium, magnesium, copper,
steel). Without rows, every rule that reads a limit is unknown. The draft field of section 1 is judged against the
family's least draft (fails) and achievable draft (warns); the thinnest wall against its least (fails) and typical
(warns).

Metal shrinks as it freezes, and a thick section that freezes last, cut off from the gate by thinner ones, leaves a void.
`solidification` builds the part's distance field on a voxel grid: inside flags by ray parity along +X, one grid row at a
time (the kernel's `voxelInsideFlags`), and each inside node's depth, the radius of the largest ball about it inside the
part (`voxelDepth`, nearest distances through the triangle hierarchy). The grid step is the larger of the cube root of
the box's volume over 400 000 nodes and the longest side over 400, and the grid is offset by 1 + 1/π cells so that no
row runs through a mesh edge.

- A hot spot is a plateau of the field with no deeper neighbour among its 26: the centre of a locally largest ball, at
  least one cell deep. Largest first, each one's liquid region is the nodes joined to it at depth ≥ its own less a
  quarter cell; a hot spot whose region holds a larger one's is part of it.
- Its modulus V/A (by Chvorinov's rule, a section with a larger modulus freezes later) is estimated from the plateau's
  shape: its principal extents √(12 λ), λ the eigenvalues of its nodes' covariance; two longer than the ball's
  diameter make a sheet (r), one a line (r/2), none a point (r/3).
- A hot spot is fed when the ball at some node of its region, grown by one cell, touches the gate the person sets.
  Unfed ones are warned `[SHRINK_POROSITY]` with their place. No gate: the feeding rule is unknown.
- The thickest section, twice the deepest radius, over the nominal wall is judged against the rows' section-change
  ratio where one is given.

The pattern's allowances come from the profile's tables or the person's own values: one shrinkage scale, by the band
of the part's largest extent, and a machining allowance on the flat faces the person marks as machined. A family or a
process with no table read is unknown.

## Where it is in the code

| File | Responsibility |
|---|---|
| `packages/barocss-cad-model/src/print/rules.ts` | `printability`: the report, the process dispatch, the printing rules, `mouldability`, `warpRule`, `tipRule`, `worstOf` |
| `packages/barocss-cad-model/src/mould/draft.ts` | `draftField`, `exactNormals`, `draftSamples`: exact normals, classes, isocline points |
| `packages/barocss-cad-model/src/mould/undercut.ts` | `undercuts`: ±d visibility, regions, side actions |
| `packages/barocss-cad-model/src/mould/parting.ts` | `partingLine`, `isoclinePolylines`: halves, edges, isoclines, loops |
| `packages/barocss-cad-model/src/mould/tooling.ts` | `splitStraddles`, `toolingPlan`, `mouldHalves`: the halves, shut-offs, side cores |
| `packages/barocss-cad-model/src/mould/walls.ts` | `wallsOf`: nominal, thinnest, ribs, bosses, inside corners, thick sections |
| `packages/barocss-cad-model/src/analysis/analysis.ts` | `wallSamples`, `wallThickness`, `draftAnalysis`, `interference` |
| `packages/barocss-cad-model/src/print/overhang.ts` | `overhangOf`: the overhang test and bed contact |
| `packages/barocss-cad-model/src/print/orient.ts` | `searchOrientation`, `fibonacciDirections`, `orientPart` |
| `packages/barocss-cad-model/src/print/layers.ts` | `printLayers`: the layer preview and its support columns |
| `packages/barocss-cad-model/src/machining/report.ts` | `machinability`: milling and turning rules |
| `packages/barocss-cad-model/src/machining/access.ts` | `accessOf`, `accessSamples`: six-direction access, setups |
| `packages/barocss-cad-model/src/machining/cavities.ts` | `cavitiesOf`, `narrowest`: corners, edges, floors, tall walls |
| `packages/barocss-cad-model/src/machining/holes.ts` | `holesOf`, `tappedHoles`, `onDrillTable` |
| `packages/barocss-cad-model/src/casting/report.ts` | `castability`: casting rules |
| `packages/barocss-cad-model/src/casting/solidification.ts` | `solidification`: distance field, hot spots, feeding |
| `packages/barocss-cad-model/src/library/builtin/materials.json` | the process profiles, finishes and printers |
| `packages/barocss-cad/src/mesh/triangle-bvh.ts` | `triangleBvh`, `rayHit`, `nearestDistance2` |
| `packages/barocss-cad/src/mesh/voxel-field.ts` | `voxelInsideFlags`, `voxelDepth` |
| `packages/barocss-cad/src/nurbs/surfaces/surface-closest.ts` | `closestPointOnSurface`, `surfaceSeedGrid` |

## How it is checked

In `packages/barocss-cad-model/test/`:

- `mould-draft.test.ts`: a cylinder drafted 3° reads 3° at every sample to 10⁻⁹, drafted against 0.5° and 3°, steep
  against 5°; a box drafted 2° and an undrafted one; a cylinder across the pull straddles, its isocline at the axis'
  height; a fillet r 4 runs 0 … 90°; the report on a drafted cup.
- `im-s0.test.ts`: exact normals against mesh normals on a cone; a side hole across the pull hidden from both +z and −z,
  a hole along it seen; a shelled box's ray thickness.
- `mould-parting.test.ts`: a box's loop round its top, 140 mm, flat; a drafted box's round its bottom; a cylinder across
  the pull traced along its isocline.
- `mould-walls.test.ts`: a shelled box's nominal 2; a rib 0.6 t passes and t warns; bosses; an L bracket's fillet and
  sharp corner; an uneven floor.
- `mould.test.ts`: the injection profile's data and the whole moulding report.
- `printing.test.ts`: overhangs (a T's undersides exactly 300 mm²; a slope 60° from the vertical counted against 45°, one
  30° not; a lying cylinder by triangles), the printing rules on passing and failing parts, the orientation search.
- `print-layers.test.ts`: a 20 mm cube in 100 layers; a hole as a clockwise loop; support columns summing to the
  orientation's support volume.
- `cnc-access.test.ts`: a 40 × 30 × 20 box in two setups, +X adding 4600 mm² then −X 600 mm²; a sealed void's 400 mm²
  unreached; a side slot reached, and sealed 1 mm short, 760 mm² unreached; an internal groove.
- `cnc-cavities.test.ts`: a pocket's r 5 corners at 8 deep pass, r 2 warn; sharp corners; slots; a rib's height; an L
  bracket's edges.
- `cnc-holes.test.ts`, `cnc-process.test.ts`, `cnc-turning.test.ts`: hole depth 4, 6 and 6.4 × d; the drill table;
  threads; walls by family; turning.
- `im8a.test.ts`, `im8c.test.ts`: casting draft and walls per family; a plate's hot spot r 5 as a sheet; the L junction's
  r = t(2 − √2); an unfed block warned.
- `g6-samples.test.ts`: the studio maps' samples agree with the report (draft signs, access shares, isoclines).

## Limits

- Undercuts and access are only as fine as their samples; the undercut rule states its coarsest spacing. Rays run on
  the display mesh, so curved faces are judged to their chord.
- Access tries the six axis directions only: no 5-axis or angled tool, no tool length, holder or collision check. A face
  along a direction counts as reached by the tool's side.
- Overhangs on curved faces and wall thickness on curved walls are as accurate as the display mesh. The support volume
  is vertical columns, not a slicer's supports. Warp is a heuristic.
- The draft of a facet face uses its triangles' normals. The halves are laid out only for one body pulled along an
  axis; a parting loop that is not flat across the pull, or a riser off the axis planes, is refused.
- Hot spots depend on the grid step; the modulus is an estimate between r/3 and r.
- The CNC and print previews are display estimates: no G-code, feeds, speeds, collision check or slicer; every file
  the CAM preview writes opens with `NOT FOR PRODUCTION`.
