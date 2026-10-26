# CAD 인수인계 — 작업 중

이 문서는 기존 작업 기록의 이동용 사본입니다. 별도 작업 목록이 아닙니다.
현재 중단하지 않았고, 원격 push도 하지 않았습니다. 실제 HEAD와 새 담당 보고가 이 사본보다 우선합니다.

## 먼저 읽기

1. 같은 폴더의 `cad-coordinator-checkpoint-20261026.json`을 읽습니다.
2. 실제 사용량을 확인합니다. 어느 유효 Codex 창이든 남음5% 이하면 조건부 중단·마감 절차를 실행합니다. null은 unknown입니다.
3. 로컬 단일 기록 `/Users/user/.cache/barocss-preserved/2026-10-24-codex-integration/round3/coordinator-api-active-20261025.json`과 각 HEAD/담당 상태를 대조합니다.
4. Kernel·GPU·CAD·CAD Model 기반을 먼저 만들고, 같은 기능을 Studio에서 완성합니다. 기능 소스→필요한 한 배치→실제 소비 흐름→제품 통합 순서를 지킵니다. 기존 유효 검사를 반복하지 않습니다.

## 완료된 CG1 범위

검증 제품 코드: `7a62d6dfd336659b57958bf5a5af64e17ddb9c0b`.
부모는 기존 제품f1af와 수정 소스3751a3입니다. 두 단면과 복사한 quadratic/cubic guide를 사용하는 bounded loft의 Model API와 Studio 흐름을 통합했습니다.

실제 Preview/Apply·Undo/Redo·Save/New/Open을 마쳤습니다. 원 스케치와 direct 객체를 보존합니다.
실제 Save6개와 앱 PNG2개는 `evidence-20261027/cg1/`에 있습니다. 원본 그대로 복사했습니다.
원곡선의 나중 편집을 추종하는 live 참조 기능은 아닙니다.

필수 제품 docs 최초1회:35pages/0작성중/47shots/3755KB/807labels, stderr0. PID99990 actualwait0·4exit0·release0·ownslot부재, source/tool3267·foreign33·CAD818·실제GPU528 불변입니다.
원 lease의 GPU288은 실제 디렉터리528와 구분합니다. 이것은 새 GPU emit 결과가 아닙니다.
공통 문서/site 및 실제 문서4페이지의 공식CUA 표시도 완료했습니다. CUA 원이미지는 JPEG이며 CLI CDP 미지원 NOTRUN과 분리합니다.

## 보존한 실패와 통합 경계

- 원902 Modeltype4 FAIL, collector cwd 오류, 원0b Guide None-only 실패를 보존했습니다. 각각 최소 정상 child로 고쳤습니다.
- 원159482 docs 실패2건은 generated DIRECT_PICK 행과 굵은 제목 내부 줄바꿈입니다. 원 source generator1회와 Docs 정상 child로 고쳤습니다. `/usrsbin` 외부 launch 오타도 원형 보존했습니다. 실제 pinned stage는 Node 전에 올바른 PATH를 export합니다.
- 제품 merge의 첫 postassert는 모든22파일이 source와 같다고 가정해서 실패했습니다. 실제 union tree는 예상과 같고21파일은 byte 일치합니다. 나머지 studio/files는 기존 제품의 더 정확한 STL dimensionless/no-guaranteed-error 문구를 정상3way로 보존한 결과입니다. merge를 다시 하지 않았습니다.
- 제품 foreign33과 타인 WIP·탭·프로필·서버는 보존합니다. descendants와 전체 runtime read graph는 증명하지 않았습니다.

## 현재 G15와 다음 행동

공통 소스: `22f856ed8fd2fb6479ad8ca806bc13f8d48a6b2f`.
정상 donor33a/009b/845/498의 정확 delta19경로를 채택했습니다. 기존 DoF/PT/focus는 두 파일의 정상3way로 보존했고 App은 바꾸지 않았습니다. 이 소스는 아직 제품에 없습니다.

첫 Model5·Studio소비4·Modeltype는 PASS입니다. StudioType은 시험107행의 `never` 오류1개로 실패했고 production3lint는 NOTRUN입니다.
원인은 `assert.deepEqual(lights, [])`가 mutable property를 never[]로 좁히는 점입니다. Outer가 소유 test1파일의 빈 배열 조건만 length0으로 고치는 정상 child를 맡았습니다.
root가 정확 child를 채택한 뒤 새SHA/newattempt에서 수정후StudioType+아직미실행production3lint2명령만 마칩니다. 생산 bytes가 그대로면 기존 Model5/Studio4/Modeltypes를 반복하지 않습니다.
그다음 Outer가 자기 agent-browser session으로 독립 조명·반경·거부/보존·UndoRedo·실제 파일/capture 흐름을 실행합니다. 중앙 새 브라우저 승인을 기다리지 않습니다.

CAD1mm=GPUworld1입니다. radius 추가 scale은 없습니다. 기존 intensity의 size²*.05만 유지합니다. false/0/생략·caster 예산·accepted 설정 보존을 지킵니다.

준비된 다음 cut은 Viewer V5 정상체인65a208b4와 standalone drawing frames d68d6e49+ac53b888입니다.
Viewer README의 중단된 packaging 지침은 되살리지 않습니다. Drawing issues.ts는 기존 root dimension-clearance 수정을 정상3way로 보존합니다.
정확한 담당·현재/다음·의존성·근거는 JSON 사본과 실제 단일 기록에 있습니다. 남의 하위 agent를 직접 운영하지 않습니다.

## 중단·push 조건

현재 실제 사용50%/남음50%, secondary unavailable입니다. 유효한 창의 남음이5% 이하면 모든6담당+자체agents의 새 작업/자동next를 멈추고 안전 checkpoint와 소스/runtime/archive 반환을 받습니다.
검증된 정확 commit만 필요한 최소 통합을 마칩니다. 미완료/NOTRUN/담당/재개 조건과 로컬·원격 SHA를 적고 정상 commit합니다.
root만 승인된 origin feature branch를 normal push하고 원격 SHA를 확인한 뒤 cad 자동화를 PAUSED로 바꿉니다. force/main/develop rewrite/PR/release/reset/credits 사용은 금지합니다.

지금 pending commit은 로컬에만 있을 수 있습니다. 원격 clone만으로 모두 복구된다고 주장하지 않습니다.
이 handoff commit은 metadata/evidence 변경입니다. 새 제품 실행 PASS로 재라벨하지 않습니다. 전체 로봇·free-forward·실측·제조 완료가 아니며 P2는 HOLD입니다.
