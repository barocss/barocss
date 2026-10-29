# D344 native quadrature 독립 수치·범위 검토

판정: **동결 진단 및 제한된 원인 설명 PASS. 현재 소스의 body-global local integration 계약에 blocking concern 없음. 구현·성능·제품 승인 아님.**

검토 checkout은 `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`, HEAD `c0fea1174f71fc4f9e83ac4f53978d09884e0ef1`이다. D343 `/tmp` review는 수정하지 않았다. 이번 검토는 문서/소스/High의 동결 관측과 oracle 코드를 읽었다. runtime, tests, heavy job, browser, build, benchmark, 제품 소스 수정, commit/push를 실행하지 않았다. 이 보고서만 `/tmp/d344-review`에 기록했다.

## 읽은 근거와 integrity

`/tmp/d344-plan/{source-analysis.md,bounded-reproduction-plan.md,native-quadrature-review-plan.md}` 및 current `brep-mass-quadrature.ts`, `solid-mass.ts`, derivatives, transform, STEP validation consumer를 읽었다.

High 동결 capsule `/tmp/d344-kernel/diagnosis-sha256.json`의 11개 artifact hash를 직접 비교했으며 모두 MATCH였다. 특히 다음 근거를 사용했다.

| 근거 | SHA256 |
|---|---|
| input-brep.json | d9ca158a6c6dfb5d91d900af55ad5b39b0decd1b7c4b78aa06be240a7ccc5ce6 |
| baseline.json | 34564b3aa874136aaf02286a1947106b1fe49603c419b957b958be0d1a1d4a37 |
| oracle.py | 188142b5b76b0f4b723fb9c1558900925cd7a28c7b8c1640f05adf54757a874d |
| oracle-results.json | a0d853261804b684ae6581536009be7a0abd10b4ef5ee28f1f52a8b66a91ecc5 |
| diagnosis.md | e36c1e5bacbc55937b2a6f2bc85f1e4dad56d3b9fca5809af35fcec17c1c47a2 |

current production quadrature source는 `8ecf18b6338a403b9b541bd04716f9a9168bd45fc9a4ceeb00141e72cc9798a6`, solid-mass는 `19ec118c7f6096f738d246e5ca46095b42dd9bf7f67e341bcc6f735690141eac`이다. diagnosis before/after source/dist hashes가 같고, current source도 일치한다. 검토 중 production arithmetic은 OLD 상태다.

## 실제 branch와 field 경계

accepted D343 run03 b7의 원래 native B-rep를 사용한다. strict validity는 true, 4 faces/6 edges/4 vertices/1 closed shell이다. 실제 dispatch는 curved sides 2개가 wholePatch, horizontal caps 2개가 planar Green이며 meshed=false, side nodes 572개다. Instrumentation diff는 copied trace, branch/delta 기록과 private test export만 추가한다. basis, nodes, weights, arithmetic order, predicates, fallback을 바꾸지 않았다. untouched production mass와 instrumented mass는 일치한다.

이미 body center subtraction이 있다. center는 support-pole box midpoint이며 이번 관측은 `[.1234567000000002,-.23456779999999977,.3456789000000001]`이다. 그러나 whole-patch는 원래 world P*w와 world U-column sums를 만든 뒤 quotient/partials/cross를 계산하고 나서 accumulate가 center를 뺀다. 늦은 point subtraction만 다시 추가하는 수정은 이 구조를 해결하지 않는다.

V field는 x*n_x 하나다. 이번 Z-thin fixture에서 horizontal caps는 V/X/Y에 0을 주고 sides가 V 및 tangent first moments를 만든다. caps의 centered Z contributions는 거의 대칭이다. 따라서 Cz가 맞는다는 관측만으로 side Jacobian이 정확하다고 볼 수 없다. X-thin cardinal control은 caps가 V를 줄 수 있으므로 V 하나만으로 그 control을 판정해서도 안 된다.

meshed=false이므로 solid-mass의 q/2q Richardson extrapolation은 실행되지 않는다. 이번 관측은 trimmed/rest, strip, inversion, facet 또는 meshed classification의 원인 증거가 아니다. 다른 control에서는 wholePatch 분류를 다시 기록해야 한다. 기존 wholePatch는 absolute coordinate size 기반 tolerance를 쓰기 때문이다.

