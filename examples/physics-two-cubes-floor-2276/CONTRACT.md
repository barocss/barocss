# Stage A — 두 상자와 바닥: 독립 낙하·지지의 공동 검증

상태: **SOURCE_ONLY / 실행 전 동결 계약**. 이 저자는 contract와 oracle source만 작성했다. candidate/reference import, 테스트, 컴파일, 수치 계산 실행, codec, 브라우저 실행을 하지 않았다. Root만 기존 gate 아래 실행한다. 기존 엔진, 제공자, API, 정지8, dynamic-next 소스/계약/실패 영수증은 바꾸지 않는다. 다른 작성자의 cases/run/tests/UI는 별도 소유다. 완료일은 실제 결과가 없어 알 수 없다.

이 단계는 **서로 떨어진 동적 두 상자가 유한한 정적 바닥에 각각 충돌하고 지지되는 경우**다. 바닥이 공유되어도 질량0인 바닥에는 상태 DOF가 없으므로 두 동적 물체의 법선 운동은 직접 결합되지 않는다. 두 바닥 접촉이 나중에 함께 존재하는 것과 동적 물체끼리 힘을 전달하는 chain은 다르다. 실제 상자–상자 접촉을 발견하면 이 단계는 거부한다. 일반 다중 접촉, 동적8, 수직 chain을 통과했다고 선언하지 않는다.

## 고정 입력·실행 경계

public `createPhysicsWorld`와 기존 `rigid-persistent-box-v1`/direct, SI/right-handed XYZ/XYZW를 사용한다. 별도 World/시계/솔버/factory/fallback을 만들지 않는다.

- 두 동적 상자: 각2kg, half-extents `[.5,.5,.5]`, primitive-COM inertia, 초기 orientation `[0,0,0,1]`, 속도·각속도0.
- 초기 중심: 왼쪽 `[-.75,.75,0]`, 오른쪽 `[.75,1.25,0]`.
- 정적 바닥: 중심 `[0,-.5,0]`, half-extents `[2,.5,2]`, identity orientation. 윗면Y0, 모든 static 상태 단어 보존.
- 중력 `[0,-9.81,0]`. 모든 restitution0, static/dynamic friction0. 센서·CCD·필터·sleep·관절·cloth·fluid·Source binding·명령 없음.
- 세 case ID: `separated-60`=dt1/60×128, `separated-120`=dt1/120×256, `separated-240`=dt1/240×512. h는 실제 JS Number이며 동일한 명목 전체 시간128/60초다. primary 합계896 actual accepted transitions/graph.

기존 graph당48Worlds/1024 accepted steps/16MiB evidence, 요청2MiB, numeric-word payload512KiB, inner170s/outer180s와 기존 output/scratch/recording512frames·1MiB 한도를 유지한다. restore 재생/control/repeat도 실제 카운터에 포함한다. 실행자 계획은9Worlds/1022 accepted steps이며 실제 호출로 확인해야 한다. oracle는 받은 state 수만 셀 수 있고 World/restore/solver 호출 수를 추정하지 않는다.16MiB는 새 graph의 증거 한도이며 새로운 RSS/전체 heap 인증이 아니다. 실패 후 cap·시간·횟수·공차를 바꾸거나 자동 retry하지 않는다.

Source와 genuine Native public root/replay를 각각 실제 실행한다. 제공자·도구·입력·oracle·runner 소스를 import 전에 고정하고 cleanup 후 다시 확인한다. 이전 PASS나 Source만으로 Native/화면 PASS를 대체하지 않는다. 실제 첫 실패와 도달한 데이터, stdout/stderr, 물리 NO_GO를 보존한다. 기존 known/unknown 오류의 상태·시계·모델·recording 유지와 정상 retry/control, 실제 save/restore/continue를 함께 검사한다. expected pose/impulse는 엔진 입력으로 쓰지 않는다.

## 독립 참조 wire

`oracle.py`는 Python 표준 Fraction/JSON/math/struct/sys만 사용한다. candidate, package, fixture builder, SAT, clipping, 반복 접촉 solver를 import하지 않는다. 이전 dynamic-next oracle의 유한 숫자/벡터/word restore utility를 **소스 복사**했으며 기존 파일을 import하거나 변경하지 않는다. 새 물리/기하 판정은 이 단계용으로 별도 작성했다.

