# 다음 동역학 범위와 기능·화면 공동 검증 초안

상태: SOURCE_ONLY / 실행 승인용 초안. 이번 작업은 이 문서만 작성했다. 모듈 import, 컴파일, 솔버, 참조 계산, codec, 브라우저 검사는 실행하지 않았다. 다음 기능의 완료일은 실제 결과가 없으므로 **알 수 없음**이다.

다음 작업은 **기존 public World로 중력 낙하 한 상자와 간격을 두고 시작하는 두 상자의 중심 법선 충돌을 여러 단계에서 검증하고, 같은 Native 제공자의 실제 움직임을 데스크톱에서 확인하는 것**이다. 이 범위에는 새 물리 솔버나 새 public profile이 필요하지 않다. 8개 정지 스택을 일반 동적 8개로 확장하는 작업은 이후 별도 계약이다.

## 현재 경계: 무엇을 재사용하는가

| 현재 코드·계약 | 실제 동작 | 다음 단계에서의 사용 |
| --- | --- | --- |
| `packages/barocss-physics/src/world.ts:285–306` | 동적 물체에 힘/중력으로 속도를 갱신한 후 새 속도로 위치를 갱신한다. | 낙하 적분을 그대로 쓴다. |
| `world.ts:329–416`, `persistent-box-contact.ts:38–80` | 기존 8 outer passes와 manifold당 8 inner iterations; 법선·접선 누적 충격량과 쌍 위치 보정. | 기존 `rigid-persistent-box-v1`에서 중심·무마찰 1쌍을 쓴다. 횟수를 바꾸지 않는다. |
| `world.ts:364–379` | 그 단계에서 warm start 전 각 점의 반발 목표를 한 번 정한다. 엄격한 closing speed `>0.5`, 두 재료 중 작은 restitution. | 기존 충돌 법칙을 유지한다. 중력 낙하 첫 범위는 restitution0이다. |
| `collision.ts:178–202` | discrete 단일 접촉의 closing-speed 법선 충격량과 위치 보정. | 기존 discrete 경로를 비교 설명에만 쓴다. 이 작업에서 새 대체 경로를 만들지 않는다. |
| `world.ts:461–477`, `replay.ts:28–58` | 출력과 기록을 먼저 준비한 후 공통 상태/시계/기록을 함께 commit한다. | 기존 World/recorder/restore를 그대로 쓴다. 별도 시계·World·로그를 만들지 않는다. |
| `model-admission.ts:53–61` | public persistent는 최대4 bodies. discrete32, large64는 각각 별도 admission이다. | 한 동적 상자+바닥 또는 두 동적 상자는 기존 persistent 범위 안이다. body 수 한도는 물리 정확도 증명이 아니다. |
| `examples/physics-persistent-impact-2276/CONTRACT.md:12–22` | 중심·축 정렬 상자/바닥 또는 동질량 두 상자, 충돌은 무중력·무마찰. 별도 중력 e0 지지 회귀와 기존 공차/예산. | 원래 one-step 충돌을 다시 구현하지 않는다. 새 범위는 비접촉 비행→늦은 첫 접촉→그 후 여러 단계이다. |
| `examples/physics-motion-desktop-2276/CONTRACT.md:3–7`, `server.mjs:12–24` | 실제 `dist/index.js`, `dist/replay.js`만 Physics로 묶는 기존 데스크톱 구조. 표시용 Viewer/GPU Source 경계는 별도다. | 같은 해시의 Native 물리를 기능 검사와 화면 검사에 함께 쓴다. 표시 계층에서 위치를 계산하지 않는다. |

정지 스택의 public admission은 `stack/stationary-profile.ts:15–38`에서 정확한 8동적+바닥, 원래 g/dt/material, 초기 속도/각속도0을 요구한다. 빈 명령만 허용한다(`:42–45`). private `stack/prepare-step.ts:79–83`도 **매 단계 BEFORE 속도와 각속도0**을 요구한다. 이 거부를 제거하거나 비영 운동을 0으로 바꾸지 않는다. `normal-bridge.ts:138–142`는 현재 exact stationary witness를 호출하고 거부 시 멈춘다. 이전 QR로 fallback하지 않는다. `stationary-normal.ts:178–215`의 제한된 free Y 운동 허용은 중력으로 생성된 그 단계의 free 상태를 위한 것이다. 임의의 초기 동역학 지원이 아니다.

## 가장 작은 다음 구현

