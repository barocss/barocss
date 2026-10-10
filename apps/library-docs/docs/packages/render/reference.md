---
outline: 2
---
# @barocss/render public signatures

Package version: `0.12.0`. Declaration snapshot: `5f5ad866205a`.

Use [task API guidance](./api), [examples](./examples) and [limits](./limits) for semantics, ownership, errors and lifecycle. These signatures come from actual public entry exports. They do not prove execution or general support beyond those guides. Unannotated returns/types are inferred by the source checker; peer type-checking and emitted declaration equivalence did not run. Private/protected members and implementation bodies are excluded.

## Public declaration groups

Choose a public declaration group. File paths and the exact local commit are provenance; no unavailable GitHub URL is required.

### index.d.ts {#declarations-0e64152d61f2}

Local source: `packages/barocss-render/src/index.d.ts` at `5f5ad866205a21510ac69552e704cc162fa253b5`.

[ButtonNode](#buttonnode) · [CardNode](#cardnode) · [ComponentRegistry](#componentregistry) · [FormState](#formstate) · [InputNode](#inputnode) · [LayoutNode](#layoutnode) · [NodeBase](#nodebase) · [RegisteredComponentProps](#registeredcomponentprops) · [RenderContract](#rendercontract) · [RenderSpecDefinition](#renderspecdefinition) · [Renderer](#renderer) · [RendererBaseProps](#rendererbaseprops) · [RendererProps](#rendererprops) · [ScreenNode](#screennode) · [ScreenSpec](#screenspec) · [TextNode](#textnode) · [ValidationError](#validationerror) · [ValidationResult](#validationresult) · [classesFor](#classesfor) · [getRenderSpecDefinition](#getrenderspecdefinition) · [validateSpec](#validatespec)

## @barocss/render

Entry: `packages/barocss-render/src/index.d.ts`. tracked public declaration for dist-default root; emitted artifact not checked.

### ButtonNode {#buttonnode}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface ButtonNode<Action extends string = 'save'> extends NodeBase<'Button', { label: string }> {
  children: []; on: { press: { action: Action } };
}
```

</details>

Local declaration: `packages/barocss-render/src/index.d.ts:23` at `5f5ad866205a`.

### CardNode {#cardnode}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface CardNode extends NodeBase<'Card', {
  padding: 'fractional' | 'spacious'; tone: 'light' | 'dark';
}> { on?: never }
```

</details>

Local declaration: `packages/barocss-render/src/index.d.ts:14` at `5f5ad866205a`.

### classesFor {#classesfor}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function classesFor(node: ScreenNode<string, string>): string;
```

</details>

Local declaration: `packages/barocss-render/src/index.d.ts:65` at `5f5ad866205a`.

### ComponentRegistry {#componentregistry}

<details><summary>Show TypeAliasDeclaration signature</summary>

```ts
export type ComponentRegistry<State = FormState, Binding extends string = '/name', Action extends string = 'save'> = {
  [Type in ScreenNode<Binding, Action>['type']]: ComponentType<RegisteredComponentProps<
    Extract<ScreenNode<Binding, Action>, { type: Type }>, State>>;
};
```

</details>

Local declaration: `packages/barocss-render/src/index.d.ts:45` at `5f5ad866205a`.

### FormState {#formstate}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface FormState { name: string }
```

</details>

Local declaration: `packages/barocss-render/src/index.d.ts:36` at `5f5ad866205a`.

### getRenderSpecDefinition {#getrenderspecdefinition}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function getRenderSpecDefinition(contract?: undefined): RenderSpecDefinition;
export function getRenderSpecDefinition<Binding extends string, Action extends string>(contract: RenderContract<Binding, Action>): RenderSpecDefinition<Binding, Action>;
```

</details>

Local declaration: `packages/barocss-render/src/index.d.ts:93` at `5f5ad866205a`.

### InputNode {#inputnode}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface InputNode<Binding extends string = '/name'> extends NodeBase<'Input', {
  label: string; value: { $bindState: Binding };
}> { children: []; on?: never }
```

</details>

Local declaration: `packages/barocss-render/src/index.d.ts:20` at `5f5ad866205a`.

### LayoutNode {#layoutnode}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface LayoutNode extends NodeBase<'Layout', {
  columns: 'responsive' | 'single'; gap: 'fractional' | 'wide';
}> { on?: never }
```

</details>

Local declaration: `packages/barocss-render/src/index.d.ts:11` at `5f5ad866205a`.

### NodeBase {#nodebase}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
interface NodeBase<Type extends string, Props> {
  type: Type;
  props: { id: string } & Props;
  children: string[];
}
```

</details>

Local declaration: `packages/barocss-render/src/index.d.ts:6` at `5f5ad866205a`.

### RegisteredComponentProps {#registeredcomponentprops}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface RegisteredComponentProps<Node extends ScreenNode<string, string>, State = FormState> {
  node: Node;
  state: State;
  setState: Dispatch<SetStateAction<State>>;
  onAction?: () => void;
  children?: ReactNode;
}
```

</details>

Local declaration: `packages/barocss-render/src/index.d.ts:38` at `5f5ad866205a`.

### RenderContract {#rendercontract}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface RenderContract<Binding extends string = '/name', Action extends string = 'save'> {
  readonly textBindings: readonly Binding[];
  readonly actions: readonly Action[];
}
```

