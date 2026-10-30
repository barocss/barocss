# D344 actual STEP bounding-box 실패 독립 검토

판정: **현재 실패는 metadata bounding-box oracle의 과도한 exact equality다. 실제 native cap geometry가 바뀌었다는 근거는 없다.** 제품/Core/STEP 소스 수정 근거는 없다. 실제 browser run-01은 여전히 FAIL이며 수정된 test로 전체 흐름을 다시 실행해야 한다.

검토 checkout `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`, HEAD `fbf8a7afb555ee7302bd3c6a6ed9e034a9a8b51a`. 읽기만 수행했다. runtime/tests/heavy/browser 및 제품 소스 수정은 NOT_RUN이다. root가 failure image를 확인하고 resources를 닫았다는 상태와 구분한다.

## 실제 data와 첫 실패

실제 경로는 `/tmp/d344-studio/run-01`이다. receipt는 FAIL, phase `native and STEP observation 02-original-step-readback`, cleanup은 CONTEXT_CLOSED/BROWSER_CLOSED/SERVER_CLOSED다.

다운로드된 `02-original-step.step`은 실제 geometry의 cap/curve CARTESIAN_POINT들에 Z `5.3457689`를 저장한다. 예를 들어 #21,#32–34,#45–47,#76은 이 cap level이다. 반면 validation metadata는 다음과 같다.

- #107 minimum point: `(-2.8765433000000002,-3.2345677999999998,.3456789)`.
- #108 maximum point: `(3.1234567000000006,2.7654322000000007,5.345768900000001)`.
- #109: 위 두 점의 `REPRESENTATION('bounding box',...)`.

stderr의 첫 assertion은 metadata maxZ `5.345768900000001`과 native interval max `5.3457689`의 strictEqual 실패다. 차이는 `8.881784197001252e-16`, ordinary cap level에서 1 ULP 외측이다. export metadata volume/centroid 검사 뒤, `importStep`와 imported geometry의 exact level assertion **이전**에 중단됐다. 따라서 이번 run은 import geometry PASS 또는 FAIL을 아직 보여 주지 않는다.

| 근거 | SHA256 |
|---|---|
| 02-original-step.step | 54a5c923c10d03418d190ad0d4f73b9b5fa43ad8e029e2d17cc13f5a4a4385c4 |
| 02-original-step-readback.stderr.txt | c79accfbe1cdce87d31757dd7bcf202ea8a1ef52c57ac076b54315170c83d4ef |
| inspector.ts | ce7d02875130bd6b0aaab5f09511cb2e0a359fe6190527d3ac8a4da8db984dae |

## source contract

`io/step.ts:204-221`의 default validation properties는 mass/area를 계산하고 box를 **brepBounds(b)**에서 얻는다. cap plane coordinate를 metadata box에 직접 복사하지 않는다. `real()`은 finite Number의 `String()` 표현을 쓰므로 metadata에 이미 계산된 one-ULP 외측 값이 그대로 직렬화된다. geometry level을 metadata와 같은 값으로 바꾸지 않는다.

`brep-bounds.ts`는 다음 경로다.

1. 원래 native vertices에서 lo/hi를 시작한다.
2. control net이 현재 box 안에 없는 edge는 curveEvaluator의 span samples와 golden-section extrema로 box를 grow한다.
3. planar face는 건너뛰고, whole curved patch는 surfaceEvaluator의 span grid와 alternating golden sections로 grow한다.
4. 나머지 trimmed curved face는 자체 mesh positions로 grow한다. facet face는 positions를 사용한다.

모든 grow/Math.min/Math.max는 현재 box를 유지하거나 외측으로 넓힌다. 전체 side patch의 Z는 하단/상단 poles를 공유하는 rational 평가를 거치므로 floating evaluated extrema가 exact cap plane보다 1 ULP 외측일 수 있다. 이번 actual 파일의 형태는 이 source 경로와 일치한다. 정확히 어느 node가 #108의 최대를 공급했는지 runtime trace는 하지 않았으므로 특정 sample을 원인으로 확정하지 않는다.

소스 comment의 'exact extremes/smallest box'는 surface를 직접 조사하는 geometry 경로를 설명한다. 모든 binary64 coordinate가 exact cap plane 값과 bit-equal하다는 보증이 아니다. 기존 D151 bounds tests도 일반 extrema를 1e-9 한계와 mesh enclosure로 검사한다. 정수 box의 exact test가 모든 curved runtime에 대한 equality contract를 만들지 않는다.

이 함수는 범용 rigorous outward-rounded interval algorithm이 아니다. 특히 trimmed branch는 mesh를 사용한다. 따라서 이번 결과를 모든 B-rep의 global conservative mathematical box 증명으로 확대하지 않는다. 여기서는 native vertices를 포함한 ordinary cylinder의 정상축 enclosure와 미세한 외측 expansion을 확인한다.

## 허용되는 test 수정과 유지할 geometry 계약

수정은 metadata box 정상축 검사에만 한정하는 것이 타당하다. blind near-equality보다 다음 조건이 강하고 source와 맞는다.

- metadata min/max가 finite이고 min<=max다.
- **strict enclosure**: box.minZ<=nativeLo, box.maxZ>=nativeHi. 이번 fixture에서는 vertex bounds로 시작하므로 이 조건을 유지할 수 있다.
- 각 외측 확장 `nativeLo-box.minZ`, `box.maxZ-nativeHi`는 기존 linear policy1e-7 이하다. inward miss를 새 tolerance로 허용할 필요는 없다.

이 1e-7은 metadata bbox의 수치 결합 한계다. tiny material interval을 1e-7로 넓히거나 geometry를 바꾸는 조건이 아니다. 기존 metadata volume의 relative native-node oracle, centroid의 strict physical normal interval, units, source ownership assert도 유지해야 한다.

다음 조건은 그대로 **exact**여야 한다.

- 원래 native cap support planes와 stored lower/upper levels.
- tiny four-ULP interval의 양수 폭과 actual strict-valid native target.
- `importStep` 이후 두 exact cap levels,4 faces/closed shell/names 및 source invariance.
- metadata 검사를 통과했다는 이유로 geometry readback assert를 약화하거나 skip하지 않는다.

정상축 외 tangent metadata bounds에 vertex-only extrema를 그대로 적용하면 안 된다. circle의 native seam vertices만으로 tangent material extrema를 표현하지 못할 수 있다. 다른 축은 기존 독립 extent/geometry 계약을 유지한다.

## 소스 불변과 후속 상태

`brep-bounds.ts` SHA256 `bb0eda30921ef8552907d2e52f646ed790fec727f9cc61919d7b95b4499b120c`, 현재 quadrature `696ec924bc4f1d7b74862533676af5e4c0b8a2a284a8a249ea7007dade4c8ed5`를 읽었다. 이번 bbox 분석은 D344 local homogeneous 구현을 다시 바꿀 근거가 아니다. STEP/Core source는 수정하지 않았다.

권고 test 수정 뒤 browser를 처음부터 다시 실행해야 한다. 첫 FAIL과 다운로드 파일은 보존한다. 이 검토는 첫 metadata equality 실패의 source/data 분류이며 actual import/Apply/export/readback 전체 제품 PASS가 아니다.
