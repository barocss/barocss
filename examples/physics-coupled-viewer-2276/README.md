# Root execution handoff

AUTHORED_NOT_EXECUTED. Use fresh IDs. Stop on the first unexpected failure. Retain existing receipts and servers.

1. Check AUTHOR-FREEZE-03.json against bytes. Run `node examples/physics-coupled-viewer-2276/build.mjs build-01` with the already pinned Node. This compiles the display bundle only. It imports no Physics or World.
2. If build passes and root authorizes the proposed fresh port, run `node examples/physics-coupled-viewer-2276/scene/server.mjs build-01`. It binds exact localhost53020 and authenticates all sources first. It does not build again.
3. Set PLAYWRIGHT_CLI to the existing installed CLI; run `node examples/physics-coupled-viewer-2276/browser-run.mjs desktop-01 http://127.0.0.1:53020`. No install/download. One browser process contains all three cases and all three widths.
4. If rendering completes, run `node examples/physics-coupled-viewer-2276/audit-browser.mjs desktop-01 audit-01`. This runs unchanged independent observers on actual saved browser data. It never creates Worlds.
5. Report build, desktop GPU, and browser physical-data status separately. Dynamic physics, second interval, wire/restore, Studio, manufacturing, equipment and promotion remain NO_GO/NOT_RUN as applicable.

The author ran only read-only inspection, syntax checks and hash-only freeze work. All execution listed above is NOT_RUN.
