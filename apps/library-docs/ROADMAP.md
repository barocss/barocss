# Documentation roadmap (W1)

## Current goal and next documentation work (2026-10-25)

Document a connected design and virtual-experiment workflow: define an object, materials, joints, loads,
environment and controls; predict selected outcomes; and compare revisions or controlled measurements within
an explicit experiment profile. Manufacturing remains a delivery track. This goal does not close A9 or P2,
resolve required engineering inputs, or replace recorded FAIL, HOLD or incomplete results.

## Numbered documentation work (2026-10-27)

The order below is the current documentation queue. Each item records its own source and checks.
The site keeps the order CAD, CAD Model, GPU, Studio and Viewer. Existing page URLs and anchors stay valid.

| No. | Work | Completion condition | State |
| --- | --- | --- | --- |
| 01 | Keep integrated CAD, CAD Model, assembly, robot, Viewer, Drawing and shop-row contracts current. | Check public inputs, outputs, units and refusals. Reconcile the latest Viewer and Drawing changes first, then update affected pages or record that no change is needed. | In progress; select the common source. |
| 02 | Validate the current site and navigation. | On the selected source, run the documentation check and site build. Check applicable samples and desktop pages, the nested menu, H2/H3 outline, Studio guides and three saved API figures. | Pending the selected source and execution window. |
| 03 | Expand Studio task guidance. | Follow one part from sketch and feature through parameters and save. Describe inputs, results, refusals and the next action. Use existing images as existing examples; capture a new result before calling it a new run. | Source written; site validation pending. |
| 04 | Audit public API documentation and examples. | Map CAD, CAD Model, GPU and Viewer operations to their documented inputs, outputs, examples and useful result visuals. Record missing cases and do not invent images for non-visual results. | In progress; GPU scene and Viewer control descriptions are written. Other gaps are being mapped. |
| 05 | Make long pages easier to use. | Separate distinct tasks in CAD Model, Object API, Boolean and GPU documentation. Keep old URLs and anchors working, and check links, components and sample imports after each split. | Queued; the new menu is the first step. |
| 06 | Explain PBR data with numeric inputs and results. | Show the material values and linear texture channels, including byte normalization. Distinguish calculated material parameters from rendered pixel values. Add actual map-off and map-on captures when available. | Numeric explanation written; actual captures not run. |
| 07 | Show point-shadow radius results. | Capture the same public scene with radius 0 and 0.4 scene world units. Record the unchanged light, camera and scene inputs, and label the two actual raster results. | Queued; actual capture not run. |
| 08 | Show a guided solid loft from the public API. | Record the two sections and guide controls. Display the returned solid mesh and distinguish annotations from the actual mesh. | Queued; actual API run and capture not run. |
| 09 | Document CAD Model render settings. | Explain the public readRender and shadow-light validator contracts, their refusal boundary and their relationship to the saved light fields. | Source written; final site validation pending. |
| 10 | Improve refusal and recovery guidance. | For common Studio tasks, name a source-supported refusal, identify the input to correct and state which accepted values remain. Link to the detailed contract. | Queued. |
| 11 | Document the experiment input and result contract. | Describe identity, occurrence, revision, units, mass and inertia sources, missing inputs and stale results after the profile owner and contract are confirmed. | Conditional on that contract. |
| 12 | Explain bounded physical experiments. | Document the pendulum only after its supported forward path exists. Distinguish inverse torque calculation from free motion under gravity. Treat structural, thermal, fluid and coupled experiments as separate later profiles. | On hold pending supported inputs and verified behavior. |
| 13 | Finish the frozen 24-case CAD API gallery. | Preserve its six-file source and original failures. Generate and review the 25 expected assets only when its execution is assigned. | On hold; it is separate from the three completed Part API cases. |


The first identified API gaps for item 04 are:

- 04.1: Show a CAD split result, the returned body keys and selection before mass properties. Label expected values separately from actual API results.
- 04.2: Explain CAD Model assembly clearance inputs and the returned map, including pending exact overlap.
- 04.3: Explain the drawing facade result, issues and returned files. Use a returned SVG only after an actual run.
- 04.4: Explain Viewer pointer and keyboard controls, focus and disposal. The source text is written; validate the site.
- 04.5: Explain GPU scene creation and update failures. The source text is written; validate the site.

