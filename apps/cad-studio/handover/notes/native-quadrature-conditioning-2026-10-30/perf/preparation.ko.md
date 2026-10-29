# D344 native quadrature 성능 측정 준비

상태: SOURCE_PREPARATION_ONLY. 벤치마크, build, 테스트 및 후보 코드는 실행하지 않았다. 저장소 파일을 수정하지 않았다. 이 문서는 root의 실행 승인과 High의 heavy gate 해제를 기다리는 계획이다.

## 현재 도구의 계약

작업 경로는 `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`이다. 게시 기준은 `c0fea1174f71fc4f9e83ac4f53978d09884e0ef1`이다.

`packages/barocss-cad/scripts/perf-bench.mjs`는 `../dist/index.js`를 읽는다. TypeScript 소스만 바꾸고 기존 dist를 측정하면 후보를 측정한 것이 아니다. 기준과 후보마다 해당 소스로 library를 먼저 build해야 한다.

지원 CLI는 다음과 같다. 마지막 인수는 정확한 case 이름의 CSV이다.

```text
node scripts/perf-bench.mjs run [case,case…]
BASE=/absolute/base.json node scripts/perf-bench.mjs save|compare [case,case…]
SHAPE=/absolute/shape.json node scripts/perf-bench.mjs shape-save|shape-compare [case,case…]
```

`RUNS` 기본값은 3이다. 일반 runner는 각 case 함수 전체를 측정하고, 그 뒤 타이머 밖에서 SHA fingerprint를 만든다. 정렬한 표본의 가운데 값을 정수 ms로 반올림한다. 현재 warm-up, 원시 표본, p95, 소수 ms 출력은 없다. `tee60-over-round`는 RUNS와 관계없이 1회이다. 잘못된 case 이름은 명시적으로 거절하지 않으므로 선택한 case 수를 별도로 확인해야 한다.

`shape-save`는 case 생성, mass query, strict check를 한 번에 실행한다. 이는 순수 적분 시간 측정이 아니다. shape 비교는 validity/counts/names를 정확히 비교하며, volume 상대차 1e-7 및 centroid 거리 1e-5를 사용한다. 잘못된 기존 mass 값을 정확도 oracle로 사용할 수 없다.

## 캐시와 기존 case의 한계

`src/brep/solid-mass.ts:72`의 quadrature 캐시는 `WeakMap<Brep, Map<number, ...>>`이다. 키는 객체 identity와 quadrature step q이다. 동일 BRep에 같은 q로 mass나 area를 먼저 읽으면 다음 mass query는 같은 적분 결과를 재사용한다. q 기본값은 8이다. density를 바꿔도 새 적분을 강제하지 않는다.

`direct-thread-long-construction-first-mass`는 fresh BRep 생성과 첫 mass query를 타이머 안에서 실행한다. 따라서 cache hit만 측정하는 case는 아니다. 하지만 thread construction과 여러 face 경로가 섞여 있다. ordinary/tiny cylinder의 wholePatch 첫 mass 비용을 분리하지 못한다. construction-only thread case는 fingerprint에서 mass를 타이머 밖에 계산한다. 두 case median을 빼서 순수 mass 시간을 만들면 안 된다.

현재 ordinary/tiny cylinder 전용 case는 없다. `hidden-lines-only`는 BRep를 global에 보관하지만 mass workload도 아니다. 기존 case의 빠른 결과만으로 D344 uncached quadrature 속도를 주장할 수 없다.

`brepQuadratureIntegrals`는 planar face를 먼저 처리하고, 나머지 wholePatch face를 tensor Gauss 경로로 처리한다. 첫 mass query 전에 fixture 복사본으로 wholePatch 적용 face와 planar face를 분류해야 한다. 모든 face가 wholePatch라고 가정하지 않는다. 별도 검사 객체에만 classification, validity, area 및 mass query를 실행한다.

## root 승인에 제안하는 최소 benchmark 확장

소유 범위는 root 승인 후 `perf-bench.mjs` 한 파일이다. 기존 case와 CLI를 유지한다. 새 case 이름은 다음 두 개를 제안한다.

- `native-cylinder-ordinary-first-mass`: radius 3, 번역 중심 (.1234567, -.2345678), z 시작 .3456789, 보통 높이 5.
- `native-cylinder-tiny-first-mass`: 같은 접선 단면, native z 끝점 .3456789 및 .34567890000000023. 실제 D343 native cylinder와 geometry 구조를 비교하여 fixture 적합성을 따로 확인한다.

fixture는 기존 공개 `prismaticFromProfile` 및 `brepFromPrismatic` producer로 만든다. native source/CP를 고치거나 새 private geometry constructor를 쓰지 않는다. 실제 D343의 4 physical faces와 새 producer 구조가 다르면 그 차이를 기록하고, 같은 geometry라고 주장하지 않는다. High의 실제 재현 fixture를 확정한 후 같은 native input으로 기준/후보를 고정한다.

최소 runner 확장은 새 두 case에만 선택적 untimed prepare를 제공하는 것이다. prepare는 표본마다 동일 fixture의 fresh deep clone 32개를 만든다. 타이머는 각 clone에 `brepMassProperties(brep, 1, {quadratureSegments: 8})`를 정확히 한 번 호출하는 32-query batch만 포함한다. clone, producer, checkBrep, wholePatch 분류, area, JSON, hash 및 oracle 계산은 타이머 밖이다. mass 결과는 밖에서 receipt로 읽으며, 일부 결과를 누락하지 않는다. 동일 batch 내와 표본 간 BRep 객체를 재사용하지 않는다. 이 설계는 캐시 제거 API나 production 계측 hook이 필요 없다.

