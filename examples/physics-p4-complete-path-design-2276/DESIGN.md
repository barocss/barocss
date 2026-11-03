# 원래 P4 complete-path 실행 설계

상태: READ_ONLY_DESIGN. 새 구현·수학·reference·fixture·World·컴파일·브라우저 실행은 0회다. 저장 JSON, 소스, Git 객체와 hash만 확인했다. 기존 후보의 수치 PASS와 비용 NO_GO, 최초 실패, HOLD를 유지한다. 이 문서는 속도 예측이나 실행 허가가 아니다.

## 현재 증거와 첫 알고리즘 경계

integer 후보의 저장된 B는 여섯 full-position 물리 payload와 독립 검증을 통과했지만 비용 NO_GO로 종료됐다. parent context 합계557970000ns와 Node 전체 수명254303000ns를 합한 보수적 경계는812273000ns다. 고정 기준695832300ns를 넘었다. 동일 baseline 경계라고 주장하지 않는다.

parent 저장 필드의 합계는 compact465815000ns, parentBridge23282000ns, residualWorld68873000ns다. 세 항의 합이 parent context다. legacyAdmission1719000ns는 residual 안의 중첩 항이므로 다시 더하지 않는다. wrapper setup120320000ns와 전체 parent942801000ns도 별도 경계다. 이 값에는 wrapper 밖의 독립 auditor 전체 비용이 포함되지 않는다.

따라서 다음 수학 변경은 이미 충분히 작은 KKT만 다시 재측정하는 경로가 될 수 없다. 필요한 첫 경계는 raw PRE/HYP 쌍의 compact proof 전체다. scalar/선택/점/tie와 모든 물리 word를 보존하면서 새 수학 알고리즘을 별도로 검증해야 한다. 알고리즘은 High 소유다. 새 kernel bank → 새 full-position 여섯 물리/독립 검증 → 한 번의 새 조합 비용 판정이 먼저다. 종료된 KKT component를 hash 동일하게 재사용해도 그 후보의 비용 NO_GO는 바뀌지 않는다.

old Node SAT는432 compact/scalar와 cold QP6회를 유지한 채445 RPC를 수행했고, parent397992000ns+Node686846000ns=1084838000ns로 종료됐다. 좁은 SAT RPC 이동이나 그 후보 재시도는 새 알고리즘 경계가 아니다. 새 알고리즘의 실제 비용 PASS 전에는 아래 World 통합을 구현하거나 실행하지 않는다.

## 이미 검증된 원래 World 경로

`physics-contact-boundary-2276/world-entry.ts` → private `reference-world.ts` → 원래 full-pair World/geometry가 실행 경로다. `physics-stack-solver-2276/world-adapter.ts`가 global-island의 velocity/warm 영역 전체를 cold normal solve로 바꾼다. 원본32 force points를 보존하며 position의36 all-pair 행과 구분한다. 이 private9-body 경로는 현 public API가 아니다.

저장 source03/emitted01은 각각 ALIGNED/OFFSET/YAW16단계, World 수락16·독립 수락16·normal16을 기록했다. emitted parity=true이며 각 decoded record/raw body hash가 source와 같다. 전체 압축량은 각 graph5005131B다. 전체1200은 false다. 별도 ALIGNED308수락 후180s 중단도 그대로 남는다.

현재 live tree를 그 자격으로 실행할 수는 없다. source graph46개 중 현재 일치29·drift17이다. global-island는 현재5175c05c…이고 adapter가 요구한 원본은670f5226…다. Physics types/validation/math 등도 바뀌었다. 재현 가능한 원본 assembly는 Git8d7474ba0b4df5367dbeee93b3a95cb777dcac48의 정확한41개 blob과 현재 hash가 자격 기록에 일치하는 strict-line/face-contact/world-entry/step-observation/world-consumer5개다. RECOVERY-MAP.json에 원래 hash와 출처를 기록했다. 실제 staging은 하지 않았다.

이 원본 closure staging은 역사적 private profile의 재현 시험이다. 현 public Physics에 대한 legacy compatibility/fallback 경로로 넣지 않는다. current API/schema로의 이행은 별도의 source/타입/transaction/physics/API qualification이며, 원본16prefix PASS를 상속하지 않는다. live WIP를 reset하거나 옛 tree 전체를 덮어쓰지 않는다.

## complete-path의 최소 체크 지점

| 실제 시점 | 원래 입력/검증 | 반드시 포함할 비용/출력 |
|---|---|---|
| World.step | 같은8개1kg/half.25m cube+floor, dt1/120, 원래 중력·재료·scene | 실제 producer/normal solver, working-state/correction/commit |
| normal event | 모든 검출 행/point IDs·좌표·법선, cold normal/KKT·loaded tangent | 실제 solve와 독립 검사, 원래 point operand hex |
| free/velocity-ready | strict contacts의32-point line/witness | 각 실제 행의80/120·기존 geometry gates |
| position attempt | 원래36행, PRE/HYP raw hex와 native observed result | full position proof, scalar/선택/point/tie/closure·roundoff |
| closure-ready | before/free/velocity/final phase ledger | momentum/angular/work/energy/phase 검사 |
| initial/accepted state | 원래 quality/state, 8s baseline | footprint/floor/penetration, 8–10s drift/speed/tilt |
| 모든 record/종료 | geometry/position/ledger/quality reply와 raw bodies | serialize/transport/flush/compress/write/hash, EOF/stderr/reap |

