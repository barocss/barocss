# Independent Fetch consumer for @barocss/render-stream

This authored Node HTTP host imports the emitted `@barocss/render-stream/fetch` and `/protocol` package exports from published-style local manifests. It does not import research example files, source aliases, or a model provider. The browser bundle imports the emitted protocol export and public `@barocss/render` validation/classes.

## Run

Use Node 22 and already installed dependencies. The commands below do not download packages. In an isolated checkout, link an existing ignored `node_modules` directory and the local kit dependency for the affected builds.

```sh
pnpm --dir packages/barocss build
pnpm --dir packages/barocss-server build
pnpm --dir packages/barocss-render build
pnpm --dir packages/barocss-render-stream build
node examples/render-stream-package/stage.mjs
node_modules/.bin/tsc -p examples/render-stream-package/tsconfig.json
PLAYWRIGHT_CORE_DIR=/path/to/installed/playwright-core node examples/render-stream-package/flow.mjs
```

`stage.mjs` copies actual `dist` files and public published export maps into ignored `.build/node_modules`. The browser and host resolve the package names from that staged tree. `output/` holds the report and two browser screenshots.

## Native result on 2026-10-11

- Exact local Integration parent: `be10f2ecca04800b0d344dc93a855e74d04fc305`.
- Affected kit, server, render, and new stream package builds passed with Node 22.19.0.
- Staged public ESM imports passed. The focused Chrome 155.0.8059.39 flow passed with no page errors or external requests and zero model calls.
- Demand control: source factory calls 0 before a read, then 1; the first response read advanced exactly 5 input records. Cancellation aborted the owned signal and invoked the iterator return path once.
- The browser saw a styled grid preview at source record 5/10 while `sourceComplete=false`. Save was unavailable then. Normal EOF admitted the final snapshot and allowed one Save; a duplicate Save returned 409.
- Cancellation restored accepted screen/CSS and the typed input. An invalid tail after a proposed commit failed with no new admission and preserved the same screen/CSS/input. Save remained disabled after both failures.
- The first declaration check failed because the leased root dependencies exposed conflicting ambient `css-font-loading-module` types. `types: []` in this example's `tsconfig.json` limits ambient types while keeping imported React declarations visible; the rerun passed.

This is one local authored browser flow. It proves package import, scoped transport behavior and visible preview ordering. It does not measure model latency, physical paint timing, durable storage, production authentication or publication readiness. The host keeps its token, current-run check and once-only Save authority. An asynchronous durable `acceptFinal` implementation needs its own atomic transaction; the adapter cannot undo callback side effects after cancellation.
