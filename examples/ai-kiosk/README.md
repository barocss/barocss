# AI coffee kiosk (example)

Every kiosk screen is written on the fly by Claude Code (`claude -p`) for the current persona, order state,
weather and time of day, and styled instantly in the browser by the BaroCSS runtime. Nobody can build these
Tailwind classes ahead of time: they do not exist until the model writes them.

The shop and menu (`menu.json`, prices in KRW) are fictional. There is no payment, no customer data and no
network beyond `127.0.0.1` and the local `claude` CLI.

## Run

The example uses the prebuilt workspace packages, not npm: the browser runtime from
`packages/barocss-browser/dist` (served as `/vendor/barocss.js`) and the kit from `packages/barocss/dist`
(for the no-op check). Build them first (`pnpm build:library`), or point at another build:
`BARO_BROWSER_DIST=/abs/packages/barocss-browser/dist BARO_KIT=/abs/packages/barocss/dist/index.js`.

```sh
node examples/ai-kiosk/server.mjs                         # real claude -p (your Claude Code login), haiku
KIOSK_MODEL=sonnet node examples/ai-kiosk/server.mjs      # haiku | sonnet | opus
KIOSK_GENERATOR=stub node examples/ai-kiosk/server.mjs    # canned HTML, no CLI
# open http://127.0.0.1:8510/   (PORT=... to change; always bound to 127.0.0.1)
```

The left pane is the kiosk; the toolbar switches persona (senior, busy regular, family with kids, foreign
visitor), weather and time, and "Regenerate" asks for a different layout of the same step. The dev panel shows
the step, generation time, what the sanitiser removed, and the #426 no-op check: class tokens for which BaroCSS
generates no CSS (should be 0).

Tests (stub generator, no CLI): `node --test examples/ai-kiosk/test/kiosk.test.mjs`.

## Recording (real model)

```sh
node examples/ai-kiosk/record.mjs                  # all 4 personas; or: record.mjs senior family
```

It drives one full order per persona (start, persona, menu, options, cart, regenerate, pay, done) through the
real server and writes `recordings/<persona>.json`: each screen's prompt, raw model HTML, sanitised HTML,
sanitiser removals, unstyled tokens and timings. It exits non-zero if an order does not complete. About 12
`claude -p` calls per persona. `KIOSK_GENERATOR=stub` dry-runs the script and writes `<persona>.stub.json`.

## Model and latency

One screen is one `claude -p` call, so a screen takes the CLI start-up plus one generation: expect a few
seconds with haiku and noticeably longer with sonnet/opus (the recordings hold the measured times). The loading
overlay covers the wait. The timeout is 120 s (`KIOSK_TIMEOUT_MS`), output is capped at 512 KB.

## Safety model

- **The model only renders.** The server owns the order state (`lib/order.mjs`); prices, line totals and the
  cart total are computed from `menu.json` and handed to the model as FACTS. The model's HTML never feeds back
  into state: only a click on an allowed `data-action` does, and the server re-validates it.
- **Spawn.** `child_process.spawn('claude', ['-p', '--model', MODEL, '--output-format', 'json'], { shell: false })`
  with a frozen argv; `MODEL` must be one of `haiku|sonnet|opus` at start-up. The prompt goes over stdin, never
  argv. Timeout (SIGKILL), output-size cap, non-zero exit and `is_error` results are rejected. `cwd` is the OS
  temp dir.
- **Sanitiser** (`lib/sanitize.mjs`, no dependencies, used by the server and again in the browser before
  `innerHTML`). It tokenizes and re-serialises; nothing is passed through. Allowed: a fixed set of layout/text
  tags and only the attributes `class`, `data-action`, `data-item`, `data-option`. `script`, `style`, `iframe`,
  `object`, `embed`, `svg`, `math`, `template`, `form`, `link`, `meta` and similar are dropped with their
  content; other unknown tags are unwrapped. Every `on*`, `style`, `href`, `src` and other URL-bearing attribute
  is dropped (no URL attribute is allowed at all, so no images). `data-action` must be in the contract
  (`lib/contract.mjs`), `data-item` must be a menu id, `data-option` a short plain token. Comments, doctypes,
  unterminated tags and quotes are dropped; text and attribute values are re-escaped.
- **Client.** Event delegation on `[data-action]` inside the stage, checked against the same contract; the
  model's HTML carries no scripts. The page is served with a CSP (`script-src 'self'`, `object-src 'none'`,
  `form-action 'none'`).
- **Static files.** An explicit allowlist of example files plus `/vendor/barocss.js`, each resolved with a
  path-traversal check.
- **Classes.** BaroCSS's usual handling of untrusted class names applies.
