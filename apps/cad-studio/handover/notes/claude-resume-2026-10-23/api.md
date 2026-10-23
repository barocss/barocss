# API lane brief (2026-10-24, R7)

## Why this lane exists

On 2026-10-24 the owner read the docs and found that the cad, cad-model and gpu APIs are inconsistent. They mix
raw JSON, free functions and object methods.

They decided: "겉 api 는 객체 형태로 가는걸로". The public facade is object-style. The core stays data and functions.

They chose a lane of its own for the facade ("나로 하자"). This is that lane. The roadmap row is R7.

## Role

You own `packages/barocss-cad-model/src/api/**` and its tests, and nothing else.
- You use it as `@barocss/cad-model/api`. cad-model exports every module by its path.
- Work on the branch `claude/api-lane-2026-10-24`, cut from integration (`review/cad-gpu-engine-2026-10-14`), in this
  session's own worktree.
- **Another lane's file needs a change?** Name the file and the change to the coordinator, and don't make it yourself.
  - The kernel lane owns `packages/barocss-cad`.
  - The outer lane owns the rest of cad-model and the studio's panels.
  - The GPU lane owns gpu and the studio's shell.
  - The docs lane owns `apps/library-docs`.
- **Check the facade's coverage with its owners:** part features with the kernel lane, assemblies and the studio
  document with the outer lane. Go through the coordinator.

## The design (R7, owner-approved direction)

- **The core stays as it is: data and functions.**
  - The JSON documents (`CadPartDocument`, `StudioDoc`) remain the source of truth. The agent's v2 tools, A7 merge,
    proposals, undo and history, the worker boundary, save/open and the fingerprints all rely on them.
  - Operations are `verb(doc, options) → result`.
  - R7.3 moves the core to one error shape, `{ code, message, where }`, and turns cad's result methods into
    functions. That's the other lanes' work; follow it as it lands.
- **The facade is yours.** Immutable objects for people and for the docs' samples.
  - Every method returns a new object and never mutates the old one.
  - Every method appends feature nodes to the document and calls the core. It never computes geometry itself.
  - `.doc` always returns the plain JSON document.
  - Results are plain data, such as mass, bounds or a STEP string.
  - Errors are the core's typed refusals, passed through as they are.
  - Selectors are typed: edges and faces filtered, sorted and grouped. No string selectors like CadQuery's ">Z".
- **The agent stays on the JSON tools.** The facade is never a second path for it.

## References: what to take from each, and what to leave

| Library | Take | Leave |
|---|---|---|
| replicad (TS) | the TS ergonomics: how types flow through a chain; the sketcher (`draw().lineTo().arc().close()`, sketch on a plane, `extrude`); finders (`EdgeFinder().inDirection('Z')`) | its OpenCascade/WASM object wrappers (owner rule: own implementation, no WASM) |
| build123d (Python) | the result as data; the selectors (`edges().filter_by(Axis.Z)`, `sort_by`, `group_by`); Plane and Location as objects of their own | operator overloading, which TS lacks: use `.union()` and `.subtract()` |
| Manifold (JS) | immutability, each operation returning a new object | its manual `delete()`, which only WASM needs |
| Onshape FeatureScript | queries that keep pointing at the same face or edge after re-evaluation, which is the same problem as our document's ids and names | its language |
| CadQuery | only how short a chain should read | string selectors |

Read their public docs pages only. Download nothing; the owner hasn't allowed downloads.

## First checkpoint: a design and one vertical slice, for the owner

1. **A design note**, `apps/cad-studio/handover/notes/api-facade-design.md`:
   - the object types (part, sketch, plane/location, selectors, assembly);
   - how each maps onto document nodes and core functions;
   - naming;
   - how ids and names stay stable;
   - error pass-through;
   - what's out of scope.
   - Include a short side-by-side for a bracket built three ways: the raw JSON document, the core functions, and the
     facade.
2. **One working slice** in `src/api/`: a part with a box, a through hole, an edge fillet chosen by a typed selector,
   `.doc`, `.mass(material)` and `.step()`.
   - **The oracle:** the facade's `.doc` equals the hand-written document byte for byte, and its results equal the core
     functions' results on that document byte for byte.
   - Unit tests under cad-model's test folder, named `api-*.test.ts`.
3. **Stop there.** Send the coordinator the note, the slice's SHA and a code sample. The coordinator shows the owner
   before the facade grows.

## Rules (standard)

- Write in English. The owner reads the coordinator's Korean.
- Check every statement against today's source.
- No push or PR. Integration is never amended.
- Git identity is `easylogic <cyberuls@gmail.com>`. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Heavy runs go through barocss-lanes-guard's gate, in the background. Kill only your own PIDs. Use Node 22.
- Give each scratch worktree its own node_modules.
- After the last test edit, run cad-model's `tsc`, since it covers test/.
- No evidence, logs or images in commits. No new dependencies.
- Owner rules:
  - typed refusals;
  - rows rule (b): the agent never writes rows;
  - no standards tables built in;
  - no nested functions in hot paths.
