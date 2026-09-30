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
export interface InputNode extends NodeBase<'Input', {
  label: string; value: { $bindState: '/name' };
}> { children: []; on?: never }
export interface ButtonNode extends NodeBase<'Button', { label: string }> {
  children: []; on: { press: { action: 'save' } };
}
export type ScreenNode = LayoutNode | CardNode | TextNode | InputNode | ButtonNode;
export interface ScreenSpec { root: string; elements: Record<string, ScreenNode> }
export interface FormState { name: string }

export interface RegisteredComponentProps<Node extends ScreenNode, State = FormState> {
  node: Node;
  state: State;
  setState: Dispatch<SetStateAction<State>>;
  onAction?: () => void;
  children?: ReactNode;
}
export type ComponentRegistry<State = FormState> = {
  [Type in ScreenNode['type']]: ComponentType<RegisteredComponentProps<
    Extract<ScreenNode, { type: Type }>, State>>;
};
export interface RendererProps<State = FormState> {
  spec: ScreenSpec;
  components: ComponentRegistry<State>;
  state: State;
  setState: Dispatch<SetStateAction<State>>;
  actions: { save: () => void };
}

/** Checks untrusted data, without parsing, repairing or returning a normalized spec. */
export function validateSpec(spec: unknown): ValidationResult;
/** Fixed style mapping. Pass only a node from a validated screen. No CSS runtime is started. */
export function classesFor(node: ScreenNode): string;
/** Revalidates the screen. Throws on invalid data or a missing used component. */
export function Renderer<State = FormState>(props: RendererProps<State>): ReactElement;
