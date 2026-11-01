---
work_id: D415
artifact_type: qualification
status: done
owner_role: executor
source_request: Owner U3 generic UI icons to Lucide
last_updated: 2026-11-01
---

# D415 — Generic Studio icons use bundled SVGs

Bounded-qualified, feature tier. GPT-6.1 Sol Medium implementation and one independent source/gallery/actual-image audit. [Commands/counts](qualification.json).

## Change and dependency

The owner explicitly approved Lucide 1.52.0 download/install. Standard pinned add passed; registry resolution reused cached package payloads (pnpm downloaded counter 0). Only the Studio manifest adds one line and the lockfile adds 18 lines. ISC package, compatible with existing React19.2.3 and optional @types/react19.3.0. No unrelated dependency, core package, API or schema changes. This permission covers this package only.

An AST inventory corrected the older ~46 estimate: 88 semantic names, including retained command/history fallbacks, with 30 dynamic expressions traced. An explicit registry uses 87 named Lucide imports. Generic icons are decorative currentColor SVGs, 19 px normal/16 px small. Unknown/prototype keys produce an empty aria-hidden diagnostic rather than raw names or an unrelated glyph; all current used names are covered.

Material Symbols is removed from the combined Google URL and the `.ms` font path is removed. Existing IBM Sans/Mono families and preconnect remain. Three collapse selectors and status colors use the SVG class. No label, action, ID or keyboard changes. The old broad-flow warning-text strip is removed because decorative SVGs have no text; that broad flow was not rerun.

The existing early CAD branch and all 100 drawn icons remain unchanged. Source SHA matches HEAD; 100 normal/small direct-render delegation controls pass. This is preservation evidence, not a universal recognition study.

## PASS

- Seven focused tests (five UI + two existing command-icon), post-final-test Model types, Studio production build/types after the final size fix, scoped lint/syntax/diff.
- Static imports and sampled bundle markers confirm selected icons present and unused library sentinels absent. No before/after bundle-size or speed claim.
- Four final dark/light galleries, 20/48 px, 352 SVGs; physical sizes correct, zero HTTP requests, resources closed. Initial gallery remains separately retained.
- One independent audit accepts source, all four final galleries, targeted size-fix confirmation and all five actual captures. Root reviewed two gallery pages and two actual images.
- Actual run01: seven states (main, palette, parameters, history, sketch, drawing, chat); zero missing icons/raw glyph spans/Material links. Physical SVG rects are 19/16, including real shadcn Finish sketch19/Delete parameter16 controls. Keyboard palette/arrows/Escape, menu/parameters close, sketch cancel, drawing and chat open/close preserve the exact native document. Existing Box CAD control remains correct.
- 303 frozen files unchanged; zero page/console errors/source changes/downloads. Material requests0, font assets0; the retained IBM stylesheet was locally fulfilled empty once. All owned context/browser/server resources closed and gate released.

## FAIL/history and limits

No unexpected functional or actual-run failure. A package.json lookup initially missed the correctly hoisted package; root resolution confirmed it inside this worktree. A declaration-only alias precheck reported five legacy aliases, while actual exports, types and build pass.

Before actual execution, source inspection found an existing shadcn SVG14px utility could shrink the new icons. Inline19/16 dimensions fix only the generic branch; contact-gallery overrides are test-only. This was not an actual failed run. The same audit confirmed the correction, and actual bounding boxes prove the final sizes.

Build/install logs retain observed peer, use-client and ineffective-dynamic-import warnings. They are not functional failures; no blanket claim compares them with an unrun baseline.

Apply/Save/export/download/Chat Send/paid calls, every UI combination, universal unlabeled recognition, full baseline suites, CI and release are NOT_RUN. Unchanged public API/library-docs checks retain D414 evidence. No full Taste Skill install/scripts/pipeline was run; the owner's earlier roadmap fallback remains.

Scoped GitHub Lucide/icon-title searches found older cad-editor/shared-integration items with different paths, not a dedicated Studio U3 issue. None closed. U3 and the registered U1–U4 profiles are now bounded-closed; broader row15 usability remains open. Next D416 assesses the registered non-dual short-dimension arrow-clearance follow-up. Existing production/motion/external-SDK holds remain.

Raw evidence only: `/tmp/barocss-d415-checks`, `/tmp/barocss-d415-gallery`, `/tmp/barocss-d415-gallery-final`, `/tmp/barocss-d415-browser-run01`, `/tmp/barocss-d415-capsule`. No logs, pictures or generated HTML are committed. OCP remains removed.