JSONL 한 줄: `{format:'two-cubes-floor-case-v1',data:{caseId,model,options,states:[initial,...actualPublicStates]},numericWordsF64leHex}`. 모든 data 숫자 leaf를 JS Object.keys/array 순서로 순회한 F64LE16hex가 sidecar다. envelope/sidecar 자체는 숫자 순회 대상이 아니다. `restore_words(data,hex)`는 유한 Number 값 일치와 모든 word 소비를 요구하고 -0을 복원한다. boolean, 비유한 수, 중복 JSON key, 누락/여분 word, 비영 값 불일치, 범위 초과는 거부한다. 복원한 카운터는 Python float일 수 있으므로 유한한 정수 값인지 검사한다.

한 줄은 newline 포함2MiB, process 누적16MiB/8요청, depth32/nodes262144/65536 numeric words, reply64KiB다. 실제512-step case가 들어가지 않으면 첫 refusal을 보존하며 이 계약에서 몰래 chunking/압축/limit 상승으로 바꾸지 않는다. 각 case는 초기 상태부터 모든 실제 단계가 있어야 한다. public clock, body/collider 링크, identity, static raw words를 확인한다.

export는 `restore_words(value,hex)`와 `verify(data)`다. CLI는 stdin JSONL에 대해 한 줄씩 `{ok,resolved,executionFailure,status,violations,metrics,certificates}`를 반환한다. 물리 gate 실패는 resolved/ok=false, 잘못된 입력은 executionFailure=true/resolved=false다. 최대32 violations에 actual step/body를 넣는다. 측정값이 binary64 보고 범위를 넘으면 명시적 문자열을 쓰며0/Infinity로 바꾸지 않는다. actor 카운터나 QR 통계를 위조하지 않는다.

## 물리·기하 gate

모든 수식은 실제 입력/상태의 binary64를 Fraction으로 해석한다. 엔진의 per-point iterative update나 warm-cache 공식을 복사하지 않는다.