If an item is waiting for an input, continue with a ready independent item. Record the exact source for each run.

R7/P2 product integration and physical validation remain on hold. Do not infer product acceptance from a
documentation picture, a sample result or a browser check.

Completion requires distinct checks. Text must match source contracts and state limits. API pictures must show
the actual numeric inputs, operation and generated result; a teaching diagram or rendered shape alone does not
prove numerical accuracy. Executable samples must have recorded results for the selected source, and site build,
link and screen checks must cover the changed pages. Source review supplies no new execution PASS. Numerical
verification uses independent references and convergence checks; measured validation needs controlled physical
measurements with stated uncertainty. Neither screenshots nor passing samples replace measured validation.

Structural/FEM, thermal, fluid and coupled physics are long-term planned documentation tracks. This does not
bring the whole Physics package into the site's current reference scope or implement a new solver. Expand the
documentation only after profile ownership, supported inputs and output contracts are fixed. New dependencies,
WASM and Physics package edits need their own decisions. Existing execution holds and frozen gallery assets
remain in force.

## Navigation and Studio guides (2026-10-27)

The main documentation order is CAD, CAD Model, GPU, Studio and Viewer. Introduction, AI agent and Reference
remain separate entries. The public URLs of the existing pages remain unchanged.

Studio has an overview and five task guides: modeling, assemblies and robots, drawings and manufacturing,
display and rendering, and files and projects. Each guide explains the inputs, steps and results, then links to
the detailed controls. The sidebar uses at most three levels, and the page outline includes H2 and H3.

The three fixed Part API examples have saved public meshes and native browser figures. They are separate from
the held 24-case gallery above. Their success does not complete that gallery or establish product acceptance.
The long Model, Object API, Boolean and GPU pages remain candidates for a later split that preserves old anchors.

## Historical planning and checkpoints

The sections below preserve the original W1 plan and reports. Their page counts, sample counts, screenshot
counts, gaps and future-tense steps describe those historical checkpoints, not the current site's measured state.
Use the current section above for new work; retain earlier failures and evidence limits when recording results.

## 진행 상황 (Historical progress, 2026-10-24)

- **페이지.** 32쪽을 모두 썼습니다. "Being written" 표시는 0입니다. 추가하기로 한 Parameters와 Rendering, 그리고
  features의 빈 곳(판금 전개, SubD 케이지 편집, 그림에서 만들기)도 채웠습니다.
- **예제.** 16개의 예제 테스트가 통과합니다(`pnpm test:samples`). 패키지 소스, 실제 `cad-mcp`와 `cad-cli`로 돌아갑니다.
- **코드와 맞추는 확인.** check-docs가 다음이 코드와 다르면 실패합니다.
  - 도구 표와 거부 코드 표(코드에서 생성);
  - .bcad의 모든 필드;
  - cad-model의 모든 모듈 폴더.
- **스크린샷.** G12 최종 레이아웃으로 모두 다시 찍었습니다(36장, 2.7 MB). Parameters·Rendering 스크린샷도 들어갔고,
  에이전트 화면은 브라우저에서 재생한 대본 대화입니다. Getting started는 WebGPU와 WebGL2 모두에서 확인했습니다.
- **남은 일.**
  - 다른 레인 파일에서 찾은 문구 문제(cad-cli usage, cad-model README, 예제 rows의 about)는 코디네이터에게 넘겼습니다.

## 요약 (Historical Korean summary for the owner)

- **대상.** BaroCSS CAD 문서 사이트(`apps/library-docs`)의 범위는 CAD 스택입니다: studio, agent,
  `@barocss/cad`, `@barocss/cad-model`, `@barocss/gpu`.
- **현재 상태.**
  - 30쪽 가운데 15쪽(소개 3쪽, studio 12쪽)을 썼고 통합 브랜치에 병합되었습니다.
  - 남은 15쪽은 agent 4쪽, packages 6쪽, reference 5쪽입니다.
  - 아직 스크린샷이 하나도 없습니다.
