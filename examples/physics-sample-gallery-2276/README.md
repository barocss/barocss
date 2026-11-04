# Physics sample gallery

실제 공개 Physics World의 서로 다른 동작을 실제 `@barocss/viewer` 화면에 연결하는 제한된 샘플입니다. 현재 실행 상태는 **제한된 6개 샘플 PASS**입니다. Source·실제 컴파일 패키지·독립 수치 기준과 실제 데스크탑 HiDPI 화면을 검사했습니다. 세 상자 장시간 시험과 엔진 전체는 여전히 미완료입니다. 상세 수치와 첫 화면 실패는 [RESULTS.md](RESULTS.md)에 보존했습니다.

| 샘플 | 표시할 동작 | 고정 스텝 |
|---|---|---:|
| 포물선 운동 | 중력 아래 상자의 이동 |64|
| 탄성 상자 | 바닥 충돌과 반발 |64|
| 구의 미끄럼과 구름 | 접선 마찰과 구의 회전 |64|
| 고속 구 충돌 | 한 스텝 안의 sphere CCD |1|
| 비등방 상자 회전 | 주축 각충격과 회전 |64|
| 두 상자와 바닥 | 낙하 후 결합 지지 |128|

수치 시험은 Source와 실제 canonical Native를 각각 사용합니다. 그래프마다 기본385스텝과 실제 반복385스텝을 수행합니다. 독립 기준은 기본385스텝을 검사합니다. 반복 일치는 결정성 검사이며 별도 물리 정확도 증명이 아닙니다. 고정 음성 입력은 거부·상태 보존과 기준 검사의 실패 판정을 확인합니다.

화면은 canonical Native만 사용합니다. Worker가 World와 시계를 단독 소유합니다. 샘플 선택·1스텝·실행/정지·초기화·카메라를 제공합니다. 추가 설명 레이어는 없습니다. 각 실제 전체 상태와 명령, signed zero를 포함한 모든 숫자의 binary64 비트를 수치 시험의 Native 결과와 호스트에서 비교합니다. 기대 위치를 엔진에 넣지 않습니다.

Viewer/GPU는 워크스페이스 공개 소스 경로입니다. 상자·구 mesh는 표시용 proxy이며 CAD 원본·충돌 입력이 아닙니다. 실제 HiDPI DPR2 및1280/1440/1920 desktop 크기를 검사합니다. 기존4MP/4096 한계를 유지합니다. 실제 native GPU 픽셀을640×360으로 샘플링하는 것은 화면 관측일 뿐, native 해상도640이라는 뜻이 아닙니다. 접촉점 marker, 모바일, Studio/React 연결, 배포는 포함하지 않습니다.

## 로컬 개발 미리보기

검증 receipt 없이 현재 체크아웃의 샘플을 열려면 Node.js22 이상과 기존 워크스페이스 의존성을 사용합니다.

```sh
node examples/physics-sample-gallery-2276/dev.mjs
```

`http://127.0.0.1:53050`에서 여섯 샘플을 선택할 수 있습니다. 현재 `packages/barocss-physics/dist/index.js`만 Physics로 사용하고 Viewer/GPU는 워크스페이스 소스를 번들합니다. dist가 없으면 먼저 아래 명령을 직접 실행해야 합니다. 미리보기는 Physics 빌드나 의존성 설치를 자동으로 실행하지 않습니다.

```sh
pnpm --filter @barocss/physics build:library
```

미리보기 출력은 `output/physics-gallery-dev`입니다. 이 개발 출력은 다시 만들 수 있으며 immutable proof 폴더와 다릅니다. 기대 궤적·수치 기준·capture API·검증 배지는 없습니다. 화면을 열었다는 사실은 수치 또는 데스크톱 PASS가 아닙니다. 같은53050 포트를 사용하는 검증 서버와 동시에 실행하지 마세요.

## Root의 증거 검증 실행

Root가 독립 수치 계약과 소스를 동결한 후 실행합니다. 기존 preview 서버의 소유자가53050 포트를 먼저 비워야 합니다. 설치나 다운로드는 필요하지 않습니다.

```sh
# 수치 명령과 인자는 RUN-CONTRACT.md를 따른다.
# 실제 api-01 PASS가 있어야 화면 빌드가 허용된다.
node examples/physics-sample-gallery-2276/server.mjs --build gallery-desktop-02 --numeric examples/physics-sample-gallery-2276/evidence/api-01/result.json
node examples/physics-sample-gallery-2276/server.mjs gallery-desktop-02
# 별도 터미널에서 기존180초 outer guard 아래 실행한다.
node examples/physics-sample-gallery-2276/browser-run.mjs gallery-desktop-02
```

주소는 `http://127.0.0.1:53050`입니다. serve 모드는 이미 빌드된 바이트만 인증하고 제공합니다. 수치 결과·모델·provider가 바뀌면 새 proof ID로 다시 빌드해야 합니다. 실패한 ID를 덮거나 자동 재시도하지 않습니다.

## 증거 보존

실제 수치·화면 PASS 뒤에만 보존 스크립트를 실행합니다.

```sh
python3 examples/physics-sample-gallery-2276/checkpoint.py --build --numeric api-01 --desktop gallery-desktop-02
python3 examples/physics-sample-gallery-2276/checkpoint.py --verify
```

`SOURCE.tar.gz`, `PROOF.tar.gz`, `CHECKPOINT.json`을 새로 만듭니다. 기존 `CHECKPOINT-15-PREFIX`의 정확한 세 파일을 의존성으로 고정합니다. 실제 build03 provider를 재사용하며 새로운 컴파일 증명을 만들지 않습니다. 원래16MiB/file·512MiB 전체 선택·50,000 members를 유지하고, 큰 원본은 삭제하지 않고 로컬 외부 SHA 참조로 남깁니다. 모든 첫 실패와 실제 상태를 보존합니다. archive 검증은 물리·브라우저 실행이 아닙니다.

이 여섯 샘플의 성공은 엔진 전체 완료를 뜻하지 않습니다. 기존 장기 세 상자512의 NO_GO, 공차, HOLD와 배포 금지는 그대로입니다. 구·마찰·CCD 결과도 여기서 실제 검증한 입력·기간으로 제한합니다.
