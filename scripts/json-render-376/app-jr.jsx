// #376 browser bundle: the official @json-render/react Renderer + a shadcn-style registry for jr-catalog.mjs.
// window.JR.render(text, el) -> { ok, error, elements, stateKeys }. text = JSONL SpecStream (json-render's own format).
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { compileSpecStream } from '@json-render/core';
import { defineRegistry, Renderer, StateProvider, ActionProvider, VisibilityProvider } from '@json-render/react';
import { catalog } from './jr-catalog.mjs';

const C = {
  Card: 'bg-card text-card-foreground flex flex-col gap-6 rounded-xl border border-border py-6 px-6 shadow-sm',
  Stack: 'flex gap-4', Grid: 'grid gap-4',
  h1: 'text-4xl font-extrabold tracking-tight', h2: 'text-3xl font-semibold tracking-tight', h3: 'text-2xl font-semibold tracking-tight',
  body: 'leading-7', muted: 'text-sm text-muted-foreground', small: 'text-sm font-medium leading-none',
  Button: 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium',
  'b.default': 'bg-primary text-primary-foreground shadow-xs', 'b.outline': 'border border-border bg-background shadow-xs',
  'b.secondary': 'bg-secondary text-secondary-foreground shadow-xs', 'b.ghost': '', 'b.destructive': 'bg-destructive text-white shadow-xs', 'b.link': 'text-primary underline-offset-4',
  's.default': 'h-9 px-4 py-2', 's.sm': 'h-8 gap-1.5 px-3', 's.lg': 'h-10 px-6',
  Badge: 'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap',
  'g.default': 'border-transparent bg-primary text-primary-foreground', 'g.secondary': 'border-transparent bg-secondary text-secondary-foreground',
  'g.outline': 'border-border text-foreground', 'g.destructive': 'border-transparent bg-destructive text-white',
  Input: 'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs',
  Label: 'text-sm leading-none font-medium',
};
const cx = (...a) => a.filter(Boolean).join(' ');
const { registry } = defineRegistry(catalog, {
  components: {
    Card: ({ props, children }) => <div className={cx(C.Card, props.className)}>{props.title && <div className="font-semibold leading-none">{props.title}</div>}{props.description && <div className="text-sm text-muted-foreground">{props.description}</div>}{children}</div>,
    Stack: ({ props, children }) => <div className={cx(C.Stack, props.direction === 'horizontal' ? 'flex-row items-center' : 'flex-col', props.className)}>{children}</div>,
    Grid: ({ props, children }) => <div className={cx(C.Grid, props.className)} style={props.columns && !/grid-cols/.test(props.className || '') ? { gridTemplateColumns: `repeat(${props.columns}, minmax(0, 1fr))` } : undefined}>{children}</div>,
    Text: ({ props }) => { const v = props.variant || 'body'; const T = /^h\d$/.test(v) ? v : 'p'; return <T className={cx(C[v] || C.body, props.className)}>{props.text}</T>; },
    Button: ({ props, emit }) => <button onClick={() => emit && emit('press')} className={cx(C.Button, C['b.' + (props.variant || 'default')], C['s.' + (props.size || 'default')], props.className)}>{props.label}</button>,
    Badge: ({ props }) => <span className={cx(C.Badge, C['g.' + (props.variant || 'default')])}>{props.text}</span>,
    Input: ({ props }) => <div className="grid gap-2">{props.label && <label className={C.Label}>{props.label}</label>}<input className={C.Input} placeholder={props.placeholder || ''} type={props.type || 'text'} /></div>,
    Switch: ({ props }) => <div className="flex items-center gap-2"><button role="switch" aria-checked={!!props.checked} className={cx('inline-flex h-5 w-9 shrink-0 items-center rounded-full', props.checked ? 'bg-primary' : 'bg-input')}><span className={cx('block size-4 rounded-full bg-background', props.checked ? 'translate-x-4' : 'translate-x-0')} /></button><label className={C.Label}>{props.label}</label></div>,
    Select: ({ props }) => <div className="grid gap-2">{props.label && <label className={C.Label}>{props.label}</label>}<select className={C.Input} defaultValue={props.value || undefined}>{(props.options || []).map((o) => <option key={o}>{o}</option>)}</select></div>,
    Separator: () => <div className="bg-border shrink-0 h-px w-full" />,
    Table: ({ props }) => <table className="w-full caption-bottom text-sm"><thead><tr className="border-b border-border">{(props.columns || []).map((c, i) => <th key={i} className="h-10 px-2 text-left font-medium">{c}</th>)}</tr></thead><tbody>{(props.rows || []).map((r, i) => <tr key={i} className="border-b border-border">{r.map((c, j) => <td key={j} className="p-2">{String(c)}</td>)}</tr>)}</tbody></table>,
    Progress: ({ props }) => <div role="progressbar" aria-valuenow={props.value} className="bg-primary/20 relative h-2 w-full overflow-hidden rounded-full"><div className="bg-primary h-full" style={{ width: `${Math.max(0, Math.min(100, Number(props.value) || 0))}%` }} /></div>,
    Icon: ({ props }) => <span className="inline-flex size-5 items-center justify-center text-muted-foreground" data-icon={props.name} aria-hidden="true">&#9679;</span>,
  },
});

window.JR = {
  parse(text) { return compileSpecStream(text); },
  render(text, el) {
    let spec, error = null;
    try { spec = compileSpecStream(text); } catch (e) { return { ok: false, error: 'parse: ' + e.message }; }
    if (!spec || !spec.root || !spec.elements) return { ok: false, error: 'no root/elements' };
    const v = catalog.validate(spec);
    if (!v.success) error = 'validate: ' + (v.error?.issues || []).slice(0, 3).map((i) => i.path.join('.') + ' ' + i.message).join('; ');
    try {
      const root = createRoot(el);
      flushSync(() => root.render(<StateProvider initialState={spec.state || {}}><VisibilityProvider><ActionProvider handlers={{}}><Renderer spec={spec} registry={registry} /></ActionProvider></VisibilityProvider></StateProvider>));
    } catch (e) { return { ok: false, error: 'render: ' + e.message, validateError: error }; }
    return { ok: true, validateError: error, elements: Object.keys(spec.elements).length };
  },
};
