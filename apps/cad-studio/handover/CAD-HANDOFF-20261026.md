# CAD 인수인계 — 작업 중

이 문서는 기존 단일 작업 기록의 이동용 사본입니다. 별도 작업 목록이 아닙니다. 작업과 자동화는 계속 중이며 원격 push는 하지 않았습니다. 실제 HEAD와 최신 담당 반환을 먼저 확인합니다.

## 재개 기준

같은 폴더의 `cad-coordinator-checkpoint-20261026.json`을 읽고 실제 사용량과 담당 상태를 대조합니다. 로컬 작업 권위는 `/Users/user/.cache/barocss-preserved/2026-10-24-codex-integration/round3/coordinator-api-active-20261025.json`입니다. 원격 clone에 로컬 pending ref와 외부 원자료가 있다고 가정하지 않습니다.

Kernel·GPU·CAD·CAD Model 기반을 먼저 구현하고 같은 기능을 Studio에서 완성합니다. 기능 소스→필요한 한 배치→실제 소비·파일 흐름→제품 통합 순서입니다. 유효한 검사를 반복하지 않습니다.

## 제품에 반영한 G15 범위

검증한 제품 코드는 `28a62d2ec02f334f5fb7613fbb096e2926fd5b20`입니다. 정상 no-ff 부모는 이전 제품 metadata `5f0e1890809add671c11324d5c5e5f7d344dd7fb`와 검증 소스 `8cddcd05fd3a388472d5a01b4a43e09cdf8a50aa`입니다. 변경 23경로가 소스와 같으며 제품 독립 18경로와 실제 foreign32를 보존했습니다. 이 문서의 후속 commit은 metadata/evidence 변경입니다. 새 실행 PASS가 아닙니다.

- Point/spot 그림자 필드의 Model 저장·읽기, 공통 입력 거부, Studio 제어와 GPU 전달을 연결했습니다. CAD1mm=GPUworld1이며 반경의 추가 변환은 없습니다. 기존 intensity의 size²×0.05만 유지합니다. false·0·생략과 caster 예산을 보존합니다.
- 실제 독립 조명·반경2.5/4.25mm·잘못된 입력 거부·Undo/Redo·Save/New/Open·PNG export를 확인했습니다. 원 파일13개와 export PNG1개를 `evidence-20261027/g15/downloads/`에 그대로 보존했습니다. 최종/재Open JSON 의미는 같고 camera 키 순서만 달라 byte는 다릅니다.
- 거부 안내가 화면 밖에 남던 문제는 sticky class1곳으로 수정했습니다. 해당 실제 거부만 다시 확인했고 accepted 파일 byte가 유지됐습니다.
- 원22f Model5·Studio4·Modeltype PASS 뒤 Studio 시험의 TS2339가 발생했습니다. 빈 배열 assertion1곳만 정상 교정한 뒤 Studio type와 생산3 lint를 통과했습니다. 기존 첫3단계는 반복하지 않았습니다.
- API 목록은 6665→6666, 추가1/변경4/삭제0입니다. 검토한5행만 expected에 반영했습니다. 공통 문서/site와 실제 문서2페이지를 확인했습니다. 제품 첫 GPU emit288(JS144/선언144), 실제 type1188과 필수 docs35/0/47/3755/819는 PASS입니다. 기존 잔류240개는 새 emit이 아닙니다.
- 실제 제품28a에서 원 BCAD1회를 열어 조명·모델·바닥 그림자를 확인했습니다. 관련 served source11개는 sourceMap원문=Git=disk입니다. 오류·경고0입니다. 원 viewport PNG2장은 `evidence-20261027/g15/`에 있습니다. 담당과 root가 직접 봤습니다.

전체 GPU 품질, PCSS 원인 분리, spot 그림자 새 인수, 성능, 실측·제조·release 수락은 아닙니다. 초기 full 캡처의 탭 상태 변화는 원인 미확정으로 보존합니다. 이후 viewport 캡처에서는 같은 Lights 탭이 유지됐습니다. 본인 Chrome/Vite/slot과 모든 source 핀은 반환했습니다. 전체 후손 종료와 runtime read graph는 미입증입니다.

## 이미 마친 CG1

제품 `7a62d6dfd336659b57958bf5a5af64e17ddb9c0b`의 bounded copied-guide loft는 위 제품의 조상입니다. Model/Studio Preview·Apply·Undo/Redo·실제 파일 왕복을 마쳤고 실제 파일6개/PNG2개는 `evidence-20261027/cg1/`에 있습니다. 원곡선 편집을 나중에 추종하는 live 참조는 아닙니다. 기존 실패와 정확한 범위는 유지합니다.

## 현재 구현과 다음 행동

공통 소스는 `1c48eaa12cb3efc874b6ae3b53a84d05c6f9b5aa`이다. 제품에서 실제 검증한 최신 코드는 `ca10a3a8ea5ce1a60cb6850062dfb1eaec157828`이다. 제품의 후속 문서 commit은 새 기능 실행 PASS가 아니다. 공통 로드맵은01–19번이며 실제 배정은 기존 단일 기록만 사용한다.

