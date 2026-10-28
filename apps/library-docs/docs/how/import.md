<script setup>
import ImportWalk from '../.vitepress/components/algorithms/ImportWalk.vue';
import ImportSense from '../.vitepress/components/algorithms/ImportSense.vue';
import ImportIges from '../.vitepress/components/algorithms/ImportIges.vue';
</script>

# Reading STEP and IGES

Parts made in other CAD systems arrive as exchange files. This page opens up how the kernel reads them:

- **STEP** (ISO 10303-21): `importStep` reads the solids of a file into one B-rep. The part's `import` feature and the
  studio's Open use it.
- **IGES 5.3**: `importIGES` reads curves and surfaces, not solids. The studio adds them as direct geometry.

The writers, `exportStep` and `exportIGES`, are covered at the end. Each export can be read back, and the tests do so.
The options and results of each function are listed in [Exchange formats](/packages/cad/formats). The code is in
`packages/barocss-cad/src/io/`.

## The stages at a glance

| Stage | What it does | Source |
|---|---|---|
| 1. Parse | The DATA section into a table: instance number → entity name and parameters | `step-import.ts` (`parseData`) |
| 2. Walk | From each solid down through shells, faces, loops and edges to points | `step-import.ts` (`importStep`: `faceOf`, `edgeOf`, `geoOf`, `surfDefOf`) |
| 3. Seams | A face going once round its axis cut in two; an edge closing on itself split | `step-import.ts` (`importStep`, `splitEdge`) |
| 4. Patches | Each face's surface as one bounded NURBS patch over the face's extent; its sense | `step-import.ts` (`surfaceFor`, `revolutionPatch`, `sweptPatch`) |
| 5. Build | The B-rep records, its tolerance, names for unnamed edges | `step-import.ts`, `brep/brep-core.ts` (`buildBrep`) |

The result follows the kernel's rule for every B-rep: each face is one bounded NURBS patch without a seam, and each edge
has two distinct vertices.

## 1. A STEP file is records that point at records

A STEP file is plain text with two sections. `HEADER;` names the file and its schema. `DATA;` holds the model as
numbered instances, one per line in the kernel's own files:

```
#33=LINE('',#15,#32);
#34=EDGE_CURVE('e.bottom|e.side0',#16,#18,#33,.T.);
```

Each instance is `#n=NAME(parameters);`. A parameter is a number, a quoted string, a reference `#n` to another
instance, an enumeration such as `.T.` or `.MILLI.`, `$` for unset, `*` for derived, a list in parentheses, or a typed
value such as `LENGTH_MEASURE(1.E-06)`. A *complex* instance lists several partial entities in one record, as
`(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))` does. References may point forwards or backwards; the kernel's
writer puts points first and the solid last.

The reader parses the whole DATA section into a table before it resolves anything. It drops `/* comments */`, and it
does not read the HEADER. Then it walks: it finds every solid, and from each one it follows the references down to the
points.

<ImportWalk />

### What each entity becomes