이 문서의 수치들은 새 bank의 **입력**이다. 예상 위치·속도·충격량을 엔진에 넘기지 않는다. 다음 저자는 별도 새 example 파일에 입력/검사/manifest를 고정한다. 기존 impact, stationary, 실패 영수증과 동결 소스를 수정하지 않는다.

1. **중력하 한 상자 낙하→바닥 접촉→e0 지지**: 기존 impact와 같은 2kg, half-extents `[.5,.5,.5]`, primitive COM inertia, 회전 identity/각속도0, 마찰0. 바닥 half-extents `[2,.5,2]`, 중심 `[0,-.5,0]`; 동적 중심 `[0,.75,0]`, 초기 속도0. g=`[0,-9.81,0]`, dt=`1/120`, restitution은 양쪽0. 처음에는 명확한 간격이 있어야 하고, 접촉은 step1보다 늦어야 한다. 실제 first-contact 단계와 그 앞/뒤 상태를 보존한다. 기존256-step 지지 길이 안에서 비행과 접촉 후 지지를 함께 본다. 기존부터 닿아 있던 support fixture의 재명명으로 통과시키지 않는다.
2. **두 상자의 지연된 중심 법선 충돌→분리**: 기존과 같은 동질량2kg, half-extents `.5`, 무마찰, 초기 회전/각속도0, 중력0, dt=`1/120`. 아래 상자 중심 `[0,-.5,0]`/속도0, 위 상자 중심 `[0,.625,0]`/속도 `[0,-2,0]`; surface gap `.125`. 기존 최소 반발계수 `.25`/`.8`을 쓴다. 바닥을 추가하지 않는다. 최소 한 단계의 실제 비접촉 운동 후 한 접촉쌍만 충돌하고, 그 후 상대 분리 속도를 확인한다. 이 단계는 **무중력 두 상자 충돌**이며, 두 상자의 중력 낙하/바닥 동시 충돌로 표현하지 않는다.
3. **같은 입력·같은 제공자 데스크톱**: 두 새 입력을 실제 Native World/recorder와 Viewer 표시 프록시에 연결한다. 기존 정지 스택 화면을 움직이는 것처럼 변형하지 않는다. 먼저 기능 bank가 물리를 통과한 동일 제공자/입력 해시를 화면에 묶고, 같은 기능 변경의 완료 조건에 실제 브라우저 검사를 포함한다. Source/Native 기능 PASS만으로 완료로 보고하지 않는다.

생산 코드 변경 예상: 이 두 표본이 기존 기준을 통과하면 **없음**. 필요한 변경은 새 bank/입력과 작은 데스크톱 입력·관측 어댑터다. 수치 실패가 나오면 첫 실제 실패/소스/입력을 보존하고 원인별 별도 최소 변경을 제안한다. 실패를 피하기 위한 timestep 축소, 통과 횟수 증가, 허용오차 확대, 정지 witness로 전환은 허용하지 않는다.

## 독립 물리 기준

다음 검사 수식은 후보의 반복 접촉 공식을 복사하지 않는다. actual BEFORE/free/post 상태, mass와 재료를 사용한다. binary64 입력 단어를 먼저 고정한다.

