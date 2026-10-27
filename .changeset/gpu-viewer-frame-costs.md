---
"@barocss/gpu": minor
---

The viewer can count what each mesh costs a frame. Off by default, `viewer.costs = true` makes `viewer.meshCosts()` hand out each mesh's draw calls, triangles, lines and points in the last frame drawn, and its draws by pass (`FramePass`: shadow, surface, transparent, oit, hiddenLines, caps, outlineMask; `FRAME_PASSES`). The records are kept from frame to frame, zeroed as each counted frame begins and dropped with their mesh. Counting changes nothing drawn, and while it is off a draw costs one branch. These are work counts, not time: the frame's time stays `stats.cpuMs`.
