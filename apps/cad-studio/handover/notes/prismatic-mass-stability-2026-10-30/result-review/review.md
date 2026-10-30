# D343 actual Offset result 독립 검토

판정: **소스 검토 PASS. Blocking finding 없음.**

검토 위치: `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`. Branch `local/cad-dev`, HEAD `4ce1b35c753952010eb6961c62ccd6c6490bd01e`.
High의 SOURCE FROZEN 알림 뒤 현재 파일과 hash를 읽었다. 제품 소스 수정, 테스트 실행, commit, push는 하지 않았다. 이 보고서만 `/tmp/d343-result-review/review.md`에 기록했다.

## 확인한 계약

- `profileCommands.ts:113-119`: 기존 shared Extrude/Boolean candidate를 만든 뒤 actual result를 검사한다. 검사 성공 뒤에만 candidate를 반환한다. source와 selection을 대입하거나 수정하지 않는다.
- `nativeOffsetFace.ts:427-445`: owned profile proof의 source modelContent, 원본 prefix, 정확한 3개 추가 node, owned sketch, 거리와 부호에 맞는 tool, 선택한 parent를 소비하는 마지막 Boolean, 실제 leaf outputs를 묶는다. 다른 문서의 profile이나 다른 Boolean operand를 그대로 통과시키지 않는다.
- `nativeOffsetFace.ts:450-459`: 마지막 node의 target key와 Model ref를 확인한다. Model과 native output이 각각 정확히 1개여야 한다. unrelated witness body는 이 대상을 대신하지 못한다. 실제 native target은 1 solid, 1 closed shell, strict-valid이어야 한다.
- `nativeOffsetFace.ts:460-497`: 실제 vertex와 complete edge coefficient는 정확한 stored `[lo,hi]` 안에 있어야 한다. vertex에서 두 exact endpoints가 모두 살아 있어야 한다. 두 outward cap support를 확인하며 cap support plane도 interval 밖이면 거절한다. cap curve/support residual은 기존 linear policy에 합산한다. 이 항목에 새 epsilon이나 minimum thickness는 없다.
- `nativeOffsetFace.ts:498-517`: tangent extents, native cap residual, source circle bound, represented addition error를 기존 linear tolerance 하나에 합산한다. 실제 Model provider의 positive finite volume과 finite centroid를 읽는다. normal centroid는 동일한 strict interval 및 기존 midpoint bound를 만족해야 한다.
- `nativeOffsetFace.ts:513`: deferred body는 자기 `massRef`와 `massPlace`로 massOfRef를 호출한다. deferMasses(true)의 비어 있는 eager fields만 보고 ordinary body를 거절하지 않는다. 별도 native B-rep quadrature 값으로 Model provider를 바꾸지 않는다.
- `nativeOffsetFace.ts:518-520`: 실제 평가/geometry/mass 실패는 FACE_DISTANCE로 바꾼다. cached refusal도 FACE_DISTANCE로 재현한다. zero/nonfinite/inverted distance 및 stale pick의 기존 전단 검사는 유지된다.

## Cache와 비용

- source 문서별 WeakMap과 owned profile별 WeakMap을 사용한다. source modelContent가 달라지면 resolve cache를 교체한다. 기존 owned profile도 result 검사 전에 현재 source canonical을 다시 비교한다.
- result witness는 신뢰한 face proof마다 마지막 candidate의 WeakRef 1개, canonical content 1개, 선택적 refusal 1개만 갖는다. 원본 ctx, evaluated bodies, native B-rep를 result cache에 강하게 보관하지 않는다.
- cache hit 전에 source, recipe, output 및 source-key 조건을 다시 검사한다. 같은 candidate object와 같은 modelContent일 때만 기존 결과를 사용한다. candidate나 source의 geometry 입력 변경은 성공 cache를 재사용하지 못한다.
- 새 candidate는 evaluateDoc와 native snapshot 조회, strict topology, bounded coefficient scan, 실제 mass 조회 비용이 든다. 같은 candidate 재검사는 이 비용을 피한다. 새 build object 사이의 재사용이나 UI latency 개선은 주장하지 않는다. 비용 benchmark는 NOT_RUN이다.

