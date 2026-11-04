# ArcSegment

D509 source candidate. This component is proposed in a temporary working copy and is not current repository API until root adoption. Tests/types/native/Viewer/Studio/docs execution are NOT_RUN. No additional feature-family qualification is implied.

## Inputs and output

start and center:required dense finite readonly[x,y] pairs; direction:required ccw|cw. No angle, ref or native ID prop.

An exact native arc descriptor inside Loop. No tessellation or inferred tangent/radius is computed by React. A single arc returns to its own start as a full circle; native validity remains separate.

Coordinates are millimetres on one localXY plane. Source values are copied, never snapped, repaired, deduplicated or resampled. Ordinary React wrappers, props, state, Fragments and keys remain supported under the existing synchronous Part contract. Typed refs are optional same-Part object tokens, not synchronous geometry queries.

```tsx
import {Loop,ArcSegment} from '@barocss/cad-react';
export function CircularVoid(){return <Loop>
  <ArcSegment start={[36,20]} center={[30,20]} direction="ccw"/>
</Loop>;}
```

Place this segment inside Loop; consume that Loop through Extrude, or as an Outer/Voids input inside Profile consumed by Extrude. Mount the complete solid recipe under Part with the existing engine/Viewer lifecycle. Part produces one logical named Model result, which can contain multiple native pieces. This does not select one native body or guarantee connected material. Future SolidSet describes multiple named Model outputs; Regions remains proposed and unexported.

Missing/excess slots, incompatible realized kinds, mixed child/ref sources, missing/wrong-scope/duplicate/cyclic tokens and malformed new descriptor fields refuse. A rejected declaration retains the prior accepted immutable Doc and retires its freshness. Geometry-dependent touching/outside/clipping rules remain native and differ between Extrude and Revolve. No universal containment/contact refusal is claimed.

The selected D509 physical proposal is a60x40 plate with one centered r6→8→Reset6 through-hole at height8, with exact returned Studio Open/Frame. Its one-body/genus1 expectation is source-only until High native and actual current consumers run. Source tests are not physical proof. No new renderer, native face/UV, sideTags/topology guarantee, Sweep/Loft, manufacturing, download, mobile or release is added.
