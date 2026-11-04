# Examples

These examples use current public package exports. The repository examples provide the complete injected-engine application: `packages/barocss-cad-react/examples/App.tsx`, `Bracket.tsx`, `TransformApp.tsx`, `TransformedBracket.tsx` and the application helper `connect-host.ts`. The latter is not a package export. No public engine client or standalone Worker is implied.

## A bracket with ordered cutting tools

```tsx
import { Difference, Target, Tools, Union, Extrude, Rectangle, Circle } from '@barocss/cad-react';

export function Bracket({ width }: { width: number }) {
  const holes = [
    { key: 'front-left', at: [10,10] as const },
    { key: 'front-right', at: [width-10,10] as const },
    { key: 'rear-left', at: [10,44] as const },
    { key: 'rear-right', at: [width-10,44] as const },
  ];
  return <Difference>
    <Target><Union>
      <Extrude distance={6}><Rectangle min={[0,0]} max={[width,60]} /></Extrude>
      <Extrude distance={56}><Rectangle min={[0,54]} max={[width,60]} /></Extrude>
    </Union></Target>
    <Tools>
      {holes.map(hole => <Extrude key={hole.key} from={-1} distance={8}>
        <Circle center={hole.at} radius={3} />
      </Extrude>)}
      <Extrude from={34} distance={14}>
        <Rectangle min={[width/2-10,53]} max={[width/2+10,61]} />
      </Extrude>
    </Tools>
  </Difference>;
}
```

The two target extrusions make the floor and wall. Four keyed tools cut floor holes. The last tool cuts a wall window. Extrusion overcut outside the target is not extra removed material. Place Bracket under Part with a connected lifecycle to evaluate/display it.

This follows the current Bracket source. The original measured package flow changes width80→100→80 through its public input, using the real existing Worker and Viewer. That finite proof is not a width-range certificate or a promise that all Boolean compositions succeed.

## Rotate first, then translate

```tsx
import { Translate, Rotate } from '@barocss/cad-react';
import { Bracket } from './Bracket';

export function TransformedBracket({ dx, angle }: { dx: number; angle: number }) {
  return <Translate offset={[dx,40,5]}>
    <Rotate axis="z" angle={angle} pivot={[0,0,0]}>
      <Bracket width={80} />
    </Rotate>
  </Translate>;
}
```

`./Bracket` is the preceding example saved as `Bracket.tsx`, not a package export. Nested ordering matters: the W80 bracket is rotated around the origin before its world translation. The measured transform states are A(dx30,90°), B(dx50,90°), C(dx50,180°), then returned A. The public Translation X and Rotation Z inputs belong to the desktop TransformApp example.

For the90° state, a source point[x,y,z] becomes[dx−y,40+x,5+z]. For180°, it becomes[dx−x,40−y,5+z]. Those are exact cardinal expectation rules used for these states, not a frontend transform implementation. The backend performs the native transformations.

## State updates through normal React

```tsx
import * as React from 'react';
import { Part, type ModelLifecycle } from '@barocss/cad-react';
import { TransformedBracket } from './TransformedBracket';

export function PlacementControls({ lifecycle }: { lifecycle: ModelLifecycle }) {
  const [dx, setDx] = React.useState(30);
  const [angle, setAngle] = React.useState(90);
  return <>
    <label>Translation X <input type="number" value={dx}
      onChange={event => setDx(event.currentTarget.valueAsNumber)} /></label>
    <label>Rotation Z <input type="number" value={angle}
      onChange={event => setAngle(event.currentTarget.valueAsNumber)} /></label>
    <Part admission="synchronous" lifecycle={lifecycle}>
      <TransformedBracket dx={dx} angle={angle} />
    </Part>
  </>;
}
```

This code changes model props through ordinary React state. It needs the separately connected engine/Viewer integration; it does not create a canvas or a Worker. Blank/nonfinite input is an invalid declaration, not authorization to treat old visible geometry as fresh. Use the lifecycle/readiness state when presenting current results.

## Current desktop controls

The repository App and TransformApp share a right inspector with compact numeric fields, collapsible groups, actual host status and Reset. Folding controls leaves Part mounted. Status polling is owned by a separate inspector child and stops on unmount; the measured idle interval changes no document, request, checkpoint or owner.

The Width example measures80→100→Reset80. Transform measures A(30,90°)→B(50,90°)→C(50,180°)→ResetA. Reset restores the actual initial props. Source/request counts are observed, not assumed from the number of control edits. Canvas buffer1000×700 and displayed10:7 aspect are retained. See [validation limits](/packages/cad-react/limits) for current native/consumer evidence and finite scope.

Global translation followed by automatic framing may leave pixels identical. The proof checks world document, centroid/bounds and fresh owners instead of forcing a pixel difference. Exact return document/frame is a finite observation, not general raster precision.
