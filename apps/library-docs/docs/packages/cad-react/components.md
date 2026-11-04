# Components and props

Import these components from `@barocss/cad-react`. Coordinates and lengths are in millimetres. Profiles are local XY geometry; extrusion and transforms lower to the existing Model operations. A React wrapper may return a compatible realized output: validation concerns the committed geometry, not the raw JSX child count.

## Detailed component pages

Each supported React element has its own props, complete example, logical/native role, validation and measured-scope page.

| Root and profiles | Solid operations | Operand slots and reuse | Placement |
|---|---|---|---|
| [Part](/packages/cad-react/components/part) | [Extrude](/packages/cad-react/components/extrude) | [Target](/packages/cad-react/components/target) | [Translate](/packages/cad-react/components/translate) |
| [Rectangle](/packages/cad-react/components/rectangle) | [Union](/packages/cad-react/components/union) | [Tools](/packages/cad-react/components/tools) | [Rotate](/packages/cad-react/components/rotate) |
| [Circle](/packages/cad-react/components/circle) | [Difference](/packages/cad-react/components/difference) | [Definitions](/packages/cad-react/components/definitions) | |
| [Polygon](/packages/cad-react/components/polygon) | [Revolve](/packages/cad-react/components/revolve) | | |

## Part

| Prop | Contract |
|---|---|
| `lifecycle` | Required `ModelLifecycle` object |
| `admission` | Required literal `"synchronous"`; caller promises the supported synchronous composition boundary |
| `units` | Optional `"mm"`, default `"mm"` |
| `children` | Required React children producing exactly one solid output outside Definitions |

`ModelLifecycle` has `dirty():void`, `invalid(error:unknown):void`, `complete(model:Compiled):void` and `detached():void`. A connected `ModelHost` implements this interface. Each Part is a separate model root; nested Parts are not geometry operands. `Part` is not a canvas and does not create a Worker.

## Profiles

| Component | Props | Output |
|---|---|---|
| `Rectangle` | `min:[x,y]`, `max:[x,y]`, optional `ref:ProfileRef` | Closed profile with strictly positive X/Y extents |
| `Circle` | `center:[x,y]`, positive finite `radius`, optional `ref:ProfileRef` | Closed circular profile |
| `Polygon` | `points:readonly [x,y][]` with 3..1024 dense finite pairs, optional `ref:ProfileRef` | Closed ordered profile |

Supply dense finite coordinate tuples. These components are profile producers, not standalone solid bodies. They do not expose a native face, a selected region, an arbitrary wire or a sketch-constraint editor.

## Polygon

[Polygon](/packages/cad-react/components/polygon) accepts a readonly array of 3..1024 ordered dense finite coordinate pairs and optional `ProfileRef`. It produces one closed profile through existing polygon sketch storage. `PolygonProps` is exported. Native validity and refusal remain authoritative; no points are repaired, removed or resampled. D504 tests and the selected width-60/80 pentagon native/Worker/Viewer and returned-document Studio flow pass. This does not qualify arbitrary outlines or Polygon-based Revolve.

## Extrude

| Prop | Contract |
|---|---|
| `distance` | Required finite nonzero length; positive and negative values lower to the existing native height |
| `from` | Optional finite start coordinate along the local extrusion direction; omitted by default |
| `children` | Exactly one realized profile, exclusive with `profile` |
| `profile` | `ProfileRef`, exclusive with `children` |
| `ref` | Optional `SolidRef` for the resulting solid |

`ExtrudeProps` is the public prop type. The input is profile geometry. An internal Sketch node is a document-storage detail, not a public `sketch={...}` prop. Native face/region extrusion available elsewhere in Studio is not automatically a source capability here.

## Revolve

Revolve accepts one closed profile child or typed `profile` reference, required sketch `axis="x"|"y"`, required finite angle in `(0,360]` degrees and optional finite two-coordinate origin. It returns a solid reference. The adapter lowers the existing Model node; it adds no native math. Declaration/types/lint checks and the selected rectangle90/180/360/Reset 90 actual flow pass; broader profile/axis/origin combinations remain unqualified. Read the [Revolve contract](/packages/cad-react/components/revolve).

## Union and Difference

| Component | Props | Contract |
|---|---|---|
| `Union` | `children`, optional `ref:SolidRef` | At least two realized solid operands; combines them in declared order |
| `Difference` | `children`, optional `ref:SolidRef` | Exactly one `Target` and one `Tools` group |
| `Target` | One solid child **or** `solid:SolidRef` | The solid to cut; `TargetProps` is exported |
| `Tools` | `children` | One or more realized solid tools, subtracted in declared order |