- **원칙.**
  - 모든 문장은 오늘의 코드, 테스트, 핸드오버 기록으로 확인할 수 있어야 합니다.
  - 코드 예제는 실제로 돌아가는 테스트에서 가져옵니다.
  - 한계는 숨기지 않고 씁니다.
  - 기억이나 옛 사이트를 근거로 쓰지 않습니다.
- **이미 쓴 페이지의 빈 곳.**
  - O9(리비전과 출처)가 병합되어 concepts, files, drawings에 추가할 내용이 생겼습니다.
  - 매개변수와 구성(configurations)을 다루는 페이지가 없습니다.
  - SubD 케이지 편집, 판금 전개, 이미지 트레이싱은 설명이 짧거나 없습니다.
  - getting-started를 실제 studio에서 따라 해 보는 확인이 아직 남았습니다.
- **순서.** 각 단계는 작은 커밋 하나이고, 커밋마다 SHA를 코디네이터에게 보고합니다.
  1. O9 빈 곳 채우기
  2. 캡처 스크립트와 tour 스크린샷, getting-started를 실제 studio에서 확인, 이미 쓴 페이지의 스크린샷 보충
  3. agent 4쪽
  4. packages 6쪽, 실행되는 예제 묶음 포함
  5. reference 5쪽, 거부 코드 표는 코드에서 생성
  - 2단계 이후로는 페이지마다 글과 스크린샷이 함께 있어야 완료로 칩니다.
- **완료 기준.**
  - "Being written" 0쪽;
  - 모든 예제 테스트 통과;
  - check-docs와 build 통과;
  - 스크린샷 예산 이내;
  - getting-started를 두 렌더러에서 확인.
- **최신 유지 방법.**
  - 거부 코드 표와 도구 표는 코드와 다르면 실패합니다.
  - 예제는 테스트로 돌아가므로, 코드가 바뀌어 깨지면 실패합니다.
  - 레인이 코드를 바꾸면 코디네이터의 병합 알림을 받아 문서 레인이 고칩니다.
- **오너 결정 (2026-10-23).**
  1. "Parameters and configurations" 페이지를 추가합니다.
  2. 페이지마다 근거 소스 목록은 달지 않습니다.
  3. Render 탭은 studio 자체의 렌더링 작업 공간이며 범위 안입니다. 따로 Rendering 페이지를 만듭니다.

## Readers

| Reader | Wants | Starts at |
|---|---|---|
| **Studio user**: a designer or engineer making a part in the browser, with or without the agent | To get a part done, to know what is refused and why | Getting started → Studio |
| **Agent user**: someone directing the built-in agent, or connecting their own agent through `cad-mcp` or `cad-cli` | What the agent can do, how changes reach the part, the tool contract | AI agent |
| **Package developer**: someone embedding the kernel, the document model or the viewer in their own code | Imports, a minimal part in code, evaluation, formats, limits | Packages |
| **Contributor or reimplementer**: someone checking behaviour against the spec and conformance suites | The document format, refusal codes, how things are verified | Reference |

## Rules every page follows

- **Checkable.** Every statement can be checked against today's code, tests or handover records. Nothing comes from
  memory or from the old site.
- **Real labels.** UI labels are quoted exactly, in bold, as the code spells them.
- **Running samples.** Code samples come from code that runs. Package pages include them from
  `apps/library-docs/samples/*.test.mjs`, which the docs lane owns and `pnpm test:samples` runs. They don't copy from
  other lanes' tests.
- **Limits stated.** A page says what is refused or not supported. It doesn't hide it.
- **Merged work only.** In-flight work isn't documented until it merges into integration.
- **English.** Pages are in English, in plain sentences.

## Pages

**Status:**

- **done** means written from the code and merged. Its gaps are listed.
- **to write** means a stub marked "Being written".

**Shots** are screenshots from the capture script described under Screenshots. Sizes are estimated lines of
Markdown.

### Introduction

#### What BaroCSS CAD is (`/`): done

- **Purpose:** what the stack is, and its status (unreleased, 0.0.0, no migration, own TypeScript, no WebAssembly).
- **Sources:** package manifests; `apps/cad-studio/handover/README.md`.
- **Shots:** one hero shot of the studio with a part.
- **Gaps:** none.

#### Getting started (`/guide/getting-started`): done

