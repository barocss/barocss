import { useState } from 'react';
import { Renderer, classesFor } from '@barocss/render';
import type { ComponentRegistry, RenderContract, ScreenSpec } from '@barocss/render';

type Binding = '/draft/name' | '/draft/topic';
export type RequestAction = 'review' | 'edit' | 'confirm';
export interface RequestState { draft: { name: string; topic: string } }
export const REQUEST_CONTRACT = {
  textBindings: ['/draft/name', '/draft/topic'],
  actions: ['review', 'edit', 'confirm'],
} as const satisfies RenderContract<Binding, RequestAction>;

// Authored repository example. The host owns all fields and callbacks.
export const REQUEST_SPEC: ScreenSpec<Binding, RequestAction> = {
  root: 'layout',
  elements: {
    layout: { type: 'Layout', props: { id: 'layout', columns: 'single', gap: 'wide' }, children: ['card'] },
    card: { type: 'Card', props: { id: 'card', padding: 'spacious', tone: 'light' }, children: ['heading', 'name', 'topic', 'review', 'edit', 'confirm'] },
    heading: { type: 'Text', props: { id: 'heading', text: 'Request details' }, children: [] },
    name: { type: 'Input', props: { id: 'name', label: 'Request name', value: { $bindState: '/draft/name' } }, children: [] },
    topic: { type: 'Input', props: { id: 'topic', label: 'Request topic', value: { $bindState: '/draft/topic' } }, children: [] },
    review: { type: 'Button', props: { id: 'review', label: 'Review request' }, children: [], on: { press: { action: 'review' } } },
    edit: { type: 'Button', props: { id: 'edit', label: 'Edit request' }, children: [], on: { press: { action: 'edit' } } },
    confirm: { type: 'Button', props: { id: 'confirm', label: 'Confirm request' }, children: [], on: { press: { action: 'confirm' } } },
  },
};
const components: ComponentRegistry<RequestState, Binding, RequestAction> = {
  Layout: ({ node, children }) => <section data-node-id={node.props.id} className={classesFor(node)}>{children}</section>,
  Card: ({ node, children }) => <article data-node-id={node.props.id} className={classesFor(node)}>{children}</article>,
  Text: ({ node }) => <p>{node.props.text}</p>,
  Input: ({ node, state, setState }) => {
    const nameField = node.props.value.$bindState === '/draft/name';
    return <label>{node.props.label}<input aria-label={node.props.label}
      value={nameField ? state.draft.name : state.draft.topic}
      onChange={(event) => {
        const value = event.target.value;
        setState((old) => ({ draft: nameField
          ? { ...old.draft, name: value }
          : { ...old.draft, topic: value } }));
      }} /></label>;
  },
  Button: ({ node, onAction }) => <button type="button" onClick={onAction}>{node.props.label}</button>,
};
export function RequestForm({ onAction }: { onAction: (action: RequestAction, snapshot: RequestState) => void }) {
  const [state, setState] = useState<RequestState>({ draft: { name: 'Ada', topic: 'Coffee' } });
  const snapshot = (): RequestState => ({ draft: { ...state.draft } });
  const actions = {
    review: () => onAction('review', snapshot()),
    edit: () => onAction('edit', snapshot()),
    confirm: () => onAction('confirm', snapshot()),
  };
  return <Renderer spec={REQUEST_SPEC} contract={REQUEST_CONTRACT} components={components}
    state={state} setState={setState} actions={actions} />;
}
