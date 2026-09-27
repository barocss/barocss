// Official json-render adapter for saved #458 specs. It never receives model instructions.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { createStateStore, defineRegistry, JSONUIProvider, Renderer, useBoundProp } from '@json-render/react';
import { z } from 'zod';
import { BASE } from '../json-render-446/styles.mjs';

const cx = (...parts) => parts.filter(Boolean).join(' ');
const binding = z.union([z.string(), z.record(z.string(), z.unknown())]);
const id = z.string();
function catalogFor(arm) {
  const layout = arm === 'variable'
    ? z.object({ id, density: z.enum(['regular', 'compact']), columns: z.union([z.literal(1), z.literal(2)]),
      placement: z.enum(['side', 'stacked']), variables: z.object({ paddingPx: z.number().optional(), gapPx: z.number().optional(), radiusPx: z.number().optional() }).strict().optional() }).strict()
    : z.object({ id, className: z.string() }).strict();
  const button = arm === 'variable'
    ? z.object({ id, label: z.string(), hoverUnderline: z.boolean().optional() }).strict()
    : z.object({ id, label: z.string(), className: z.string().optional() }).strict();
  return defineCatalog(schema, {
    components: {
      Layout: { props: layout, slots: ['default'] },
      Text: { props: z.object({ id, text: z.string() }).strict() },
      Input: { props: z.object({ id, label: z.string(), value: binding }).strict() },
      Select: { props: z.object({ id, label: z.string(), options: z.array(z.string()), value: binding }).strict() },
      Button: { props: button },
    },
    actions: Object.fromEntries(['save', 'refresh', 'add'].map((name) => [name, { description: `Record local ${name}` }])),
  });
}
function registryFor(arm, catalog) {
  return defineRegistry(catalog, {
    components: {
      Layout: ({ props, children }) => {
        const bounded = arm === 'variable';
        const base = props.density === 'compact' ? 12 : 24;
        const style = bounded ? {
          '--ui-padding': `${props.variables?.paddingPx ?? base}px`, '--ui-gap': `${props.variables?.gapPx ?? base}px`,
          '--ui-radius': `${props.variables?.radiusPx ?? 14}px`,
        } : undefined;
        const classes = bounded ? `grid-cols-${props.columns}` : props.className;
        return <section data-node-id={props.id} className={cx(BASE.layout, bounded && 'typed-layout', classes)} style={style}>{children}</section>;
      },
      Text: ({ props }) => props.id === 'heading'
        ? <h2 data-node-id={props.id} className={BASE.heading}>{props.text}</h2>
        : <p data-node-id={props.id} className={BASE.text}>{props.text}</p>,
      Input: ({ props, bindings }) => {
        const [value, setValue] = useBoundProp(props.value, bindings?.value);
        return <label data-node-id={props.id} className={BASE.field}>{props.label}<input aria-label={props.label} className={BASE.input} value={value ?? ''} onChange={(event) => setValue(event.target.value)} /></label>;
      },
      Select: ({ props, bindings }) => {
        const [value, setValue] = useBoundProp(props.value, bindings?.value);
        return <label data-node-id={props.id} className={BASE.field}>{props.label}<select aria-label={props.label} className={BASE.input} value={value ?? ''} onChange={(event) => setValue(event.target.value)}>{props.options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
      },
      Button: ({ props, emit }) => <button type="button" data-node-id={props.id} className={cx(BASE.button, arm === 'variable' && props.hoverUnderline ? 'hover:underline' : props.className)} onClick={() => emit('press')}>{props.label}</button>,
    },
    actions: { save: () => {}, refresh: () => {}, add: () => {} },
  }).registry;
}
let root;
let store;
let arm;
let catalog;
let registry;
let actions;
const handlers = Object.fromEntries(['save', 'refresh', 'add'].map((name) => [name, () => actions.push(name)]));
function render(spec) {
  const checked = catalog.validate(spec);
  if (!checked.success) return { ok: false, errors: checked.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`) };
  if (arm === 'utility') window.BaroCSS.preloadJsonRenderClasses(spec, window.BaroCSS.getRuntime());
  flushSync(() => root.render(<JSONUIProvider store={store} handlers={handlers}><Renderer spec={spec} registry={registry} /></JSONUIProvider>));
  return { ok: true, errors: [] };
}
window.REPLAY458 = {
  mount(selectedArm, initialState, spec) {
    if (root || !['variable', 'utility'].includes(selectedArm)) throw new Error('Invalid first mount');
    arm = selectedArm;
    catalog = catalogFor(arm);
    registry = registryFor(arm, catalog);
    store = createStateStore(initialState);
    actions = [];
    root = createRoot(document.getElementById('out'));
    return render(spec);
  },
  update(spec) { if (!root) throw new Error('Mount first'); return render(spec); },
  state() { return store?.getSnapshot() ?? null; },
  actions() { return actions?.slice() ?? []; },
};