1. **각 상자의 비접촉 낙하**: 그 상자 자신의 첫 접촉 전까지 독립 closed form `v_n=g*n*h`, `p_n=p0+g*h²*n(n+1)/2`를 검사한다. 왼쪽이 이미 지지되어도 오른쪽의 아직 비접촉인 낙하를 계속 검사한다. free velocity1e-11m/s, 나머지 SI 잔차1e-10이다. 연속해 `p(t)=p0+g*t²/2`, `v(t)=g*t`와 기존 kick-drift 오차를 구분한다.
2. **일치하는 접촉 전 시간**: 세 dt의6/12/24번째 실제 상태에서 명목T=.1s를 비교한다. 두 상자가 모두 아직 비접촉이어야 한다. body별 signed/absolute 위치·기계 에너지 오차, 실제 clock, analytic first-order defect를 보고한다. scalar `metrics.precontactPositionErrorM` 및 `precontactEnergyErrorJ`는 각 body의 absolute error 중 최대다. 실행자는60/120/240 두 지표의 비율을 기존 `[1.99,2.01]`로 검사한다. 이 에너지 오차는 실제 비보존 오차이며 보존한 것처럼 표시하지 않는다. Fraction 이론 defect `-m*|g|²*T*h/2`와1e-10J 안에서 일치해야 한다.
3. **실제 첫 충돌과 지지**: 각 body의 actual first contact는 step1 뒤에 있고 왼쪽보다 오른쪽이 늦어야 한다. 둘 다 실제 바닥 충돌을 하고, 이후 두 바닥 접촉이 함께 존재해야 한다. 각 body의 첫 접촉 후 매 단계 실제 바닥 contact/0 속도/바닥 gap을 검사한다. 지지 단계 수는 actual first index와 받은 끝 index로 보고하며 솔버 호출 수로 해석하지 않는다.
4. **Newton e0·운동량·각운동량·에너지**: actual BEFORE+중력에서 free velocity를 독립 재구성한다. e0/fixed-floor 법선 반발 속도0, λ=`m*closing`, kinetic loss=`m*closing²/2`를 Newton/운동량으로 검사한다. 실제 A/B public impulse와 tangent를 body 부호에 맞춰 합산해 `m Δv=m g h+J`, `I Δω=arm×J`를 검사한다. impulse/velocity/spin/body momentum/COM angular momentum/kinetic energy/최종 floor gap1e-10 SI, tangent1e-12Ns를 유지한다. 실제 바닥 반력을 외력으로 처리한다. public aggregate impulse만 알 수 있으므로 private 점별 multiplier 분포를 추정하지 않는다.
5. **대표점 기하 — 별도 원래1e-12m**: public aggregate `pointM`만 독립 검사한다. actual quaternion에 대해 정확한 `q / |q|²` 회전 행렬/역회전을 구성해 point−COM을 각 local frame으로 바꾼다. 바닥 local 윗면과 유한 X/Z footprint, 상자 local 아랫면과 모든 extents 경계를 각각1e-12m로 검사한다. normal unit/direction은 별도1e-12 기준이다. SI1e-10을 이 기하 주장에 재사용하지 않는다. candidate clipping/SAT 법선·면 판정 구현을 부르지 않는다. 실패하면 첫 NO_GO이며 tolerance를 확대하지 않는다. 이 검사는 public 대표점1개/쌍이다. private manifold4점, strict-line32 witness의 통과 주장이 아니다.
6. **독립 접촉의 기하 증명**: actual quaternion으로 각 상자의 world-X projection half-extent를 exact 계산한다. 왼쪽 최대X와 오른쪽 최소X 사이의 **엄격히 양인 실제 gap**가 매 단계 있어야 한다. 원래.5m gap의 변동은 SI1e-10 이내여야 한다. 각 상자 projection의 유한 바닥 X/Z footprint도1e-12m로 확인한다. 어떤 moving-moving public contact도 허용하지 않는다. 각 body의 floor bottom gap는 실제 orientation/extent로 계산한다. 이것은 정적 floor와의 독립 두 접촉을 보증하며 동적 chain의 결합식을 풀었다는 뜻이 아니다.
7. **시간·projection 진단의 한계**: 각 body의 연속 접촉시각은 `sqrt(2*initialGap/|g|)`이며 actual discrete sample interval과 나란히 보고한다. kick-drift는 연속해보다 일찍 접촉할 수 있으므로 연속 root를 actual before/after에 억지로 넣지 않는다. 제곱 시간으로 `[(n-1)h,(n+1)h]`의 정직한 h-scale 구간을 검사한다. exact continuous TOI/remainder를 주장하지 않는다. public 상태에 private rounded free position이 없으므로 projection potential work 재구성은 그 반올림 잔차도 포함한다. max/body별 누적 값을 따로 보고하고 총 에너지를 보존한 것처럼 만들지 않는다.

## 기능·public World·desktop 공동 완료 조건

다음 결과의 세 항목을 같은 입력/Native provider 해시로 연결한다: (a) 독립 oracle Source/Native 수치 PASS, (b) 실제 public transaction/recorder/restore와 full-word parity PASS, (c) 실제 데스크톱 동작·표시 PASS. 수치만 통과하면 이 단계의 공동 완료는 미완료다. 픽셀에 움직임만 보여도 물리 실패를 대체하지 못한다.

화면은 같은 accepted public 상태만 표시한다. 초기 간격, 서로 다른 첫 바닥 충돌, 나중의 두 독립 지지, actual 단계/시계/법선 impulse와 자세를 확인한다. 기존 step/play/pause/reset/record·camera/resize와1280/1440/1920 desktop 기준을 유지한다. SI→mm 변환은 한 번만 한다. 표시 계층에서 예상 탄도/pose를 적분하지 않으며 새 설명 레이어를 추가하지 않는다. Physics는 실제 dist root/replay, Viewer/GPU Source 경계는 별도 표시한다. 모바일·배포·release·Studio/CAD/제조/장비 HOLD는 변경하지 않는다.

**Stage B는 아직 NOT_QUALIFIED다.** Stage A의 수치/public World/desktop이 모두 통과한 후에만 ‘바닥에 놓인 아래 상자 위로 위 상자가 낙하하는’ 진짜 동적 결합 chain을 별도 입력/실패 baseline/closed-form global normal 계약으로 시작한다. Stage A 결과를 Stage B로 바꿔 부르지 않는다. 회전·마찰·기울어진 접촉·동시 반발·일반8체 확대는 별도 증명 전 NO_GO다.
