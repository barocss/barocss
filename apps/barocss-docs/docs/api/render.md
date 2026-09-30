---
title: Experimental renderer API
description: Renderer, validateSpec, classesFor and the five-component screen contract
---

# Experimental renderer API

::: warning Staged first release
`@barocss/render` is not yet published. Use the [local installation and complete example](/guide/render).
:::

```tsx
import { Renderer, validateSpec, classesFor } from '@barocss/render';
import type { ScreenSpec, ComponentRegistry, FormState, ValidationError } from '@barocss/render';
```

## validateSpec(value: unknown)

Returns `{ ok: boolean, errors: { path: string, message: string }[] }`. Validate the **inner screen
object** after parsing JSON or unwrapping a transport response. It is not a type guard, normalized
result or repair function. After success, the host can cast the candidate to `ScreenSpec`.

Only `root` and `elements` are accepted. Root must be a Layout. The graph has 2–32 nodes, each
reachable, with no cycle and exactly one parent per non-root node. IDs match
`[a-z][a-z0-9-]{0,31}`; `props.id` matches the element key. References must exist. Unknown fields,
props and types fail. Text/labels have 1–300 characters. Leaf `children` arrays are empty.

| Component | Required props, in addition to `id` | Other fields |
| --- | --- | --- |
| Layout | `columns`: responsive or single; `gap`: fractional or wide | `children`: node IDs |
| Card | `padding`: fractional or spacious; `tone`: light or dark | `children`: node IDs |
| Text | `text` | Empty children |
| Input | `label`; `value: { "$bindState": "/name" }` | Empty children |
| Button | `label` | Empty children; `on: { "press": { "action": "save" } }` |

## Renderer(props)

`props` includes `spec`, `components`, `state`, `setState`, and `actions`.
It validates the spec again and renders through the supplied `ComponentRegistry`. Invalid data
throws `Invalid spec: PATH`. A missing used component throws `Missing registered component: TYPE`.
The renderer is not an error boundary or last-valid-screen store.

Register ordinary React component functions/classes for Layout, Card, Text, Input and Button.
Object-valued `memo`/`forwardRef` registrations are unsupported. Each component receives `node`,
`state`, `setState`, `children` and `onAction`. The host supplies a callable `actions.save` and
controls form state; default `FormState` is `{ name: string }`. State/action functions are not
runtime-validated. Stable IDs become React keys; retaining ID and position can preserve an input.

## classesFor(node)

For an already validated Layout or Card, returns fixed BaroCSS utility classes corresponding to
the allowed style choices. Other types return an empty string. It is not a validator, and does
not start CSS generation. The host starts [BrowserRuntime](/api/browser-runtime).

## Limits and responsibility

This experimental API is ESM-only, with built TypeScript declarations and React 19.2.3 as an
external peer. Types express shapes, not runtime validity, graph/count rules or matching IDs.
The host owns HTML, state, actions, validation errors, last valid screen, CSS startup, transport,
revision and cancellation policy. JSON cannot supply executable component functions, free HTML,
JavaScript, CSS, arbitrary class names or external URLs. The package calls no model or network.
The authored browser checks demonstrate this narrow form path, not arbitrary UI/model quality.
