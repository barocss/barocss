# D343 actual Offset result 독립 검토 v3

판정: **동결 v3 소스 검토 PASS. Blocking finding 없음. 실제 Studio 수정 후 흐름은 별도 PENDING.**

검토 checkout: `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`, branch `local/cad-dev`. 이전 로컬 checkpoint는 `f9c17c1461ad7814f89d6fefef0e358aac473596`이다. push는 하지 않았다. High의 v3 SOURCE FROZEN, type/lint PASS와 gate release 알림 뒤 현재 소스를 읽었다. 이 리뷰는 제품 소스 수정, heavy test, browser 실행을 하지 않았다.

## 실제 브라우저 경계와 재개방

v2 보고서 `/tmp/d343-result-review/review-v2.md`를 변경하지 않았다. SHA256은 `08e5729fe1f60c3c677a53910be12735cf58fb4b0f9429fed53ac6d46dd1754e`이다.

v2의 Model 83 PASS 및 API 9 PASS 뒤 실제 Studio run-01은 **FAIL**이었다. source cylinder R3/H5.00009를 translate하고 unrelated witness를 둔 상태에서 top cap Offset −5.00009 preview가 `[VALUE] Offset face: the native circular cap needs one finite circular bound.`로 거절됐다. 이는 actual-result postvalidator에 도달하기 전의 native circle qualification 실패다. `/tmp/d343-studio/run-01/failure.json` SHA256은 `69b78208eae72d31f496b95189b3d79c11e638673fb95c5d1dbb34b5744ec9f3`이다. UI/selection/source를 담은 실패 기록을 읽었으며 원본을 보존했다. 이 리뷰에서 screenshot을 다시 열지 않았다. root의 시각 확인과 구분한다.

High의 독립 Chrome native 재현 `/tmp/d343-circle-browser/chrome-native.json`을 읽었다. SHA256은 `6adede40339e5a937b07107270028d0532e3893eb4de3006519c134eccdb370d`이다. 양쪽 native cap은 X halfspan 3, Y halfspan 3.0000000000000004였고 동일 Chrome resolve가 위 VALUE를 냈다. xmin/xmax는 −2.8765433/3.1234567, ymin/ymax는 −3.2345678000000007/2.7654322000000002였다. 반면 run-01 Node native inspector의 두 halfspan은 3/3이었다. 따라서 exact bounding halfspan 등호가 실제 runtime rounding 차이에 의존한다는 원인이 확인됐다. Chrome 재현은 sourceUnchanged 및 browser/server closed 기록을 남겼다.

## v3 수정과 원형 권위

`circle()`의 사전 조건만 바뀌었다. 두 bounding halfspan이 exact equal이어야 한다는 조건을 제거하고 두 halfspan이 양수이고 유한한 modeling range 안에 있는지 확인한다. center는 유한한 modeling range 안에 있어야 한다. X halfspan으로 reference radius를 만드는 기존 방식은 유지한다.

이 변경은 bbox를 원형 증명으로 승격하지 않는다. 그 뒤의 **두 cap 각각의 전체 4 quadratic span을 bijection으로 matching하는 rational curveBound**, 기존 native side/whole-curve 결합 및 footprint bound가 원형을 증명한다. ellipse나 malformed native curve가 그 증명을 우회하는 경로는 추가되지 않았다. 새 epsilon, minimum thickness, clamp, widened interval은 없다.

직접 소스 문자열을 이전 checkpoint와 비교했다.

- `circle()`의 reference 생성부터 whole-span/side 검증 반환까지: byte-equal.
- `validateNativeOffsetDistance` 본문: byte-equal.
- `validateNativeOffsetResult` 함수: byte-equal.
- Core `solid-mass.ts` SHA256은 `19ec118c7f6096f738d246e5ca46095b42dd9bf7f67e341bcc6f735690141eac`로 이전 동결값과 같다.

