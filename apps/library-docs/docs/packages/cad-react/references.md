# References, identity and compiler results

Native IDs are generated automatically. Use a typed object ref when another branch must consume declared geometry. A handle describes a supported kind; it does not contain synchronous evaluated CAD geometry.

## Share a profile

```tsx
import * as React from 'react';
import { Definitions, Circle, Extrude, type ProfileHandle } from '@barocss/cad-react';

export function SharedProfile() {
  const profile = React.useRef<ProfileHandle|null>(null);
  return <>
    <Extrude profile={profile} distance={20} />
    <Definitions><Circle ref={profile} center={[0,0]} radius={4} /></Definitions>
  </>;
}
```

Place this component inside a Part. Pass the ref object itself, not `profile.current`. The example declares the producer after its consumer: lookup resolves the committed model, so this is a supported forward reference. Do not read a handle during render to obtain geometry.

## Share a solid

```tsx
import * as React from 'react';
import { Definitions, Extrude, Rectangle, Rotate, Translate, type SolidHandle } from '@barocss/cad-react';

export function SharedSolid() {
  const source = React.useRef<SolidHandle|null>(null);
  return <>
    <Translate offset={[30,40,5]} solid={source} />
    <Definitions>
      <Rotate ref={source} axis="z" angle={90}>
        <Extrude distance={6}><Rectangle min={[0,0]} max={[80,60]} /></Extrude>
      </Rotate>
    </Definitions>
  </>;
}
```

A profile token cannot be used as a solid operand, and a solid token cannot be an extrusion profile. References are scoped to one Part. Missing, wrong-kind, duplicate or cyclic bindings refuse. Callback refs are not graph dependency tokens. Passing both a child and a source ref is invalid.

| Public type | Meaning |
|---|---|
| `ProfileHandle` | Readonly kind `rectangle` or `circle` |
| `SolidHandle` | Readonly kind `extrude`, `revolve`, `union`, `difference`, `translate` or `rotate` |
| `ProfileRef` | React object ref containing `ProfileHandle|null` |
| `SolidRef` | React object ref containing `SolidHandle|null` |
| `ModelLifecycle` | Declaration dirty/invalid/complete/detached callbacks |
| `ExtrudeProps`, `RevolveProps` | Exclusive one-profile child or ProfileRef input; their numeric operation parameters differ |
| `TargetProps` | Exclusive one-solid child or SolidRef input |
| `TranslateProps`, `RotateProps`, `SolidInput` | Existing body-transform and exclusive solid-input contracts |

Extrude and Revolve share the child-or-profile-reference rule. Their exported prop types express that union directly; there is no public `ProfileInput` type export. Revolve outputs a SolidRef and can take part in Definitions, Boolean and rigid-transform declarations. Controlled composition checks do not qualify every combined shape as a new native case.

## Identity and invalid declarations

Mounted feature identity and ordinary React keys retain native IDs through supported prop updates and reorders. Removal/remount creates a new identity. A ref object or an automatic native ID does not reconnect source code to a saved document after page reload.

The compiler stages IDs until a declaration succeeds. An invalid declaration retains the prior accepted compiler result. That does not make prior displayed geometry current: dirty/invalid/detached lifecycle changes retire freshness in the host. Applications must distinguish previous visible geometry from a ready current result.

## CompositionCompiler and IrError

`CompositionCompiler` is a public lower-level utility for inert realized descriptors. It does not execute React functions, native geometry or rendering. Most React hosts should use Part rather than manually construct descriptors.

```ts
import { CompositionCompiler } from '@barocss/cad-react';

const result = new CompositionCompiler().compile({
  kind: 'part', units: 'mm', children: [{
    kind: 'extrude', distance: 6, children: [{
      kind: 'rectangle', min: [0,0], max: [80,60],
    }],
  }],
});
if (result.ok) {
  const document = result.value.doc;
  void document; // A compiled model document, not an evaluated B-rep.
} else {
  console.error(result.error.code, result.error.message);
}
```

| Public type | Fields |
|---|---|
| `Compiled` | `revision`, `doc`, `fingerprint`, `sourceIds` provenance |
| `CompileResult` | Success `{ok:true,changed,value}` or failure `{ok:false,error,previous}` |
| `ErrorCode` | The finite compiler refusal-code union below |

Treat compiled results as immutable. Logical compiler outputs may be normalized by the existing Model reader; do not assume a compiler output key is already the accepted engine body key.

`IrError` extends Error and exposes `code`. Current compiler codes are `CARDINALITY`, `TYPE`, `CYCLE`, `MISSING_REFERENCE`, `DUPLICATE_BINDING`, `DUPLICATE_ALIAS`, `DUPLICATE_KEY`, `INVALID_PARAMETER`, `EXCLUSIVE_INPUT` and `UNSUPPORTED_CAPABILITY`. These are declaration errors, not a replacement for the CAD engine's native refusal and tolerance contracts.
