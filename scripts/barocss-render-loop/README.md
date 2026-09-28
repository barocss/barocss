# #460 local UI loop: deterministic stage

This directory connects the private [`@barocss/render`](../../packages/barocss-render/) prototype to a loopback browser session. The current start command uses authored mock screens. It does not invoke Codex, another model, or an API. Live generation and a resumed Codex turn remain separate work under #460's review and launch boundary.

## Run the authored mock

Reuse the installed local assets from #459; do not download another browser or dependency for this stage.

```sh
export JR_ROOT=/Users/user/.barocss-ai/v3/wt/issue-446/scripts/json-render-446/scratch/jr
export PW_DIR=/Users/user/github/ai-based/abs/node_modules/.pnpm/playwright-core@1.60.0/node_modules/playwright-core
export REPO_DEPS_ROOT=/Users/user/.barocss-ai/v3/integration
NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node

"$NODE" scripts/barocss-render-loop/serve.mjs
# Open the printed 127.0.0.1 URL. Generate, enter a name, then Save profile.
"$NODE" --test scripts/barocss-render-loop/*.test.mjs
```

The server starts in `authored-mock` mode. It returns the authored #459 form, then a confirmation screen containing the entered name. Both complete JSON responses pass `validateSpec` before the browser sees them. Updates are **per complete response**, not per node or patch. The browser measures first visible screen and action-to-next-screen times locally, with one sample per screen in the test. These mock timings are not model latency.

## State and action boundary

The server owns the screen revision, one session ID, the accepted spec, and the pending generation. `save` is the only accepted action. Its payload has one `name` string of 1–80 characters and the current revision. The browser disables the form during a pending action. The server rejects duplicate, stale, malformed, wrong-origin and wrong-token requests before it calls a generation transport. A cancellation aborts that transport and retains the last valid screen and entered name. Restart keeps the revision counter increasing, so an action from an earlier run stays stale.

The browser receives a random session token from the loopback server. POST requests require that token and the exact loopback Origin. The server also checks the Host header, sends no CORS grant, and sets a restrictive CSP. Only fixed local assets are served. The token, browser prompt, and form state never become CLI arguments or filesystem paths. The current `generateMockScreen` function is test data; a future CLI transport must use fixed, independently reviewed arguments and a separate launch decision.

The browser tests cover two authored screens, the action result, invalid requests before generation, input freeze, cancellation, stale result rejection and restart. Controller tests cover malformed output, changed session IDs, duplicate actions and safe error messages. The actual CLI and live evidence acceptance in #460 is still pending.
