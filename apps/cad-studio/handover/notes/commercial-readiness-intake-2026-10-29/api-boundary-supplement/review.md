# CAD / CAD Model API 경계 종합

판정: 구조 복잡성과 실제 반복이 있다. 큰 줄기의 문제는 두 개의 기하 엔진이 아니라 공개 API 경계, domain/tool 책임, feature 지원표의 분산이다. Evidence와 추론을 아래에서 구분한다. 제품 수정/빌드/테스트/브라우저/기하 동등성 판단은 하지 않았다.

소스 pin은0867ad4bb1b54604deadb741065dbcc78416b7c1이다. 최초 조사 때의 다른 작업자 feature-pattern WIP는 보존했다. 이후 c99cb121에 커밋된 변경20개(CAD8/Model12)만 별도 대조했다. source capsule은 runtime graph가 아니다.

| 순위 | 확인한 사실 | 해석과 확신 |
| --- | --- | --- |
| 1 | Model package wildcard가 ./src/*.ts 전체 subpath를 공개한다. Studio179개 파일의702 literal static import/re-export 선언이188개 Model 경로를 참조한다.299개는 명시적 type-only,403개는 syntactic value-eligible이며 실제 runtime loading 수가 아니다. | 내부 파일 이동이 consumer 계약 변경으로 번질 수 있다. Evidence High / 영향 Inference High. Studio의 모든 코드를 단일 facade로 바꿔야 한다는 결론은 아니다. |
| 2 | Model evaluate→assembly/faces→chat/references→evaluate 값 import cycle이 남고 facade도 chat validator/name helper를 호출한다. | domain 함수와 tool dispatcher가 같은 파일에 있어 책임과 의존 방향을 이해하기 어렵다. Evidence High / 유지 비용 Inference High. runtime 초기화 오류/성능 저하는 NOT_RUN. |
| 3 | Model feature 의미가 commands/editFields/checkNode/engine.part lowering/BINDS/COMMAND_DOCS에 반복된다. | 생성·편집·검증·저장/커널변환·parameter binding·tool 설명의 coverage 관리가 분산됐다. Evidence High / drift 위험 Inference Medium. 현재 모든 표가 불일치한다는 뜻은 아니다. |
| 4 | CAD root index는695행/529 export declarations이며 사용자 facade /api는별도7 declarations다. part-model.ts4523행에는 admission/evaluation/cache/result ownership/serialization/export가 묶인다. | 공개 사용자 경로와 전문 profile, 단일 파일의 여러 책임이 탐색/변경 비용을 만든다. Evidence High / 영향 Inference High. 줄 수와 export 문법 수는 결함/런타임함수 수가 아니다. |
| 5 | CAD snapshot/json/admitJSONText의동일본문3쌍을 TypeScript token으로 부모도 대조했다(각493/406/640tokens). | 정책/오류 drift 후보이며 실제 동작 결함은 아니다. own-data는이미47파일에서사용된다. paired4,194,304값 예산과 common1,048,576 예산, 오류wrapping/순서/-0/UTF8/rawduplicatekey 등 계약을맞추기전단순치환할수없다. |

## 현재 계층에서 필요한 반복

CAD는 geometry/B-rep/mesh 및 low-level kernel과 generic Part facade를 제공한다. Model은StudioDoc/parameters/refs/replay/edit/assembly를 그 위에 연결한다. Model StudioPart는 CAD Part<StudioDoc>와 backend를 사용하고 selector와error도CAD타입을재사용한다. public facade/문서 admission/실제 geometry 입력에서하는검사는보호경계가다르다. 이 wrapper·검증들을같은이름이라는이유로제거할근거는없다.

Model→CAD static선언은129개/116파일이며참조specifier는 @barocss/cad, /api, /internal/native-si-mass의3개다. 마지막경로도CADpackage에서명시export된경계여서 private bypass로분류하지않는다. package의큰의존방향과Model내부cycle은다른문제다.

## 정적 조사 방법과 한계

부모는pin의tracked src/examples TS/JS2561파일(test/fixture path제외)을gitcat-file로보존하고TypeScript5.9.3 AST의literal import/export만분석했다. parse diagnostic0은tsc/testPASS가아니다. dynamic imports/callback graph/실제emittedJS/typeusage elision/모든controller rootfile은전체분석이아니다. externalconsumer전체와bundle영향도미확인이다. 소스179파일·188경로는이방법의Studio→Model결합이며중복률이아니다.

초기gitgrep사전필터가알려진App경로를누락해그카운트를폐기하고alltracked방식으로교체했다. 원래preliminary JSON은limit표시와함께보존했다. 존재하지않는옛apps/cad-studio/src/engine/doc.ts 경로조회실패는읽기경로가정이며제품실패가아니다.

과거06c332감사의148exact/97structural후보수는이번수치로재사용하지않았다. 이번에직접확인한세본문쌍과동일/다른계약만사용한다. old전체CI미등록주장도재사용하지않았다.

## 추가로 구분할 읽기

안정된library공개surface와Studio전용applicationAPI를분리해의도된경계를확인할수있다. feature한종류를생성→수정→검증→변환→binding→설명교차표로읽으면의도적차이와빠진규칙을구분할수있다. 같은본문한쌍의caller별에러·소유권·예산을대조하면공유가능범위를줄일수있다. 이들은read-only판별조건이며이번에제품리팩터링/전체rename/새framework를구현하지않았다.

근거:
- research/cad-api-structure-review-20261029/review.md 및 verification/cad-api-structure-review-20261029.json
- research/cad-model-api-structure-review-20261029/review.md 및 verification/cad-model-api-structure-review-20261029.json
- verification/cad-model-api-structure-parent-20261029.json
- verification/cad-selected-duplicate-tokens-parent-20261029.json
- full-static-import-surface.json / full-tracked-source-capsule.json (이폴더)

## 후속 committed 변경 대조

exact c99cb121c42da75005d31cacacaa088f4b18a122의 CAD8/Model12 변경을 별도 읽고 부모가20파일의 SHA256/Git blob을 대조했다. wildcard/cycle/adapter 및 선택한 동일본문3쌍은 유지된다. 새 rectangular feature pattern은 기존 여러 feature 지원 표에 연결되고 공통 validator도 재사용한다. 따라서 모든 검증을 독립 중복 구현으로 부르면 안 된다. CAD part-model은 현재4547행이며 최초 pin4523행과 구분한다.179files/188subpaths/702declarations는 최초pin의정적수치이고 후속전체재집계나runtime수치는아니다. 후속 source/test정의 읽기는 실행/기하수락이 아니다.

기존로드맵 R4/R5의 완료는 해당 batch와 fingerprint 범위를 보존한다. 현재 잔여 책임·의존 방향은 R4/R5/R7의 후속 경계 확인에 연결한다. 구조 후보만으로 과거 완료를 전체 무효화하지 않는다. 두 current-delta.md 및 verification/cad-api-current-delta-parent-20261029.json 참조.