새 case에만 warm-up 3 batches 및 측정 11 batches를 적용한다. warm-up도 fresh objects를 사용한다. 기존 `RUNS=11`은 측정 표본 수로 유지한다. 새 선택적 `WARMUP=3`, `BATCH=32` 지원과 high-resolution `samplesMs`, `medianMs`, `msPerQuery` 기록을 제안한다. 기존 정수 ms/fingerprint 필드는 유지한다. 표본이 너무 짧으면 후보 수정 전에 기준 pilot에서 batch를 128로 바꾸고, 최종 기준과 후보를 모두 같은 값으로 다시 측정한다. pilot은 성능 결과로 승격하지 않는다.

이 확장 없이 clone을 타이머 안에서 만들면 측정 이름과 보고서를 clone+first-mass로 한정해야 한다. 순수 first-mass로 표시하지 않는다. warmed cache case를 추가할 필요는 없다. 필요하다면 별도 이름으로만 기록한다.

## 정확한 기준/후보 실행 순서: 아직 실행하지 않음

1. root 승인 및 High gate 해제를 확인한다. 다른 heavy 작업을 동시에 실행하지 않는다. 기준 source SHA, 핵심 source hash, benchmark hash, dist hash, Node version, OS/CPU 및 RUNS/WARMUP/BATCH/q/density를 기록한다.
2. 위 benchmark 확장만 적용하고 node syntax/lint를 확인한다. 이때 quadrature production source는 게시 기준과 같아야 한다. root가 기준 build와 sole-heavy 슬롯을 승인한 뒤 library를 build한다.
3. 별도 qualification 객체로 native input 전체 JSON hash, bodies/shells/closed/faces/edges/vertices/loops/coedges, face/edge names, endpoints, surface CP/weights/knots/domain, method 및 wholePatch face IDs를 기록한다. 원래 입력과 query 후 입력의 byte/semantic identity를 확인한다. geometry hash는 정확도 oracle가 아니다.
4. 같은 프로세스 안의 warm-up 3 및 측정 11 batches를 실행한다. ordinary와 tiny 각각 32 fresh objects/batch를 쓴다. 기존 `direct-thread-long-construction-first-mass`도 RUNS=5로 한 번 기준을 남겨 broader mixed-workload control로 사용한다. 이것은 pure wholePatch case가 아니다.
5. High는 그 뒤 production 후보를 수정한다. 같은 benchmark 소스, machine, Node22, workload, 순서 및 batch 설정으로 후보 build 후 같은 측정을 실행한다. 입력 geometry/names/counts는 정확히 같아야 한다. mass 값/fingerprint 변화는 의도한 정확도 변화와 따로 분류한다. compare 명령의 예상 fingerprint DIFF를 성능 regression이나 geometry FAIL로 자동 해석하지 않는다.
6. Korean Markdown와 JSON에 raw sample, median batch ms 및 median/query ms, before/after 비율, 조건과 한계를 기록한다. 표본 수가 11이므로 강한 tail/p95 주장은 하지 않는다. 한 쌍의 local run을 서비스 성능 또는 전체 Kernel 성능으로 확대하지 않는다.

승인 후 사용할 명령 형태는 다음과 같다. 새 두 case와 환경 변수는 제안 상태이며 아직 기존 script에서 지원하지 않는다.

```sh
cd /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad
RUNS=11 WARMUP=3 BATCH=32 BASE=/tmp/d344-perf/baseline.json /Users/user/Library/pnpm/nodejs/22.19.0/bin/node scripts/perf-bench.mjs save native-cylinder-ordinary-first-mass,native-cylinder-tiny-first-mass
RUNS=11 WARMUP=3 BATCH=32 BASE=/tmp/d344-perf/baseline.json /Users/user/Library/pnpm/nodejs/22.19.0/bin/node scripts/perf-bench.mjs compare native-cylinder-ordinary-first-mass,native-cylinder-tiny-first-mass
RUNS=5 BASE=/tmp/d344-perf/thread-baseline.json /Users/user/Library/pnpm/nodejs/22.19.0/bin/node scripts/perf-bench.mjs save direct-thread-long-construction-first-mass
```

candidate 명령 stdout/exit를 별도 파일에 저장한다. compare의 예상 mass fingerprint DIFF도 원문 그대로 보존한다. geometry qualification은 timing JSON과 별도 파일이다. 오류가 나면 첫 결과를 보존하고 candidate를 PASS로 표시하지 않는다.

## 정확도 증명 범위

독립 reference는 실제 저장된 normal endpoints의 Fraction 차/중점과 native 원형 단면의 대칭 및 별도 적분이다. Math.PI 기반 원기둥 volume은 rounded analytic guide이다. 기존 upright provider 또는 잘못된 native quadrature 값을 유일한 oracle로 쓰지 않는다. baseline의 V/tangent centroid 오류는 보존할 failure 관측이다. 정확도 개선율과 실행 시간 개선율은 다른 결과이다. 성능 실행이 끝나기 전에는 어떤 속도 주장도 하지 않는다.

기존 source hash: perf-bench `04a74e4a283d89eec554cb8847d42d7de2fb027785fd61c6f0cbc2906b3c6685`; solid-mass `19ec118c7f6096f738d246e5ca46095b42dd9bf7f67e341bcc6f735690141eac`; quadrature `8ecf18b6338a403b9b541bd04716f9a9168bd45fc9a4ceeb00141e72cc9798a6`. 이 값은 read-only preparation 시점의 파일 관측이다. 실행 직전에 다시 확인한다.
