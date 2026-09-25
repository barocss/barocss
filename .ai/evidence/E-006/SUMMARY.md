# E-006 — colour token on the real site (vite dev), D1–D3

Target: `apps/barocss-site` unchanged (`baroStart({config:{preflight:true}})`), `vite` dev on 127.0.0.1:5190. Chromium's only
network path is `env.mjs`'s proxy (app origin only). Actor: headless `claude -p`, `claude-opus-4-8[1m]`, CLI 2.1.173,
Playwright MCP 0.0.76 only (`--tools ""`), fresh context and empty cwd per run. The prompt is E-004's word for word, and the
task is E-005's Y1 (see `runs/*.json` → `prompt`).

Rerun (repo root, after `pnpm install && pnpm build:library`; `PW_MCP_DIR` = dir with `node_modules/@playwright/mcp` 0.0.76):
- self-test: `node .ai/evidence/E-006/grader-selftest.mjs` → `selftest.json` (exit 0, 11/11)
- runs: `node .ai/evidence/E-006/run.mjs D1` (`D2`, `D3`) → `runs/<label>.json`

Files: `grader.js` and `env.mjs` are E-005's, unchanged. `grader-selftest.mjs` is E-005's with arm P dropped. Its positive
control is `updateConfig({...getRuntime().options.config, theme.extend})` + `bg-brand`, which passes with no regression. Its
negative control is the bare `updateConfig({theme.extend})` + `bg-brand`, which fails on regression only: heroInstall.color
and heroGithub.color change, while the class and colour checks pass. `run.mjs` is E-004's, pointed at the dev server through
the proxy, with post-run page facts added. All of these were committed in d180f8a, before any agent run.

## Runs

| Run | Read updateConfig source (call #) | Config object passed (only call) | Verify | Claim | Grader Y1 | Agree | Turns / cost |
|-----|-----------------------------------|----------------------------------|--------|-------|-----------|-------|--------------|
| D1 | `rt.updateConfig.toString()` (#6) | #7 deep `Object.assign({}, rt.options.config, {theme:{extend:{colors:{brand}}}})` → `{preflight:true, theme:{extend:{colors:{brand}}}}` | `getCss('bg-brand')`, computed bg, screenshot | done | PASS, 0 regressions | yes | 14 / $0.49 |
| D2 | fetched `browser-runtime.ts` source from `/@fs` (#10); also `baro-boot.ts`, `context.ts` | #11 deep spread of `runtime.options.config` → same object | probe `div.bg-brand` computed bg, target computed bg, element screenshot | done | PASS, 0 regressions | yes | 16 / $0.72 |
| D3 | `rt.updateConfig.toString()` + `options.config` (#9) | #10 literal `{preflight:true, theme:{extend:{colors:{brand}}}}` (+ `addClass(['bg-brand'])`) | `getCss`, computed bg, screenshot, console errors | done | PASS, 0 regressions | yes | 17 / $0.52 |

For all three runs:
- Discovery: page scripts → the inline module `index.html?html-proxy&index=0.js` → its `/@fs/…/barocss-browser/src/index.ts`
  import (D2 imported `baro-boot.ts`, the same module graph).
- Route: `getRuntime()`, which is the page runtime. There were no duplicate barocss `<style>` ids, and after the run the
  page-module probe sees the new config and `getCss('bg-brand')`.
- After the run, `options.config` = `{"preflight":true,"theme":{"extend":{"colors":{"brand":"#5B21B6"}}}}` and the preflight
  partition still holds 41 rules, the same as the baseline.
- Target class change: `bg-blue-600` → `bg-brand`.
- Raw-CSS detector: 0 writes and 0 style-attribute changes.
- Refused requests: only Chromium's own Google background traffic. None came from the agent.
- No environment failures and no retries.

No run passed a bare theme object, so the "drop config → notice → recover" path was not exercised. Every run read
`updateConfig`'s source (or `options.config`) before calling it, and preserved `preflight`.
