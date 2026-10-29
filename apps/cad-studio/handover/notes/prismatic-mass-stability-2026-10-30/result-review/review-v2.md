# D343 actual Offset result 독립 검토 v2

판정: **동결 v2 소스 검토 PASS. Blocking finding 없음. 통합 검증은 별도 PENDING.**

위치: `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`. Branch `local/cad-dev`, HEAD `4ce1b35c753952010eb6961c62ccd6c6490bd01e`.
High의 v2 SOURCE FROZEN 알림 뒤 소스, owned-sha256.json, receipt.md와 집중 테스트 로그를 읽었다. 제품 소스 수정과 테스트 실행은 하지 않았다.

## v1 판정 재개방 및 보존

v1 보고서 `/tmp/d343-result-review/review.md`를 변경하지 않았다. SHA256은 `568af039f66f09b7cbd4f1b710ec75965b09de227a52fc647e11e7fd4c0a8e35`이다.

v1 집중 테스트 6 PASS 뒤 Model 통합에서 **79 PASS, 2 FAIL, 0 SKIP**가 나왔다. `/tmp/d343-model/final-result-first.log` SHA256은 `74044449af3002757aec4f7881f62104701a1098e6d519b85db1f594adfc23b6`이다. X/Y ordinary +2 retry가 exact vertex endpoint 존재 조건에서 거절됐다. 첫 소스 검토는 full cap support와 trimmed vertex의 차이를 놓쳤다. 따라서 v1 PASS를 최종 통합 PASS로 사용할 수 없다.

## 수정 판정

- v2는 vertex가 exact lo/hi에 있어야 한다는 조건을 제거했다. 모든 vertex는 strict stored `[lo,hi]` 안에 있어야 하며 실제 normal span은 양수여야 한다. collapsed target은 계속 거절한다.
- target level의 권위는 **complete affine cap support의 전체 normal coefficients와 native outward sense**다. 양쪽 cap support plane은 각 intended stored lo/hi와 exact equality를 만족해야 한다. endpoint 존재 조건을 tolerance로 완화하지 않았다.
- complete cap-boundary curve의 normal residual은 기존 joint linear tolerance에 더한다. 따라서 exact support plane을 가진 cap의 trim vertex가 1 ulp 안쪽에 있는 ordinary result를 허용한다. 모든 boundary curve normal coefficients는 여전히 strict interval 안에 있어야 한다.
- 새 epsilon, minimum thickness, widened normal interval은 없다. tiny Z의 실제 양수 interval과 actual Model provider 조건은 유지된다.
- 모든 face는 native parametric support를 유지해야 한다. 다만 trimmed SIDE의 미사용 연장 support pole을 material bound로 보지 않는다. 기존 native trim topology/strict checker와 boundary 검사를 사용한다. 이 구분은 범용 side-interior embedding proof가 아니다.

## 계속 유지되는 계약

v2 source에서 다음 조건을 다시 확인했다.

- owned profile의 source canonical, 원본 node prefix, 정확한 +3 shared recipe, owned sketch, 거리와 부호, 마지막 Boolean operand, leaf output record를 묶는다.
- 실제 마지막 Boolean의 target key/ref를 unique Model/native output으로 확인한다. 살아 있는 unrelated witness body는 비어 있는 target을 대신할 수 없다.
- 실제 target은 1 solid, 1 closed shell, strict-valid이어야 한다. validation은 shared Offset build가 candidate를 반환하기 전에 끝난다. actual 실패는 typed FACE_DISTANCE로 전달한다.
- tangent extents, cap-boundary residual, source footprint bound, represented cap addition error는 기존 tolerance 하나를 공유한다.
- 실제 Model body의 mass 또는 자기 massRef/massPlace로 해석한 deferred provider를 사용한다. positive finite volume과 finite centroid, 동일 normal interval 및 기존 midpoint bound를 검사한다. 별도 prospective mass나 native B-rep quadrature로 바꾸지 않는다.
- source/recipe/output 검사는 result cache hit보다 먼저 실행된다. source modelContent가 바뀌면 resolve cache가 교체되고, 이전 owned profile도 source fingerprint 비교에서 거절된다. 같은 candidate object와 같은 canonical content만 결과를 재사용한다.
- result witness는 trusted face proof마다 마지막 candidate WeakRef 1개, content 1개, 선택적 typed refusal 1개만 보관한다. ctx, evaluated body, native B-rep를 강하게 추가 보관하지 않는다.
- 새 candidate마다 실제 평가/strict 검사/계수 scan/mass 조회 비용이 든다. benchmark와 UI latency는 NOT_RUN이다. 성능 향상을 주장하지 않는다.

## 읽은 검증 증거

- `/tmp/d343-actual-result/focused-v2-final.log`: **8 PASS, 0 FAIL, 0 SKIP**. SHA256 `520f0ff51e081c7e5fc20b316022dd9e85125290dd8d401dbf71ab3ee4f269f3`.
- 새 테스트는 X/Y empty-target-with-witness 거절, .001 및 +2 retry, 별도 X/Y +2 no-witness, tiny Z actual provider, 12 signed ordinary box controls, deferred mass, source/recipe/output misuse, cached 재검사를 포함한다.
- High receipt는 full Model type-check와 owned helper/new-test lint PASS를 기록한다. review에서 테스트를 다시 실행하지 않았다.
- `unchanged-checks.json`은 distance predicate byte equality와 Core mass source 불변을 기록한다. 소스 diff도 validateNativeOffsetDistance 본문 변경이 없음을 보여 준다.
- 기존 ordinary +2 성공을 expected refusal로 바꾸지 않았다. source predicate를 수정하고 witness/no-witness 성공 control을 추가했다.
- Medium의 v2 broad Model integration은 이 보고서 시점 **PENDING**이다. root의 API/Studio/browser와 file/reopen, remote/CI/release 결과도 별도다. 집중 8 PASS로 이 범위를 대신하지 않는다.
- 리뷰 세션 실행: tests **NOT_RUN**, heavy **NOT_RUN**, API/Studio/browser **NOT_RUN**, files **NOT_RUN**, commit/push **NOT_RUN**.

## 검토 범위의 한계

이는 지정 shared recipe의 실제 output, native closure/strict validity, exact cap support levels, strict boundary normal interval, bounded tangent extents와 실제 Model normal centroid에 대한 소스 검토다. 전체 재료 동일성, 임의 side surface 내부, tangent centroid, inertia, generic Boolean 정확도는 보증하지 않는다.

native quadrature의 tiny-volume/tangent-centroid 차이는 **UNREPAIRED 별도 provider 문제**다. quadrature centroid를 prismatic provider와 같게 하는 조건은 추가하지 않았다. Core longitudinal h2/h3의 별도 full Kernel 결과도 여기서 재검증하지 않았다.

## 동결 SHA256

| Path | SHA256 |
|---|---|
| `packages/barocss-cad-model/src/app/nativeOffsetFace.ts` | `096d95ed4f0f2565b053d8568db9e981415f9bd7222ed2ab43c79be3c966eb0d` |
| `packages/barocss-cad-model/test/native-offset-result.test.ts` | `cc4c890f5cb3acd7b29c4987e8f9e52ef8a8a9e4f0715e3ab3434f3bfdbfe5a2` |
| `packages/barocss-cad-model/src/app/profileCommands.ts` | `8a1fdc9adb080cae39edc1ed34c1c591e5e87095b79e79cc53e48df94be231fd` |

High owned-sha256.json과 위 helper/new-test hash가 일치한다. v1 보고서와 첫 통합 FAIL 로그는 그대로 보존했다.
