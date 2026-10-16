# studio-chat — 2026-10-16
Branch claude/studio-chat, commit a479ac15b (on cad-studio tip 061885141). No push.
Shared-file edits to watch when merging: src/App.tsx (imports, chat state, eval-effect selection line, topbar Chat button, <ChatPanel> mount), vite.config.ts (plugins: [chatProxy()]), tsconfig.json (include server/**), test/browser-flow.mjs (step "chat builds a plate through a mocked proxy" before the palette step).
New: src/chat/*, src/ui/ChatPanel.tsx, src/ui/chat.css, server/chatProxy.ts, test/chat.test.ts.
No new dependency: the proxy uses fetch (no @anthropic-ai/sdk, to keep pnpm-lock.yaml untouched).
Verified: pnpm test 84/84, type-check, browser flow 36/36 on WebGPU. Live-key run NOT done (ANTHROPIC_API_KEY unset).
Note: delete_feature exists as a chat tool only (tester U1: no UI delete) — renumbering logic in src/chat/features.ts could back a UI delete.

## Update: claude CLI instead of the API key (user request)
Commit 4ed9dee8b on claude/studio-chat. `pnpm chat` (apps/cad-studio) starts server/chatServer.ts on 127.0.0.1:52021; vite proxies /api/chat there. Each turn: `claude -p --output-format stream-json --tools "" --mcp-config <cad MCP> --strict-mcp-config --model claude-opus-5-5 [--resume <session>]`; the cad MCP server (server/cadMcp.ts) runs src/chat/tools.ts in Node on a state file. server/chatProxy.ts and the browser tool loop were removed; package.json gained a "chat" script (no deps).
Verified: pnpm test 82/82, type-check, flow 36/36 WebGPU (mocked chat server), live CLI turn: 6 tool calls, 18.6 s, 14748 mm³.

## Update: image attachments (commit on claude/studio-chat after 4ed9dee8b)
Attach/paste/drop images in ChatPanel (src/chat/images.ts scales to 1568 px); server sends them via `claude -p --input-format stream-json` on stdin. Tests 83/83, flow 36/36, live drawing run → 38429 mm³.

## Update: character bitmaps → relief or 3D figure (2ec2e0cf9)
src/chat/trace.ts traces attached images in the browser; tools get_image_layers / extrude_image_layer (relief) / inflate_image_layer (smooth-loft 3D body + surface bumps). Kernel limits seen: smooth loft ≤5 sections (V control points ≤16), ≤64 segments per loop; Booleans with lofted bodies are slow (~7 s each) and union of bumps onto the curved body can fail ("touch along an edge"), so bumps stay separate bodies. Tests 86/86, flow 36/36, live cat keychain 34 s, live 3D figure 65 s.

## Backlog: what chat modeling still can't do (reported to coordinator 2026-10-16, user asked to keep for later)
1. Multi-part assemblies via chat — in progress in studio-chat session.
2. Threads, springs, involute gears, helical/freeform surfaces — no kernel features.
3. Booleans with lofted bodies slow (~7 s) and bump-onto-loft unions can fail; figure features stay separate bodies.
4. Smooth loft ≤ 5 sections, ≤ 64 segments per loop.
5. Image → 3D inflates only the front silhouette (no side/back/limbs).
6. Whole-part re-evaluation per tool call; 24-step turn cap.
7. Buildings beyond massing (interiors, BIM, curved facades) out of kernel scope.
8. Tracing tested on one cartoon only; photos/gradients untested.
9. No UI feature delete (chat has delete_feature).

## Update: assemblies by chat (claude/studio-chat, after 1e5165f3f)
Tools add_part / place_part / delete_part / add_mate / edit_mate / delete_mate / get_assembly (src/chat/assembly.ts) + "part" on every part tool. Tests 113/113, flow 41/41, live gearbox (4 parts, 8 mates) 70 s. Backlog item 1 done.
