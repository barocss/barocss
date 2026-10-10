# Render public API

Only the package root is a consumer entry. Use the built root; source helper modules are not public subpaths.

| Signature | Arguments and result | Refusal and ownership |
| --- | --- | --- |
| `validateSpec(spec: unknown, contract?): ValidationResult` | Inner screen object; optional host declarations. Returns `ok` and `errors: {path,message}[]`. | Returns validation errors without repair. Host retains accepted screen. |
| `Renderer(props): ReactElement` | `spec`, function-valued `components`, `state`, `setState`, `actions`, optional matching `contract`. | Throws for invalid screen, used component or action. No error boundary or state store. |
| `classesFor(node): string` | Already validated `ScreenNode`. Fixed Layout/Card utilities; other nodes return empty string. | Not a validator. Host starts CSS. |
| `getRenderSpecDefinition(contract?): RenderSpecDefinition` | Returns detached JSON-serializable `definitionVersion:1` data. | Bad declarations throw `TypeError` with first `contract.*` path. Copy edits cannot change validation. |

## Public types

`ValidationError`, `ValidationResult`, `LayoutNode`, `CardNode`, `TextNode`, `InputNode`, `ButtonNode`, `ScreenNode`, `ScreenSpec`, `RenderContract`, `FormState`, `RegisteredComponentProps`, `ComponentRegistry`, `RendererProps` and `RenderSpecDefinition` are declared at the root. Binding/action generics default to `/name` and `save`. Configured generics need an explicit contract.

[Exact type definitions and overloads](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-render/src/index.d.ts)

## Lifetime

There is no renderer instance to dispose. Unmount your React tree and destroy host-owned CSS, network and session resources. Definitions are copied per call. Keys preserve identity only within React's normal reconciliation rules.

[Manifest and version](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-render/package.json) · [Package task notes](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-render/README.md)
