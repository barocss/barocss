# Full-position V2 → direct-grid V3 metadata map

상태: READ_ONLY_SCHEMA_PROPOSAL. 여섯 immutable V2 reply와 기존 comparator/checker/caller 소스만 읽었다. 구현·SAT·reference·수학·World 호출은0이다. 기존 payload/checker는 수정하지 않는다. Phase3 조합은 pure17 PASS와 Root의 이 MAP 검토 후에만 허용한다.

## 범위와 닫힌 경로 문법

각 frame에서 P는 prePairs/hypPairs, i는0..35, F는 아래 여섯 numeric 이름, C는 raw/normalized, a는0..14다. 이 표의 변수는 구조 분류용이다. 실제 comparator의 예외는 고정 범위를 전개한 구체 JSON pointer 목록이어야 한다. 임의 wildcard 삭제나 certificate subtree 제외는 허용하지 않는다. 알 수 없는 key·누락·배열길이/순서 변경은 실패다.

F = rawMarginM, normalizedMarginM, rawDepthM, normalizedDepthM, rawNormalizedMarginDifferenceM, rawNormalizedDepthDifferenceM.

기존 record는 pairKey, F6개, selection, ties, satCertificateV2로 닫혀 있다. satCertificateV2는11개 key다. 새 record는 V2 key를 satCertificateV3로 일대일 rename하고, certificate는 기존11개 key+enclosureAlgorithm 한 개로 닫는다. rename은 저장 값을 고쳐 V2 checker에 통과시키는 normalization이 아니다. 원래와 새 artifact를 그대로 두고 경로를 대응한다.

## 변경이 가능한 새 증명 metadata

| V2 경로 | V3 대응 | 허용과 의무 |
|---|---|---|
| /reference/P/i/satCertificateV2 | 같은 위치 satCertificateV3 | bijective schema rename만 허용. 내부 필드 전부 아래 규칙으로 검사 |
| .../protocol | .../protocol | p4-compact-observer-v2 → p4-compact-direct-grid-v1 정확한 문자열 |
| .../numericIntervals/F/low, high, precision | 같은 V3 leaf | 실제 새 enclosure 값만 변경. canonical integer endpoint, 기존 precision table/bit/byte cap, enclosure/rounding/width를 독립 검사 |
| 없음 | .../enclosureAlgorithm | DIRECT_SCALED_MARGIN_QUOTIENT_ISQRT_MINIMAL_GRID 정확한 새 tag 한 개 |
| /metrics/maxCertifiedSatWidthM | 같은 경로 | 유도 proof-width 진단이다. 새72×6 endpoint 폭의 정확한 max를 다시 구하고 기존 방식으로 Float64 표시. 저장값 동등성 예외는 이 metric 하나이며 물리 threshold를 바꾸지 않음 |
| /referenceProtocol | 새 full combination protocol | 제안 p4-position-witness-direct-grid-v3. Root 확정 필요. 기존 KKT referenceProtocol 교체와 같은 한 경로이며 subtree 예외가 아님 |

low/high/precision은 frame당1296개 leaf다. protocol72개와 width metric1개를 추가 분류한다. 각 record의 F6개 중 raw/normalized margin은 direct minimal radical-grid 원시 증명이다. depth의 clipping과 두 absolute-difference interval은 그대로의 조합 enclosure다. 파생 difference가 반드시1-grid minimal이거나 pure kernel의 exact flag를 가진다고 주장하지 않는다. V3 record에 per-field exact flag를 임의로 추가하지 않는다.

## 반드시 동일해야 할 certificate 내부 값

- .../numericIntervals/F/word: 16자리 little-endian binary64 word 그대로다. endpoint가 바뀌어도 이 word와 record의 해당 F value는 바뀔 수 없다.
- .../raw와 .../normalized의 firstExactMinimum, exactTiedMinima 전체, axes15개와 각 axis/exactZero/nearParallel/marginSign: field·값·순서 모두 동일하다. 새 방식은 winner 알고리즘이 아니다.
- .../physicalGates: PRE는 difference2개, HYP는 difference2개+depth2개만 가진다. 값은 기존 PASS와 같아야 하며 새 endpoints로 represented binary64(1e-12)에 대해 다시 증명한다. 복사한 PASS는 증명이 아니다.
- .../absoluteIntervalWidthLimitM='1e-25', axisArithmetic='EXACT_INTEGER_ALL_15_AXES_BOTH_MODELS', omittedLegacyField='precisionMaxDifferenceM', oldDecimalRuns=0, exactWinnerUsedForScalarSelection=false, scalarCandidateAxes=15는 그대로다. 이 고정 한도/claim을 새 metadata라고 삭제하지 않는다.

## certificate 밖의 모든 물리 경로

/reference/P/i/pairKey와 F6개는 원래 bytes/Float64 word를 보존한다. selection은 normal3, boundM, candidateIndex, pointM3, rawAxisLength, label, feature의 실제 key/값 전부 동일하다. ties는 exactMinimumCandidateIndices, withinDiagnosticTieToleranceCandidateIndices, skippedCandidateIndices, diagnosticTieToleranceM 및 uniquePhysicalFeatureClaimed 전체가 동일하다. scalar15축 코드는 그대로 사용하고 exact winner를 scalar 선택에 주입하지 않는다.

