# Components and props

Import these components from `@barocss/cad-react`. Coordinates and lengths are in millimetres. Profiles are local XY geometry; extrusion and transforms lower to the existing Model operations. A React wrapper may return a compatible realized output: validation concerns the committed geometry, not the raw JSX child count.

## Detailed component pages

Each supported React element has its own props, complete example, logical/native role, validation and measured-scope page.

| Root and profiles | Solid operations | Operand slots and reuse | Placement |
|---|---|---|---|
| [Part](/packages/cad-react/components/part) | [Extrude](/packages/cad-react/components/extrude) | [Target](/packages/cad-react/components/target) | [Translate](/packages/cad-react/components/translate) |
| [Rectangle](/packages/cad-react/components/rectangle) | [Union](/packages/cad-react/components/union) | [Tools](/packages/cad-react/components/tools) | [Rotate](/packages/cad-react/components/rotate) |
| [Circle](/packages/cad-react/components/circle) | [Difference](/packages/cad-react/components/difference) | [Definitions](/packages/cad-react/components/definitions) | |

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

Supply dense finite coordinate tuples. These components are profile producers, not standalone solid bodies. They do not expose a native face, a selected region, an arbitrary wire or a sketch-constraint editor.

## Extrude

| Prop | Contract |
|---|---|
| `distance` | Required finite nonzero length; positive and negative values lower to the existing native height |
| `from` | Optional finite start coordinate along the local extrusion direction; omitted by default |
| `children` | Exactly one realized profile, exclusive with `profile` |
| `profile` | `ProfileRef`, exclusive with `children` |
| `ref` | Optional `SolidRef` for the resulting solid |

`ExtrudeProps` is the public prop type. The input is profile geometry. An internal Sketch node is a document-storage detail, not a public `sketch={...}` prop. Native face/region extrusion available elsewhere in Studio is not automatically a source capability here.

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

A solid input is exactly one realized solid child or `solid:SolidRef`. `SolidInput`, `TranslateProps` and `RotateProps` are exported. Offset and explicit pivot require three finite coordinates, including all three indexed array elements. Sparse arrays refuse. Angle must be finite with absolute value at most3600; zero is allowed. An omitted pivot remains omitted and uses the existing backend origin default.

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