- **비접촉 탄도**: 독립 연속해 `v(t)=v0+g t`, `y(t)=y0+v0 t+g t²/2`에 비교한다. 기존 적분은 kick→drift이므로 위치를 연속해와 비트 동일하다고 요구하지 않는다. 일정 중력의 별도 폐형식 `v_n=v0+g n h`, `y_n=y0+n h v0+g h² n(n+1)/2`로 적분 순서를 확인한다. 연속해 위치 오차는 `g T h/2`; 기계 에너지 오차는 `-m |g|² T h/2`이며 이를 실제 에너지 보존으로 위장하지 않는다. 이 수식은 oracle 안에서만 계산한다.
- **dt 수렴**: 기존 `physics-motion-foundations-2276/world.test.ts:11–32`의1초/60·120·240Hz, 속도 `1e-11`, 위치 `<.083m`, 오차비 `[1.99,2.01]`를 그대로 유지한다. 새 free-flight cube control에서도 h/2에 따른 1차 위치·에너지 오차를 보고한다. 접촉이 들어온 경로에 탄도 연속해를 계속 적용하지 않는다. stationary의 고정 dt는 바꾸지 않는다.
- **첫 접촉 시간**: 실제 discrete 상태의 접촉 전 양의 surface gap와 접촉 단계의 free 상태를 저장한다. 닫힌 탄도/상대운동해의 접촉시각과 discrete 접촉 구간을 구분해서 보고한다. end-step 접촉이 연속시간의 정확한 TOI라고 주장하지 않는다.
- **법선 충돌**: 실제 접촉 직전 free 상대속도에서 Newton의 반발 법칙과 선형 운동량으로 outgoing 속도를 구한다. e는 원래 strict `>0.5`에서만 재료 min, 그 외0. 두 동적 물체는 reduced mass를 써서 법선 충격량과 `loss=(1-e²) reducedMass closingSpeed²/2`를 검사한다. 바닥 반력은 외력 충격량으로 취급한다. 전체 운동량이 그대로라고 요구하지 않는다.
- **중력/ledger/에너지**: `Δp = m g h + 접촉 충격량`을 검사한다. 접촉 법선 운동량과 COM 각운동량, 접선 충격량을 actual endpoint/arm에서 재구성한다. 접촉 kinetic loss는 free→post 속도로 검사한다. 중력 적분 에너지 오차와 위치 보정이 바꾼 potential energy는 별도로 보고한다. 이 항들을 빼서 임의 경로의 총 에너지가 정확히 보존된다고 표시하지 않는다.
- **기존 접촉 공차**: `physics-persistent-impact-2276/cases.mjs:26`과 계약20행의 velocity/omega/impulse/momentum/angular momentum/gap/energy `1e-10` SI, tangent `1e-12Ns`를 유지한다. 접촉 후 미침투/지지 단계에는 해당 gap 기준을 쓴다. 비접촉 비행 중 정상적인 양의 gap를0과 비교하지 않는다. 반복성/Source·Native/복원 비교는 기존 identity 정규화 범위 외 모든 값·단어를 보존한다.

새 bank의 정확한 case/step 수는 저자가 실행 전에 고정해야 한다. 상한은 기존 impact 범위인 graph당 최대48 Worlds,1024 accepted steps,16MiB evidence를 넘기지 않는다(`cases.mjs:27–30`). 원래20 finite/256 support 등을 가진 고정287-step bank는 수정·재가격화하지 않는다. 새 검사는 별도 bank다. replay 재생, control과 dt별 실행도 합계에 포함한다. 예산에 안 들어가면 범위를 다시 잘라 계약을 고정하며, 자동 재시도나 cap 상승으로 해결하지 않는다. 기존 World step 한도,512-frame/1MiB recorder, 모델/명령 한도,170 inner/180 outer와 output/wire/scratch 제한을 그대로 사용한다.

## 실제 새 솔버가 필요한 지점

위 두 입력을 위해 새 솔버를 먼저 쓰는 것은 중복이다. 다음에 **한 물체가 여러 접촉쌍에 동시에 묶이거나 비영 운동이 남는 다물체 normal 문제를 독립적으로 보증할 때** 새 private dynamic 단계 계약이 필요하다. 기존 sequential persistent가 일부 입력을 실행할 수 있다는 사실만으로 그 보증이 생기지 않는다.

- 이미 있는 `stack/normal-solver.ts:250–285`의 `solveNormalContacts`는 자유 속도에 대한 질량 가중 최소 변화와 homogeneous normal constraints를 다룬다. free velocity, 각 DOF, 남는 운동을 처리할 수 있다. 이 코드를 읽고 필요한 새 **동적 bridge/admission/result 검증**을 만드는 것이 첫 후보이며 같은 QR 솔버를 복사하지 않는다. 현 normal budget64/각 counter·rank·잔차 한도를 유지한다(`:32–36`). 이 솔버는 restitution 목표나 friction solver가 아니다(`:249`).
- 현 exact stationary solver는 floor→chain 평형이 증명된 경우에만0을 출력한다. 일반 동적 결과를0으로 만드는 데 재사용할 수 없다. 현 Fraction stationary checker의 zero-after 증명도 동적 checker로 재명명할 수 없다. 동적 검사는 actual `M(v_after-v_free)=Jᵀλ`, λ≥0, normal feasibility/complementarity와 비영 해를 검사해야 한다. 작은1/2body 경우는 독립 폐형식으로 먼저 확인하고, 그다음 고정된 소수 다접촉 문제에 독립 matrix check를 더한다.
- `stack/full-pair-phase.ts:68–93,107–112`는 모든 eligible PRE pair의 signed row를 cold solve하고 HYP를 검사한 뒤 **위치 평행이동만 한 번** 적용한다. `full-pair-rows.ts:69–98`는1..9 bodies/최대36 pairs의 원래 bounded zero-restitution profile과 완전한 pair 목록을 요구한다. `:117` 이후는 비접촉쌍도 signed row를 만든다. 이 기하·행 구성·post-check는 후속 dynamic e0 단계의 재사용 후보지만, 속도 충돌·회전 접촉·시간 적분 자체를 해결하지 않는다. row prune/접촉 수 축소는 하지 않는다.
- 현재 `world.ts:309–316`은 sweep 후 기존 접촉 루프로 간다. `ccd.ts:44–60`, `ccd-box.ts:23–39`는 경로의 첫 hit에 위치를 두고 기존 `1e-9` offset을 적용한다. 이후 `world.ts:329–477`에는 impact 뒤 남은 시간에 대한 새 적분/재탐색 단계가 없다. 따라서 이것을 **TOI 이후 remainder를 끝까지 적분하는 동적 단계**라고 부르면 안 된다. 그 요구가 생기면 남은 시간의 중력·충돌 순서·재충돌/예산을 소유하는 별도 bounded 알고리즘과 참조가 필요하다. 이 계획은 기존 CCD offset/공차도 바꾸지 않는다.