| STEP entity | Kernel record |
|---|---|
| `MANIFOLD_SOLID_BREP`, `BREP_WITH_VOIDS` | A solid body; each void's `ORIENTED_CLOSED_SHELL` is unwrapped to its shell, the flag not applied |
| `CLOSED_SHELL` | A closed shell |
| `ADVANCED_FACE`, `FACE_SURFACE` | A face: its surface, its bounds and its *same_sense* |
| `FACE_OUTER_BOUND`, `FACE_BOUND` | An outer or inner loop. A face with no outer bound gets its first bound as the outer loop |
| `EDGE_LOOP` of `ORIENTED_EDGE`s | The loop's coedges, each an edge used forward or reversed |
| `EDGE_CURVE` | An edge: its curve and its two vertices |
| `VERTEX_POINT`, `CARTESIAN_POINT` | A vertex at that point |
| `LINE` | A degree-1 curve from the edge's start vertex to its end vertex |
| `CIRCLE`, `ELLIPSE` | Rational quadratic arcs over the edge's angle range, spans of at most a quarter turn, middle weight cos(Δt / 2) |
| `B_SPLINE_CURVE_WITH_KNOTS`, rational B-spline curves | NURBS curves as written, knots expanded by their multiplicities |
| `SURFACE_CURVE`, `SEAM_CURVE`, `TRIMMED_CURVE` | Their 3D curve; a trimmed curve's own trim parameters are not used: the edge's vertices bound it |
| `PLANE` | A flat bilinear patch over the face's boundary, padded by 1 mm plus 1 % of its largest in-plane coordinate |
| `CYLINDRICAL_`, `CONICAL_`, `SPHERICAL_`, `TOROIDAL_SURFACE` | Exact rational patches of revolution over the face's extent: a line or arc profile turned through the face's angles |
| `B_SPLINE_SURFACE_WITH_KNOTS`, rational B-spline surfaces | NURBS surfaces as written |
| `SURFACE_OF_LINEAR_EXTRUSION` | σ(u, v) = C(u) + v·V over the face's extent; of a line, a plane |
| `SURFACE_OF_REVOLUTION` | The curve turned about the axis over the face's angles; of a line, a cylinder or a cone |
| `TESSELLATED_SOLID`, `TESSELLATED_SHELL` (AP242) | Facet bodies from `TRIANGULATED_FACE`s and their `COORDINATES_LIST`, beside any B-rep solids |

Vertices and edges are read once per instance number, so an edge two faces name is one edge with two coedges. The
first and last control points of each edge's curve are set to its vertices' points. That closes any small gap between
the curve's ends and the vertices.

The extent of an analytic patch is found from 9 points sampled along each edge of the face's loops. The angles are
the smallest arc holding them all: the circle minus the widest gap between them, plus a margin of
min(10⁻³, gap / 4) rad on each side. The height (or latitude) range grows by 1 % of its span on each side, at least
10⁻⁶. When two gaps are equally widest, as on a half cylinder bounded by two straight edges, the loop's turning about
the surface normal decides which one the face lies across.

## 2. A face once round its axis

Other systems write a cylinder's wall as one face that goes all the way round. Its loop is two circles and a *seam*
edge used twice, once each way. That face has no bounded patch without a seam, so the reader cuts it in two:

- The cut runs at the angle opposite the seam. If a hole in the wall lies there, the reader tries 719 other angles
  around the axis. It takes the one clearest of the seam and of every hole.
- Where each boundary chain crosses the cut angle, its edge is split. The crossing is found on 64 samples along the
  edge, then by 80 bisections. Splitting the circle also splits it in the loop of the disc beside it.
- The two halves meet along a new edge. On a cylinder or a cone it is a straight line. On a sphere or a torus it is an
  arc of the profile. On a surface of revolution it is the seam itself, turned onto the cut.
- The halves are named like any face split in two: `wall#1`, `wall#2` ([Names that survive edits](/how/naming)).

An edge that starts and ends at one vertex, such as a full circle, is split in two at its middle. A hole across the
seam itself is refused, as is a face whose holes leave no clear angle to cut (the best clearance 10⁻⁶ rad or less).

## 3. Orientation flags

Three flags say which way things run, and a fourth says which side of a surface is outside:

| Flag | Where | What the reader does |
|---|---|---|
| *same_sense* | `EDGE_CURVE` | For a circle or ellipse, which way from the start vertex to the end vertex: with the curve (counter-clockwise about its axis) or against it. A B-spline is reversed for `.F.`. A line runs from vertex to vertex either way |
| *orientation* | `ORIENTED_EDGE` | The coedge uses its edge forward (`.T.`) or reversed (`.F.`) |
| *orientation* | `FACE_BOUND` | `.F.`: the loop's uses taken in reverse order, each one turned over |
| *same_sense* | `ADVANCED_FACE` | Whether the surface's own normal is the face's outward normal |