</details>

Local declaration: `packages/barocss-render/src/index.d.ts:32` at `5f5ad866205a`.

### Renderer {#renderer}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function Renderer<State = FormState>(props: RendererBaseProps<State, '/name', 'save'> &
  { contract?: RenderContract }): ReactElement;
export function Renderer<State, Binding extends string, Action extends string>(props: RendererBaseProps<State, Binding, Action> & { contract: RenderContract<Binding, Action> }): ReactElement;
```

</details>

Local declaration: `packages/barocss-render/src/index.d.ts:67` at `5f5ad866205a`.

### RendererBaseProps {#rendererbaseprops}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
interface RendererBaseProps<State, Binding extends string, Action extends string> {
  spec: ScreenSpec<Binding, Action>;
  components: ComponentRegistry<State, Binding, Action>;
  state: State;
  setState: Dispatch<SetStateAction<State>>;
  actions: Record<Action, () => void>;
}
```

</details>

Local declaration: `packages/barocss-render/src/index.d.ts:49` at `5f5ad866205a`.

### RendererProps {#rendererprops}

<details><summary>Show TypeAliasDeclaration signature</summary>

```ts
export type RendererProps<State = FormState, Binding extends string = '/name', Action extends string = 'save'> =
  RendererBaseProps<State, Binding, Action> &
  ([Binding, Action] extends ['/name', 'save']
    ? { contract?: RenderContract<Binding, Action> }
    : { contract: RenderContract<Binding, Action> });
```

</details>

Local declaration: `packages/barocss-render/src/index.d.ts:56` at `5f5ad866205a`.

### RenderSpecDefinition {#renderspecdefinition}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface RenderSpecDefinition<Binding extends string = '/name', Action extends string = 'save'> {
  definitionVersion: 1;
  components: {
    Layout: { props: { id: string; columns: LayoutNode['props']['columns'][]; gap: LayoutNode['props']['gap'][] }; container: true };
    Card: { props: { id: string; padding: CardNode['props']['padding'][]; tone: CardNode['props']['tone'][] }; container: true };
    Text: { props: { id: string; text: string }; container: false };
    Input: { props: { id: string; label: string; value: { $bindState: Binding[] } }; container: false };
    Button: { props: { id: string; label: string }; on: { press: { action: Action[] } }; container: false };
  };
  styleClasses: {
    Layout: Record<LayoutNode['props']['columns'] | LayoutNode['props']['gap'], string>;
    Card: Record<CardNode['props']['padding'] | CardNode['props']['tone'] | 'base', string>;
  };
  limits: { nodes: [number, number]; text: [number, number]; declarations: number; bindingLength: number };
  syntax: { idPattern: string; bindingSegmentPattern: string; bindingPrefix: '/'; bindingSeparator: '/'; unsafeNames: string[] };
  fields: { screen: string[]; node: string[]; contract: string[]; textProps: string[] };
  graph: { rootType: 'Layout'; matchingIds: true; leafChildrenEmpty: true; oneParent: true; reachable: true; acyclic: true };
  permissions: { textBindings: Binding[]; actions: Action[] };
}
```

</details>

Local declaration: `packages/barocss-render/src/index.d.ts:73` at `5f5ad866205a`.

### ScreenNode {#screennode}

<details><summary>Show TypeAliasDeclaration signature</summary>

```ts
export type ScreenNode<Binding extends string = '/name', Action extends string = 'save'> =
  LayoutNode | CardNode | TextNode | InputNode<Binding> | ButtonNode<Action>;
```

</details>

Local declaration: `packages/barocss-render/src/index.d.ts:26` at `5f5ad866205a`.

### ScreenSpec {#screenspec}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface ScreenSpec<Binding extends string = '/name', Action extends string = 'save'> {
  root: string; elements: Record<string, ScreenNode<Binding, Action>>;
}
```

</details>

Local declaration: `packages/barocss-render/src/index.d.ts:28` at `5f5ad866205a`.

### TextNode {#textnode}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface TextNode extends NodeBase<'Text', { text: string }> {
  children: []; on?: never;
}
```

</details>

Local declaration: `packages/barocss-render/src/index.d.ts:17` at `5f5ad866205a`.

### validateSpec {#validatespec}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function validateSpec(spec: unknown, contract?: RenderContract<string, string>): ValidationResult;
```

</details>

Local declaration: `packages/barocss-render/src/index.d.ts:63` at `5f5ad866205a`.

### ValidationError {#validationerror}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface ValidationError { path: string; message: string }
```

</details>

Local declaration: `packages/barocss-render/src/index.d.ts:3` at `5f5ad866205a`.

### ValidationResult {#validationresult}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface ValidationResult { ok: boolean; errors: ValidationError[] }
```

</details>

Local declaration: `packages/barocss-render/src/index.d.ts:4` at `5f5ad866205a`.

Local declaration paths and SHA record provenance. GitHub source links are exposed only when that exact commit is confirmed remotely. Reference extraction is not a registry, tarball, emitted-JS or browser acceptance result.