- **Purpose:** install, run, a first part, a tapped hole that needs rows, the agent, Save/Open/Export.
- **Example:** the first-part steps, which follow `apps/cad-studio/test/browser-flow.mjs`.
- **Shots:** after New part, the box, the hole preview, the refusal toast, the Library rows, the chat proposal.
- **Gaps:** the page hasn't been walked against the live studio on both renderers yet. That walk is part of the
  Screenshots step.

#### Concepts (`/guide/concepts`): done, with a gap

- **Purpose:** units and coordinates; correct or refused; sizes from your rows; the library's own values.
- **Sources:** `engine/doc.ts`; `chat/rows.ts`; `app/fasteners.ts`.
- **Gap, now unblocked:** a **Revisions and sources** section (O9, merged at 2f3fcb414). It must explain:
  - the document's source revision (`revisionOf`);
  - which fields it hashes, now including fastener sizes and casting rules;
  - that every export names the revision it was made from;
  - that a newer request to the engine makes an older reply on the same lane come back stale, so an out-of-date
    preview, section or drawing never replaces a newer one (for example, a section plane dragged fast).
- **Sources for the gap:** `team/source.ts`; `engine/lanes.ts`; `o9-source.test.ts`; `o9-lanes.test.ts`.

### Studio

#### Tour of the studio (`/studio/tour`): done

- **Sources:** `App.tsx`; `ui/ShortcutHelp.tsx`; the command definitions in `cad-model/src/app/*.ts`.
- **Shots:** an annotated layout shot, and the command palette.
- **Gaps:** the **Render** tab appears only by name. It links to the Rendering page.

#### Sketches (`/studio/sketches`): done

- **Shots:** a sketch with constraints and the DOF readout.
- **Gaps:** none.

#### Part features (`/studio/features`): done, with gaps

- **Gaps:**
  - SubD cage editing in the studio has one line. The page must say what the studio offers beyond the agent's
    `subd.*` actions: select, move, extrude, crease. To check in `App.tsx` and the cage tools.
  - Sheet metal's flat pattern and bend table are only touched on.
  - Image tracing, from a picture to solids, is missing. It is the `image.*` actions, and the studio's entry if there
    is one.
- **Sources:** `cad-model/src/app/*.ts`; `chat/cageTools.ts`; the sheet modules.
- **Shots:** the hole dialog's Copies; a SubD cage.

#### Parameters and configurations (`/studio/parameters`): to write (added by the owner, decision 1)

- **Purpose:**
  - named sizes;
  - expressions;
  - saved configurations, and switching between them;
  - how a parameter drives features and drawings.
- **Sources:** the **Parameters** panel in `App.tsx`; the parameter code in `cad-model/src/engine`.
- **Shots:** the Parameters panel.
- **Size:** about 60 lines.

#### Assemblies and mates (`/studio/assemblies`): done

- **Shots:** the mates card; interference; explode.
- **Gaps:** none.

#### Drawings (`/studio/drawings`): done, with a gap

- **Gap:** the title block's **SRC** line beside REV (O9).
- **Shots:** a sheet with views and dimensions; the issues list.

#### BOM and quotes (`/studio/bom`): done

- **Shots:** the BOM card.
- **Gaps:** none.

#### Manufacturing (`/studio/manufacturing`): done

- **Shots:**
  - the thickness map, on WebGPU;
  - the CNC preview;
  - print layers.
- **Gaps:** none.

#### Frames and weldments (`/studio/frames`): done

- **Shots:** a table frame; the cut list.
- **Gaps:** none.

#### Robots (`/studio/robots`): done

- **Shots:** the Joints card with its sliders; the workspace voxels.
- **Gaps:** the page should say that exports now carry `robot.source.json` (O9). That line goes in **Files**.

#### Display, sections and analysis (`/studio/display`): done

- **Shots:**
  - each of the 5 display modes, as one strip;
  - a section box;
  - zebra.
- **Gaps:** none.

#### Rendering (`/studio/rendering`): to write (added by the owner, decision 3)

- **Purpose:** the **Render** tab, the studio's own rendering workspace. It doesn't use the `@barocss/render`
  package. It draws with `@barocss/gpu` and keeps its settings in the document (`doc.render`). It never changes the
  model.
