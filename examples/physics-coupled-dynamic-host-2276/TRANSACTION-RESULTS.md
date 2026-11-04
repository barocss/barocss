# Actual dynamic transaction and wire results

동적 마찰 after 입력의 실제 적용 후 실패 원자성, 기록·복원을 소스와 NodeNext 컴파일 경로에서 통과했습니다. 기존 build-02 runtime은 변경하지 않았습니다.

| 항목 | 실제 결과 · 각 경로 |
|---|---|
| World / phase 시도 / 승인 | 4 / 6 / 4 |
| 실제 적용 / query / 반환점 / anchor | 257 / 41 / 37 / 999 |
| 실제 helper 계획 | 5회. 실패한 적용 후 시도 포함 |
| step 호출 | 직접 4회 + 내부 재생 3회 = 7회 |
| 독립 관찰자 | 20회 PASS |
| Source/Native 전체 파일·wire 비교 | 38개 PASS. 정규화 없음 |
| 실제 유효 wire | 4771 bytes |

첫 query 전의 알려진 오류와 실제 비영 충격량·producer bucket 변경 뒤의 알려지지 않은 오류를 주입했습니다. 두 경우 모두 승인된 model·state·clock·cache·cursor·recording·command 값은 원본 그대로였습니다. 실패한 시도의 진단 기록과 연산은 남겼습니다. 이후 실제 재시도는 같은 새 provider의 clean-after 결과와 일치했습니다.

공개 함수 `serializePhysicsRecording`, `deserializePhysicsRecording`, `restorePhysicsRecording`을 실제로 호출했습니다. 숨겨진 B·C World의 승인 후 public state, 전체 private.world, 실제 owner recording은 dispose 직전 getter의 실제 캡처를 사용했습니다. 복원된 D는 살아 있는 getter를 사용했습니다. A 재시도, B, C, D의 네 승인 구간 모두 기하·물리 ledger·마찰·독립 gold target 검사를 통과했습니다.

숨겨진 초기 public/private getter는 별도 저장하지 않았습니다. 이 값들을 읽었다고 주장하지 않습니다. 같은 model의 실제 A 초기 대조 상태를 숨겨진 실제 생성 query, attempt-start, 회전·중력·drift 기록, 실제 free input과 cold cache-init에 원본 값으로 대응시킨 뒤 검사했습니다. 실제 승인 후 출력은 이 대조 상태로 재구성하지 않았습니다. 다른 World 사이의 전체 진단 trace/cacheFrame 동일성도 NOT_PROVEN으로 유지하며 ID를 정규화하지 않았습니다.

잘못된 이전 magic은 `INVALID_SNAPSHOT`으로 거부됐고 추가 World를 만들지 않았습니다. D의 두 번째 구간은 `COUPLED_PROFILE_UNSUPPORTED`로 phase 시작 전에 거부됐습니다. 승인된 상태와 진단 계수는 보존됐습니다. 이 결과는 두 번째 물리 구간의 성공이 아닙니다.

Source 명령은 7866.29275 ms, Native는 7911.372291 ms, parity는 236.070792 ms였습니다. 한 번의 명령 실행 시간이며 성능 보장은 아닙니다. 원래 4 World·8 attempt, 8×8 반복, 180초·16 MiB, 수치 공차를 유지했습니다. 입력 명령은 빈 배열만 검증했습니다.

공개 패키지 채택, 브라우저 wire, 이후 성공 구간, 이전 구간 캐시 재사용, 여러 접촉점, 일반 관성·재료와 원래 8-box 장시간 안정성은 별도 단계입니다. HOLD·NO_GO·최초 실패는 유지했습니다. 배포와 릴리즈는 하지 않았습니다.