`world-consumer.mjs`의 contacts→position-world→step-ledger→quality는 서로 다른 논리 검증이다. 하나를 다른 항으로 대체하거나 누락하지 않는다. 독립 실패가 World commit 후 발견되면 WorldAccepted와 IndependentlyAccepted를 따로 기록한다. accepted state를 되돌려 그 차이를 숨기지 않는다. producer가 거부한 경우는 기존 rollback 동등성도 보존한다. 최초 물리 실패와 뒤의 실행/cleanup 실패를 별도 보관한다.

## 실행 순서와 원래1200으로 가는 경로

1. 새 compact 수학 kernel과 closed metadata 계약을 먼저 검증한다. 기존 saved six frame/position/KKT 물리 authority는 유지한다. 비용 NO_GO면 종료하고 World 단계는 NOT_RUN이다.
2. 새 조합이 그 수치/비용 gate를 통과한 뒤에만 원본 provider closure와 transitive reference/tool identities를 새 소유 staging에 고정한다. 원래 source46개, normal transform 원본/교체 영역/결과 hash, source/emitted graph를 각각 인증한다. 컴파일 시 현재 live Physics로 새어 들어가는 입력을 거부한다.
3. 새 소유 runner로 원래 세 scene의 fresh16prefix를 source와 실제 emitted에서 실행한다. raw body/point operand, 물리 record, counters/parity를 검증한다. timing/process-path sidecar는 물리 parity payload와 섞지 않는다. 새 수학 observer는 같은 실제 run의 모든 작업·transport·compression·output 비용을 기록한다.
4. source/emitted16prefix와 complete-path resource gate가 모두 PASS일 때만 원래 scene별1200-step command를 허용한다. 각 scene은 초기화부터 같은 World 인스턴스를 유지한다. step16으로 건너뛰거나 saved pose로 재시작하지 않는다. 각 scene command의 초기화·전체 검증·출력·정리까지180s 안에 포함한다. 첫 실패 후 남은 scene/graph는 NOT_RUN이다.
5. step960의 실제 accepted state를8s 기준으로 저장하고 step960..1200의 원래8–10s 품질 검사를 유지한다. full Source/emitted parity와 원래 물리·원시 기록·자원 결과가 있어야 해당 private profile을 평가할 수 있다. public API/desktop/일반 마찰·warm 검증은 별도다.

동일 actual run의 비용은 authoritative 전체 wall/parent CPU/소유 child 전체 수명 CPU와 준비·출력·정리로 기록한다. World/normal/geometry/position/ledger/quality/transport/compression은 중첩 attribution도 남기되 합해서 전체라고 부르지 않는다. parent 대기에서 reference compute를 빼도 순수 IPC 비용은 아니다. 다른 세션의 contacts68.095ms/position886.494ms/ledger89.583ms/quality129.545ms와 CPU baseline773147000ns를 더하지 않는다.

## 실행 전에 해결해야 할 자원 계약

- 기존 run.mjs는 모든 examples/*.py를 넓게 hash하고 child timeout600s를 사용한다. 새 실행 진입점으로 재사용하지 않는다. 필요한 closure만 명시하고, scene별 외부180s와 내부170s supervisor가 actual producer/모든 reference child를 소유해야 한다. CPU가 막힌 child에도 외부 census group guard가 적용되어야 한다. detach하지 않고 정리는 등록한 정확한 PID에만 한다.
- 기존 observer.mjs는 한 pending만 허용하지만 deadline·bounded stderr·close/reap 완료 확인이 없다. future runner가 one-outstanding/2MiB line·남은시간 floor·bounded decode·EOF/trailing output/stderr·exit/reap를 고정해야 한다. 기존 helper 자체를 이미 그 조건으로 검증했다고 주장하지 않는다.
- 예전 recorder의 cap은293601280B(280MiB)이며 한 graph의 세 scene이 공유한다. offline bank의16MiB를 trajectory cap이라고 바꾸지 않는다. scene별 새 command로 나누더라도280MiB를 scene마다 새로 지급하면 원래 cap을 올리는 셈이다. 전체 graph/campaign byte ledger와 emergency reserve를 사전에 동결해야 한다.
- recorder는 JSON 전체 line, gzip, raw concat을 먼저 만든 뒤 cap을 확인한다. 압축파일이 작아도 순간 메모리 상한을 증명하지 않는다. future format은 원래 물리 payload/raw words를 보존하면서 line/압축 전 scratch/압축 후 bytes/hash를 할당 전에 제한해야 한다. 누락·sampling·point drop으로 맞추지 않는다.
- 현재16prefix 출력5MB가1200에 들어간다는 근거는 없다. 선형 외삽하지 않는다. full-run 출력·직접 데이터64MiB·CPU 한계가 동시에 만족되는지는 NOT_PROVEN이다. 새 가격/bit/precision/body/iteration cap을 올려 해결하지 않는다.

## 보존할 물리 조건

strict geometry/원래80–120 agreement1e-60, 관련1e-9/1e-12 gates, position/KKT/closure1e-12, normal/tangent/work1e-10을 그대로 구분한다. normal QR/outer64는 원래 runtime8×8과 다른 단위다. 실제 cold adapter는 warm/global sweeps0·reusedPoints0을 요구한다. 8×8을 늘리거나 두 counter를 같다고 부르지 않는다.

quality는 항상 penetration≤.002m·finite floor footprint/escape 조건을 검사한다. 8s 이후 vertical drift≤.005m, horizontal drift≤.01m, linear/angular speed≤.02, tilt≤1도와8s baseline/precision 조건을 유지한다. 이것으로 더 엄격한 HYP closure1e-12를 대체하지 않는다. 현재 자료에는1200/8–10s 완료, current API migration, full output fit 또는 desktop proof가 없다.