<ImportSense />

For the face, the reader compares the normal of the patch it built with the surface's natural normal (a plane's axis,
a cylinder's outward radius). The face is `forward` when the two agree exactly when *same_sense* is `.T.`. A B-spline
surface and a swept surface keep their file parametrisation, so their sense is the flag itself.

The reader does not check or correct the flags. A file whose flags disagree gives a B-rep that `checkBrep` reports
under `orientation`. The import tests run `checkBrep` on every file they read.

## 4. Units, tolerances and repair

**Lengths.** `importStep` reads the numbers as they are written, in millimetres. It does not read the file's
`LENGTH_UNIT`. The studio does: `stepLengthUnit` finds a declared SI unit with its prefix (`.MILLI.` 1, `.CENTI.` 10,
none 1000, …) or a `CONVERSION_BASED_UNIT` named `INCH` (25.4) or `FOOT` (304.8). For a unit other than millimetres it
adds a `scale` step about the origin to each solid it opened. A file that declares no unit is read as millimetres, and
the studio says so.

**Angles.** A cone's half-angle is taken in radians. `PLANE_ANGLE_UNIT` is not read.

**Tolerance.** The reader looks for the file's `UNCERTAINTY_MEASURE_WITH_UNIT` named `distance_accuracy_value`. When
it is larger than 10⁻⁶ mm, the B-rep's tolerance is that accuracy, capped at 10⁻⁵ × max(1 mm, the model's largest
coordinate). A tolerant body written by another system, or by the kernel itself (D110), stays tolerant. Otherwise the B-rep gets the
kernel's default, max(10⁻⁷ mm, 10⁻¹¹ × its largest coordinate). The kernel's own writer states 10⁻⁶ mm, or its
bodies' largest entity tolerance where that is larger.

**Repair.** Apart from the snapped curve ends, the reader takes the topology as the file gives it. It does not sew
faces or heal gaps. Sewing open surfaces into a solid is a separate step, `sewSolid` (`brep/sew-solid.ts`, the part's
`sew` feature), with a tolerance of 10⁻³ of the surfaces' size by default, at least 10⁻⁶ mm.

**Names.** Faces and edges keep the names the file gives them. A name that repeats, as when two bodies with the same
feature names are exported together, is numbered in file order: `top#1`, `top#2`. An unnamed edge is named by its two
faces, `a|b`. The part's `import` feature puts its own id before every name.

**Checking what came in.** A file may carry CAx-IF *geometric validation properties*: volume, surface area, centroid
and bounding box. `stepValidationProperties` reads them and `compareValidationProperties` compares them with the model.
The limits are CAx-IF's: volume and area within 1 %, the centroid within 0.1 % of the box's diagonal.

**Size.** Before reading, the part's `import` feature refuses a file whose text, apart from its tessellated records,
is larger than 32 MiB, or whose text is larger than 128 MiB in all (D49). A B-rep file takes about 17 times its text
in memory while it is built.

## 5. IGES: fixed columns and pointers

IGES is older and laid out by column. Every line is 80 characters: 72 of data, a section letter and a sequence number.
The Start section is free text, the Global section the file's settings, and the Directory section one two-line entry per
entity. The Parameter section holds the entities' numbers, and the Terminate section counts the others. Directory
entries and parameter lines point at each other by sequence number.

<ImportIges />

The reader is narrow on purpose. It takes back what the kernel's writer writes, checks every field of it, and refuses
everything else with an `IGESImportError` and a diagnostic `code`:

- **Entities.** Only 126 (rational B-spline curve) and 128 (rational B-spline surface): untransformed, open and
  non-periodic. There are no trimmed surfaces (144) and no solids, so an IGES file never becomes a B-rep.