따라서 v2의 last-target key/ref, exact cap support levels, strict boundary interval, typed FACE_DISTANCE, actual/deferred Model mass, source/candidate/cache ownership 조건은 유지된다. 새 export나 public API는 없다. 이전 API 9 PASS는 export 계약 증거로 재사용할 수 있으나 새 browser flow 성공으로 주장할 수 없다.

## 최종 테스트 seam의 소유권

새 `native-offset-circle-browser.test.ts`는 공개 authored cylinder radius .1과 translation [.1,.2,.3456789]로 Node에서도 unequal halfspan을 만든다. private native 주입 없이 두 signed cap이 기존 native resolver와 distance 검사를 통과하는지 확인한다. source 문서와 selection이 바뀌지 않는지도 확인한다.

ellipse 검사는 `partBreps()`가 준 native B-rep를 structuredClone한 뒤 그 clone의 모든 vertex/edge/support Y 좌표만 일관되게 1.01배 한다. clone을 공개 STEP export/import 경로로 읽고, `complete native circular quotient`에서 VALUE로 거절되는지 검사한다. 기존 endpoint-보존 changed interior pole 거절 테스트도 함께 통과했다.

cached native B-rep, global module state, prototype, exported function 또는 private cache를 테스트가 수정하지 않는다. 강제 geometry seam이나 복구 hook이 없다. 처음 시도한 captured Chrome STEP roundtrip은 import support 확장 때문에 다른 whole-curve 실패를 냈다. 그 로그/coefficients는 /tmp에 보존했으며 최종 테스트에 사용하지 않는다. captured fixture는 repository에 남기지 않았다. 최종 Node fixture와 실제 Chrome R3 원인 관측은 서로 다른 증거다.

## 읽은 검증 결과

- High `/tmp/d343-circle-browser/focused-final.log`: **26 PASS, 0 FAIL, 0 SKIP**. 새 unequal-span 두 signed cap/ellipse 3개, 기존 native qualification 15개, actual result 8개다. 로그 SHA256 `6d032c9153e30e6d58eb7c5edb112dae47bb07423225a41f21e948b61d28b509`.
- High full Model type-check 및 owned helper/new-test lint: PASS. final script의 set-e 실행 순서와 비어 있는 final error 로그를 읽었다. 이전 wrong-cwd lint harness 실패는 지우지 않았다.
- v3 broad affected Model, Studio/Vite build 및 actual Studio run-02는 root/Medium 단계이며 이 리뷰 시점 **PENDING**이다. 실제 run-01 FAIL은 해결된 product PASS로 바꾸지 않는다.
- 리뷰 세션 실행: tests/heavy/browser **NOT_RUN**, screenshot 재검토 **NOT_RUN**, commit/push **NOT_RUN**.

## 한계

이번 변경은 cross-runtime cap bounding-span exact equality 거절을 제거한다. 실제 browser preview/apply/save/reopen/Undo/Redo 성공은 후속 actual flow가 증명해야 한다. Node 26 PASS로 대신하지 않는다.

전체 side-interior embedding, generic Boolean/재료 동일성, native quadrature의 tiny-volume/tangent-centroid/inertia 정확도는 별도 범위다. quadrature 문제는 **UNREPAIRED** 상태이며 원형 qualifier 수정의 PASS로 포함하지 않는다.

## 동결 SHA256

| Path | SHA256 |
|---|---|
| packages/barocss-cad-model/src/app/nativeOffsetFace.ts | 2112393a89e38f9ff02e6fc3aaa2be6446e9bca31e87f1b2d4129c83b083c847 |
| packages/barocss-cad-model/test/native-offset-circle-browser.test.ts | 3aece22c3baa6fe8fe28bdde39b6326ba6eb8e774e55f8cd1cc29470aafeb55d |
| packages/barocss-cad-model/test/native-offset-result.test.ts | cc4c890f5cb3acd7b29c4987e8f9e52ef8a8a9e4f0715e3ab3434f3bfdbfe5a2 |

v1/v2 review와 각 첫 실패 기록은 그대로 보존했다.
