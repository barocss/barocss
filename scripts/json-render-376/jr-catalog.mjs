// #376 json-render catalog: a shadcn-style catalog (same component set as the #231 probe), defined with the
// official @json-render/core defineCatalog + @json-render/react schema. Layout containers, Text and Button accept a
// `className` (Tailwind utilities), as shadcn-based json-render catalogs usually do.
import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { z } from 'zod';

const cls = z.string().nullable().optional().describe('Tailwind utility classes (theme tokens: bg-primary, text-muted-foreground, bg-card, border-border, rounded-lg, ...)');
export const catalog = defineCatalog(schema, {
  components: {
    Card: { props: z.object({ title: z.string().nullable().optional(), description: z.string().nullable().optional(), className: cls }), description: 'Card container; children render inside', slots: ['default'] },
    Stack: { props: z.object({ direction: z.enum(['vertical', 'horizontal']).nullable().optional(), className: cls }), description: 'Flex stack layout container', slots: ['default'] },
    Grid: { props: z.object({ columns: z.number().nullable().optional(), className: cls }), description: 'Grid layout container', slots: ['default'] },
    Text: { props: z.object({ text: z.string(), variant: z.enum(['h1', 'h2', 'h3', 'body', 'muted', 'small']).nullable().optional(), className: cls }), description: 'Text or heading' },
    Button: { props: z.object({ label: z.string(), variant: z.enum(['default', 'outline', 'secondary', 'ghost', 'destructive', 'link']).nullable().optional(), size: z.enum(['sm', 'default', 'lg']).nullable().optional(), className: cls }), description: 'Button' },
    Badge: { props: z.object({ text: z.string(), variant: z.enum(['default', 'secondary', 'outline', 'destructive']).nullable().optional() }), description: 'Small status badge' },
    Input: { props: z.object({ label: z.string().nullable().optional(), placeholder: z.string().nullable().optional(), type: z.string().nullable().optional() }), description: 'Text input with label' },
    Switch: { props: z.object({ label: z.string(), checked: z.boolean().nullable().optional() }), description: 'Toggle switch with label' },
    Select: { props: z.object({ label: z.string().nullable().optional(), options: z.array(z.string()), value: z.string().nullable().optional() }), description: 'Dropdown select' },
    Separator: { props: z.object({}), description: 'Horizontal rule' },
    Table: { props: z.object({ columns: z.array(z.string()), rows: z.array(z.array(z.string())) }), description: 'Data table (cells are plain strings)' },
    Progress: { props: z.object({ value: z.number() }), description: 'Progress bar 0-100' },
    Icon: { props: z.object({ name: z.string() }), description: 'Icon by lucide name' },
  },
  actions: {},
});