- Studio UI5: 원2e7→root1c80, 공통 타입/lint·기본 화면을 완료하고 제품ca10a3와 필수 제품 docs 검사까지 마쳤다. 오류·단위·기존 Hud 키보드 guard를 보존했다. 다음 키보드 tooltip은 Outer 독립 소스이며 아직 미완료다.
- Viewer: 정상10개 묶음은 공통에 채택했고 기존 SDK/앱·원본 점 검사는 한정된 담당 검증을 마쳤다. 제품 미채택이다. 새 측정·조립품 거리·리뷰는 별도 소유 작업이다. 정상 commit/실행/파일 결과를 받아 기존묶음과 구분한다. packaging/config/hook 중단은 유지한다.
- Drawings 독립 프레임: 기본 소스와 교정 consumer/types/lint, 실제 Add/편집/숨김/Move·Save/New/Open/SVG·삭제를 마쳤다. 최초 native5PASS/1FAIL은 보존했다. 거부 안내 가시성은 공통4175에서 실제 PASS·전반환했으나 표제란 일부를 가렸다. 전용 상태행 소스4e→rootb467을 채택했고 같은 화면1건의 비중첩/입력 확인은 GPU창 반환 뒤다. 제품 미채택이다.
- 공통03 절삭 피처 선형 반복: Core05→4d887c9e7, Model503→11a8b6c9b, Studio9ee→1c48eaa12의 정확 정상 delta를 채택했다. migrate의 schema4/route admission과 기존 Core/키보드 보호를 유지했다. 최초 합동 build/새4/Model두파일 한 runner/types2/lint13은 아직NOT_RUN이다. GPU02창 뒤 실행하고 실제 소비·파일·제품으로 마감한다.
- Docs: 실제 Kernel API3결과와 JPEG3, 메뉴/Studio6안내·현재 API계약 문서를 공통에 채택했다. 새Model 기본 샘플/producer3/별도JPEG는 private 정상f4→189 후보이다. 새3결과와새8샘플은 담당 실제PASS이나 전체164는159PASS/2FAIL/3CANCELLED이다. spring closed-ground의[GEOMETRY]와CLI경로 실패를 별도로 보존하고 담당 수리/환경복구를 진행한다. 최종공통public목록·docs/site·제품은 아직대기다. 과거 c7e/source와Node18실패를 새 소스로 재라벨하지 않는다.
- GPU: fe2637 PT visibility와607f7d RenderTarget은 소유 새필수배치·공개PNG·정리를 완료했다. 최신 직접 지시대로 다른 위치 인계이며 이root제품에 자동병합하지 않는다. 현재02.1 sized target8de의 소유 실행창이며03.1 GLB2b056은 정상source후보/새실행대기다. 다른레인실행과겹치지않는실제반환을조정한다.
- Kernel 독립07: K02 0d2e1abc/K03 51a59aaa는 정상source완료/실행NOT_RUN/공통미채택이다. 새spring 실제오류를 최소교정으로 우선한다. 원WIP와기존source를보존한다.
- 전체 API 설계: `api-public-model-direction-20261027.md`의 원본/진입점/커널·GPU계층 방향을 따른다. Model을 사용자 설계 원본으로 삼고 일반Part/Assembly를 같은 진입점에서 쓰되, 기존import·format·참조·typed오류를 보존한다. 전체 메서드 차이표와 호환이행은 미완료이며 물리적패키지합침은 아직결정하지않았다.

각 담당이 내부 분할과 취합을 맡는다. 필요한 실제 UI·파일·오류·source 결속과 자기 정리를 수행한다. 독립 source는 병렬이며 무거운 실행은 하나씩 한다. 정상기능을 같은원본의 소스→필요한한배치→실제소비/파일→제품으로 닫고 유효PASS를 반복하지 않는다. 다음 source준비를 제품완료로 표시하지 않는다.

## 중단·push 조건

이번 저장 관측은 사용72%/남음28%, secondary unavailable이다. 재개할 때 실제 도구로 다시 확인한다. 어느 유효 Codex 창이든 남음5% 이하면 전체6담당과 자체 agent의 새 작업/자동next를 멈추고 안전 checkpoint·source/runtime/archive 반환을 받습니다. 검증된 exact commit만 필요한 최소 통합을 마칩니다.

미완료/NOTRUN·담당·재개 조건·로컬/원격 SHA를 적고 정상 commit합니다. root만 사용자 승인된 origin feature branch를 normal push하고 원격 SHA를 확인한 뒤 cad 자동화를 PAUSED로 바꿉니다. force/main/develop rewrite/PR/release/reset/credits 사용은 금지합니다. 기존 중단·권한·브랜치 보호·P2 HOLD는 유지합니다.
