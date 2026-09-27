# #446 multi-turn UI experiment: offline contract and preflight

This directory is research only. It defines a frozen replay contract and checks whether the official renderer and browser dependencies are available locally. It does **not** implement a replacement renderer, produce a visual score, or call a model.

## Evidence and versions

| Source | Pinned evidence | Relevant responsibility |
| --- | --- | --- |
| Prior BaroCSS study | [`../json-render-376/NOTES.md`](../json-render-376/NOTES.md), frozen `result.json`; `@json-render/core` and `@json-render/react` 0.21.0, React 19, A2UI React 0.11.1 / web core 0.11.0 | One output per format/model/request, no repeated edits. Its scratch installs are absent in this worktree. |
| Current json-render | [official React guide at `c2600d7`](https://github.com/vercel-labs/json-render/blob/c2600d73908ed505e6d726f5b6f969ba8f597ce7/skills/react/SKILL.md) | Catalog schema sets allowed components and props. React registry renders them. `useBoundProp` handles two-way state binding; actions are resolved by the provider. A catalog can choose to expose `className`. |
| Current A2UI | [official v1.0 protocol at `ec12ba9`](https://github.com/a2ui-project/a2ui/blob/ec12ba915ab21725929430bd14bcef04e5ee7f12/specification/v1_0/docs/a2ui_protocol.md) | Protocol separates component structure from catalogs and allows custom catalogs. The v0.9 basic catalog limitation measured in #376 is not a protocol-wide styling limit. |
| Current AG-UI | [official client guide at `b8ebd02`](https://github.com/ag-ui-protocol/ag-ui/blob/b8ebd02c84a3a2757990da47aebf7c55b708b1ef/docs/quickstart/clients.mdx) and [event reference](https://github.com/ag-ui-protocol/ag-ui/blob/b8ebd02c84a3a2757990da47aebf7c55b708b1ef/docs/concepts/events.mdx) | Agent/frontend event transport and state synchronization. It does not define the CSS runtime or a required renderer. |
| BaroCSS | `@barocss/browser` and `@barocss/kit` local manifests; [`json-render-preload.ts`](../../packages/barocss-browser/src/json-render-preload.ts) | CSS runtime resolves discovered utility tokens. The existing preload helper scans literal `className` values from json-render elements and calls `runtime.addClass`. It does not render components or preserve form state. |

Upstream commits were read on 2026-09-27. The offline preflight records the **installed** versions separately from the local package manifests. A missing installed version is `null`, not an assumed version. The current v1.0 A2UI protocol and current json-render React guide are capability references; this experiment does not run them without their official packages.

## Frozen comparison

`contract.mjs` defines three scenarios: account settings, sales dashboard, and coffee order. Each scenario has one stable component identity set, content, initial values, user edit, focus target, and action. All arms share these semantics, the host, theme and viewport sequence. The fourth stage adds exactly one help Text node. The responsive stage changes a desktop Chromium viewport from 1280 to 390 pixels; it is not a mobile-device test.

The three planned catalog styling arms are:

1. **Fixed:** catalog-owned variants only.
2. **Bounded:** catalog-owned density, columns and placement props.
3. **Utility:** catalog admits a model-selected `className`, with BaroCSS resolving tokens.

**Build** is a matched control for the utility arm: the same component tree and classes with a CSS build whose inventory is frozen before the replay. It is not a fourth AI UI renderer. The offline contract covers 3 scenarios × 4 arms × 4 stages = 48 cells. It does not assume an arm can express an edit simply because the contract names a styling knob; that requires a rendered result and computed style.

## Measurement and attribution rules

For each stage, a future official-renderer runner must capture schema validity, a stable DOM/component signature, the edited value, focused element, action count, unstyled frame count, theme adherence, host style delta, and a screenshot. `null` means unmeasured. Unavailable/unsupported cells remain in the denominator and are never passes.

- **Renderer/state failure:** the validated spec fails to mount, the expected DOM node is absent, or the edited value, focus or action changes before CSS comparison.
- **Styling failure:** DOM/state/action remain correct, but computed style, stylesheet insertion, theme tokens or layout violate the expected style contract.
- **Mixed/unknown:** both paths fail, timing is insufficient to assign cause, or an official dependency is missing.

The frame metric needs `requestAnimationFrame` sampling from edit submission until the final style is applied. A screenshot alone cannot prove that no unstyled frame occurred. Host impact must compare computed host element styles before and after each stage. The control must use the same base CSS, component registry and semantic tree so a renderer change is not misattributed to BaroCSS.

## Offline verification

Use Node.js 22.22.0 or later from this worktree:

```sh
node --test scripts/json-render-446/contract.test.mjs
node scripts/json-render-446/check.mjs --write
git diff --exit-code -- scripts/json-render-446/offline-preflight.json
```

Optional `JR_ROOT` and `PW_DIR` point to directories containing `node_modules` for the official renderer and Playwright; omitting them checks this worktree only. The generated [`offline-preflight.json`](offline-preflight.json) is deterministic for a fixed installed environment. All 48 cells currently have `blocked:official-renderer-unavailable` and null measurements because the official json-render packages, React and Playwright are absent from this worktree. A Playwright package exists in a separate unrelated workspace, but using it alone does not supply the official renderer. No download or paid call was made. The historical #376 outputs remain evidence of their own one-shot runs only.

## Next gate

Run the full browser replay only after an approved, pinned official renderer installation is available in an isolated research directory. Add the exact runner command to #446 before executing it. Until then, the experiment cannot support a recommendation to add a BaroCSS UI layer or a claim about multi-turn model reliability. A later live-model follow-up must freeze prompts and fixtures, use repeated samples from two model tiers, and report tokens, latency, parse/render/state failures and cost estimates before any paid run.