- **Must explain:**
  - **Appearance** per body, or the default: preset, colour, metallic, roughness, opacity, a texture with its repeat,
    an authored `@shader` material.
  - **Lights:** sun, point and spot. **Environment:** gradient or image. Tone mapping (**Filmic (ACES)**).
  - **Camera:** **Save this view** and **Go to saved view**, and the field of view.
  - **Props:** extra scene objects written in the GPU package's CSS-shaped scene language (**PROPS · CSS SCENE**,
    **Apply props**).
  - **Timeline:** keys per body, **Turntable**, play and scrub.
  - **Export image**, which writes a PNG.
  - The limit: rendering needs WebGPU.
- **Sources:** `apps/cad-studio/src/ui/RenderPanel.tsx`, `ui/Timeline.tsx`; `cad-model/src/engine/render.ts`.
- **Shots:** the Render panel with a lit part; the timeline.
- **Size:** about 70 lines.

#### Shop rows (`/studio/rows`): done

- **Shots:** Library with the fastener sizes loaded.
- **Gaps:** none.

#### Files and exports (`/studio/files`): done, with gaps

- **Gaps (O9):**
  - **Sources on exports:**
    - STEP's `FILE_DESCRIPTION`;
    - 3MF's `barocss:SourceRevision` metadata;
    - the drawing's SRC line;
    - the `.source.json` record written beside STL, the URDF/MJCF/SDF zips and USD;
    - what the record holds: the revision, the input's SHA-256, the files, a robot's hand-set values.
  - **Recovery:** the copy is now written after its mesh blobs. The page should name the **Could not restore** case.
- **Sources:** `team/source.ts`; `o9-source.test.ts`; `recovery.test.ts`.

### AI agent

#### Designing with the agent (`/agent/`): to write, about 90 lines

- **Purpose:** what the agent can and can't do, and how a request becomes a part.
- **Must explain:**
  - the chat server (`pnpm chat`, the `claude` CLI);
  - what the agent sees: summaries, rendered views, measurements;
  - what it can't do:
    - write rows (`[ROWS_NOT_FROM_PERSON]`);
    - change a drawing other than by proposal;
    - work outside the open document;
  - briefs and requirements (`requirements.*`), and checks against them.
- **Example:** a conversation from a scripted, non-live test, `apps/cad-studio/test/chat.test.ts` or
  `clarify.test.ts`. The tool calls are shown as they are recorded. There's no live model run: those need the
  owner's permission.
- **Sources:**
  - `chat/` (`brief.ts`, `observe.ts`, `views.ts`, `questions.ts`);
  - `apps/cad-studio/server/`.
- **Shots:** the chat panel with a proposal card.

#### Tools (v2 actions) (`/agent/tools`): to write, about 160 lines

- **Purpose:** the tool contract `barocss-cad-tools-v2`.
- **Must explain:**
  - the 13 tools: model, features, query, history, requirements, proposals, assembly, library, print, drawing,
    subd, image, describe;
  - each action and its arguments, from `chat/groups.ts` (one table, generated or checked against `GROUPS`);
  - that `describe` gives the full schema on request;
  - that a call has the same gates and refusals as the handler behind it;
  - `features.batch`, all or nothing;
  - the per-turn budget: the tool list and prompt are guarded at 25,000 or less.
- **Example:** a `query.measure` call and its result; a `features.batch` with a refusal. Both from
  `samples/agent-tools.test.mjs`, run through `toolset.ts`.
- **Sources:** `chat/groups.ts`; `chat/toolset.ts`; `chat/tools-v2.json`; `test/toolset.test.ts`.

#### cad-mcp and cad-cli (`/agent/cli`): to write, about 110 lines

- **Must explain:**
  - **cad-mcp:** `node apps/cad-studio/scripts/cad-mcp.mjs --doc part.bcad [--autonomy 1-4] [--libraries dir]`; the
    MCP client config; stdout carries only the protocol.
  - **cad-cli:** `run` (a script to .bcad, STEP and STL, with `--check` and `--dry-run`), `check`, `urdf`, `mjcf`,
    `robot-check`, `robot-size`, `stock`, `nest`, `pattern`, `mould`, `mould-quote`, `cam-preview`, `bundle`
    (`verify`), `replay`, `board`, `team`.
  - **Exit codes.**
  - **Using another agent.**