후속 순서는 ‘한 낙하→한 쌍의 지연 충돌→둘+바닥의 서로 떨어진 충돌 사건→작은 동시 normal 문제’다. 앞 단계의 PASS가 다음 단계의 PASS가 아니다. 일반 동적8, 기울어진/오프센터 충돌, 충돌 유발 회전, 마찰/굴림/접선 결합, 동시 반발 충돌, 관절·구동·CCD remainder는 이 다음 계약에서 **NOT_QUALIFIED/NO_GO**다. 기존 profile의 이미 지원하는 회전·마찰 기능을 제거한다는 뜻은 아니다. 이 새 확장 주장의 경계다.

## 기능과 데스크톱을 함께 통과시키는 조건

다음 구현의 acceptance 단위는 수치 영수증과 화면 영수증의 쌍이다. 같은 model/options/Native provider 해시로 연결해야 한다.

1. 새 case source/contract/pins 고정→actual public Source와 genuine Native 기능 검사. 독립 탄도/충돌/운동량/에너지, 첫 접촉 전후 words, 입력 보존, record/save/restore/continue를 검사한다. 오류 시 상태/시계/기록 유지와 다음 실제 retry/control도 검사한다. 기존 비용·실패/정지8 영수증은 보존한다.
2. 실제 dist root/replay만 Physics로 해석하는 기존 데스크톱 build/serve 분리를 재사용한다. 현재 `physics-motion-desktop-2276/server.mjs:14–19`의16MiB bundle/각 asset1MiB/metadata1MiB/2048 inputs 상한을 유지한다. 새 입력 어댑터를 별도로 만들어 동결된 현재 장면/영수증을 덮어쓰지 않는다. Viewer/GPU Source 표시는 Physics Native와 구분한다.
3. `physics-persistent-impact-2276/scene/app.mjs:21–22`는 현재 step1을 firstImpact로 저장한다. 새 지연 충돌 장면은 actual 첫 contact/법선 충격량 발생에서 한 번만 저장해야 한다. `:11–15`의 energy 표시도 현재 zero-gravity/mass2 전용 계산이므로, 낙하에 연결할 때 actual model mass·primitive inertia의 kinetic/potential/integrator-error 항을 구분한다. 기존 숫자를 중력 총 에너지로 relabel하지 않는다. 이 두 관측 어댑터 변경이 최소 필요한 화면 측 코드다.
4. 현재11-check desktop 프로토콜을 같은 범위에서 적용한다: 시작 paused; step/play/pause/reset/record clock; 초기 간격에서 실제 낙하; 늦은 첫 접촉; 충돌 후 분리/정지; accepted body transform의 Viewer 표시와 SI→mm 한 번; 원시 상태/숫자 표시 일치; 실제 mesh pixels; camera/resize;1280/1440/1920. 모바일은 검사하지 않는다. 화면 보간·모션 preset·예상 pose로 움직임을 대신하지 않는다. 새 설명 레이어는 추가하지 않는다.
5. 공개 실패는 첫 결과를 보존한다. 기능은 PASS여도 화면이 멈춤/오표시이면 이 기능의 공동 acceptance는 미완료다. 반대로 픽셀에서 움직임이 보여도 물리 oracle 실패면 미완료다. Studio/CAD/제조·장비 HOLD, 배포/릴리즈 상태는 바꾸지 않는다.

다음 승인 가능한 구현은 **위 두 새 표본과 공동 기능·데스크톱 gate**다. 현재 문서는 구현/실행 결과가 아니다. 실제 결과 전까지 새 dynamic step 및 화면의 상태는 NOT_RUN이며, 일반 동적8의 완료일도 알 수 없다.