## 두 oracle 층과 추가 분리

oracle.py는 CAD 코드를 import하지 않는다. native binary64 값과 실제 저장된 u/v를 Python Fraction으로 읽고 quadratic Bezier 및 V-linear basis를 독립 계산한다. actual input의 U knots `[0,0,0,.5,.5,1,1,1]`, V knots `[0,0,1,1]`, degree2/1, paired positive weights, paired tangent poles, column별 exact Z levels를 읽어 확인했다. 따라서 이 fixture의 각 span에 해당 Bernstein 식을 쓸 수 있다. 이 oracle은 일반 NURBS oracle이 아니다.

1. **native exact basis at stored nodes + exact native P*w**: 생산 basis recurrence를 사용하지 않는다.
2. **observed rounded N/D as exact rational + exact native P*w**: basis generation rounding과 그 뒤 homogeneous arithmetic을 구분한다.
3. **observed N/D + observed production Pw**: weighted product rounding을 분리한다. 초기 Python product 재현 대신 최종 capsule은 실제 Pw copy를 사용한다.
4. **observed R/Ru columns + exact remaining quotient/field arithmetic**: U-column sum 뒤에 이미 생긴 손실과 최종 quotient/accumulation rounding을 구분한다.

Pw, R/Ru, N/D, point/partials/normal은 재사용 배열의 alias가 아니라 복사본이다. face sense는 실제 composite weight 안에 들어 있다. oracle의 exact field sum은 같은 stored body center를 사용한다.

| 계산 층 | V | Cx | Cy | max relative Sv.z error from native h |
|---|---:|---:|---:|---:|
| exact native basis | 6.2781632964155324e-15 | .12345670000000014 | -.23456779999999963 | 0 |
| observed basis, exact native products | 6.2781632964155324e-15 | .12345670000000014 | -.23456779999999963 | 5.55e-17 |
| observed Pw, remaining arithmetic exact | 6.382222331984455e-15 | .12345670000000007 | -.2345677999999996 | .0251263 |
| observed R/Ru, remaining arithmetic exact | 6.180191251439208e-15 | .10042170557247193 | -.26839177431837374 | .2796108 |
| actual floating production | 6.180191251439208e-15 | .10042170557247179 | -.26839177431837347 | .2796108 |

exact native layer는 Su.z=0, Sv.x=Sv.y=0, Sv.z=h를 만족한다. observed basis만 exact-input으로 쓴 층도 오차가 작다. observed Pw에서 이미 h의 유의한 오차가 생기고, observed R/Ru exact quotient가 production V와 tangent bias를 재현한다. 마지막 quotient의 Sv.z 추가 상대오차는 이 sample들에서 최대 약1.73e-16이다.

따라서 **이 captured whole-patch fixture의 pre-accumulation homogeneous weighted-product와 U-column-sum conditioning 손실**은 실제 관측으로 뒷받침된다. 이를 basis recurrence만의 버그, 마지막 quotient만의 버그 또는 모든 B-rep의 일반 원인으로 표현하면 안 된다.

## 수치 권위의 한계

exact claim은 **stored composite weights를 사용한 572 side samples의 V/X/Y와 derivatives**다. 독립 Gauss factor multiplication, 모든 11 fields, planar Green의 전체 샘플, area sqrt, 최종 raw-to-central inertia 또는 exact integration을 증명하지 않는다. sqrt가 필요한 area는 norm² exact arithmetic과 별도 enclosure로 구분해야 한다.

rounded-pi guide `6.278163296415537e-15`와 exact-node V가 약7.8e-16 relative로 가깝다는 사실은 보조 관측이다. native stored rational circle을 exact pi 원으로 단정하지 않는다. radial homogeneous residual만으로 material area를 bound하려면 winding/complete coverage/no self-overlap 또는 quarter monotonicity가 추가로 필요하다. 이번 arithmetic 원인 판정은 π guide가 아니라 native derivative identities와 관측 층 분리에 의존한다.

world raw reconstruction 후 central inertia는 여전히 `XX-V*cx²` 등의 subtraction을 한다. tiny normal second moment 또는 큰 world translation에 대한 central inertia 정확도는 V/C 수정과 별도다. extreme coordinates와 공통 surfaceD1 evaluator도 이번 범위 밖이다.

