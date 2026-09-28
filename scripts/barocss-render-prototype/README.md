# #459 local renderer comparison

This is an authored, one-screen research comparison. The private `@barocss/render` implementation lives in [`packages/barocss-render/`](../../packages/barocss-render/); this directory contains the demo, the official json-render adapter, fixtures, browser checks and evidence. It does not call Codex, Claude, or the OpenAI API.

## Run locally

Reuse the owner-approved #446 install and the existing matching Playwright/Chromium pair. These paths are the assets used for the checked-in evidence on this host; change them if those assets move. No dependency or browser download is needed.

```sh
export JR_ROOT=/Users/user/.barocss-ai/v3/wt/issue-446/scripts/json-render-446/scratch/jr
export PW_DIR=/Users/user/github/ai-based/abs/node_modules/.pnpm/playwright-core@1.60.0/node_modules/playwright-core
export REPO_DEPS_ROOT=/Users/user/.barocss-ai/v3/integration
export RESULT_DIR="$PWD/scripts/barocss-render-prototype/evidence"
NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node

"$NODE" scripts/barocss-render-prototype/serve.mjs
# Open the printed 127.0.0.1 URL. Use both forms, Apply authored edit, and Apply JSON.
"$NODE" --test scripts/barocss-render-prototype/*.test.mjs
"$NODE" scripts/barocss-render-prototype/accounting.mjs --write
```

The server binds only `127.0.0.1`. It serves fixed local assets and makes no external request. `PORT` can choose a local port; the default is an ephemeral port. The page shows both implementations in same-origin frames. Its text area accepts JSON data only. Invalid JSON, unknown nodes/props/styles/actions, free HTML and arbitrary class names are rejected with field paths; the last valid DOM and state remain visible. The fixture adds a help Text, changes gap from 10 to 14 px, card padding from 14 to 22 px, and theme from white to slate. Both forms retain the edited value and focus. At a 390 px viewport, the layout has one column; at 1200 px it has two.

## Evidence and limits

`evidence/result.json` records 2 arms, 8 invalid-update probes, the browser dashboard flow, computed styles, values, focus, actions, dependency versions and the BaroCSS bundle SHA-256. Seven screenshots show the three screen stages in both arms and the dashboard. The paired arm screenshots are byte-identical for the initial, edited and narrow stages in the tested Chromium. The checks assert these facts; they do not measure runtime speed, model success, or broad design quality. The approved dependencies are json-render core/react 0.21.0, React/React DOM 19.2.3, Zod 4.3.6, Playwright Core 1.60.0, Chromium 148.0.7778.96, esbuild 0.25.12, BaroCSS kit/browser 0.11.2 and Node 22.19.0.

Supported here: the five registered components, one named form binding, save action, fractional spacing, responsive one/two-column layout and two theme tones. Unsupported here: arbitrary HTML/JS/CSS, unregistered components, arbitrary class names, external URLs, other actions and data bindings. These unsupported cases are policy rejections, not rendering failures. The screen is authored, not generated. #458 still has no successful real Codex JSON output. `serve.mjs --capture /absolute/path/to/saved.json` can load a saved JSON spec or a `{ "specJson": "..." }` envelope after strict validation, and exposes it to the page's Load saved CLI JSON button. It does not run a CLI or model. A future #460 session controller must supply actual generated screens, handle action/state handoff and stale results, and obtain its own live-run authority.

## Integration-code accounting and decision

`accounting.mjs` counts nonblank, noncomment physical source lines from explicit paths; it excludes manifests, docs, evidence and installed dependency code. It writes `evidence/accounting.json` with `--write`. At the complete passing run, the prototype application adapter had 18 lines and the official json-render application adapter had 40. The private renderer core had 16 lines; the 82-line strict validation policy is shared by both arms even though its source lives in the private package. Shared application components had 27, shared browser/server harness 146, authored fixture 19, and verification 209. The two adapters use the same visual components and authored spec. Line count is a narrow integration-code measure, not development time, total dependency size or a speed result. The prototype shifts some work into its core; the official renderer already supplies state binding and actions.

**Decision for this bounded screen:** a thin, strict app adapter around existing json-render plus BaroCSS is sufficient here. Keep the owner-directed `@barocss/render` package private and use it as a candidate in #460's actual generated multi-screen flow. This one authored screen does not settle that later choice or justify publishing a package.
