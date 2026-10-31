# Codex 인수인계 — 2026-11-01

오너가 Claude 작업을 정리하고 Codex로 넘기라고 지시했다("진행사항 확인하고 어느정도 마무리가 됐으면 codex 쪽에 인수인계 할 수 있도록 준비해줘").
- Claude 쪽에서 마지막으로 끝낸 기록은 **D398**이다. 다음 번호는 **D399**다.
- 진행 중이던 lane은 11④를 끝내고 멈췄다. 13행 조사를 시작했지만 바뀐 파일은 없다.
- 커밋하지 않은 작업은 없다.

이전 인수인계(맥락용): [Claude 인수인계 2026-10-30](../claude-handoff-2026-10-30/README.md)(Codex → Claude), [2026-10-28](../claude-resume-2026-10-28/README.md). 아래 내용이 그 둘보다 우선한다.

## 0. 시작할 때

```sh
cd /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b
export PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH
git fetch origin
git status --short          # untracked .claude/ 만 보여야 한다
git branch --show-current   # local/cad-dev
git log -3 --oneline        # 맨 위가 이 문서를 넣은 커밋이다
git config user.name; git config user.email   # easylogic / cyberuls@gmail.com
```

- **작업 브랜치:** `local/cad-dev`. 위 worktree를 `origin/local/cad-dev`로 fast-forward해 두었다.
- **저장소 본체** `/Users/user/github/barocss/barocss`는 다른 브랜치(`codex/pr-feature-evidence`)에 있다. 건드리지 않는다.
- **develop 대비:** `origin/local/cad-dev`가 `origin/develop`보다 190커밋 앞서 있다. 마지막 통합은 PR [#2249](https://github.com/barocss/barocss/pull/2249)(D346까지)다. 열린 PR은 없다.
  - 09–11행과 정리 묶음이 develop에 아직 들어가지 않았다.
  - develop으로 보내는 새 PR이나 병합은 오너가 따로 지시할 때만 한다.
- **Claude 쪽 worktree:** `compassionate-turing-e88276`(코디네이터)와 `heuristic-gould-b94e20`(lane)는 Claude 세션 것이다. 둘 다 `aab2deecc` 이후 깨끗하다. 편집하지 않는다.

## 1. 먼저 읽을 것

1. [roadmap.md](../../roadmap.md)의 "권장 진행 순서 (오너 수락 2026-10-30)" 단락(실행 색인 표 아래). 단계별 원장(01–06, 20/21, 10, 11)이 그 안에 있다.
2. [decisions.md](../../decisions.md)의 D367–D398. 기능 하나에 기록 하나다. 각 기록 끝의 **Follow-ups**가 남은 일이다.
3. [공통 Studio 흐름 도구](../studio-flow-helper-2026-10-31/README.md)(D370). 새 실제 Studio driver는 이것을 쓴다.
4. 도면은 [decisions-drawings.md](../../decisions-drawings.md)도 본다. D398에서 DR-1의 "다른 sheet의 상세도" 보류가 끝났다고 한 줄 고쳤다.

## 2. 이번 Claude 구간에서 끝낸 것 (2026-10-30 ~ 11-01)

| 단계 | 기록 | 내용 |
|---|---|---|
| 경계 결함 | D367, D368 | #2229 sweep 예산을 접촉으로 오판하던 것; 20② 필렛 드래그 값 튐 |
| 09 고급 스케치 | D348–D358, D366 | BOUNDED_CLOSED. [범위 원장](../roadmap09-scope-ledger-2026-10-30/README.md) |
| B1 / B2 밴드 | D369, D371 | 연관 2D 밴드, 연관 3D ruled 밴드 면. Thicken은 #2258 뒤다 |
| 회고 | D370 | 검증 단계 차등(§5), 공통 흐름 도구 |
| 3b 정리 | D360–D362, D365 | 커널 미사용 100파일 제거, `part-model.ts` 분리, 오류 코드 매핑, schema 3·4만 읽음 |
| 01–06 | D372–D376 | 독립 공차 프레임, 선형 절삭 반복, 문서·API 사이트, Viewer 마감, GPU 인계 |
| GPU 병합 | D378 | 로컬 GPU 브랜치 2개를 `local/cad-dev`에 병합 |
| 20 / 21 | D377, D379–D382, D385 | 드래그 중 뒤 기능 유지, 핸들 옆 값 입력, 알림 클릭 통과, History 막대, 사이드바 격자, 도형을 tool rail로 |
| 10 조립 | D383, D384, D387–D393 | 부품 반복, 하위 조립 안 참조·BOM·선택, 유연한 하위 조립, 인스턴스 겉모습, 조립 안 부품 편집, 조립 cut, 설명 단계 |
| 11 도면 | D394–D398 | GD&T 마무리, 선·면적 datum target, ISO/ASME, 인치·이중 치수, 도면 세트(여러 sheet) |
| 테스트 | D386 | 흐름 94–96단계 selector 수정(제품 결함 아님) |

10⑦ motion study는 손대지 않았다. Physics/Motion 보류이고 오너 확인이 필요하다.

**마지막 검사:** D398에서 Model 2513/2513, Studio 624/624, 실제 run03 PASS. 이번 정리 중에는 다시 돌리지 않았다(NOT_RUN).

## 3. 다음 작업 (로드맵 순서)

순서는 roadmap의 4단계 그대로다. **10 → 11 → 13 교환 → 14 생산.** 12 파일·버전과 16 정확도는 각 단계에서 함께 검사하고, 30 커널 일반성은 16과 함께 진행하고, 31 직접 편집은 30 뒤다. 그다음 15 사용성(릴리스 전), 마지막이 17–19다.

**다음 한 항목은 13행(교환과 손실 표시, CG7)이다.** lane이 현재 지원 범위와 이 기계에서 쓸 수 있는 독립 판독기를 측정하다 멈췄고 남긴 결과물은 없다. 측정부터 다시 한다. 관련 이슈는 #2263(STEP 범위), #2248(STEP의 이름 있는 좌표계)이다.

**단계 경계 규칙:** 단계를 넘어갈 때 재현된 정확도 결함을 먼저 처리한다. 지금 등록된 후보는 아래와 같다. 오너는 작은 후보를 두 번 건너뛰라고 했다. 재현되면 처리하고, 재현되지 않으면 기록만 한다.
- (a) Open 시 참조 보류: Studio Open이 `REFERENCE_MOVED` 뒤에만 `verifyReferences`를 돌린다. 그래서 이름을 잃은 참조가 보류가 아니라 거절로 열린다. 먼저 재현한다(D371 후속).
- (b) 잃은 모서리 메시지 제목이 일반적인 "chamfer or fillet"이다.
- (c) gpu 단위 테스트 기존 실패 16개: Studio renderer 테스트 theme에 `d5c5d7a20`의 `selection`/`selectionHover` 색이 없고, `cad-instance-display-diagnostics`에 소스 문자열 단언 2개가 있다(D378 후속).
- (d) #2229 남은 항목: 닫힌 고리의 chord당 예산 문서, cancel/late-result 행.
- (e) 20③ 드래그 끊김: 미리보기가 120 ms를 넘는 부품에서 다시 측정한다(D377은 미재현).

**오너가 등록했지만 순서를 정하지 않은 UI 항목:** U1–U4(roadmap "Owner request 2026-10-31: icon quality and one Fillet command").
- U1: 20 px 아이콘 가독성.
- U2: Material 글리프를 쓰는 명령 5개에 그린 아이콘을 넣는다.
- U3: Studio UI 아이콘을 Material Symbols 글꼴에서 `lucide-react`로 옮긴다. 의도된 의존성 추가이므로 `pnpm-lock.yaml`을 함께 커밋한다. CAD 명령 아이콘은 `cadIcons.tsx`에서 직접 그린 채로 둔다.
- U4: Fillet 명령을 하나로 합치고 Type을 고르게 한다.

## 4. 고치지 못한 후속 (D-record Follow-ups 요약)

- **도면 (커널 소유):**
  - DXF DIMSTYLE 머리글이 ASME·인치 설정을 따르지 않는다(D396, D397).
  - 이중 치수가 아닌 짧은 치수의 글자가 화살표에 닿을 수 있다. 커널 DXF fixture 쪽이다.
- **도면 (모델):**
  - 폭이 0인 공차 영역이 인치에서 뒤집혀 찍힌다(D397).
  - ASME에서 2.5 mm 고정 글자가 3 mm 최소보다 작다(D396).
  - sheet를 옮긴 뒤 1번 sheet가 자동으로 다시 배치되지 않는다. 3D 주석은 sheet를 모른다. zone 참조가 없다(D398).
  - 바깥 판정이 실루엣이 아니라 상자로 한다. 선·면적 target이 형상을 따라가지 않는다(D395).
  - 살아남은 mutant용 테스트가 없다(D394).
- **채팅 도구 설명:** 새 도면 설정(표준·단위·이중 치수·sheet)이 빠져 있다. 턴마다 도구 목록과 프롬프트 한도 25,000자 중 24,997자를 쓰고 있어 넣지 못했다. 넣으려면 다른 설명을 줄여야 한다.
- **조립:**
  - mate가 cut 전 정의 면을 읽는다. 하위 조립 대상은 거절한다. cut한 판의 BOM 면적은 원재료 기준이다(D392).
  - 하위 조립 안 부품은 제자리 편집이 안 된다. guard 호출 지점에 테스트가 없다(D391).
  - 설명 단계에 재생과 채팅 도구가 없고 최상위 occurrence만 다룬다(D393). 그래서 #2251은 열어 두고 댓글을 남겼다.
  - 고리를 닫는 mate를 Studio가 한 번 커밋하고 모델이 거절한다. `drawing.balloons`가 테스트되지 않았다(D383).
- **id 규칙:** `assembly/takenIds.ts`가 instance id 할당 때 steps·cut 대상·mate·pattern seed가 아직 가리키는 id를 건너뛴다. 오래된 참조를 새 부품에 다시 잇지 않는다. 새 할당기도 이것을 쓴다.

DXF DIMSTYLE 머리글은 지금 `DIMTXT 3.5`, `DIMTAD 1`로 고정되어 있다. 짧은 치수 글자를 올리면 커널 DXF fixture `conformance/r11b/plate-drawing`이 바뀐다. 이 두 항목은 커널 lane 몫이다.

## 4a. lane만 알던 것 (2026-11-01 lane 보고)

**코드 규칙:**
- 모든 도면 commit 경로는 `apps/cad-studio/src/ui/drawing/commitSettings.ts` → `readDrawing`을 거친다. 그래서 작성한 도면과 다시 연 JSON이 같다.
  - 새 도면 필드는 `readDrawing`의 정해진 key 순서에 넣는다. 그렇지 않으면 fresh Open 뒤 `f.same`이 실패한다.
- 도면 표준·단위 preset은 명시적 인자(`presetOf`)다. module 상태로 되돌리지 않는다.
- 출력하는 공차 한계는 항상 참 공차 영역 안에 있어야 한다. property test가 `drawing-units.test.ts`에 있다.

**실제 Studio driver의 함정:**
- `f.openFile(file, n)`의 두 번째 인자는 instance 수가 아니라 NODE 수다. 보통 2다.
- 도면 작업 공간은 거절을 toast가 아니라 `.dw-hint`(안내 막대)에 보인다.
- 버튼 `textContent`에 아이콘 이름이 섞여 있다. 라벨은 `.ms` span을 빼고 읽는다.
- 분해 보기에서는 gizmo가 나오지 않는다.
- Save 뒤 SVG title 글자는 파일 이름을 따른다.
- SVG의 완전한 원은 가장 오른쪽 점에서 시작하는 반원 두 개다(cx = startX − r).

**이번 구간의 새 driver:** 모두 `apps/cad-studio/test/`에 있다.
- `assembly-cut-browser.mjs`, `assembly-steps-browser.mjs`
- `gdt-completion-browser.mjs`, `datum-target-kinds-browser.mjs`
- `drawing-standard-browser.mjs`, `drawing-units-browser.mjs`, `drawing-sheets-browser.mjs`

모두 flow-helper를 쓴다. `<NAME>_SOURCE_FROZEN=1`과 `PW_DIR`·`CHROME`을 주고 `gate.sh` heavy로 감싸 돌린다.

**기타:**
- 확대한 SVG를 검토하는 도구는 lane scratch에만 있었다. 저장소에는 없다. 다시 필요하면 새로 만든다.
- chat port 52391에서는 이번 구간에 충돌이 없었다.
- 4–5일 된 agent-browser Chrome 프로세스(pid 5600, 18269 등)는 lane 것이 아니다. 그대로 두었다.

## 5. 지킬 규칙 (오너 결정)

**답과 기록:**
- 사용자에게는 한국어로 짧게 답한다. 코드·커밋·결정 기록·이슈는 영어다.
- PASS / FAIL / NOT_RUN을 나눠 보고한다. 해시는 출처·변경 감지용이지 형상의 정답이 아니다.

**Git:**
- stash·amend·rebase·reset·force push를 쓰지 않는다. 고칠 것은 새 커밋으로 한다.
- 이름을 지정한 경로만 add한다(`-A`·`-a` 금지). `.claude/`는 커밋하지 않는다. 저장소 root 설정을 바꾸지 않는다.
- 기능 마일스톤마다 `origin/local/cad-dev`에 일반 push한다. 새 PR·develop 병합·릴리스·npm 배포는 오너가 따로 지시할 때만 한다.

**의존성과 이름:**
- `packages/barocss-cad`·`barocss-cad-model`·`barocss-gpu`에는 WASM이나 새 runtime 의존성을 넣지 않는다. 직접 구현한다.
  - cad-studio UI는 UI 라이브러리를 쓸 수 있다(shadcn/Tailwind, lucide-react).
- 아이콘 글꼴을 프로젝트에 넣지 않는다.
- lockfile은 의존성을 일부러 추가할 때만 커밋한다.
- 이름에 단위 접미사를 붙이지 않는다(MM·Deg 등).
- 아직 릴리스 전이므로 문서는 최신 schema만 따른다. migration이나 schema 번호 올림 대신 fixture를 고친다.
- 반복 경로(프레임별·요소별 루프)에서 함수 안에 함수를 만들지 않는다. module 수준으로 올린다.

**증거:**
- 로그·스크린샷·압축 파일·대용량 증거를 커밋하지 않는다. 2026-10-22/23 Codex 구간에 1.28 GB가 커밋돼 디스크가 찼다. 지금 `handover/notes`도 530 MB다.
- 숫자와 명령은 결정 기록과 작은 `qualification.json`에 적는다.

**검증 단계 (2026-10-31 회고, v4):**

| 단계 | 대상 | 검사 |
|---|---|---|
| small | 새 공개 표면이 없는 한정 결함 수정 | 관련 테스트 + 실제 Studio 실행 1회, 독립 감사 없음 |
| feature | 새 도구·명령·동작 | 독립 감사 1회 + 실제 실행 |
| full | 커널 기하·공차, 공개 API | 감사 여러 회 + mutation |

- 기준선을 다시 돌리지 않는다. 지난 checkpoint의 통과 테스트 이름과 비교한다.
- 전체 흐름 대신 `FLOW_ONLY=<regex>`로 바뀐 기능이 실제로 거치는 단계만 돌린다. 다시 돌릴 때는 실패한 단계와 그 선행 단계만 돌린다.
- 커널 전체 suite는 brep core를 바꿨을 때만 돌린다.
- 마지막 테스트 편집 뒤 cad-model `tsc`를 돌린다. esbuild runner는 `test/`를 type-check하지 않는다.
- 샘플을 바꾸면 checkpoint 전에 `apps/library-docs/samples/run.mjs`를 돌린다.
- `groups.ts`를 바꾸면 `agent-tools.mjs`를, 거절 코드를 바꾸면 `refusals.mjs`를 같은 커밋에서 재생성한다.

**실행 환경:**
- Node 22.19.0을 쓴다. gpu 테스트는 Node 18에서 깨지고, 테스트 전에 `build:library`가 필요하다.
- 브라우저:
  - `PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright`
  - `CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'`
  - 브라우저 suite는 로컬 전용이다. GitHub Actions에서는 WebGPU를 쓸 수 없다(오너 결정, row 33).
- 무거운 실행은 한 번에 하나다. `~/.claude/local-mods/barocss-lanes-guard/bin/gate.sh acquire heavy <wait> <label>` / `release`로 감싼다. load 40 미만에서만 돌린다.
- 실제 Studio 흐름이 도는 동안 그 worktree에 아무것도 쓰지 않는다(편집·checkout·`build:library` 포함). Vite가 전체를 다시 읽어 결과가 가짜 실패가 된다.
- 프로세스는 자기 PID만 종료한다. 스크립트 이름으로 `pkill`하지 않는다.
- 흐름 chat port는 `CAD_STUDIO_CHAT_PORT=52391`이다. `EADDRINUSE`가 나면 `lsof`로 점유자부터 확인한다.
- scratch worktree의 `node_modules`를 통합 worktree에 symlink하지 않는다. 그러면 `@barocss/*`가 다른 트리의 live 패키지로 풀린다.

**이슈:**
- 로드맵이 진행될 때마다 관련 이슈를 닫을 수 있는지 확인한다.
- 모든 수용 항목이 있을 때만 근거 댓글과 함께 `completed`로 닫는다. 일부만 되면 댓글을 남기고 열어 둔다.
- 연구 이슈(research/BACKLOG/HOLD)와 epic은 열어 둔다.

**UI:**
- 왼쪽 테두리만 있는 둥근 상자를 쓰지 않는다. 상태는 칩·점·라벨, 전체 테두리 또는 배경색으로 보인다.
- 오른쪽 dock 하나에 정리한다. 떠 있는 글자 많은 패널을 겹치지 않는다.

**모델 배정:** 오너는 일반 구현·검사를 Sol Medium, 복잡한 기하·공차 판단을 Sol High에 맡기라고 했다(2026-10-30 인수인계). 실제로 쓴 모델을 기록한다. 쓸 수 없는 모델을 썼다고 쓰지 않는다.

## 6. 오너 결정을 기다리는 것

- 09–11행 묶음을 develop으로 보내는 PR(`local/cad-dev` → `develop`).
- 10⑦ motion study의 범위(Physics/Motion 보류 해제 여부).
- FEA 기본 정적 해석을 로드맵에 다시 넣을지, 28행 외부 형식 SDK 정책.
- 다운로드와 유료 live 실행은 항목마다 오너에게 묻는다.
