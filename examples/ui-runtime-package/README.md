# UI Runtime package fixture

This example imports the emitted `@barocss/ui-runtime` JavaScript from
`packages/barocss-ui-runtime/dist`. Its child bundle is **hand authored** and
implements the frozen #1354 bridge. It is not evidence that
`@barocss/ui-compiler` emitted a compatible artifact.

Run with Node 22, a built runtime package and an already installed
`playwright-core` path:

```sh
tsc -p packages/barocss-ui-runtime/tsconfig.json
PLAYWRIGHT_CORE_DIR=/path/to/playwright-core node examples/ui-runtime-package/flow.mjs
```

The flow checks preview interaction, count/name bounds, calculation, same
module state retention, final Save callback, wrong-window rejection, changed
module reset, cancel/error recovery and blocked-script mount cancellation.
It writes `output/report.json` or preserves `output/failure.json`. The server
uses local authored content and makes no model or provider calls. Its resource
policy is a bounded fixture, not a production CSP or hostile-code sandbox.

To compose the actual emitted compiler package, use its own staged public
consumer and authored source. Set `UI_COMPILER_ENTRY` to its emitted-package
consumer file, `UI_COMPILER_SOURCE` to its authored JSX file, and
`COMPOSED_ARTIFACTS` to an ignored output JSON path. Run
`compose-artifacts.mjs`, then `flow.mjs` with the same `COMPOSED_ARTIFACTS`.
This path checks actual compiler bytes through the Runtime controller. It does
not copy or edit the compiler owner's package.