```tsx
import { Difference, Target, Tools, Extrude, Rectangle, Circle } from '@barocss/cad-react';

export function HoledPlate() {
  return <Difference>
    <Target><Extrude distance={6}><Rectangle min={[0,0]} max={[80,60]} /></Extrude></Target>
    <Tools><Extrude from={-1} distance={8}><Circle center={[10,10]} radius={3} /></Extrude></Tools>
  </Difference>;
}
```

This is existing CAD Boolean evaluation, with the backend's native geometry/refusal limits. The JSX layer does not implement a new Boolean kernel or certify every operand arrangement.

## Translate and Rotate

| Component | Required props | Optional props |
|---|---|---|
| `Translate` | `offset:[x,y,z]`, one solid input | `ref:SolidRef` |
| `Rotate` | `axis:"x"|"y"|"z"`, `angle` in degrees, one solid input | `pivot:[x,y,z]`, `ref:SolidRef` |

A solid input is exactly one realized solid child or `solid:SolidRef`. `SolidInput`, `TranslateProps` and `RotateProps` are exported. Offset and explicit pivot require three finite coordinates, including all three indexed array elements. Sparse arrays refuse. Angle must be finite with absolute value at most 3600; zero is allowed. An omitted pivot remains omitted and uses the existing backend origin default.

```tsx
import { Translate, Rotate, Extrude, Rectangle } from '@barocss/cad-react';

export function PositionedPlate() {
  return <Translate offset={[30,40,5]}>
    <Rotate axis="z" angle={90} pivot={[0,0,0]}>
      <Extrude distance={6}><Rectangle min={[0,0]} max={[80,60]} /></Extrude>
    </Rotate>
  </Translate>;
}
```

The inner Rotate lowers before the outer Translate. No matrix or trigonometry is computed by the React layer. Accepted axes/angles are API input rules; they do not expand the finite [runtime evidence](/packages/cad-react/limits).

## Definitions, refs and standard React behavior

`Definitions` takes `children` declaring profiles or solids for typed reuse. Its definitions do not add independent Part outputs. See [references](/packages/cad-react/references) for `ProfileHandle`, `SolidHandle`, `ProfileRef` and `SolidRef`.

Normal function components, props, hooks, Fragments and keyed arrays can compose these components within synchronous admission. React keys and mounted identities preserve supported feature identity; remounting creates new identity. No component has a public native-ID prop. Internal Suspense/Offscreen/async behavior is outside admission, including when a wrapper hides it.

## D509 profile composition

D509 implements Loop, LineSegment, ArcSegment, Profile, Outer and Voids. The existing thirteen logical elements remain; the package now has nineteen. The 76 source-checkpoint controls (65 reused with unchanged inputs and 11 newly run), package/API types, lint and four semantic mutation controls pass. The selected all-six SegmentedProfiledPlate passes four original Viewer states and native proof. Returned-document Studio Open/F and the separate compound-metadata consumer pass at their saved source checkpoints. Current-source Studio continuation and fresh documentation verification are recorded separately from geometry evidence.

| Component | Input and role |
| --- | --- |
| [Loop](/packages/cad-react/components/loop) | Ordered 1..1024 exact segment descriptors; optional profile ref |
| [LineSegment](/packages/cad-react/components/line-segment) | Finite start pair inside Loop; no native ID or ref |
| [ArcSegment](/packages/cad-react/components/arc-segment) | Finite start/center and explicit ccw/cw direction inside Loop |
| [Profile](/packages/cad-react/components/profile) | Exactly one Outer, optional one Voids; optional profile ref |
| [Outer](/packages/cad-react/components/outer) | Exactly one single-loop child or profile reference |
| [Voids](/packages/cad-react/components/voids) | 1..64 single-loop children or dense profile references |

Profile and Loop produce typed profile data. Outer/Voids and LineSegment/ArcSegment are structural descriptors, not independent native features. Composite Profile emits its own consumed sketch without emitting orphan sketches for its sources. Extrude.profile and optional same-Part refs remain valid. Circle sources convert through the existing exact loop helper; no sampled approximation. Extrude admits explicit holes in its existing native bounds. Revolve uses one outer with holes, no additional regions; its geometry admission differs and new holed Revolve physical proof is NOT_RUN. Sweep/Loft, Regions, arbitrary planes, face inputs and constraints remain unexported. Part is one logical Model output and can contain multiple native pieces; no connected-solid guard is added.
