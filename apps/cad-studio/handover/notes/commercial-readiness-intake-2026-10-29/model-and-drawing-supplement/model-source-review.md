# CAD Model 비도면 상용 준비 추가 검토

판정: **상용 수락 보류 — SOURCE_ONLY_REVIEW_COMPLETE / COMMERCIAL_ACCEPTANCE_NOT_QUALIFIED**.

Model은 단순 형상 wrapper보다 넓다. 문서 codec, 불변 Part/Assembly, 이름 있는 매개변수, feature/body ID, 참조 재검사·보류, 일괄 편집과 checkpoint, worker 전송용 identity 최적화가 있다. 다만 이 기능들이 사용자의 브래킷 편집→저장→다음 세션 재편집 작업을 끝까지 보장한다는 새 실행 증거는 이번 검토에서 만들지 않았다. 테스트 수만으로 상용 합격을 선언하지 않는다.

## 고정 범위와 보존

제품 저장소는 `P=/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`이다. 소스 기준은 `5907c3931cce980f9beb99bfc857ede6654ee2e5`이다. 모든 소스는 `git -C P show SHA:path`로 읽었다. 시작 dirty roadmap/decisions/note와 후속 작업자의 viewport/style WIP는 제외·보존했다. 종료 HEAD와 dirty는 verification JSON에 기록한다. 고정 SHA→종료 HEAD의 Model package delta는 0이다. consumer App의 이후 변경을 과거 UI 실행 증거로 사용하지 않는다. root AGENTS 및 제공된 사용자 지침을 적용했다. 제품·브랜치·기존 증거·state·ledger는 변경하지 않았다.

아래 행 번호는 고정 SHA 기준이다. `evidence/`에 읽은 exact source와 SHA256/git blob 목록을 보존한다. 이것은 소스 capsule이며 실제 실행 import graph가 아니다. 빌드·테스트·브라우저·guard·새 numeric/API 실행은 모두 **NOT_RUN**이다. 커널 Boolean/B-rep/공차 정확도와 도면/measurement/auto/issues 판정은 범위 밖이다.

## 실제 있는 계약과 사용자 작업 경계

| 영역 | 소스에서 확인한 구현 | 수락 경계 |
|---|---|---|
| 공개 API | `src/api/index.ts:1–25`, `api/part.ts:508–518`, `api/studio.ts`의 backend: 기존 kernel Part를 사용하며 입력 doc를 복사하고 평가한 뒤 Part를 만든다. 명령 검증·build·signature capture·평가를 기존 Model에 위임한다. Assembly는 constructor/doc getter에서 복사한다(`api/assembly.ts:31–37`). | package.json의 wildcard `./* → ./src/*.ts`가 폭넓은 subpath를 노출한다. 루트 `.` export는 없다. 파일 경로 변경은 consumer 계약에 영향을 줄 수 있다. `0.0.0-experimental` 표기는 단독 실패 근거가 아니다. |
| 치수·수식 | `engine/doc.ts:23,631`의 저장 치수는 number 또는 `{parameter:string}`, parameter map은 유한 scalar 값이다. `engine/parameters.ts`는 추가/갱신/rename/remove/bind를 구현하며 rename은 참조와 configuration key를 갱신한다. remove는 해당 참조를 이전 수치로 고정한다. `api/studio.ts` BINDS가 지원 feature/field를 정하고 나머지는 PARAMETER_UNBINDABLE로 거부한다. | 이름 있는 매개변수는 존재한다. 이 저장형만으로 일반 영속 수식 dependency graph·단위 추론·순환 방정식 지원을 주장하지 않는다. facade가 kernel의 param/withParameters도 재수출하므로 “수식 전체 없음”도 주장하지 않는다. 실제 입력 문법과 저장되는 의미를 선택한 consumer에서 확인해야 한다. |
| ID·참조 | `engine/ids.ts:1–38,91–105`의 nextId와 stable feature/body key, `references.ts:199–212,230–301`의 signature capture/refresh/check, 모호·소실 참조의 held suppression 및 명시적 confirm이 있다. | ID 보존과 형상 topology 의미 보존은 다르다. 모호한 참조를 사용자에게 되묻는 지원 경계가 있다. 모든 topology 편집의 자동 추적을 보장하지 않는다. |
| 편집·거부·재시도 | `chat/part/history.ts:22–46,119–148`에서 ops/script를 작업 state에 순서대로 적용하고 첫 refusal이면 원 state를 반환한다. dryRun·checkpoint/restore가 실제 handler에 연결된다. `chat/transactions.ts`의 OP_IDS=500은 최근 operation ID 재실행 방지 한도다. | batch 기능이 없다는 평가는 틀리다. 이 handler의 원자적 state 수락은 Studio UI의 Undo 깊이·late commit·영속 idempotence까지 자동 입증하지 않는다. checkpoint는 session state이며 내구성 version과 구분한다. |
| native 문서·revision | `container.ts:60–132`은 chunk/hash 검사와 일반 read, canonical snapshot read, working-copy read를 분리한다. `doc.ts:624–631`은 schema1–4를 기술한다. `doc.ts:683–686,737–750`에는 명시적으로 수락하기 전 적용하지 않는 pending part revision 및 공유 part definition/rev/source가 있다. | schema4 전체가 무조건 허용되는 것은 아니다. 기존 snapshot admission은 schema3와 지원 route-bundle schema4 프로필이다. 일반 Open normalization과 snapshot raw 보존을 섞지 않는다. part revision 존재는 모든 assembly merge/수정 충돌·파일 감시·PLM 지원이 아니다. |
| 비동기·wire 수명 | `wireDoc.ts`의 immutable node identity 전송, 64회 주기/256회 보존 및 idempotent dispose, disposed pack 거부가 있다. `meshWire.ts`는 sender typed array를 복사해 transfer한다. Studio `engine/client.ts:100–145,168`은 retire/dispose, receiver/wire 해제 및 stale lane을 관리한다. | D330의 선택 실제 root mount/retry 증거를 재사용할 수 있다. 이것을 일반 blob GC, 모든 탭/worker crash/OOM, 장시간 메모리 안정성으로 확장하지 않는다. immutable 입력 계약을 어긴 array mutation을 제품 결함으로 만들지 않는다. |

