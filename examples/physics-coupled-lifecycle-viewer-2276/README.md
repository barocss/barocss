# Root execution handoff

AUTHORED_NOT_EXECUTED. No build, World, browser, decoder or observer has run for this new consumer.

1. Verify AUTHOR-FREEZE-01.json. Run `node examples/physics-coupled-lifecycle-viewer-2276/build.mjs build-01` with pinned installed Node. It bundles the unchanged old UI only.
2. After build PASS and root's exact fresh port authorization, run `node examples/physics-coupled-lifecycle-viewer-2276/scene/server.mjs build-01`. It serves new actual lifecycle emitted ESM at exact53040. It does not rebuild.
3. Set PLAYWRIGHT_CLI to the already pinned installed CLI. Run `node examples/physics-coupled-lifecycle-viewer-2276/browser-run.mjs desktop-01 http://127.0.0.1:53040`.
4. After desktop7/7 PASS, run `node examples/physics-coupled-lifecycle-viewer-2276/audit-browser.mjs desktop-01 audit-01`. It audits original actual browser full DAG and report, then unchanged15 independent physical observers. It creates no World.

Report build, desktop GPU/lifecycle7checks, actual raw lifecycle data audit and15physical observers separately. Whole dynamic P03 remains NO_GO. Browser cleared storage/getter checks are NOT_RUN. Stop at first failure; preserve failure and later NOT_RUN. Existing53020/53001 leases are unrelated and must remain untouched. No packaging yet.
