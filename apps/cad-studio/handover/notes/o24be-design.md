# O24 (b)–(e) design: mate connectors, more references, joint kinds, relations (outer lane, 2026-10-24)

Owner: "관절,메이트 확장 넣어서 하자" (2026-10-24). O24 (a) (slider-crank loops, the cam mate) is done. This note fixes
the data model and the solver/tree changes for the rest, so each of (b)–(e) lands as its own checkpoint.

Everything stays in `doc.mates` (no new top-level document field, so STUDIO_DOC_FIELDS does not change). Saved
documents keep resolving: every new field is optional, and a mate without them solves exactly as today.

## Reference table (c, used by b)

`faceTableFrom` (assembly/faces.ts) reads more from the same B-rep. New `MateFace` kinds:

| kind | from | geometry (part coordinates) |
|---|---|---|
| `sphere` | a spherical face | `point` (centre), `radius`, `outer` |
| `cone` | a conical face | `point` (apex), `axis` (apex → base), `half` (half-angle, rad), `outer`, `span` |
| `line` | a straight edge, by its persistent name | `point` (start), `axis` (unit, start → end), `length` |
| `circle` | a circular edge (full or arc) | `point` (centre), `axis` (its normal), `radius`, and its ends when an arc |

Plane entries gain `centre` (the face's area centroid); cylinder entries gain `span` (the face's extent along its
axis, from its axis point). Both are optional extras: mate signatures and every current consumer read only the
fields they read now.

The kernel's `faceGeometry` returns `other` for spheres and cones. The kernel is not ours, so cad-model classifies
them itself from the face's NURBS (own TypeScript, no dependency):
- a sphere: sample points all at one distance from a least-squares centre, within the kernel's linear tolerance;
- a cone: a ruled surface (degree 1 one way) whose two rational boundary circles share an axis with different radii;
  the apex is where the rule lines meet the axis.
Anything else stays unmateable, as today.

## (b) Mate connectors

A mate side may be a **connector**: a frame (origin, Z, X) at a point of the part's geometry (Onshape's and Fusion's
joint origins). `MateRef` gains `at?: Connector`:

```ts
interface Connector {
  point?: 'centre' | 'start' | 'mid' | 'end' | 'apex';   // which point of `face` (default per kind below)
  offset?: Vec3;    // mm, in the connector's own frame, applied after placing
  turn?: number;    // degrees about its Z
  flip?: boolean;   // Z reversed (a half turn about X)
}
```

`face` names what it sits on: any reference-table entry (a face, an edge, an origin plane, a datum).

| on | origin (`point`) | Z | X |
|---|---|---|---|
| flat face, origin plane, datum plane | `centre` (default): the face's centroid; origin planes: the origin | its normal | the part's X projected onto it (else its Y) |
| round face, cone | `centre` (default): the axis at the middle of `span`; `start`, `end`: the span's ends; `apex` (cone) | its axis | perpendicular, canonical |
| sphere | `centre` | the part's Z | the part's X |
| straight edge | `mid` (default), `start`, `end` | its direction | perpendicular, canonical |
| circular edge | `centre` (default); `start`, `mid`, `end` along an arc | its normal | toward its start |

A vertex is a straight or circular edge's `start` or `end`. The resolved connector is a `frame` MateFace
(`point`, `normal` = Z, `x`), built at solve time; it never enters the stored table.

Classic kinds accept a connector on either side: as a plane (origin, Z) for coincident, distance and angle; as an
axis (radius 0) for concentric and tangent. So "an edge's midpoint on a face", "a hole's centre on a sketch point" and
the like are coincident mates.

References: a connector side keeps `face`'s name and its `sig` like any mate face, so re-matching works on edges,
spheres and cones too (`mateSignature` gains the new kinds).

## (c) More references directly

Beyond connectors, the classic kinds take the new entries where the meaning is plain:
- concentric: any two of cylinder, cone, circular edge, straight edge (each an axis); two spheres (centres together,
  three turns free: a ball);
- tangent: a sphere and a flat face (the centre a radius off it);
- coincident: a straight edge on a flat face (the line in the plane), a point-like connector on a face.
Every other pairing is refused with the pairs it takes (`mateRefusal`), as today.

## (d) Joint kinds

New `MateKind`s between two connectors, Onshape's set. The connectors' Z axes are aligned (the same way; `flip` on
the mate opposes them).