## 기존 실행 증거 재사용

이번에는 기존 성공 검사를 다시 실행하지 않았다. 아래는 원 작성자/기존 검토 범위이며 이번 독립 runtime PASS가 아니다.

- D321 Stop, D322 late Save, D326 selected project/serialized Open의 제한된 수락을 기존 review에서 재사용한다. actual consumer ownership 수정이 있으므로 이전 A04/A05/A06를 모두 미수정으로 남기지 않는다. D326은 선택 실제 5 cases+별도 starter이며 다른 형식 import/stage와 worker sender 전체를 포함하지 않는다. D322는 늦게 끝난 원래 저장 bytes와 현재 doc/dirty/recovery 소유권을 분리했다.
- D323는 codec→project Version→실제 Version/Open UI 연결이 있는 bounded author acceptance다. 고유 관련 unit 12개이며 final5는 중복이다. selected CG6 project1+별도 starter가 있다. omitted nextId, false/0/empty, ids/keys/parents/revision의 정의·로그를 수락한다. `byte-equal:true` 로그와 보존된 binary를 직접 비교한 것은 다르다. 해당 rare fixture 입력/출력 binary capsule과 전체 bundle graph의 독립 대조는 기존 검토에서도 미완료였다. 일반 정상 UI positive control을 rare fixture UI 생성 증거로 올리지 않는다.
- D330 qualification은 Model focused12/Studio17이 whole Model1853/Studio476에 포함된다고 기록한다. 합산하지 않는다. baseline Model0P2F/Studio2P8F와 첫 API harness 판정 불일치는 보존된다. native selected5+별도 starter1의 범위는 root mount/dispose/controlled retry와 선택 import stop 흐름이다. sourcewatch21은 full runtime graph가 아니다. 자연 OS worker failure/StrictMode 재생/장시간 leak 수락이 아니다.
- drawing High의 새 CPU 6 groups PASS 관측은 별도다. wrapper drift assert 뒤 제어 오류로 계속 실행되어 상위 판정은 `FAIL_ORCHESTRATION_WITH_VALID_PINNED_CPU_OBSERVATIONS`, clean acceptance는 NOT_QUALIFIED다. 이를 Model 전체 또는 상용 PASS로 쓰지 않는다. 도면 소스는 이 검토에서 재탐색하지 않았다.

## 상위 완료 gate 4개

이는 새 재현 결함 목록이 아니다. 기존 roadmap의 수락 공백을 좁힌 것이다.

