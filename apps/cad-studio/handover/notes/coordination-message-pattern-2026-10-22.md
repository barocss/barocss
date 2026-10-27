---
artifact_type: owner-supplied-coordination-example
received: 2026-10-22
source_sha256: e04adcf327cbda0fc401e54036b8eb3e223ef2f88950e9731ee6fbc3f1404d71
---

The owner clarified that this example defines the coordinator message loop: receive, inspect, decide, reply, relay dependencies, and report the result and next instruction. Its historical technical numbers are not current verification or a new task assignment.

```text
n the near band, and the exact distance is computed at each vertex.

수신 메시지 2개, 실행됨 명령 2개, 메시지 보냄 다른 세션 2개
4번이 승인됐고, G23 S0 답은 GPU 레인에게서 오는 대로 받기로 했습니다. G22 검증이 끝나면 체크포인트를 보내겠습니다.

보낸 사람: GPU: transform instances and a GPU clip plane

G20.1 checkpoint (cut-outs in the viewer): 02ebc9a7a (gpu) and 94eb2d048 (record, with your S0 answers). G22: my answer is in the message before this one: their field on a refined band mesh, overlaps local to body a with a pose key, incremental pair updates. It probably crossed with your reminder.

What's in
- Viewer.clipCutout (default false), used with clipPlanes. Kept means on any plane's kept side. The removed region R (the cut-away sides intersected) is convex, so it is one stretch of any ray.
- C is where the ray leaves R, on the plane it leaves through. A cap is drawn where the first surface after C is a back face. That is G19.1's rule unchanged, so the probe, caps, hatch, shadow caps (light probe) and ghost caps all work without new passes.
- GPU: the frame's plane count is negative for a cut-out, so the frame block doesn't grow. clippedAway means inside every removed half-space. regionAlong returns R's exit.
- CPU:
  - The packed planes carry the flag as one extra number at the end (packedCutout); keptBy keeps a point on any plane's kept side.
  - regionEntry returns R's exit.
  - A segment's kept part can be two pieces, and each is tried.
  - clipBox returns the box unchanged, or none when R holds all of it.
  - The shadow key includes the mode.
- A fault the oracle found and I fixed: with a cut-out, a kept surface in front of R is nearer than the cap. The CPU had taken the cap anyway, because in G19 nothing was kept before C. clippedRayFull now returns the nearer one; the GPU's depth test always did.

Evidence
- Unit test viewer-core G20: 800 rays at a box under 2 or 3 random planes in cut-out mode, against the closed form (the box's stretch minus R's).
  - 300+ hits and 40+ caps, each to 1e-9 with its plane.
  - Also: the packed flag; a segment across a removed slab is found on either piece and not between, with its nearest end from inside the slab; clipBox; the frame block's −n.
- Browser test (real WebGPU), a 4 mm cube seen obliquely:
  - The quarter's caps: 10,915 px against 8(|vx|+|vy|) = 10,839 ± 789.
  - The octant's caps: 7,407 against 4(|vx|+|vy|+|vz|) = 7,370 ± 789.
  - 300 GPU picks against CPU rays: 0 differ, 74 on caps.
  - The edge through the removed corner isn't found there, and is found on its kept half.
  - The octant cut-out's ground shadow is 1,853 px; the seven 2 mm cubes it's made of give 1,853.
- Bench (BENCH_ONLY=section, three runs alone, load 14–16): the GPU section measured 2.77, 3.24 and 2.41 ms per submit; G19.4's single run gave 2.33. The intersection path only adds one uniform branch per fragment, and the run-to-run spread is wider than the difference. No baseline rerun, per v2.

Checks (T1, gpu)
- tsc and lint clean; unit 84/84, consumer 3/3, browser 19/19.
- Studio not touched; that is G20.2.

Next is G20.2 (studio):
- the Cut-out mode with 2 or 3 planes, default corner facing the camera through the box centre;
- WebGL2 CPU clipping (pieces A and B, internal caps dropped);
- the exact section as separate kernel pieces, reported per source body (status, mass and properties, outliner, pick names);
- hatch;
- the flow on both renderers.

배송됨 · 읽기 · 답장함
G20.1 (02ebc9a7a, 94eb2d048) is accepted. Go for G20.2. Your G22 answer had crossed with my reminder; it was received and relayed.
- The closed-form oracle covers 800 rays with 2–3 random planes.
- The quarter and octant cap areas are within bounds. 300 picks match.
- The octant's shadow equals the seven-cube scene at 1,853 px.
- The CPU fix (a kept surface in front of R is nearer than the cap, which G19 never had) was found by your own oracle. Good.
- The bench spread (2.4–3.2 ms) is wider than any difference, which is fine.
Integration is now 9fec9950c: your G19.4, G19.5 and G20.1, the outer lane's G24 data, the bead mapping (5b), section edges keyed by body, and the G22/G23 data S0s. The kernel lane's FRk8b is uncommitted in that worktree. Merge 9fec9950c before G20.2's checkpoint. Note that section edge names changed to section_<body key>, in case your exact-section pieces or picks read them.
배송됨 · 읽기 · 답장함
Integration is now 9fec9950c: your item 4 and the S0s (to 90e62fc7f), plus the GPU lane's G19.4–G20.1 (ghost caps, caps casting shadows, the section in Render, cut-outs in the viewer). Merge it before G22's checkpoint. The GPU lane's G20.2 will report the exact section's pieces per source body, so if your BOM or properties code reads section pieces, it should keep working by source key.
GPU 줄의 G20.1(엔진에서 모서리 잘라 내기)을 받아들였습니다. 바깥 줄 작업과 함께 통합 브랜치에 합쳐서 지금은 9fec9950c입니다.

G20.1에서 된 것: 평면 2개나 3개로 모서리만 잘라 내는 모드를 엔진에 넣었습니다. 평면 2개면 4분의 1이 빠지고(3/4 단면), 3개면 8분의 1이 빠집니다(7/8 단면). 절단면 채우기, 빗금, 그림자, 반투명 처리는 G19 장치를 그대로 씁니다.

검증:

무작위 광선 800개를 공식과 비교해 1e-9 안에서 맞았습니다.
4 mm 정육면체로 3/4 단면과 7/8 단면의 절단면 넓이를 재 보니 공식값 범위 안이었습니다.
GPU 선택 300번이 CPU 결과와 모두 같았습니다.
7/8 단면의 그림자는 1,853픽셀로, 같은 모양을 2 mm 정육면체 7개로 만든 장면의 그림자와 정확히 같았습니다.
스스로 잡은 버그: 모서리를 잘라 내면 남는 표면이 절단면보다 앞에 올 수 있습니다. 그런데 CPU 쪽 선택이 이 경우에도 절단면을 먼저 잡았습니다. 앞서 G19 단면에서는 생길 수 없던 경우인데, 검증 과정에서 찾아 고쳤습니다.

이번에 합친 것:

GPU 줄: G19.4(반투명 절단면, 절단면 그림자), G19.5(렌더 작업공간 단면), G20.1
바깥 줄: 단면 모서리 이름 수정, G22·G23 데이터 사전 조사
다음:

GPU 줄: G20.2를 진행합니다. 스튜디오에 모서리 잘라 내기 모드를 넣고, WebGL2와 정확한 단면도 지원합니다.
바깥 줄: G22 데이터를 만들고 있습니다.
커널 줄: 질량 오차(FRk8b)를 고치고 있습니다.
검사: 이전 통합 상태의 전체 흐름이 지금 돌고 있습니다. 끝나면 새 통합 상태(9fec9950c)의 검사를 이어서 돌립니다.
```
