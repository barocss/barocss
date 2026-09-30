// Official json-render adapter for the frozen #457 catalog. Only authored local specs reach this page.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { createStateStore, defineRegistry, JSONUIProvider, Renderer, useBoundProp } from '@json-render/react';
import { z } from 'zod';

import { BASE } from '../json-render-446/styles.mjs';
import { VARIABLE_FIELDS, VARIABLE_TOKENS, STATE_TEMPLATES } from './baseline.mjs';

const cx = (...parts) => parts.filter(Boolean).join(' ');
const id = z.string();
const textValue = z.union([z.string(), z.record(z.string(), z.unknown())]);
const scalar = (field) => z.number().finite().min(field.min).max(field.max);
const variableShape = z.object(Object.fromEntries(Object.entries(VARIABLE_FIELDS).map(([name, field]) => [name, scalar(field).optional()]))).strict();
const boundedLayout = { id, density: z.enum(['regular', 'compact']), columns: z.union([z.literal(1), z.literal(2)]), placement: z.enum(['side', 'stacked']) };

function catalogFor(arm) {
  const classProp = arm === 'utility' || arm === 'build' ? { className: z.string().optional() } : {};
  const layout = arm === 'preset' ? z.object(boundedLayout).strict()
    : arm === 'variable' ? z.object({ ...boundedLayout, variables: variableShape.optional() }).strict()
      : z.object({ id, className: z.string() }).strict();
  const buttonState = arm === 'preset' || arm === 'variable' ? { hoverUnderline: z.boolean().optional() } : {};
  const props = {
    Layout: layout,
    Text: z.object({ id, text: z.string(), ...classProp }).strict(),
    Input: z.object({ id, label: z.string(), value: textValue, ...classProp }).strict(),
    Select: z.object({ id, label: z.string(), options: z.array(z.string()), value: textValue, ...classProp }).strict(),
    Button: z.object({ id, label: z.string(), ...classProp, ...buttonState }).strict(),
  };
  const catalog = defineCatalog(schema, {
    components: Object.fromEntries(Object.entries(props).map(([name, shape]) => [name, {
      props: shape, description: `${name} in the frozen #457 catalog`, ...(name === 'Layout' ? { slots: ['default'] } : {}),
    }])),
    actions: { save: { description: 'Record a local save' }, refresh: { description: 'Record a local refresh' }, add: { description: 'Record a local add' } },
  });
  return { catalog, props };
}

function registryFor(arm, catalog) {
  const { registry } = defineRegistry(catalog, {
    components: {
      Layout: ({ props, children }) => {
        const defaults = props.density === 'compact' ? { paddingPx: 12, gapPx: 12 } : { paddingPx: 24, gapPx: 24 };
        const values = { ...defaults, radiusPx: VARIABLE_FIELDS.radiusPx.initial, ...props.variables };
        const style = arm === 'variable' ? Object.fromEntries(Object.entries(VARIABLE_FIELDS).map(([name, field]) => [field.cssName, `${values[name]}${field.unit}`])) : undefined;
        const layoutClasses = arm === 'preset'
          ? cx(`grid-cols-${props.columns}`, props.density === 'compact' ? 'p-3 gap-3' : 'p-6 gap-6')
          : arm === 'variable' ? cx(`grid-cols-${props.columns}`, ...VARIABLE_TOKENS) : props.className;
        const base = arm === 'variable' ? BASE.layout.split(' ').filter((token) => token !== 'rounded-xl').join(' ') : BASE.layout;
        return <section data-node-id={props.id} className={cx(base, layoutClasses)} style={style}>{children}</section>;
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
      Button: ({ props, emit }) => {
        const stateClass = (arm === 'preset' || arm === 'variable') && props.hoverUnderline ? STATE_TEMPLATES.hoverUnderline : null;
        return <button type="button" data-node-id={props.id} className={cx(BASE.button, stateClass, props.className)} onClick={() => emit('press')}>{props.label}</button>;
      },
    },
    actions: { save: () => {}, refresh: () => {}, add: () => {} },
  });
  return registry;
}

let reactRoot;
let store;
let arm;
let catalog;
let shapes;
let registry;
let actions;
const handlers = Object.fromEntries(['save', 'refresh', 'add'].map((name) => [name, () => { actions.push(name); }]));
function render(spec) {
  const validated = catalog.validate(spec);
  if (!validated.success) return { ok: false, errors: validated.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`) };
  const propErrors = [];
  for (const [nodeId, node] of Object.entries(spec.elements)) {
    const shape = shapes[node.type];
    if (!shape) { propErrors.push(`elements.${nodeId}: unknown component`); continue; }
    const checked = shape.safeParse(node.props);
    if (!checked.success) for (const issue of checked.error.issues) propErrors.push(`elements.${nodeId}.props.${issue.path.join('.')}: ${issue.message}`);
  }
  if (propErrors.length) return { ok: false, errors: propErrors };
  if (arm === 'utility') window.BaroCSS.preloadJsonRenderClasses(spec, window.BaroCSS.getRuntime());
  flushSync(() => reactRoot.render(<JSONUIProvider store={store} handlers={handlers}><Renderer spec={spec} registry={registry} /></JSONUIProvider>));
  return { ok: true, errors: [] };
}
window.REPLAY = {
  mount(selectedArm, initialState, spec) {
    if (reactRoot) throw new Error('mount must run once per page');
    arm = selectedArm;
    ({ catalog, props: shapes } = catalogFor(arm));
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
