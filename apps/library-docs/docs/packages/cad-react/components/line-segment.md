# LineSegment

D509 implements Loop, LineSegment, ArcSegment, Profile, Outer and Voids. The existing thirteen logical elements remain; the package now has nineteen. The 76 source-checkpoint controls (65 reused with unchanged inputs and 11 newly run), package/API types, lint and four semantic mutation controls pass. The selected all-six SegmentedProfiledPlate passes four original Viewer states and native proof. Returned-document Studio Open/F and the separate compound-metadata consumer pass at their saved source checkpoints. Current-source Studio continuation and fresh documentation verification are recorded separately from geometry evidence.

## Inputs and output

start:required dense finite readonly[x,y] pair. No ref, end or native ID prop.

A descriptor inside Loop. It does not create a native sketch, profile, solid or persistent native edge by itself. The next segment start defines its end.

Coordinates are millimetres on one localXY plane. Source values are copied, never snapped, repaired, deduplicated or resampled. Ordinary React wrappers, props, state, Fragments and keys remain supported under the existing synchronous Part contract. Typed refs are optional same-Part object tokens, not synchronous geometry queries.

```tsx
import {Loop,LineSegment} from '@barocss/cad-react';
export function Boundary(){return <Loop>
  <LineSegment start={[0,0]}/><LineSegment start={[60,0]}/>
  <LineSegment start={[60,40]}/><LineSegment start={[0,40]}/>
</Loop>;}
```

Place this segment inside Loop; consume that Loop through Extrude, or as an Outer/Voids input inside Profile consumed by Extrude. Mount the complete solid recipe under Part with the existing engine/Viewer lifecycle. Part produces one logical named Model result, which can contain multiple native pieces. This does not select one native body or guarantee connected material. Future SolidSet describes multiple named Model outputs; Regions remains proposed and unexported.

Missing/excess slots, incompatible realized kinds, mixed child/ref sources, missing/wrong-scope/duplicate/cyclic tokens and malformed new descriptor fields refuse. A rejected declaration retains the prior accepted immutable Doc and retires its freshness. Geometry-dependent touching/outside/clipping rules remain native and differ between Extrude and Revolve. No universal containment/contact refusal is claimed.

The measured canonical case is a60×40×8 mm plate: one Loop of four LineSegments as Outer and one Loop with a full CCW ArcSegment as Voids, centered at[30,20], radius6→8→Reset6. All six new elements are realized. Two native captures and two exact-Doc reuses bind four original GUI consumers; one native body/one shell/genus1 is proved only for these states. Blank NaN input waits for visible Error and finite-coordinate alert, submits no extra engine call, retires freshness and retains the preceding radius8 frame. Collapse/reopen/idle/Reset also pass. Recorded Studio Open/F and its fresh Worker binding pass for the exact returned document at that source checkpoint, with source and cleanup verification. Full viewport fitting and raster precision are NOT_MEASURED; the Studio palette can occlude the plate. No general topology, face/UV, NURBS, arbitrary-hole, release or mobile qualification follows.

The example above is a declaration example. Physical evidence comes from the pinned all-six SegmentedProfiledPlate recipe; equal dimensions do not create an additional producer certificate.
