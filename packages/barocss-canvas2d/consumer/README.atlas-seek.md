# Named atlas frame seek (#1568)

The SpriteAtlas consumer now exposes Red, Blue and Clear through a labeled
selector. `seekFrame(index)` accepts the three known integer indices, delegates
to the existing public `animation.seek(index)`, then snapshots, updates, renders
and shows the same session. It preserves the controller and ticker's playing
state. Public seek remains the authority for negative-zero rejection; no new
index semantics or timing engine was added.

Every `show` synchronizes the selector from the current Sprite image/crop and
current atlas catalog. An unmatched crop (including the existing manual Gold
crop) displays the disabled **Manual crop** option, even if the controller's
index still says Red. Disposal disables the selector and removes its own change
callback exactly once. Existing controls, diagnostics and tree subscriptions
retain their prior lifetime. Pack, Gold, Save/Open and PNG algorithms are unchanged.

## Focused cloud verification

Cloud publication parent: `9f1f8976f61f2cfb19813a00a7a1071a7fa7c576`.
Original cloud implementation parent: `04c50d60d16712c31a58ff0cc5b24c47db69e2f9`.
The historical native parent `416e6dbc9b8cf900bc9801334dc9d499c47edf48`
and its native proof remain historical. This change uses five of the frozen
nine consumer paths; no private native inputs or old producer proofs are replayed.

Commands (Node 22 / pnpm 9):

- `pnpm --filter @barocss/canvas2d build:library`
- `node node_modules/typescript/bin/tsc -p packages/barocss-canvas2d/consumer/tsconfig.atlas-seek.json`
- `node packages/barocss-canvas2d/consumer/evidence/atlas-seek/browser-flow.js`

Despite its reserved contract filename, `browser-flow.js` is explicitly a
**deterministic software check, not a browser run**. It executes the actual host
functions with the real built public tree/atlas/animation/ticker providers and
instrumented DOM/renderer boundaries. It verifies whole Scene crop-only changes,
identity retention, playing/paused and repeated seek behavior, invalid indices,
actual crop/catalog synchronization and idempotent disposal. The frozen sequence
Start → first 40 ms timestamp (delta 0) → 20 ms Red → seek Blue → 40 ms Blue →
20 ms Clear passes, including five scheduler requests and one final cancellation.
These are software observations, not native frame or browser resource counts.

Genuine UI acceptance is **UNRUN**. The cloud preview browser cannot reach the
execution server across command-specific network namespaces. No screenshot,
browser-observations or document-snapshot artifact pretends otherwise. Real
keyboard input, independently read Blue/Clear pixels and hits, Sprite→stage
pointer dispatch, 12 asset-byte retention and actual GL/listener accounting
remain to be measured in the one frozen original-atlas browser flow. The
expected 1 GL / 16 additions / 4 removals / 12 retained callbacks remain hypotheses.
Take the actual screenshot before terminal teardown. Do not replay Pack, Gold,
Save/Open, PNG or old producer acceptance. Full-workspace CI, #1254/#674 integrated
acceptance, held #1032, debt #1451 and release remain separate.
