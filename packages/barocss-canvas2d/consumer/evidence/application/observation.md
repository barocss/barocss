# Application native observation — #1037

Exact parent: `ab81aacade3def44e1736ab0b935a8f6b72278ae`.
Date: 2026-10-09. This is a native functional receipt. Integration and publication remain separate.

## Executed checks

- Node 22.22.0 affected library build: **206.9 KiB**, passed after correcting three initial TypeScript errors in the new module.
- Existing strict consumer checkJs, including `application.mjs`: passed after two nullable fixture captures were corrected.
- Strict public compiled-root declaration consumer `types.mts`: passed. No installed-package claim.
- `node probe.mjs`: inert compiled-root import, 19 pre-context refusals and two null-context construction failures passed. Accessor bodies and GPU/context work did not run for early refusals. Node cannot observe private ticker disposal after the null-context failure; the JSON records that limit.
- Actual HeadlessChrome 155 / WebGL2 / DPR2: 15 control stages passed. Red `[255,0,0,255]` Sprite and gray `[51,51,51,255]` background pixels agreed with accepted hit IDs. One real mouse click reached Moving then stage.
- First/resume delta 0, elapsed 1000 with delta 100, priority order and equal-priority registration order passed. A raw ticker listener at −100 ran after automatic rendering. An instrumented actual renderer received exactly two render calls for two successful batches.
- Stop during an update completed the current batch and render, without another frame request. Dispose during the first update aborted later updates and rendering.
- A missing asset rejected Scene admission with `INVALID_ASSET`: old accepted pixels/hits remained, while the successful tree mutation remained visible in the CPU tree. Registration and explicit restart repaired it. A deliberate update error stopped scheduling and propagated the identical error object; explicit unsubscribe/restart recovered.
- Calling app.render inside onUpdate returned `INVALID_SCENE`. Canceled callbacks replayed after stop and dispose made no new updates/renders. Dispose removed host fixture listeners, update/raw/pointer subscriptions. Post-dispose app/renderer/ticker methods returned `DISPOSED`; CPU tree handles remained editable.
- Actual WebGL2 construction with an injected synchronous scheduler failed with `INVALID_SCENE` and cleaned allocated handles/listeners. Injected cancel failure propagated the same error, called cancellation once, and still disposed ticker/renderer. Both checks created/deleted 3 buffers, 2 VAOs, 2 programs and 4 shaders; remaining tracked handles and context listeners were zero. This measures handles, not GPU memory.
- Internal render consumes one of the existing 128 ticker listener slots: 127 application listeners succeeded, the next returned `SCENE_LIMIT`. Invalid function/priority inputs were refused. Add/unsubscribe during a batch produced `A,B,A,C` over two batches.
- Browser console: zero errors and zero warnings. Screenshot inspected.

## Reproduction

Serve this worktree with the existing `examples/canvas2d-scene/server.mjs`, then open `/packages/barocss-canvas2d/consumer/application.html` using Playwright CLI. `browser-flow.playwright.js` and `lifetime-check.playwright.js` are run-code function inputs. They require this actual page and WebGL2; they are not Node mocks. Saved JSON contains observations from the executed runs.

The scheduler is controlled and deferred. This is not browser RAF performance evidence. No broad probe campaign, pack/install, document/PNG campaign or release gate was run for this feature. Canvas DOM/file/native-capture policy remains host-owned. Only rejected Scene admission retains the old accepted display; the Application does not roll back callback tree, asset or view mutations.
