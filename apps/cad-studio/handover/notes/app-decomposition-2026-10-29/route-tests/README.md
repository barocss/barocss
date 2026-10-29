# D327 route-editor ownership regression preparation

Status: six meaningful tests written; **types/lint/test execution NOT_RUN** pending root serial approval. Only new `test/route-editor-ownership.test.ts` and these notes were changed by this worker. The normal Studio runner discovers `.test.ts` automatically, so no runner/package edit is needed.

The tests render the actual `useRouteBundleEditor` with React `react-dom/server.edge`. They use actual Model `importSource`, geometryOf, copied sweep paths and createRouteBundle from the two literal cubic direct-curve fixture adapted from Model route-bundle.test.ts. No fake hooks or fabricated candidate document is substituted. `open([])` selects the existing real bundle; the initial zero transform lets ref-based actions operate without pretending SSR state setters rerendered the hook.

Only EngineClient preview/evaluate transport is deferred. Typed replies contain successful revision, bodies[] and wallTime0. These are ownership test responses, not geometry/native-worker/numeric acceptance. A known Promise response is released before setImmediate drains its continuation; elapsed time never determines success.

Six cases cover exact normal final handoff once/no early adoption, discard during preview/final, same-value owner reference replacement, blocked preview and command-invalidated final. They assert no late candidate acceptance and no inappropriate later evaluation. The accepting callback mirrors App's discard-then-install seam and preserves exact candidate/result pointer identity. No routePhase/HUD/state-view assertions are made because SSR does not rerender; gizmo/pointer/browser/Kernel behavior remains outside this proof.

No source checksum or mirror-implementation test was added. The note's hash is only an evidence checkpoint, not a correctness oracle. Root owns the later scoped command/types/lint and any actual integration proof; no heavy command, browser, commit or push has run here.