- **Example:** `cad-cli run` on a small script, then `check`, from `samples/cli.test.mjs`, which spawns the real
  script.
- **Sources:**
  - `scripts/cad-mcp.mjs`, `scripts/cad-cli.mjs`;
  - `server/cadCli.ts`, `server/cadDoc.ts`;
  - `test/cad-external.test.ts`, `tool-contract-mcp.test.ts`.

#### Proposals and autonomy (`/agent/proposals`): to write, about 90 lines

- **Must explain:**
  - Autonomy L1–L4, default L2: what applies directly (value edits) and what becomes a proposal (structural
    changes).
  - Preview, Accept and Reject; `leave_out`.
  - How a chat turn re-applies the agent's ops onto your newer edits. Conflicts come back as a new proposal.
  - Drawing changes are always proposals.
- **Example:** a proposal accepted with one op left out, from `samples/proposals.test.mjs`.
- **Sources:**
  - `chat/part/proposals.ts`, `chat/proposals.ts`, `chat/merge.ts`, `chat/proposalDiff.ts`;
  - `test/proposals.test.ts`, `chat-merge.test.ts`.
- **Shots:** a proposal card with its diff.

### Packages

Package pages need runnable samples. So the first packages commit adds `apps/library-docs/samples/` and a
`test:samples` script, which runs with `node --test` under Node 22 and imports the packages by their public paths.

#### @barocss/cad (`/packages/cad/`): to write, about 80 lines

- **Must explain:**
  - What the kernel is: its own TypeScript B-rep and NURBS, no WebAssembly.
  - Installing from the repo, since it is unreleased.
  - The entry points.
  - A minimal part in code.
- **Example:** `samples/cad-minimal.test.mjs`, a box with a hole, evaluated and measured.
- **Sources:** `packages/barocss-cad/package.json` exports; `src/index.ts`.

#### Modeling API (`/packages/cad/modeling`): to write, about 140 lines

- **Must explain:**
  - parts and features as data (the `barocss-cad-part` JSON);
  - evaluating;
  - measuring;
  - mass properties;
  - tessellation and its tolerances.
- **Example:** `samples/cad-modeling.test.mjs`, which mirrors what `modeling-mass.test.mjs` and
  `modeling-stl.test.mjs` exercise.
- **Sources:** `src/part-*.ts`; `test/modeling-*.test.mjs`.

#### B-rep, robustness and refusals (`/packages/cad/robustness`): to write, about 110 lines

- **Must explain:**
  - Booleans, fillets and offsets on exact surfaces.
  - Strict validity: `brep-check-strict`.
  - The `CadPartError` codes: FORMAT, INPUT, PARAMETER, REFERENCE, SELECTION, CAPABILITY, GEOMETRY, plus the
    others the code holds (BINDING, PROFILE, SUPPORT, UNDERCUT), to be checked.
  - Touching lumps as separate bodies.
  - How it is fuzzed and pinned: RB, the conformance suite.
- **Example:** a refused boolean and its typed error, from `samples/cad-refusal.test.mjs`.
- **Sources:**
  - `test/boolean-*.test.mjs`, `brep-check-strict.test.mjs`, `conformance.test.mjs`;
  - `conformance/README.md`.

#### Exchange formats (`/packages/cad/formats`): to write, about 100 lines

- **Must explain:**
  - STEP read and write: units, AP242 tessellated input, the `description` option (O9);
  - IGES read and write;
  - STL;
  - DXF (2000 and R12);
  - what each format carries and what it drops.
- **Example:** `samples/cad-step-roundtrip.test.mjs`.
- **Sources:**
  - `test/brep-step2.test.mjs`, `step-tessellated.test.mjs`, `iges.test.mjs`, `dxf-writer.test.mjs`;
  - `src/step.ts`.

#### @barocss/cad-model (`/packages/cad-model/`): to write, about 150 lines

- **Must explain:**
  - The studio document model (`engine/doc.ts`).
  - Evaluation and its caches.
  - The chat tools and the agent contract (link to Tools).
  - Drawings, BOM, processes and robots, as modules.
  - Importing by path: the package is public module by module, at 0.x. This means a map of the top-level folders
    (`engine`, `chat`, `app`, `drawing`, `print`, `robot`, `team`, …), not a per-function reference.
