import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { createStateStore, defineRegistry, JSONUIProvider, Renderer, useBoundProp } from '@json-render/react';
import { z } from 'zod';
import { Layout, Card, Text, Input, Button } from './visual.jsx';

const props = {
  Layout: z.object({ id: z.literal('layout'), columns: z.enum(['responsive', 'single']), gap: z.enum(['fractional', 'wide']) }).strict(),
  Card: z.object({ id: z.literal('card'), padding: z.enum(['fractional', 'spacious']), tone: z.enum(['light', 'dark']) }).strict(),
  Text: z.object({ id: z.string(), text: z.string() }).strict(),
  Input: z.object({ id: z.literal('name'), label: z.string(), value: z.object({ $bindState: z.literal('/name') }).strict() }).strict(),
  Button: z.object({ id: z.literal('save'), label: z.string() }).strict(),
};
const catalog = defineCatalog(schema, {
  components: Object.fromEntries(Object.entries(props).map(([name, shape]) => [name, {
    props: shape, ...(['Layout', 'Card'].includes(name) ? { slots: ['default'] } : {}),
  }])),
  actions: { save: { description: 'Record a local save action' } },
});
const registry = defineRegistry(catalog, {
  components: {
    Layout: ({ props, children }) => <Layout node={{ type: 'Layout', props }}>{children}</Layout>,
    Card: ({ props, children }) => <Card node={{ type: 'Card', props }}>{children}</Card>,
    Text: ({ props }) => <Text node={{ type: 'Text', props }} />,
    Input: ({ props, bindings }) => {
      const [value, setValue] = useBoundProp(props.value, bindings?.value);
      return <Input node={{ type: 'Input', props }} value={value} onChange={setValue} />;
    },
    Button: ({ props, emit }) => <Button node={{ type: 'Button', props }} onClick={() => emit('press')} />,
  },
  actions: { save: () => {} },
}).registry;

export const createJsonState = () => createStateStore({ name: 'Ada' });
export function validateJsonSpec(spec) {
  const result = catalog.validate(spec);
  return result.success ? { ok: true, errors: [] } : { ok: false,
    errors: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })) };
}
export function JsonArm({ spec, store, onSave }) {
  return <JSONUIProvider store={store} handlers={{ save: onSave }}><Renderer spec={spec} registry={registry} /></JSONUIProvider>;
}