- **Units.** Only the writer's millimetres and scale 1, without conversion. The 26 Global fields must have the
  writer's types, and its delimiters, unit, scale, precisions, dates and version must have the writer's values. The
  declared largest coordinate must equal the largest pole coordinate read.
- **Records.** 80 printable ASCII columns and a line feed each; at most 8192 records, 16 entities and 1 MiB of text.
- **Geometry.** Degree 1 to 5, at most 64 curve poles, at most 16 surface poles per direction and 256 in all. Each
  curve and surface passes the kernel's own validation.

The result is the geometry as a native model, with ids made from the directory numbers (`demo_d1`, `demo_d3`). It
comes with the model's source text. The reader compiles that text and requires the same model back, bit for bit.
`validateIGESImport` repeats the whole import and compares.

## 6. Writing

**STEP.** `exportStep` writes AP214 (`AUTOMOTIVE_DESIGN`):

- each body as a `MANIFOLD_SOLID_BREP`, or a `BREP_WITH_VOIDS` whose cavities are `ORIENTED_CLOSED_SHELL`s with `.F.`;
- planar faces as `PLANE`s whose axis is the face's outward normal, every other surface as its exact (rational)
  B-spline;
- straight edges as `LINE` with a `VECTOR`, the rest as (rational) B-spline curves;
- points and directions written once and shared;
- units of millimetre, radian and steradian, and by default the validation properties above.