| kind | holds | free (the joint tree's steps) |
|---|---|---|
| `fastened` | Z, X, origin | none (fixed) |
| `revolute` | Z, origin | turn about Z |
| `slider` | Z, X, origin on a's Z line | slide along Z |
| `cylindrical` | Z, origin on a's Z line | slide along Z, turn about Z |
| `pin_slot` | Z, origin on a's X line | slide along a's X, turn about Z |
| `planar` | Z, origin on a's XY plane | slide along a's X and Y, turn about Z |
| `ball` | origin | three turns about the origin (a's X, Y, Z) |
| `universal` | origin, a's X square to b's Y | turn about a's X, then about b's Y |
| `screw` | Z, origin on a's Z line, slide = `pitch` × turn / 360° | turn about Z, the slide following it |

- **Solver** (assembly/mates.ts): the directions and linear rows above, in the existing two-stage solve (directions,
  then the smallest move); universal's square is an angle-style cone term (90°). The freedom reported is the table's.
- **Joint tree** (robot/joints.ts): a pair joined by exactly one joint-kind mate takes that kind's steps directly
  (axes from the connectors, so a universal's and a pin-slot's axes are the person's, not a null-space basis). A pair
  with a joint mate and other mates goes through the rows as today (the joint mate adds its rows). Screw: the slide
  is a chain joint following the turn, `mimic` multiplier `pitch / 2π` mm/rad.
- **Limits:** a joint mate may carry `limits: { turn?, slide?, x?, y?, turn2? : [lower, upper] }`, degrees and mm. The
  tree takes them as the joint's limits; `set_joints` still overrides per joint key.
- **Exports:** URDF has fixed, revolute/continuous, prismatic, mimic: a ball, universal, planar and pin-slot are chains
  through dummy links (as today's ball and planar), a screw a revolute plus a mimicking prismatic. MJCF has `ball`
  (written as one ball joint) and joint equality. A mimic between a turn and a slide is scaled to the format's units
  (m/rad), which today's writers do not do because no such pair existed.

## (e) Relations

Relations couple two joints; they hold nothing for the solver (as `cam`). Kinds, with `a` the leader's part and `b`
the follower's (`face` empty, or a gear's face to read its teeth):

| kind | leader → follower | value |
|---|---|---|
| `gear` | turn → turn | `ratio` (follower per leader, signed); default −z_a/z_b from the two parts' gears |
| `rack_pinion` | turn → slide (or slide → turn) | `distance`: mm per turn; default π·m·z from the pinion's gear |
| `lead_screw` | turn → slide (or slide → turn) | `distance`: the lead, mm per turn; `flip` for a left-hand thread |

Each sets the follower joint's `mimic` (the part's own non-fixed joint, as the cam mate finds it). The existing checks
apply: COUPLED_TWICE, COUPLING_CYCLE; plus RELATION_JOINTS (the parts' joints are not the kinds the relation joins).
Gears on two links (a planet on its carrier) are a gear relation, the coupling the automatic gear pairing refuses.

## Agent and studio

- v2: `assembly.add_mate`'s hint becomes `kind, a, b, distance?, angle?, flip?, ratio?, pitch?, limits?` with
  `a`/`b` `{part, face, at?}`; the handler's schema and description carry the kinds (read through `describe`, not
  counted per turn). Measured per checkpoint against the 25,000 cap.
- MatePanel (outer): the kind list grows (grouped: Faces / Joints / Relations), a connector's point, offset, turn
  and flip, a joint's limits, a relation's ratio or distance. Picking an edge or a vertex in the viewport is the GPU
  lane's picker; until it lands, an edge is chosen from the part's edge list in the panel.

## Order and checkpoints

(c)'s reference table first (b needs it), then (b), (d), (e): one checkpoint each, with its tests:
- (c): a sphere and a cone read from revolved parts; edges named and placed; signatures; concentric with a cone and
  a circular edge, tangent with a sphere.
- (b): each connector point on each kind against closed forms; offset/turn/flip; a classic mate with a connector.
- (d): each kind's solved pose and freedom; the tree's steps and axes; FK of a screw; URDF/MJCF written and read back
  (urdfdom's check_urdf, MuJoCo).
- (e): a rack–pinion (the parallel gripper), a lead screw carriage, a gear pair on two links; FK and the exports'
  mimic units.