1. **브래킷 한 개의 fresh-session 재편집 증거 — evidence gap.** O21/12 CG6/16 R7 및 기존 required-capabilities Model 행에 연결한다. 이미 지원되는 치수/parameter 문법을 고정한다. 값 변경→feature 편집→stable IDs/refs→native Save→새 context Open→다시 값 변경을 검사한다. 저장 의미/원 bytes/정규화 기대를 따로 고정한다. D323의 이미 통과한 codec 검사는 반복하지 않고 빠진 fresh-session consumer만 확인한다. 일반 영속 수식 그래프가 실제 요구라면 지원 문법을 먼저 명시하며 새 요구로 분리한다.
2. **선택 consumer의 원자적 reject/Undo/late ownership — evidence gap.** 12/O9/16, D321/D322/D326/D329/D330 및 API-PUBLIC-MODEL-CONTRACT-01에 연결한다. 실제 공개 편집 consumer에서 두 번째 operation refusal→원 doc/IDs/refs/Undo 깊이 불변, 성공 batch→Undo1/Redo1, 취소 후 늦은 결과 무시, 동일 opId 재시도를 확인한다. handler 원자성이나 과거 Stop 선택 PASS를 이 전체 UX 계약으로 확대하지 않는다.
3. **참조 ambiguity와 assembly revision 수락의 저장 후 의미 — supported limit + evidence gap.** O19/O11/O24/16 reference evolution에 연결한다. 동일 part definition의 두 occurrence가 있는 지원 fixture에서 새 revision을 pending 상태로 읽고, 수락 전 불변/수락 후 공유 revision 갱신을 검사한다. gone/ambiguous face는 held/refusal을 유지하고 명시적 confirm 뒤 저장·재열기로 같은 의미를 확인한다. 절대 topology 자동추적 또는 전체 mate solver 정확도 수락이 아니다. geometry 판단은 High 범위다.
4. **실행 가능한 계약/등록과 실제 release evidence — evidence gap.** 12/16 R4 Model/R1 Studio/R7 public boundary에 연결한다. `scripts/test.mjs`는 디렉터리 `*.test.ts`를 기본 등록하지만 등록은 실행이 아니다. 현재 CI planner는 type-check/lint/test를 구분하며 runner는 required lint/types/build와 manual/pre-release regression의 package tests를 구분한다(`affected-ci-run.mjs:65–74,149,175`). 따라서 옛 “CI 미등록” 문장을 모든 현 테스트에 재적용하지 않는다. 한 release SHA에서 위 consumer workflow의 retained input/output·실행 graph·SKIP/exit·지원 한도와 API 호환성을 결속해야 한다. 모든 suite 재실행을 이번 source review의 조건으로 삼지 않는다.

## 새 소스 후보 1개 — 미실행, 결함 아님

`engine/evalMemo.ts:15–24,69–81`은 evaluator별 wrapper를 WeakMap에 보관하지만 성공 Promise cache는 module-global이고 key에는 evaluator identity/session이 없다. `chat/part/history.ts:26,82`와 `engine/references.ts:220`이 실제 사용한다. 같은 문서를 서로 다른 합법적 evaluator/context에 전달하면 먼저 성공한 결과가 재사용될 수 있다는 소스 후보다. 모든 evaluator가 같은 의미의 순수 평가라는 계약이면 의도한 content cache일 수 있다. 현재 stale UI/worker 결과나 native handle 오류를 재현한 것은 아니다.

공개 함수 서명은 `evalMemo.ts:15,21`과 `chat/toolKit.ts:43`에서 `(doc: StudioDoc) => Promise<EvalResult|null>`이다. `chat/tools.ts:57–65,86,114`의 proposal/accept/rebase/runTool/dispatchTool도 평가자를 호출자로부터 받는다. 확인한 선언과 cache 주석에는 서로 다른 evaluator가 반드시 같은 결과를 내야 한다는 명시적 조건이 없다. 이 사실만으로 다른 context가 지원된다고 단정하지 않는다. 표준 제품 경로가 동일한 순수 evaluate를 반복 사용한다면 공유 cache는 의도에 맞을 수 있다. 또한 새 Worker realm은 module-global cache도 새로 만들므로 서로 다른 Worker 사이의 cache 공유라고 주장하지 않는다. 반대로 같은 realm에서 다른 평가자가 허용되는지, 정상 caller가 실제로 그렇게 사용하는지는 이번 bounded 검토에서 확정하지 않았다. 상태는 **SOURCE_CANDIDATE / CONTRACT_GAP**이다. 선언·caller와 hash는 evidence에 보존했다.

다음 최소 확인은 두 평가자의 허용 계약을 먼저 확인하고, 허용된다면 같은 immutable doc에 다른 명시적 context를 가진 평가자 2개를 연결해 반환 source/revision/context가 현재 요청 소유권을 지키는지 보는 focused CPU gate다. 성공한 기존 whole suite 반복이나 제품 수정은 하지 않는다. immutable node/array를 임의 변경하는 fixture는 사용하지 않는다. 이 후보는 일반 cache leak·hash collision·보안 결함 주장으로 확대하지 않는다.

## 종료

이번 추가 감사는 상용 수락을 새로 내리지 않는다. **기능 기반은 충분히 존재하지만 선택 workflow의 내구성·참조 의미·원자적 편집 및 release 결속이 아직 제한적으로만 검증됐다.** 교환 도면과 커널 기하 정확도는 다른 담당 결과를 합쳐야 한다. 다음 checkpoint는 위 1번의 기존 지원 parameter/native 문서 한 profile을 정확히 정하고, 이전 receipt로 이미 충족된 항목을 제외한 fresh-session consumer gate 준비다. 별도 source candidate는 확인 요청만 남긴다. 새 실행·GitHub 변경·제품 수정은 하지 않았다.