The writer always writes `.T.` for an edge's and a bound's flags. Its files therefore use only the `ORIENTED_EDGE` and
face flags; files from other systems may use all four. Mesh bodies go out as AP242 tessellated faces, or as planar
faces up to 5,000 triangles a body ([Exchange formats](/packages/cad/formats#step)).

**IGES.** `exportIGES` writes 1 to 16 chosen curves and surfaces of a millimetre model as entities 126 and 128. The
parameters are packed into 64 columns, every number in its shortest exact decimal, with a fixed date of
20000101.000000. The same model gives the same bytes.

## Where it is in the code

| File | Responsibility |
|---|---|
| `packages/barocss-cad/src/io/step-import.ts` | `importStep`: `parseData` (the table), the walk (`faceOf`, `edgeOf`, `geoOf`, `surfDefOf`), seams and closed edges, `surfaceFor` (patches and sense), the tolerance, names; `tessellatedBreps`, `stepMeshes`, `stepTessellatedChars`; `stepValidationProperties`, `compareValidationProperties` |
| `packages/barocss-cad/src/io/step.ts` | `exportStep`: product structure, units, uncertainty, solids, tessellated meshes, `writeValidationProperties`; `MESH_PLANAR_TRIANGLES`, `MESH_PLANAR_LIMIT` |
| `packages/barocss-cad/src/io/iges-import.ts` | `importIGES`: `physicalRecords`, `globalFields`, `directories`, `scanTokens`, `entity`, `fullSource`; `validateIGESImport`; `IGESImportError` and its codes |
| `packages/barocss-cad/src/io/iges.ts` | `exportIGES`: S, G, D, P and T records, `curveParameters`, `surfaceParameters` |
| `packages/barocss-cad/src/brep/brep-core.ts` | `buildBrep` (records, default tolerance), `checkBrep` (the orientation check among others) |
| `packages/barocss-cad/src/part/part-mesh.ts`, `part/part-model.ts` | The part's `import` feature; `CadPartLimits`, `stepSizeProblem` |
| `packages/barocss-cad/src/brep/sew-solid.ts` | `sewSolid`: open surfaces sewn into a solid (not used by the import) |
| `packages/barocss-cad-model/src/engine/stepUnits.ts` | `stepLengthUnit`: the file's declared length unit, for the studio's scale |
| `packages/barocss-cad-model/src/engine/direct.ts` | `importIGESFile`: IGES into the studio's direct geometry |

## How it is checked

- `packages/barocss-cad/test/step.test.mjs`:
  - *STEP export is well formed AP214 and round-trips every part exactly (validity, faces, names, volume)*: six parts
    (a holed plate, a rounded box, a torus, a sphere, a shelled box with a void, a drafted box). Every reference in the
    file is defined. The part read back is valid, with the same faces and names and the same volume to 10⁻⁹.
  - *several bodies go into one STEP product; unsupported input is refused with the reason*: three bodies back;
    *no solid* and *no DATA section* refused.
  - *STEP from other systems: analytic surfaces, closed circles, seams and poles become seamless patches*: the files
    of `test/step-fixtures.mjs`, written as OCCT writes them. They are a cylinder, a box with a through hole, a cone
    frustum, a sphere, a cylinder with a pocket across from its seam, a prism with an extruded B-spline side and a
    revolved B-spline profile. Each is valid, with the expected face names (`wall#1`, `wall#2` …) and volume within
    5 × 10⁻⁴, no closed edges, and is valid again when written and read back. Imported bodies take a hole, a fillet and
    a chamfer. `OFFSET_SURFACE` is refused as `CAPABILITY`; a hole across the seam and a profile off its axis plane
    are refused by name.
  - *a STEP file with several solids: one body by default, each solid its own part with each*.
  - *curved bodies read back from STEP keep their exact volume*: a torus, a bent pipe, a torus joined to a rod, to
    10⁻⁹ by quadrature over the read surfaces.
- `packages/barocss-cad/test/step-validation.test.mjs`: validation properties written, read back and in agreement;
  two bodies of the same names imported with them numbered.
- `packages/barocss-cad/test/step-tessellated.test.mjs`: AP242 meshes out and back with the same volume, area,
  centroid and face names; planar or tessellated by size; a B-rep and a mesh in one file; an open tessellated shell
  read as a sheet; the D49 size caps.
- `packages/barocss-cad/test/perf3-c16.test.mjs`, *C16 STEP tokens*: comments, a doubled quote and a non-breaking
  space read as before.
- `packages/barocss-cad/test/iges.test.mjs`: the writer's fixed-width records, pointers and counts; 126 and 128
  parameters, u fastest; the Global section; refusals of other units, entities and invalid geometry.
- `packages/barocss-cad-model/test/direct.test.ts`, *IGES: written curves and surfaces read back as the same geometry;
  a file it cannot read is refused*.
- `packages/barocss-cad-model/test/step-units.test.ts`: millimetres, metres and inches declared, and none.

No test file yet uses an `EDGE_CURVE` or a `FACE_BOUND` flag of `.F.`, an `ELLIPSE`, a `TOROIDAL_SURFACE` written by
another system, a `TRIMMED_CURVE` or a `FACE_SURFACE`. The orientation figure's eight cases were run by hand on the
built kernel.

## Limits

- **Refused by name**, as a `BrepError` with code `INPUT` and the message `STEP: …`. The part's `import` feature
  reports a message saying *not supported* as `CAPABILITY`, anything else as `INPUT`:
  - other surfaces (`OFFSET_SURFACE` …), curves, edges, faces, shells, and bounds that are not edge loops;
  - a hole across a seam, and holes that leave no angle to cut;
  - a B-spline edge that a seam cut or a closed edge would have to split;
  - a face once round a swept circle, a face of revolution bounded by two meridians only, and a face once round
    without a seam;
  - a profile of revolution off a plane through its axis, on the axis, or a line square to it;
  - a file with no DATA section or no solid.
- **Not read:** the file's length and angle units (the studio scales lengths; angles are taken as radians), the product
  structure and assemblies, colours, layers and PMI. A void's `ORIENTED_CLOSED_SHELL` flag and a trimmed curve's trim
  parameters are not applied.
- **No healing:** faces are not sewn and gaps are not closed, except that each curve's ends are set to its vertices.
- **IGES** is read only as the kernel's writer writes it: curves and surfaces, never a solid.