- **Example:** `samples/cad-model-doc.test.mjs`: read a `.bcad`, evaluate it, write STEP.
- **Sources:** `packages/barocss-cad-model/package.json`; `src/*/`; `apps/cad-studio/test/pkg-boundary.test.ts`.

#### @barocss/gpu (`/packages/gpu/`): to write, about 110 lines

- **Must explain:**
  - The viewer (`@barocss/gpu/viewer`): scenes, geometry, materials.
  - WebGPU, with the WebGL2 fallback, and what is WebGPU-only.
  - The compute analyses: thickness, draft, access, clearance.
  - Frame costs.
- **Example:** the README's `createViewer` sample, checked by a browser-free test where possible. If it can't be
  checked that way, the page says it needs a browser.
- **Sources:** `packages/barocss-gpu/README.md`; `src/viewer/`; `tests/*.test.mjs`.
- **Scene language:** the CSS-shaped scene language, as far as the studio uses it (the Render tab's props and
  `@shader` materials), with the package README as its full description.

### Reference

#### Refusal codes (`/reference/refusals`): to write, generated, about 250 lines

- **Must explain:** every typed refusal: its code, what causes it, what to do. There are 73 bracketed codes in
  cad-model and the studio, plus the kernel's `CadPartError` codes.
- **How:** `scripts/refusals.mjs` collects the codes from the source into a table. The cause and remedy are written
  per code, and check-docs fails when the codes in the code and on the page differ.
- **Sources:** the code itself.

#### The .bcad document (`/reference/document`): to write, about 120 lines

- **Must explain:**
  - The fields; nodes and outputs.
  - Plain JSON or the `BCADPACK` container: magic, version and chunks, and blobs by SHA-256.
  - The schema version, which tracks the latest until the first release.
  - The source revision (O9).
- **Example:** a minimal document from `samples/document.test.mjs`, which writes it and reads it back.
- **Sources:** `engine/doc.ts`, `engine/container.ts`, `engine/blobs.ts`, `engine/migrate.ts`;
  `test/wire-doc.test.ts`.

#### Rows file formats (`/reference/rows`): to write, about 150 lines

- **Must explain:** each of the 13 row kinds: its fields, units and source field, the `unchecked` list, and the
  shipped samples.
- **Example:** the shipped `samples/rows/fastener-sizes.json`, validated by `samples/rows.test.mjs`.
- **Sources:** `engine/rowDefinitions.ts`, `engine/rowFiles.ts`, `engine/rowSources.ts`; `test/shop-rows.test.ts`.

#### Limits (`/reference/limits`): to write, about 90 lines

- **Must explain:** what is refused or not supported, by area, and the WebGPU-only features. It gathers the limits
  each page states into one list, each linked back to its page.
- **Sources:** the pages themselves, and the handover's open items.

#### How it is verified (`/reference/verification`): to write, about 90 lines

- **Must explain:**
  - Unit and conformance tests: the kernel's 33 conformance folders, cad-model's 5.
  - RB, fuzzing and the fingerprint.
  - Browser flows on both renderers.
  - The external readers: MuJoCo, urdfdom, ezdxf, usd-core.
  - The verification tiers.
- **Sources:**
  - `conformance/README.md`;
  - `apps/cad-studio/test/browser-flow.mjs`;
  - `apps/cad-studio/handover/`;
  - `test/cad-external.test.ts`.

## Screenshots

- **Capture script:** `apps/library-docs/scripts/capture.mjs`. It uses Playwright from `~/.cache/barocss-playwright`
  and drives the studio on its own ports, 52820 (studio) and 52891 (chat), which the coordinator has cleared. It runs
  through the barocss-lanes-guard gate, in the background.
- **Per page, not at the end:** the script is built with the tour's shots, in the same checkpoint as the
  getting-started walk. From then on, a page counts as done only with its text and its shots, so the owner sees real
  pages early. The 15 written pages get their shots in one backfill pass right after the script.
- **Steps:** every shot is a named step in the script, so a reshoot is one command.
- **Output:** shots go to `docs/public/shots/<page>/`, with a `manifest.json` that lists each shot, its step and its
  size.