## 본 관측과 검증 범위

- 기존 provider 분류 `/tmp/d343-model/provider-classifications.json`을 읽었다. +X/+Y는 admission ACCEPTED 뒤 native output 0이었다. +Z는 actual native output 1, stored levels `.3456789`와 `.34567890000000023`이었다. 이는 새 postcondition 전의 원인 기록이다.
- `/tmp/d343-actual-result/focused-final.log`: **6 PASS, 0 FAIL, 0 SKIP**를 확인했다. X/Y empty target + witness, retry, tiny Z actual provider, 12 signed ordinary box controls, deferred mass, source/recipe/output tampering을 포함한다. 이 로그는 High가 실행했다. 리뷰 세션에서 다시 실행하지 않았다.
- High는 final type-check 및 owned helper/new-test lint PASS와 heavy slot release를 보고했다. `run-final.sh`의 set-e 순서 및 비어 있는 type/lint error 로그를 읽었다. 최종 통합 receipt와 broad Model 결과는 root가 별도 취합한다.
- 기존 `offset-face-native.test.ts`의 rotated circle ordinary +2 controls는 유지된다. 첫 구현의 2 FAIL은 최종 PASS로 덮어쓰지 말고 이력으로 보존해야 한다. 최종 broad affected Model run은 이 리뷰 시점 **PENDING**이다.
- 리뷰 세션 실행: tests **NOT_RUN**, API **NOT_RUN**, Studio/browser **NOT_RUN**, files/reopen **NOT_RUN**, remote/CI/release **NOT_RUN**.

## 명시적 한계

이 guard는 특정 shared recipe의 실제 output 존재, native closure/validity, normal interval, cap binding, tangent extents, 실제 Model mass의 normal centroid를 검사한다. 전체 재료의 동등성, 임의 곡면의 동일성, tangent centroid 정확도, inertia 정확도 또는 모든 Boolean의 보증은 아니다.

native B-rep quadrature의 tiny-volume/tangent-centroid 차이는 **UNREPAIRED 별도 provider 문제**다. 이 검토는 quadrature가 prismatic provider와 같은 centroid를 내야 한다는 조건을 추가하지 않았다. Core longitudinal h2/h3의 별도 full Kernel 결과를 이 Model 결과로 대신하지 않는다.

## 읽은 source SHA256

| Path | SHA256 |
|---|---|
| `packages/barocss-cad-model/src/app/nativeOffsetFace.ts` | `4a556c283dce835d19400e623b49e6ec169dcdb7b2cf207a829270071f1107b5` |
| `packages/barocss-cad-model/src/app/profileCommands.ts` | `8a1fdc9adb080cae39edc1ed34c1c591e5e87095b79e79cc53e48df94be231fd` |
| `packages/barocss-cad-model/test/native-offset-result.test.ts` | `bb7e5235440fe5432ad9d625d0bcad4bd73254721fe04faf0b5efa0b156c7f28` |
| `packages/barocss-cad-model/test/native-offset-face.test.ts` | `aad1c22a62db43d503f9dbe12f09c621048f69a9f40a4ee3fc8387e3835d8c31` |
| `packages/barocss-cad-model/test/offset-face-native.test.ts` | `a6aac6af88dbd9ec358872f0b9e4b88d247a0488e3cc05eec2c0d8e217700203` |
| `packages/barocss-cad-model/src/engine/evaluate.ts` | `e19916805fca12e41bca23acba3bcf6878efcc636d600e372a3c2320c37b1c59` |

분류 근거 SHA256: `/tmp/d343-model/provider-classifications.json` = `b0f74c619410285d283d0ac305e2eeed572a093cc74f215e5f67cada88198b5c`.
