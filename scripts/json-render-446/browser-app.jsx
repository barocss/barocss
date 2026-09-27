// Official json-render React replay adapter for #446. Specs are frozen local fixtures, never executable model code.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { createStateStore, defineRegistry, JSONUIProvider, Renderer, useBoundProp } from '@json-render/react';
import { z } from 'zod';

import { BASE, FIXED } from './styles.mjs';
const cx = (...parts) => parts.filter(Boolean).join(' ');
const textValue = z.union([z.string(), z.record(z.string(), z.unknown())]);
const id = z.string();
const classProp = { className: z.string().optional() };
const baseCatalogProps = (arm) => ({
  Text: z.object({ id, text: z.string(), ...(arm === 'utility' || arm === 'build' ? classProp : {}) }).strict(),
  Input: z.object({ id, label: z.string(), value: textValue, ...(arm === 'utility' || arm === 'build' ? classProp : {}) }).strict(),
  Select: z.object({ id, label: z.string(), options: z.array(z.string()), value: textValue, ...(arm === 'utility' || arm === 'build' ? classProp : {}) }).strict(),
  Button: z.object({ id, label: z.string(), ...(arm === 'utility' || arm === 'build' ? classProp : {}) }).strict(),
});
function catalogFor(arm) {
  const layoutProps = arm === 'fixed'
    ? z.object({ id, variant: z.enum(['regular', 'compact', 'stacked']) }).strict()
    : arm === 'bounded'
      ? z.object({ id, density: z.enum(['regular', 'compact']), columns: z.union([z.literal(1), z.literal(2)]), placement: z.enum(['side', 'stacked']) }).strict()
      : z.object({ id, className: z.string() }).strict();
  const props = { Layout: layoutProps, ...baseCatalogProps(arm) };
  return defineCatalog(schema, {
    components: Object.fromEntries(Object.entries(props).map(([name, shape]) => [name, {
      props: shape, description: `${name} in the frozen #446 catalog`, ...(name === 'Layout' ? { slots: ['default'] } : {}),
    }])),
    actions: { save: { description: 'Record a local save' }, refresh: { description: 'Record a local refresh' }, add: { description: 'Record a local add' } },
  });
}
function registryFor(arm, catalog) {
  const { registry } = defineRegistry(catalog, {
    components: {
      Layout: ({ props, children }) => {
        const style = arm === 'fixed' ? FIXED[props.variant]
          : arm === 'bounded' ? cx(`grid-cols-${props.columns}`, props.density === 'compact' ? 'p-3 gap-3' : 'p-6 gap-6')
            : props.className;
        return <section data-node-id={props.id} className={cx(BASE.layout, style)}>{children}</section>;
      },
      Text: ({ props }) => props.id === 'heading'
        ? <h2 data-node-id={props.id} className={cx(BASE.heading, props.className)}>{props.text}</h2>
        : <p data-node-id={props.id} className={cx(BASE.text, props.className)}>{props.text}</p>,
      Input: ({ props, bindings }) => {
        const [value, setValue] = useBoundProp(props.value, bindings?.value);
        return <label data-node-id={props.id} className={cx(BASE.field, props.className)}>{props.label}<input aria-label={props.label} className={BASE.input} value={value ?? ''} onChange={(event) => setValue(event.target.value)} /></label>;
      },
      Select: ({ props, bindings }) => {
        const [value, setValue] = useBoundProp(props.value, bindings?.value);
        return <label data-node-id={props.id} className={cx(BASE.field, props.className)}>{props.label}<select aria-label={props.label} className={BASE.input} value={value ?? ''} onChange={(event) => setValue(event.target.value)}>{props.options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
      },
      Button: ({ props, emit }) => <button type="button" data-node-id={props.id} className={cx(BASE.button, props.className)} onClick={() => emit('press')}>{props.label}</button>,
    },
    actions: { save: () => {}, refresh: () => {}, add: () => {} },
  });
  return registry;
}

let reactRoot;
let store;
let arm;
let catalog;
let registry;
let actions;
const handlers = Object.fromEntries(['save', 'refresh', 'add'].map((name) => [name, () => { actions.push(name); }]));
function render(spec) {
  const validated = catalog.validate(spec);
  if (!validated.success) return { ok: false, errors: validated.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`) };
  if (arm === 'utility') window.BaroCSS.preloadJsonRenderClasses(spec, window.BaroCSS.getRuntime());
  flushSync(() => reactRoot.render(<JSONUIProvider store={store} handlers={handlers}><Renderer spec={spec} registry={registry} /></JSONUIProvider>));
  return { ok: true, errors: [] };
}
window.REPLAY = {
  mount(selectedArm, initialState, spec) {
    if (reactRoot) throw new Error('mount must run once per page');
    arm = selectedArm;
    catalog = catalogFor(arm);
    registry = registryFor(arm, catalog);
    store = createStateStore(initialState);
    actions = [];
    reactRoot = createRoot(document.getElementById('out'));
    return render(spec);
  },
  update(spec) { if (!reactRoot) throw new Error('mount first'); return render(spec); },
  state() { return store?.getSnapshot(); },
  actions() { return actions?.slice() ?? []; },
};
window.REPLAY_BASE_CLASSES = BASE;
window.REPLAY_FIXED_CLASSES = FIXED;
