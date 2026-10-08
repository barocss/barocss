# Issue 659 prototype observation (2026-10-08)

Base: `939d50242fefa9d83d2863c214a285c19f743ea0`. Only `packages/barocss-motion/**` and `examples/motion-scene/**` belong to this task.

## Actual commands and outcomes

- First build: `PATH=/Users/user/.barocss-ai/v3/integration/node_modules/.bin:$PATH pnpm --dir packages/barocss-motion build:library` exited 1 before compilation. The host resolved Node 18.10.0, below pnpm's minimum 18.12.
- Same affected build with `PATH=/Users/user/.nvm/versions/node/v22.22.0/bin:/Users/user/.barocss-ai/v3/integration/node_modules/.bin:$PATH pnpm --dir packages/barocss-motion build:library` exited 0. `tsc` emitted `dist/index.d.ts`; esbuild emitted `dist/index.js` (9.6 KB).
- `/Users/user/.nvm/versions/node/v22.22.0/bin/node examples/motion-scene/probe.mjs` exited 0. It sampled both exact endpoints and midpoint, checked pause/seek/repeat, and rejected a duplicate key time without changing the player's prior state.
- `python3 -m http.server 52119 --bind 127.0.0.1` served the demo at `http://127.0.0.1:52119/examples/motion-scene/`. Playwright CLI opened it in a separate `motion659` Chrome session. After the final reload, console reported 0 errors and 0 warnings.

## Browser observations

- Renderer reported ready; scene object IDs stayed `part-a` and `part-b`.
- Clicking **Midpoint · 2 s** produced `part-a.translation=[-25,10,0]`, `rotation=[0,0,0.7071067811865475,0.7071067811865475]`, `scale=[1.25,0.875,1]`; `part-b.translation=[30,20,0]`, `scale=[0.825,1.2,0.825]`. The actual frame is in [midpoint.png](./midpoint.png).
- In clamp mode, Play advanced from 2 s to the exact 4 s endpoint and paused; `part-a.translation=[25,20,0]`.
- Switching to repeat and playing from 4 s gave a sampled `timeSeconds=1.3859999999999864`, `playing=true`, `mode=repeat`. Pause later returned `timeSeconds=1.8950999999999534`, `playing=false`, with `part-b.translation=[32.36025000000105,18.950999999999535,0]`.

The screenshot and browser observations prove this one local Three.js display consumer. They do not establish native GPU adoption, CAD feature updates, other renderers, broader package validation, or release readiness. Three.js is a pinned CDN import used only by the demo. The core has no Three.js dependency, runtime clock, or renderer mutation. Demo renderer units equal the clip's millimeters; an alternate host must map units and axes explicitly once.
