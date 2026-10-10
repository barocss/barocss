import type { ComponentType, Dispatch, ReactElement, ReactNode, SetStateAction } from 'react';

export interface ValidationError { path: string; message: string }
export interface ValidationResult { ok: boolean; errors: ValidationError[] }

interface NodeBase<Type extends string, Props> {
  type: Type;
  props: { id: string } & Props;
  children: string[];
}
export interface LayoutNode extends NodeBase<'Layout', {
  columns: 'responsive' | 'single'; gap: 'fractional' | 'wide';
}> { on?: never }
export interface CardNode extends NodeBase<'Card', {
  padding: 'fractional' | 'spacious'; tone: 'light' | 'dark';
}> { on?: never }
export interface TextNode extends NodeBase<'Text', { text: string }> {
  children: []; on?: never;
}
export interface InputNode<Binding extends string = '/name'> extends NodeBase<'Input', {
  label: string; value: { $bindState: Binding };
}> { children: []; on?: never }
export interface ButtonNode<Action extends string = 'save'> extends NodeBase<'Button', { label: string }> {
  children: []; on: { press: { action: Action } };
}
export type ScreenNode<Binding extends string = '/name', Action extends string = 'save'> =
  LayoutNode | CardNode | TextNode | InputNode<Binding> | ButtonNode<Action>;
export interface ScreenSpec<Binding extends string = '/name', Action extends string = 'save'> {
  root: string; elements: Record<string, ScreenNode<Binding, Action>>;
}
/** Host declarations only. Runtime validation enforces syntax, limits and uniqueness. */
export interface RenderContract<Binding extends string = '/name', Action extends string = 'save'> {
  readonly textBindings: readonly Binding[];
  readonly actions: readonly Action[];
}
export interface FormState { name: string }

export interface RegisteredComponentProps<Node extends ScreenNode<string, string>, State = FormState> {
  node: Node;
  state: State;
  setState: Dispatch<SetStateAction<State>>;
  onAction?: () => void;
  children?: ReactNode;
}
export type ComponentRegistry<State = FormState, Binding extends string = '/name', Action extends string = 'save'> = {
  [Type in ScreenNode<Binding, Action>['type']]: ComponentType<RegisteredComponentProps<
    Extract<ScreenNode<Binding, Action>, { type: Type }>, State>>;
};
interface RendererBaseProps<State, Binding extends string, Action extends string> {
  spec: ScreenSpec<Binding, Action>;
  components: ComponentRegistry<State, Binding, Action>;
  state: State;
  setState: Dispatch<SetStateAction<State>>;
  actions: Record<Action, () => void>;
}
export type RendererProps<State = FormState, Binding extends string = '/name', Action extends string = 'save'> =
  RendererBaseProps<State, Binding, Action> &
  ([Binding, Action] extends ['/name', 'save']
    ? { contract?: RenderContract<Binding, Action> }
    : { contract: RenderContract<Binding, Action> });

/** Checks untrusted data against the host declarations; omitted contract means /name and save. */
export function validateSpec(spec: unknown, contract?: RenderContract<string, string>): ValidationResult;
/** Fixed style mapping. Pass only a node from a validated screen. No CSS runtime is started. */
export function classesFor(node: ScreenNode<string, string>): string;
/** Revalidates the screen and checks all used own action functions before rendering. */
export function Renderer<State = FormState>(props: RendererBaseProps<State, '/name', 'save'> &
  { contract?: RenderContract }): ReactElement;
export function Renderer<State, Binding extends string, Action extends string>(
  props: RendererBaseProps<State, Binding, Action> & { contract: RenderContract<Binding, Action> }): ReactElement;

/** Serializable format version 1. All component props listed here are required. */
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
/** Returns a fresh deep copy; invalid host declarations throw TypeError at contract.*. */
export function getRenderSpecDefinition(contract?: undefined): RenderSpecDefinition;
export function getRenderSpecDefinition<Binding extends string, Action extends string>(
  contract: RenderContract<Binding, Action>): RenderSpecDefinition<Binding, Action>;