- **Budget:** at most 250 KB a shot and 10 MB in all. The script fails over budget.
- **Renderers:** WebGPU by default. A shot on a WebGPU-only page says so in its caption.
- **Getting-started walk:** the same run walks Getting started and records any label that differs from the page.

## Not documented, and why

| Not documented | Why |
|---|---|
| physics, render, ui-*, server, browser, kit, cad-interop packages | Outside the CAD stack this site covers. (The studio's Render tab doesn't use the render package; see Rendering.) |
| A full reference of `@barocss/gpu`'s scene language | The package README is its reference. The site covers only what the studio uses. |
| A per-function API reference for cad-model | The package is public by module path at 0.x and changes often. The page gives a module map; a generated reference can follow the first release. |
| v1 tool names | Removed. v2 is the only list a model reads. |
| Work not merged into integration | It may still change. It is added when it merges. |
| ECAD/PCB; structural/FEM and other engineering experiments | ECAD/PCB remains deferred. FEM, thermal, fluid and coupled experiments are long-term planned tracks under the current goal; profile ownership and input contracts must be confirmed before documentation expands. |
| Live-model results (O15, `chat-live.mjs`) | Need the owner's permission to run. Pages use scripted tests instead. |
| Install from npm | Unreleased. Pages install from the repository. |
| Timings and frame rates | They vary by machine. Only the counts tests pin are given. |
| Evidence, logs and receipts | Not committed, by rule. Pages link to tests, not to runs. |

## Order and checkpoints

Each checkpoint is one small commit, `docs(library-docs): W1.<n> — …`. Each is followed by check-docs and the build,
and its SHA is reported to the coordinator.

| Step | Checkpoints | Size |
|---|---|---|
| R0 | This roadmap; owner approval | — |
| O9 gaps | Concepts (Revisions and sources); Files (sources on exports, recovery); Drawings (SRC) | 1–2 commits, about 60 lines |
| Capture script | the script, its manifest and the tour's shots; the getting-started walk; then the backfill of shots for the other written pages | 2–3 commits |
| Agent | index, tools, cli, proposals, each with its shots; `samples/` begins with agent-tools, cli, proposals | 4 commits, about 450 lines |
| Packages | samples harness and `test:samples`; cad index, modeling, robustness, formats; cad-model; gpu | 7 commits, about 700 lines |
| Reference | refusals and its generator; document; rows; limits; verification | 5 commits, about 700 lines |
| Studio gaps | features (SubD, sheet flat pattern, image tracing); Parameters and configurations; Rendering | 2–3 commits, about 190 lines |

## Definition of done

1. All pages in the sidebar exist, and none carries "Being written". Each page is done only with its text and its
   shots.
2. Every code sample is included from `samples/`, and `pnpm test:samples` passes.
3. The refusal table matches the codes in the code.
4. check-docs and `pnpm build` pass.
5. The shots are within budget. Getting started has been walked on WebGPU and WebGL2 with no differing label.
6. Each page states its limits. Limits gathers them.
7. Nothing in `apps/library-docs` is evidence, a log or a receipt.

## Keeping pages current

- **Generated where it can be.** The refusal table, and the tools table checked against `GROUPS`, fail when the code
  and the page differ.
- **Running samples.** A sample that stops running fails `test:samples`.
- **Labels.** A warning-only check looks for each bold UI label on the studio pages in the studio's and cad-model's
  sources, and reports the labels it doesn't find.
- **Ownership.** Lanes don't edit the docs. A lane's change that a page describes reaches the docs lane through the
  coordinator's merge notice, and the docs lane updates the page. Pages don't carry source lists (decision 2); the
  sources named in this roadmap are for writing them.

## Decisions for the owner

1. **A Parameters and configurations page:** yes, under Studio after Part features (owner, 2026-10-23).
2. **Source lists on pages:** none (owner, 2026-10-23). The stale check is dropped. Currency rests on the generated
   tables, the running samples, the label check and the merge notices.
3. **The Render tab:** its own Rendering page, under Studio after Display (owner, 2026-10-23). It is the studio's
   own rendering workspace, in scope, not the render package.
