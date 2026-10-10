// Internal authority. Public callers receive a copy, never this frozen object.
const limits = { nodes: [2, 32], text: [1, 300], declarations: 32, bindingLength: 256 };
const permissions = { textBindings: ['/name'], actions: ['save'] };
const text = `${limits.text[0]}–${limits.text[1]} characters`;
function freeze(value) {
  for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child);
  return Object.freeze(value);
}
export const RENDER_SPEC_DEFINITION = freeze({
  definitionVersion: 1,
  components: {
    Layout: { props: { id: 'node ID', columns: ['responsive', 'single'], gap: ['fractional', 'wide'] }, container: true },
    Card: { props: { id: 'node ID', padding: ['fractional', 'spacious'], tone: ['light', 'dark'] }, container: true },
    Text: { props: { id: 'node ID', text }, container: false },
    Input: { props: { id: 'node ID', label: text, value: { $bindState: permissions.textBindings } }, container: false },
    Button: { props: { id: 'node ID', label: text }, on: { press: { action: permissions.actions } }, container: false },
  },
  styleClasses: {
    Layout: { responsive: 'grid grid-cols-1 md:grid-cols-2', single: 'grid grid-cols-1', fractional: 'gap-2.5', wide: 'gap-3.5' },
    Card: { base: 'rounded-xl', fractional: 'p-3.5', spacious: 'p-5.5', light: 'bg-white text-slate-900', dark: 'bg-slate-900 text-white' },
  },
  limits,
  syntax: {
    idPattern: '^[a-z][a-z0-9-]{0,31}$',
    bindingSegmentPattern: '^[a-zA-Z][a-zA-Z0-9_-]{0,31}$',
    bindingPrefix: '/', bindingSeparator: '/',
    unsafeNames: ['__proto__', 'prototype', 'constructor'],
  },
  fields: {
    screen: ['root', 'elements'], node: ['type', 'props', 'children', 'on'],
    contract: ['textBindings', 'actions'], textProps: ['text', 'label'],
  },
  graph: { rootType: 'Layout', matchingIds: true, leafChildrenEmpty: true,
    oneParent: true, reachable: true, acyclic: true },
  permissions,
});