## 구현 전 local-integration 계약 검토

다음 계약은 source상 일관된다. 아직 새 algorithm 구현의 PASS 판정은 아니다.

- 원래 native poles/weights/knots는 수정하지 않는다. 같은 body-global center c를 선택하고 weighted products 이전에 local P-c를 만든다. W, basis, quadrature rules와 span order는 유지한다.
- projected LOCAL point를 private local field accumulator에 직접 전달한다. center를 더한 world point를 다시 만들고 accumulate에서 빼면 회복한 tiny coordinate를 다시 잃을 수 있다.
- 기존 planar/trimmed/mixed/facet worldpoint callers는 같은 center를 빼는 wrapper를 사용한다. 서로 다른 origin의 field tensors를 섞지 않는다. closed-body total을 모은 뒤 fromCentre를 한 번 적용한다. 기존 meshed squared/cubed bookkeeping의 origin도 일관돼야 한다.
- face-local anchor에 기존 fromCentre를 단순 적용하면 안 된다. open-face V=∫x*n_x 자체가 anchor 변경에 따라 vector-area flux만큼 바뀐다. closed-body translation 공식의 cancellation을 face마다 다른 anchor에 적용할 수 없다.
- P-c subtraction 자체도 binary64다. exact native arithmetic과 rounded local-coefficient arithmetic을 구분한다. moderate paired endpoints에서의 안정성을 extreme/universal exactness로 넓히지 않는다.
- density, MMGS/SI provenance, method labels, q-dependent fallback, errors, input ownership 및 native geometry/names/counts/strict validity를 유지한다. centroid clamp, volume factor, new minimum/tolerance 또는 blanket tiny refusal은 넣지 않는다.

기존 setCentre/global scratch 상태가 동기적인 호출 안에서 사용된다는 수명도 유지해야 한다. runtime callback/reentrancy에 대한 새 지원을 주장하지 않는다. shared core evaluator의 전역 변경은 이 자료만으로 정당화되지 않는다.

## 필요한 control과 후속 판정

- captured original native input의 전후 geometry/name/hash identity와 exact stored-node comparison.
- normal origin을 0 근처로 옮긴 경우: 표현된 endpoint gap과 모든 pole change를 기록한다. mathematical translation과 이미 rounded geometry는 구분한다.
- ordinary h .001 및 5.00009, original pre-Offset body와 ordinary +2 native result.
- signed/reflected controls: native column order에서 signed h를 계산한다. transformBrep가 det<0에서 sense와 loops를 이미 뒤집으므로 oracle에서 determinant를 중복 곱하지 않는다.
- exact 0/±1 cardinal permutations: V뿐 아니라 각 axis의 tangent first moments, node derivatives와 side/cap contributions를 확인한다. unsupported XY Offset composition 대신 실제 qualified native B-rep의 transform을 사용한다.
- planar-only, whole-patch+planar, trimmed/rest 또는 mixed/facet ordinary controls로 공통 origin 계약과 기존 branch/method/fallback을 확인한다. 새 특수 route를 만들 필요는 없다.
- area, density1 및 기존 MMGS density scaling, null/refusal/method 및 SI provenance checks를 분리한다.
- native B-rep quadrature를 실제 사용하는 STEP validation-property readback을 확인한다. upright Model/Studio closed-form mass panel을 이 provider의 제품 증거로 재사용하지 않는다.

old-source uncached perf baseline은 Medium/root 소유이고 이 리뷰는 **NOT_RUN**이다. baseline 확보 전 production 편집을 승인하지 않는다. 결과는 cold integration과 cached mass를 구분하고, construction+mass median을 빼서 pure mass time으로 주장하지 않는다. accuracy로 mass bits가 바뀌는 것은 geometry identity 실패가 아니다. 성능/accuracy/제품 승인과 source 진단은 별도 기록해야 한다.

## 최종 상태

독립 source/oracle review: PASS, 위 제한 안에서 blocking concern 없음. 제품 소스는 아직 old/frozen이다. 리뷰 세션의 runtime/tests/heavy/perf/browser/build: NOT_RUN. 구현/성능/전체 질량정확도/외부 consumer/release: NOT_ACCEPTED 또는 후속 PENDING. D343의 immutable artifacts는 수정하지 않았다.
