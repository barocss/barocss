# E-005 — blocked at the self-test (step 1), no agent runs

Target: `apps/barocss-site` unchanged (`baroStart({config:{preflight:true}})`). Arm D = `vite` dev on 127.0.0.1:5190,
arm P = `vite build` + `vite preview` on 127.0.0.1:5180. Chromium's only network path is `env.mjs`'s proxy (app origin
only, `--proxy-bypass-list=<-loopback>`); the self-test shows the CDN import, external fetch and other localhost ports are refused.

Rerun (repo root, after `pnpm install`; `PW_MCP_DIR` = dir with `node_modules/@playwright/mcp` 0.0.76):
`node .ai/evidence/E-005/grader-selftest.mjs` → `selftest.json` (exit 1: 17/18 expectations pass).

Files: `grader.js` is E-004's with only the snapshotted elements changed (target = hero `a[href="#demo"]` "Live Demo";
both other hero links, Install and GitHub; the navbar logo mark; hero h1; body). `grader-selftest.mjs` is E-004's adapted to
arms D/P plus the network-guard check. The runner was not adapted: the stop rule fired first.

## Failing gating expectation

"arm D positive control: page module URL getRuntime().updateConfig theme.extend passes Y1 with no regression": FAIL.

- Discovery works. The served inline module imports
  `/@fs/…/packages/barocss-browser/src/index.ts`, and `import()` of that exact URL returns baroStart's module:
  `getRuntime()` is the page runtime (`identity.sameModuleSameRuntime: true`, no new style elements).
- `getRuntime().updateConfig({theme:{extend:{colors:{brand:'#5B21B6'}}}})` produces `.bg-brand { background-color:
  rgb(91, 33, 182) }`, and the target passes the class and colour checks. It **regresses** `heroInstall.color` and
  `heroGithub.color` from `oklch(0.208 0.042 265.755)` to `rgb(0, 0, 238)`, the UA link colour.
- Cause (`bareCallEffect`): `updateConfig` replaces the config and does not merge it. `options.config` goes from
  `{"preflight":true}` to `{"theme":{"extend":{…}}}`, and the preflight partition goes from 41 rules to removed.
  `packages/barocss-browser/src/browser-runtime.ts` `updateConfig` sets `this.options.config = newConfig`.
- Shapes that keep the existing config pass Y1 with no regression, both adding the class and replacing `bg-blue-600`:
  `updateConfig({...r.options.config, theme:{extend}})` and `updateConfig({preflight:true, theme:{extend}})`.
  E-004's A1 used the spread shape. The fixtures had no preflight, so the bare shape passed there.
- A second module instance (`?e005=1`) with the bare shape also regresses the same two properties.

## Arm P (gating expectations all pass; route recorded, not gated)

No BaroCSS route was found. There is no global with `updateConfig`, and the bundle `assets/index-*.js` has no exports.
The page runtime's style elements are present.
