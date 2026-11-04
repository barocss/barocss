# Polygon

`Polygon` declares one closed planar profile from an ordered list of points. It lowers to the existing Model polygon sketch storage. It adds no Boolean, tolerance, triangulation or geometry-repair algorithm.

## Props

| Prop | Contract |
|---|---|
| `points` | Required readonly array of 3 to 1024 dense finite `[x,y]` coordinate pairs |
| `ref` | Optional `ProfileRef`, for reuse within the same Part |

Coordinates are in mm on the current local XY plane. Points are copied in declared order. The final edge returns to the first point. Do not repeat the first point to ask the adapter to close or repair a loop. No point is removed, snapped or resampled. Native geometry validation can refuse degenerate, crossing, contacting or otherwise unsupported outlines after declaration validation succeeds.

`PolygonProps` is exported. Polygon produces a profile, not a solid, face selection, wire, mesh or sketch-constraint scope. There is no public native-ID prop. Holes, regions, arbitrary planes and constraints remain separate source capabilities.

## Direct child

```tsx
import {Polygon,Extrude} from '@barocss/cad-react';

export function PolygonPlate({width}:{width:number}) {
  return <Extrude distance={8}>
    <Polygon points={[[0,0],[width,0],[width,50],[10,50],[0,40]]}/>
  </Extrude>;
}
```

Place this component inside an existing Part and supply the existing engine/Viewer integration. Changing width changes the declared polygon and requests the existing native recalculation. This component adds no visible explanatory UI.

## Forward reference through an ordinary component

```tsx
import * as React from 'react';
import {Polygon,Extrude,Definitions,type ProfileRef,type ProfileHandle} from '@barocss/cad-react';

function Outline({ref,width}:{ref?:ProfileRef;width:number}) {
  return <Polygon ref={ref} points={[[0,0],[width,0],[width,50],[10,50],[0,40]]}/>;
}

export function SharedPolygon({width}:{width:number}) {
  const outline=React.useRef<ProfileHandle|null>(null);
  return <>
    <Extrude distance={8} profile={outline}/>
    <Definitions><Outline ref={outline} width={width}/></Definitions>
  </>;
}
```

The ref is optional. Pass the object token, not `.current`. Normal React props, state, wrappers and stable keys provide reuse and identity. A Polygon profile can also feed the existing Revolve child/ref contract. That type compatibility does not qualify every revolved outline.

## Validation and current evidence

Counts outside 3..1024, missing array elements, inherited array elements, missing coordinates, nonfinite values and malformed coordinate pairs refuse. A rejected declaration retains the prior immutable compiled document and retires its freshness. A mounted feature keeps its IDs on supported updates; remounting creates a new identity.

The current PolygonApp measures the pentagon shown above at widths 60 and 80 mm and an extrusion height of 8 mm. Public Width changes, blank-input refusal, valid recovery and Reset pass with the existing Worker and Viewer. The exact returned width-60 document opens through public Studio Open and Frame all. These selected convex plates have independent native volume, centroid, boundary and topology evidence. A separate settled-error observation confirms the visible coordinate error and retained previous frame without an extra native request.

The package has 57 controlled tests, package/API-example types and lint passing. The native 3 to 1024 point budget is not a certificate for every outline, concave polygon or Polygon-based Revolve. See the support boundaries for the separate declaration and physical results.
