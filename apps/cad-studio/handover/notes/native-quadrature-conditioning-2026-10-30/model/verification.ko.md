# D344 Model·Studio 소비자 검증

승인된 검사를 완료했고 heavy gate를 해제했다. 실제 브라우저는 NOT_RUN이다. 저장소 src와 benchmark를 바꾸지 않았다.

- 새 STEP 소비자 테스트: 2 PASS, 0 FAIL.
- 관련 기존 Model 테스트: 23 PASS, 0 FAIL. STEP·units·cache·MMGS·mass·native mass wire 경로만 선택했다. 전체 Model86을 반복하지 않았다.
- 전체 Model types: PASS. 새 테스트 lint: 0 errors, 0 warnings.
- Studio types 및 Vite build: PASS. Vite의 기존 module directive/dynamic import warnings는 로그에 있다.
- 새 browser driver lint: 0 errors, console warning 1개.

새 Node 테스트는 실제 Offset command build로 만든 target-only residue를 exportStudioStep 기본 경로로 내보냈다. metadata V는 6.278163296415527e-15, C는 [.12345669999999997, -.23456779999999938, .3456789000000001]이다. 독립 stored-node rational Gauss reference와 별도 rounded-circle guide를 확인했다. STEP에 mm·mm²·mm³ 단위를 기록했고, 원본 문서와 native 입력은 바뀌지 않았다.

importStep 후 strict-valid closed solid/shell 1개, physical faces 4개, names 및 exact cap levels [.3456789, .34567890000000023]를 유지했다. 이 fixture의 imported raw mass는 wholePatch side 2개를 사용하는 quadrature였다. 그 V는 export native V와 같았고 Cxy는 별도 소수점 관측값이다. imported provider를 export metadata oracle로 대체하지 않았으며, 모든 trimmed/fallback 또는 STEP provider를 수리했다고 주장하지 않는다.

테스트 runner가 임시 bundle의 import.meta.url을 사용하므로, 독립 helper 경로는 runner가 실제 test directory로 고정하는 import.meta.dirname에서 해결하도록 runtime 전에 정리했다. 첫 runtime 실패는 없었다. 모든 최초 로그는 그대로 보존했다.

최종 동결 SHA:

- Model test: 233d899441bb53850bcc5ffca42c666ed54cec7734c53d8f71b8dec014dbdf78
- Browser driver: 7286429630f31b3daa966c0dce86f2c443d8097b0b3a8b47a2ba7f1e48ab3a09
- Benchmark: 37d81a207f097d7cb35d859200db64f716d0c38d30ed8a79b3d79e60ab4c39a9
- Quadrature: 696ec924bc4f1d7b74862533676af5e4c0b8a2a284a8a249ea7007dade4c8ed5

실제 브라우저 실행은 root의 source checkpoint 및 승인 후에만 가능하다. Node 결과는 실제 mouse·worker·download 제품 흐름 PASS를 대신하지 않는다. Commit/push는 하지 않았다.
