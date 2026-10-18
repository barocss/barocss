# CAD server, concurrent AI + human editing, command-only modelling — where we are (2026-10-18)

Research note from the coordinating session, for the owner's direction decision. No roadmap change is
implied: A5–A8 stay after R14 unless the owner decides otherwise. Sources: a read-only survey of this
worktree at `eb8a49241` (D83) and web research (dates are publication dates; items marked *unverified*
could not be confirmed).

## 1. The goal, in three parts
- **(a) CAD server**: our engine runs as a long-lived service that holds documents, not only inside the studio.
- **(b) Concurrent editing**: several AI agents and people edit the same model at the same time, safely.
- **(c) Command-only modelling**: a part can be made from commands or a script alone, with no editor.

## 2. How others do it
| | Server | Concurrency | Command / code surface | AI |
|---|---|---|---|---|
| **Onshape** (PTC) | Session servers hold each document in memory; geometry servers regenerate (Parasolid + D-Cubed); clients get triangles only ([Lauer 2018](https://www.onshape.com/en/blog/how-does-onshape-really-work)) | Definition (feature list) is the truth, B-rep is a cache; every change an immutable **microversion**; workspaces = branches, versions = tags; edits address features by internal id so an edit made on an older parent applies to the latest; undo = inverse of *your* change on top of latest; merges never block, "from" side wins per dimension, broken features shown red ([Baran 2015](https://www.onshape.com/en/blog/under-the-hood-how-collaboration-works)) | FeatureScript (built-in features are FeatureScript; references are **queries** resolved at regeneration); REST API addressed by w/v/m ids; 2.5k–10k calls/user/year | AI Advisor; **FeatureScript MCP server** (2026-08-13, "text-to-code-to-CAD") |
| **Zoo** (KittyCAD) | Own GPU B-rep engine in the cloud; viewport streamed as WebRTC video | No multi-user; git over `.kcl` text | Batched low-level modelling commands over WebSocket with per-command ids; **KCL** is the one file format GUI, code and prompts all edit | Zookeeper agent writes KCL, checks its work with viewport snapshots |
| **Autodesk** | APS Design Automation runs Fusion etc. as cloud jobs | — | Fusion TypeScript API | **Fusion Compute MCP**: one `execute` tool over the whole API, sessions ≤ 1 h |
| **Rhino.Compute** | Headless HTTP server (Windows only) | — | Grasshopper definitions, RhinoCommon | — |
| **Code-CAD** (CadQuery, build123d, OpenSCAD) | Run headless anywhere | Text/git only | Python / CSG scripts | The usual target of LLM CAD research (CADCodeVerify, CAD-Coder, CAD-Recode, BenchCAD): generate → execute → measure/render → repair |
| **Figma** (contrast, not CAD) | One server process per document | Server-authoritative; last write wins **per property**; client-generated ids; server rejects structural cycles; deliberately neither OT nor CRDT ([Wallace 2019](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/)) | — | — |

Multi-agent CAD papers (2025–2026: requirements/CAD/QA agents; Designer/Modeler/Verifier; ArtiCAD)
take turns on one script. **No one we found has several agents concurrently editing one live model.**

## 3. Where we are
**(c) Command-only — mostly there.**
- `apps/cad-studio/src/engine/evaluate.ts` (`evaluateDoc`, `stepFor`, `stlFor`, `brepsFor`) is pure TypeScript and already runs in Node.
- `server/cadMcp.ts` + `src/chat/tools.ts` expose ~60 tools: `run_command` (any toolbar command), `add_features` (feature JSON), `edit_feature`, queries (`inspect`, `measure`, `mass_properties`, `interference`, `section`, `wall_thickness`, `draft`, `render_views`), requirements (`check_spec`), transactions (`apply_ops`, `checkpoint`, `diff`), proposals, assembly, library, printability, 10 SubD cage tools (D83).
- `packages/barocss-cad` has a code API (`cad.model()…extrude().build()`, `CONCISE_API.md`) and a versioned `CadDocumentV1`.
- `StudioDoc` is versioned JSON (`SCHEMA = 3`, migrations, refuses newer schemas), saved as `.bcad` with SHA-256 blobs.
- Missing: the A5 `run_script` DSL and a stable, versioned command/feature schema contract (`describe_feature`, outputSchema); a CLI/batch runner (script or ops file → `.bcad`/STEP) independent of the chat server; one document model (`StudioDoc` vs `CadDocumentV1`/`CadPartDocument` are separate).

**(a) CAD server — the pieces, not the service.**
- The engine runs headless; `cadMcp` is a per-turn stdio process over a state file, started by `chatServer` (127.0.0.1, origin-checked, single user).
- PERF3 B12's `meshWire` (send only meshes the client lacks, by token) is already the right shape for a server that streams meshes to thin clients.
- Missing: a long-running document service (documents by id, persistence, HTTP/WebSocket), sessions, accounts and permissions, an external MCP entry point (planned in A5).

**(b) Concurrent editing — good foundations, no concurrency control.**
- A1 (D26–D31): stable feature ids `n<k>`, body keys, selectors, signature re-matching — the same idea as Onshape's feature ids plus queries; it is the precondition for several writers.
- A4 (D39–D41): all-or-nothing `apply_ops` with `opId` idempotency, checkpoints, `treeDiff` by id; proposals carry a `base` model hash, `acceptProposal` refuses a stale base, `rebaseProposal` replays ops on the current part; autonomy levels (L2 default; assembly/mates/drawing/locked always need the user).
- Missing: a revision log for direct edits (only proposals carry `base`); merge rules per parameter; live sync to other clients; locks/leases (only in A8 v3 text); the A7 Integrator (patches against a base revision, serial gates).
- **Defect candidate (code reading, not yet run):** a chat turn captures `base` and at `done` commits the agent's whole document (`src/ui/ChatPanel.tsx` ~104–131, `src/App.tsx` ~2035–2043). Edits the user makes while a turn runs would be overwritten (last writer wins on the whole document).

**A5–A8 as written (README:937–965), after R14:** A5 DSL + one tool layer for in-app chat and an external MCP server; A6 inputs (brief template, clarifying policy, reference bodies); A7 multi-agent v1 (Requirements, Designer, Verifier, deterministic Integrator; op patches against a base revision hash through gates; full trace; cost per accepted design); A8 v2/v3 (parallel reviewers, Architect owning `interfaces`, Part agents with leases, ECRs, Assembly/BOM agents). No acceptance criteria or D-records yet.

## 4. Gap table
| Need | Have | Missing | Where it would go |
|---|---|---|---|
| Definition as truth, B-rep as cache | Feature nodes + evaluation memo (A3/B12) | Cache keyed by revision | server design |
| Immutable change history | Undo stack, checkpoints, proposals' `base` | Microversion-style revision log for every edit (human and agent) | new, before A7 |
| Stable addressing | A1 ids, selectors, signatures | Sketch-entity side ids (R10a) | R10a (already planned) |
| Merge rules | Proposal rebase = replay | Per-parameter rule (LWW or "from" wins), structural validation, broken-feature reporting | A7 Integrator |
| Live sync | — | Server-authoritative op stream to clients (Figma/Onshape style), mesh streaming (meshWire fits) | server design |
| One canonical text | Feature JSON, `cad.model()` API | `run_script` DSL and its versioned schema; unify `StudioDoc`/`CadDocumentV1` | A5 |
| Headless entry | Node `evaluateDoc`, per-turn `cadMcp` | CLI runner; external MCP server; document service | A5 + server |
| Safety | Autonomy levels, `needs_approval`, origin check | Accounts, roles, permissions | server design |

## 5. Recommended shape (when we build it)
1. **Server-authoritative operation log** keyed by stable feature id (our A1 ids), with an immutable revision per change; B-rep/meshes are caches tagged by revision. Regenerate on the server so clients never need bit-identical kernels (Onshape's choice; Zoo streams video).
2. **Merge = rebase + regenerate**: last-write-wins per parameter, structural checks on the server, never block; features broken by a merge are reported with a typed reason (our "typed refusal" rule) and an owner to repair.
3. **Agents keep proposing, people keep editing directly** (our A4/L2 rules); agent patches go through the A7 Integrator's gates against a base revision.
4. **One canonical text** (A5 DSL) that the GUI, people and agents all produce; feature JSON stays the wire format.
5. **One MCP tool layer** for in-app chat and external clients (A5), plus a CLI runner for batch/CI.
6. Measure regeneration cost per op and keep incremental regeneration (PERF3 already gives the benches).

## 6. Options for the owner (order unchanged unless chosen)
- **0. Keep the order.** A5–A8 after R14; record this note as the design input for A5/A7.
- **1. Small contained items now** (fit the "fix now if contained" policy, no reorder):
  - confirm and fix the chat-turn overwrite (merge the agent's ops onto the current document, or refuse/re-propose when the user edited during the turn);
  - give direct edits a revision id / base like proposals (a microversion-lite log), so A7 has something to stand on.
- **2. Pull A5 forward** (DSL + external MCP + CLI runner) before R9, since (c) is closest and unblocks external agents.
- **3. Add a "server" track** (document service, op stream, accounts) before A7.

## 7. Could not verify
Where KCL executes; how Onshape handles two users editing the same feature at the same instant; Onshape's
persistent-naming internals; the exact Fusion Compute MCP announcement date; current Design Automation credit rates.