/reference의 translations/lambda/primalMargins/objective, 모든 Exact 문자열, certificateExact, basisRows/basisRank/dynamicDof, infeasibilityCertificate, uniqueActiveSetClaimed=false, numericRepresentation, rowChecks, actualDecodedDelta, additionRoundoff, actualDecodedRowMarginsExactM, oneApplyBasis, nonpenetrationChecked와 그 모든 하위 값은 동일하다. KKT의 stationary/complementarity·native 비교·RNE·roundoff 검사도 유지한다. 본 MAP은 이 영역에 새 예외를 추가하지 않는다.

/metrics는 maxCertifiedSatWidthM을 제외한 전부 동일하다. translation/objective/certificate/margin 차이, primal/dual/complementarity/stationarity, solutionReached, actualCertificateExact, maxPreAxisDifferenceM, maxHypDepthRawM, maxHypDepthNormalizedM, heldBitsMatch, roundedFinalMatches, staticBitsMatch, maxRoundedFinalDifferenceM, rawNormalizedDepthDifferenceM, stageReached를 그대로 비교한다. 물리1e-12 gate, 폭1e-25 gate, 정확한 RNE cell 조건을 서로 대체하지 않는다.

root의 ok/resolved/executionFailure/referenceStatus/violations 및 기존 기타 key도 동일하다. 알 수 없는 추가 항은 기본 EXACT 규칙의 허가가 아니라 schema 실패다.

## 기존 KKT metadata 예외는 넓히지 않음

old V2 cold-QP oracle와 비교할 때 이미 승인된 여섯 경로는 root referenceProtocol 교체, reference/arithmetic 교체, reference/counters 제거, reference/proofCounters·proofAuthority·witnessProvenance 추가다. 새 SAT 증명 때문에 이 목록에 KKT 물리 subtree를 추가하지 않는다. old counter를 복사해 cold solve가 실행됐다고 표시하지 않는다. 동일 integer KKT component를 hash 동일하게 재사용할 수 있지만 이전 조합의 비용 NO_GO는 종료 상태로 남는다. 새 B의 모든 물리/독립 검증과 단일 비용 판정은 새로 실행해야 한다.

## 새 독립 V3 validator의 필요 조건

1. 실제 saved request/body/pair/stage·원래scalar 경로·old oracle·source/tool pins를 먼저 인증한다. 입력에 oracle 답이나 winner를 seed하지 않는다. V3 schema를 정확히 닫고frame당72record, 여섯 frame 합계432record/864 raw-normalized model/12960axis 전체 census를 유지한다.
2. 두 base margin의 N,D,S,p를 authenticated represented geometry에서 독립적으로 binding한다. D>0,S>0을0분자에서도 먼저 확인한다. pure kernel의 signed enclosure/minimal-grid 정수 부등식을 검사하되 candidate sqrt/factorization을 재사용하지 않는다. pure17 PASS만으로 full-frame input binding이 증명됐다고 주장하지 않는다.
3. depth=max(0,margin)와 absolute differences의 enclosure 조합을 독립 확인한다. 기존 exact margin equality 특수0 처리도 증명해야 한다. 파생 intervals는 minimal/exact라고 새로 선언하지 않는다.
4. 모든 endpoints를 해석해 low≤high, exact 폭≤10^-25를 검증한다. precision은 기존64/128/256/512/1024/2048이고 cap/재시도 정책은 그대로다. 각 word는 old oracle와 같고, interval 전체가 그 word의 strict own rounding cell 내부에 있어야 한다. 0/±0를 포함해 word/string normalization은 하지 않는다.
5. PRE/HYP physical gates를 exact represented1e-12로 재평가하고 기존 PASS와 비교한다. maxCertifiedSatWidthM은 exact 폭 max의 실제 표시값과 비교한다. 매우 작은 폭의 실제 Float64 underflow0은 진단 표시일 뿐, exact 폭 증명을 없애지 않는다.
6. 나머지 모든 certificate/record/KKT/metrics leaf는 exact 비교한다. 새 certificate 한 개를 검사 없이 통째로 제외하거나 old oracle certificate를 복사해 V3 값을 덮어쓰지 않는다. 각 허용 leaf를 실제로 소비했는지도 확인한다.

기존 compact.verify, position-V2 verify, physical.compare_world 및 witness checker의 world branch는 V2 key/protocol/width 또는 full object equality를 고정한다. 그대로는 V3를 수락할 수 없다. ended 파일을 고치거나 reply를 변환하지 말고, 새 소유 validator에서 같은 KKT/물리 검사와 새 닫힌 certificate 검사를 함께 구성해야 한다. 검증된 source/math component 재사용과 새 전체 결과의 독립 검증은 구분한다.

## 다음 단계 제한

현재 단계는 MAP뿐이다. Pure17(13 valid/2 invalid/2 resource)와 Root 검토가 먼저다. 이후에만 Python compact의 interval 부분을 새 방법으로 바꾸고, unchanged integer-proof Node6RPC를 합친 새 full6 B를 만들 수 있다. Node SAT port나 종료된 후보의 재측정이 아니다. 새 full6 물리/독립 PASS 후 한 번만 parent+whole child 보수적 비용695832300ns gate를 판정한다. 원래1200/API/desktop은 여전히 NOT_RUN이다.
