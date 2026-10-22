# RB9 ladder — scripted agent (seed 2026)

Each rung: n trials on fresh documents, parameters sampled from the seed — trial 0 every parameter at its low end, 1 at its high end, 2 and 3 alternating, then random on the step grid. The checker is hidden from the agent and runs on the part it leaves. pass = every hard predicate holds; pass@1 = c/n; pass@k any, pass^k all; RS = the mean share of hard predicates holding. Each mutant is a seeded wrong design run on both range ends, killed when its targeted predicate fails.

| rung | title | passed | pass@1 | pass@k | pass^k | RS | mutants killed | predicates no mutant kills |
|---|---|---|---|---|---|---|---|---|
| 1 | block with hole | 5/5 | 1.00 | 1 | 1 | 1.000 | 12/12 | — |
| 2 | washer | 5/5 | 1.00 | 1 | 1 | 1.000 | 12/12 | — |
| 3 | printed phone stand | 5/5 | 1.00 | 1 | 1 | 1.000 | 12/12 | — |
| 4 | machined plate (geometry) | 5/5 | 1.00 | 1 | 1 | 1.000 | 18/18 | — |
| 5 | sheet-metal L-bracket | 5/5 | 1.00 | 1 | 1 | 1.000 | 14/14 | — |
| 6 | load bracket (beam) | 5/5 | 1.00 | 1 | 1 | 1.000 | 14/14 | — |
| 7 | bolted lap joint (plates) | 5/5 | 1.00 | 1 | 1 | 1.000 | 12/12 | — |
| 8 | snap-fit box | 5/5 | 1.00 | 1 | 1 | 1.000 | 20/20 | — |
| 9 | PCB enclosure | 5/5 | 1.00 | 1 | 1 | 1.000 | 14/14 | — |
| 10 | sheet-metal PCB enclosure | 5/5 | 1.00 | 1 | 1 | 1.000 | 16/16 | — |
| 11 | print-in-place toy | 5/5 | 1.00 | 1 | 1 | 1.000 | 10/10 | — |
| 12 | 5-part assembly | 5/5 | 1.00 | 1 | 1 | 1.000 | 12/12 | — |
| 13 | product from a brief | 5/5 | 1.00 | 1 | 1 | 1.000 | 10/10 | — |
| 14 | 2-axis robot arm | 5/5 | 1.00 | 1 | 1 | 1.000 | 12/12 | — |

Overall: 70/70 trials pass (100 %); mutants killed 188/188.

## Trials

| rung | trial | seed | parameters | pass | RS | failed | calls | ms |
|---|---|---|---|---|---|---|---|---|
| block-hole | 0 | 2026 | w 30, d 30, h 8, dh 3 | yes | 1.000 | — | 2 | 35 |
| block-hole | 1 | 2026 | w 120, d 120, h 40, dh 48 | yes | 1.000 | — | 2 | 11 |
| block-hole | 2 | 2026 | w 30, d 120, h 8, dh 12 | yes | 1.000 | — | 2 | 9 |
| block-hole | 3 | 2026 | w 120, d 30, h 40, dh 3 | yes | 1.000 | — | 2 | 8 |
| block-hole | 4 | 2026 | w 54, d 73, h 36, dh 15.5 | yes | 1.000 | — | 2 | 8 |
| washer | 0 | 2026 | D 8, d 3.2, t 0.8 | yes | 1.000 | — | 1 | 8 |
| washer | 1 | 2026 | D 40, d 28, t 4 | yes | 1.000 | — | 1 | 11 |
| washer | 2 | 2026 | D 8, d 5.6, t 0.8 | yes | 1.000 | — | 1 | 8 |
| washer | 3 | 2026 | D 40, d 16, t 4 | yes | 1.000 | — | 1 | 8 |
| washer | 4 | 2026 | D 16.5, d 8.9, t 3.6 | yes | 1.000 | — | 1 | 8 |
| phone-stand | 0 | 2026 | w 60, D 50, H 40, g 10 | yes | 1.000 | — | 5 | 16 |
| phone-stand | 1 | 2026 | w 100, D 90, H 80, g 14 | yes | 1.000 | — | 5 | 13 |
| phone-stand | 2 | 2026 | w 60, D 90, H 40, g 14 | yes | 1.000 | — | 5 | 15 |
| phone-stand | 3 | 2026 | w 100, D 50, H 80, g 10 | yes | 1.000 | — | 5 | 15 |
| phone-stand | 4 | 2026 | w 71, D 69, H 74, g 13 | yes | 1.000 | — | 5 | 13 |
| machined-plate | 0 | 2026 | L 80, W 50, T 6, dh 4, px 40, py 20, rc 3, a 9, b 9, depth 2 | yes | 1.000 | — | 8 | 504 |
| machined-plate | 1 | 2026 | L 200, W 150, T 20, dh 10, px 160, py 120, rc 8, a 140, b 100, depth 18 | yes | 1.000 | — | 8 | 794 |
| machined-plate | 2 | 2026 | L 80, W 150, T 6, dh 10, px 40, py 120, rc 3, a 20, b 9, depth 4 | yes | 1.000 | — | 8 | 278 |
| machined-plate | 3 | 2026 | L 200, W 50, T 20, dh 4, px 184, py 20, rc 8, a 24, b 24, depth 2 | yes | 1.000 | — | 8 | 748 |
| machined-plate | 4 | 2026 | L 110, W 100, T 18, dh 8, px 73, py 70, rc 5.5, a 31.5, b 41.5, depth 13 | yes | 1.000 | — | 8 | 1534 |
| sheet-l-bracket | 0 | 2026 | t 1, r 1, k 0.3, a 30, b 25, w 20, dh 3 | yes | 1.000 | — | 2 | 74 |
| sheet-l-bracket | 1 | 2026 | t 3, r 9, k 0.5, a 60, b 50, w 40, dh 13 | yes | 1.000 | — | 2 | 44 |
| sheet-l-bracket | 2 | 2026 | t 1, r 3, k 0.3, a 60, b 25, w 40, dh 3 | yes | 1.000 | — | 2 | 39 |
| sheet-l-bracket | 3 | 2026 | t 3, r 3, k 0.5, a 30, b 50, w 20, dh 6.5 | yes | 1.000 | — | 2 | 40 |
| sheet-l-bracket | 4 | 2026 | t 1.5, r 3, k 0.48, a 51, b 35, w 24, dh 5.5 | yes | 1.000 | — | 2 | 38 |
| load-bracket | 0 | 2026 | L 40, b 10, m al6061, F 20, dmax 0.03 | yes | 1.000 | — | 5 | 69 |
| load-bracket | 1 | 2026 | L 150, b 30, m steel, F 500, dmax 0.25 | yes | 1.000 | — | 5 | 74 |
| load-bracket | 2 | 2026 | L 40, b 30, m al6061, F 500, dmax 0.24 | yes | 1.000 | — | 5 | 65 |
| load-bracket | 3 | 2026 | L 150, b 10, m steel, F 20, dmax 0.03 | yes | 1.000 | — | 5 | 61 |
| load-bracket | 4 | 2026 | L 70, b 20, m steel, F 348, dmax 0.15 | yes | 1.000 | — | 5 | 59 |
| lap-joint | 0 | 2026 | d 4.5, nx 1, t 3, W 32, sy 9, sx 9, ov 13.5, LA 33.5, LB 33.5 | yes | 1.000 | — | 11 | 93 |
| lap-joint | 1 | 2026 | d 9, nx 2, t 10, W 120, sy 93, sx 54, ov 108, LA 198, LB 198 | yes | 1.000 | — | 15 | 166 |
| lap-joint | 2 | 2026 | d 4.5, nx 2, t 3, W 120, sy 9, sx 27, ov 40.5, LA 195.5, LB 60.5 | yes | 1.000 | — | 15 | 153 |
| lap-joint | 3 | 2026 | d 9, nx 1, t 10, W 59, sy 32, sx 18, ov 54, LA 74, LB 199 | yes | 1.000 | — | 11 | 65 |
| lap-joint | 4 | 2026 | d 5.5, nx 1, t 9, W 94, sy 36.5, sx 16, ov 25, LA 105, LB 155 | yes | 1.000 | — | 11 | 66 |
| snap-fit-box | 0 | 2026 | W 60, D 40, H 25, s 1.5, tl 2, m abs, nh 2, tb 1.2, y 0.6, b 5, L 9 | yes | 1.000 | — | 8 | 102 |
| snap-fit-box | 1 | 2026 | W 120, D 80, H 40, s 3, tl 3, m petg, nh 4, tb 2, y 1.2, b 10, L 31 | yes | 1.000 | — | 12 | 180 |
| snap-fit-box | 2 | 2026 | W 60, D 80, H 25, s 3, tl 2, m petg, nh 2, tb 2, y 0.6, b 10, L 11 | yes | 1.000 | — | 8 | 91 |
| snap-fit-box | 3 | 2026 | W 120, D 40, H 40, s 1.5, tl 3, m abs, nh 4, tb 1.2, y 1.2, b 5, L 32 | yes | 1.000 | — | 12 | 178 |
| snap-fit-box | 4 | 2026 | W 76, D 59, H 38, s 2.5, tl 2.5, m abs, nh 4, tb 1.5, y 1.1, b 9, L 16 | yes | 1.000 | — | 12 | 182 |
| pcb-enclosure | 0 | 2026 | w 90, d 60, h 25, t 2, a 40, b 30, i 3.5, v M2.5, hs 5, c 3, n 3, sl 8 | yes | 1.000 | — | 8 | 682 |
| pcb-enclosure | 1 | 2026 | w 140, d 100, h 40, t 3, a 104, b 64, i 5, v M3, hs 10, c 23, n 8, sl 15 | yes | 1.000 | — | 8 | 769 |
| pcb-enclosure | 2 | 2026 | w 90, d 100, h 25, t 3, a 40, b 64, i 3.5, v M3, hs 5, c 13, n 3, sl 15 | yes | 1.000 | — | 8 | 682 |
| pcb-enclosure | 3 | 2026 | w 140, d 60, h 40, t 2, a 106, b 30, i 5, v M2.5, hs 10, c 3, n 8, sl 8 | yes | 1.000 | — | 8 | 743 |
| pcb-enclosure | 4 | 2026 | w 103, d 79, h 38, t 3, a 50, b 33, i 4.5, v M2.5, hs 8.5, c 18, n 4, sl 12 | yes | 1.000 | — | 8 | 685 |
| sheet-pcb-enclosure | 0 | 2026 | t 1, r 1, k 0.3, A 80, B 50, h 15, inset 8, dh 2.5, sw 10, sh 4 | yes | 1.000 | — | 1 | 224 |
| sheet-pcb-enclosure | 1 | 2026 | t 2, r 4, k 0.5, A 140, B 100, h 35, inset 15, dh 4, sw 30, sh 25 | yes | 1.000 | — | 1 | 203 |
| sheet-pcb-enclosure | 2 | 2026 | t 1, r 2, k 0.3, A 140, B 50, h 35, inset 8, dh 4, sw 10, sh 28 | yes | 1.000 | — | 1 | 196 |
| sheet-pcb-enclosure | 3 | 2026 | t 2, r 2, k 0.5, A 80, B 100, h 15, inset 15, dh 2.5, sw 30, sh 4 | yes | 1.000 | — | 1 | 200 |
| sheet-pcb-enclosure | 4 | 2026 | t 1, r 1.5, k 0.48, A 121, B 69, h 19, inset 11.5, dh 3.1, sw 25, sh 10.5 | yes | 1.000 | — | 1 | 185 |
| print-in-place | 0 | 2026 | ra 3, g 0.3, hr 4, w 2, tf 1.5, e 1.5 | yes | 1.000 | — | 7 | 148 |
| print-in-place | 1 | 2026 | ra 8, g 0.6, hr 12, w 6, tf 3, e 4 | yes | 1.000 | — | 7 | 134 |
| print-in-place | 2 | 2026 | ra 3, g 0.6, hr 4, w 6, tf 1.5, e 4 | yes | 1.000 | — | 7 | 141 |
| print-in-place | 3 | 2026 | ra 8, g 0.3, hr 12, w 2, tf 3, e 1.5 | yes | 1.000 | — | 7 | 129 |
| print-in-place | 4 | 2026 | ra 4, g 0.45, hr 11, w 5, tf 2, e 2 | yes | 1.000 | — | 7 | 134 |
| five-part-assembly | 0 | 2026 | P 100, Q 50, tb 4, bw 8, bd 20, bh 30, ds 6, c 12, zc 7, ct 3, xa 5, xb 60 | yes | 1.000 | — | 22 | 77 |
| five-part-assembly | 1 | 2026 | P 200, Q 100, tb 10, bw 15, bd 40, bh 60, ds 12, c 40, zc 40, ct 6, xa 75, xb 174 | yes | 1.000 | — | 22 | 75 |
| five-part-assembly | 2 | 2026 | P 100, Q 100, tb 4, bw 15, bd 20, bh 60, ds 6, c 20, zc 11, ct 6, xa 5, xb 74 | yes | 1.000 | — | 22 | 73 |
| five-part-assembly | 3 | 2026 | P 200, Q 50, tb 10, bw 8, bd 40, bh 30, ds 12, c 18, zc 21, ct 3, xa 82, xb 110 | yes | 1.000 | — | 22 | 73 |
| five-part-assembly | 4 | 2026 | P 125, Q 75, tb 9, bw 13, bd 28, bh 36, ds 9, c 20, zc 22, ct 6, xa 11, xb 86.5 | yes | 1.000 | — | 22 | 74 |
| product-brief | 0 | 2026 | kind knob, R 10, H 12, ds 4, f 0.4, depth 4.8, fr 0.5, w 20, t 3, a 20, l 8 | yes | 1.000 | — | 6 | 174 |
| product-brief | 1 | 2026 | kind hook, R 25, H 25, ds 8, f 1, depth 17.5, fr 3, w 40, t 6, a 50, l 20 | yes | 1.000 | — | 8 | 42 |
| product-brief | 2 | 2026 | kind knob, R 25, H 12, ds 8, f 0.4, depth 8.3, fr 0.5, w 40, t 3, a 50, l 8 | yes | 1.000 | — | 6 | 293 |
| product-brief | 3 | 2026 | kind hook, R 10, H 25, ds 4, f 1, depth 10, fr 3, w 20, t 6, a 20, l 20 | yes | 1.000 | — | 8 | 38 |
| product-brief | 4 | 2026 | kind knob, R 17, H 23, ds 7, f 0.6, depth 10.7, fr 2, w 28, t 5.5, a 43, l 10 | yes | 1.000 | — | 6 | 70 |
| two-axis-arm | 0 | 2026 | l1 80, l2 80, m 0.1, R 110, q1 0.5, q2 -2, v 1, acc 5 | yes | 1.000 | — | 21 | 240 |
| two-axis-arm | 1 | 2026 | l1 250, l2 250, m 1, R 490, q1 1.5, q2 -0.5, v 3, acc 20 | yes | 1.000 | — | 21 | 214 |
| two-axis-arm | 2 | 2026 | l1 80, l2 250, m 0.1, R 320, q1 0.5, q2 -0.5, v 1, acc 20 | yes | 1.000 | — | 21 | 279 |
| two-axis-arm | 3 | 2026 | l1 250, l2 80, m 1, R 280, q1 1.5, q2 -2, v 3, acc 5 | yes | 1.000 | — | 21 | 273 |
| two-axis-arm | 4 | 2026 | l1 125, l2 160, m 0.9, R 248, q1 0.9, q2 -1.7, v 2, acc 11 | yes | 1.000 | — | 21 | 268 |

## Mutants

| rung | mutant | what is wrong | target | killed | failed |
|---|---|---|---|---|---|
| block-hole | diameter@0 | the hole 1 mm too big | bore | yes | volume, bore, through |
| block-hole | diameter@1 | the hole 1 mm too big | bore | yes | volume, bore, through |
| block-hole | offset@0 | the hole 2 mm off the middle | bore | yes | bore, through |
| block-hole | offset@1 | the hole 2 mm off the middle | bore | yes | bore, through |
| block-hole | blind@0 | a blind hole half way | through | yes | volume, through |
| block-hole | blind@1 | a blind hole half way | through | yes | volume, through |
| block-hole | wide@0 | the block 5 mm too wide | box | yes | box, volume |
| block-hole | wide@1 | the block 5 mm too wide | box | yes | box, volume |
| block-hole | no-hole@0 | no hole | volume | yes | volume, bore, through |
| block-hole | no-hole@1 | no hole | volume | yes | volume, bore, through |
| block-hole | loose@0 | a second block beside it | solids | yes | box, volume, solids |
| block-hole | loose@1 | a second block beside it | solids | yes | box, volume, solids |
| washer | offset-bore@0 | the bore 0.5 off its axis | coaxial | yes | box, volume, solids, outer, bore, coaxial, (refused) |
| washer | offset-bore@1 | the bore 0.5 off its axis | coaxial | yes | coaxial |
| washer | thick@0 | 1.5 times too thick | box | yes | box, volume |
| washer | thick@1 | 1.5 times too thick | box | yes | box, volume |
| washer | big-bore@0 | the bore 0.9 D | bore | yes | volume, bore, coaxial |
| washer | big-bore@1 | the bore 0.9 D | bore | yes | volume, bore, coaxial |
| washer | disc@0 | a solid disc | volume | yes | box, volume, solids, outer, bore, coaxial, (refused) |
| washer | disc@1 | a solid disc | volume | yes | volume, bore, coaxial |
| washer | outside@0 | the outside 1 mm too big | outer | yes | box, volume, outer, coaxial |
| washer | outside@1 | the outside 1 mm too big | outer | yes | box, volume, outer, coaxial |
| washer | two@0 | two washers | solids | yes | box, volume, solids |
| washer | two@1 | two washers | solids | yes | box, volume, solids |
| phone-stand | no-lip@0 | no lip | slot | yes | volume, slot |
| phone-stand | no-lip@1 | no lip | slot | yes | volume, slot |
| phone-stand | thin-back@0 | the back pocketed to a 0.5 mm skin | min-wall | yes | volume, slot, min-wall |
| phone-stand | thin-back@1 | the back pocketed to a 0.5 mm skin | min-wall | yes | volume, slot, min-wall |
| phone-stand | tall@0 | the back 5 mm too high | box | yes | box, volume |
| phone-stand | tall@1 | the back 5 mm too high | box | yes | box, volume |
| phone-stand | tall-lip@0 | the lip 2 mm too high | volume | yes | volume |
| phone-stand | tall-lip@1 | the lip 2 mm too high | volume | yes | volume |
| phone-stand | narrow-slot@0 | the slot 3 mm too narrow | slot | yes | slot |
| phone-stand | narrow-slot@1 | the slot 3 mm too narrow | slot | yes | slot |
| phone-stand | loose-piece@0 | a second solid floating above | solids | yes | box, volume, solids |
| phone-stand | loose-piece@1 | a second solid floating above | solids | yes | box, volume, solids |
| machined-plate | moved@0 | one hole 1 mm off its pitch | holes | yes | holes |
| machined-plate | moved@1 | one hole 1 mm off its pitch | holes | yes | holes |
| machined-plate | three@0 | three holes | holes | yes | holes, volume |
| machined-plate | three@1 | three holes | holes | yes | holes, volume |
| machined-plate | deep@0 | the pocket 1 mm deeper | pocket | yes | pocket, volume |
| machined-plate | deep@1 | the pocket 1 mm deeper | pocket | yes | pocket, volume |
| machined-plate | sharp@0 | corner radius 1 | corners | yes | corners, volume |
| machined-plate | sharp@1 | corner radius 1 | corners | yes | corners, volume |
| machined-plate | extra@0 | a stray Ø3 blind hole | volume | yes | pocket, volume |
| machined-plate | extra@1 | a stray Ø3 blind hole | volume | yes | pocket, volume |
| machined-plate | long@0 | the plate 5 mm longer | box | yes | box, volume |
| machined-plate | long@1 | the plate 5 mm longer | box | yes | box, volume |
| machined-plate | loose@0 | a loose block | solids | yes | box, solids, pocket, volume |
| machined-plate | loose@1 | a loose block | solids | yes | box, solids, pocket, volume |
| machined-plate | deep-hole@0 | a Ø0.5 blind hole T − 1 deep (over 6 × d: failed) | machinable | yes | pocket, volume, machinable |
| machined-plate | deep-hole@1 | a Ø0.5 blind hole T − 1 deep (over 6 × d: failed) | machinable | yes | pocket, volume, machinable |
| machined-plate | groove@0 | an internal groove round a corner hole (undecided reach, unreached area) | machinable | yes | holes, pocket, volume, machinable |
| machined-plate | groove@1 | an internal groove round a corner hole (undecided reach, unreached area) | machinable | yes | holes, pocket, volume, machinable |
| sheet-l-bracket | k-off@0 | K 0.05 off | flat-length | yes | flat-length, flat-area |
| sheet-l-bracket | k-off@1 | K 0.05 off | flat-length | yes | flat-length, flat-area |
| sheet-l-bracket | k-area@0 | K 0.1 off | flat-area | yes | flat-length, flat-area |
| sheet-l-bracket | k-area@1 | K 0.1 off | flat-area | yes | flat-length, flat-area |
| sheet-l-bracket | short@0 | a leg 5 short | volume | yes | volume, flat-length, flat-area |
| sheet-l-bracket | short@1 | a leg 5 short | volume | yes | volume, flat-length, flat-area |
| sheet-l-bracket | narrow@0 | 5 narrower | flat-width | yes | volume, flat-width, flat-area |
| sheet-l-bracket | narrow@1 | 5 narrower | flat-width | yes | volume, flat-width, flat-area |
| sheet-l-bracket | radius@0 | the bend radius 0.5 more | bend | yes | volume, flat-length, flat-area, bend, holes |
| sheet-l-bracket | radius@1 | the bend radius 0.5 more | bend | yes | volume, flat-length, flat-area, bend |
| sheet-l-bracket | one-hole@0 | one hole only | holes | yes | volume, flat-area, holes |
| sheet-l-bracket | one-hole@1 | one hole only | holes | yes | volume, flat-area, holes |
| sheet-l-bracket | loose@0 | a loose piece beside it | solids | yes | volume, solids |
| sheet-l-bracket | loose@1 | a loose piece beside it | solids | yes | volume, solids |
| load-bracket | thin@0 | the arm 0.6 of the depth its stress needs | stress | yes | stress, deflection |
| load-bracket | thin@1 | the arm 0.6 of the depth its stress needs | stress | yes | stress, deflection |
| load-bracket | long@0 | the arm twice as long | deflection | yes | deflection |
| load-bracket | long@1 | the arm twice as long | deflection | yes | deflection |
| load-bracket | stepped@0 | its far half 0.8 deep | prismatic | yes | prismatic, slender, fillet, stress, deflection |
| load-bracket | stepped@1 | its far half 0.8 deep | prismatic | yes | prismatic, slender, fillet, stress, deflection |
| load-bracket | stubby@0 | L/h = 3 | slender | yes | slender |
| load-bracket | stubby@1 | L/h = 3 | slender | yes | slender |
| load-bracket | no-fillet@0 | no root fillet | fillet | yes | fillet |
| load-bracket | no-fillet@1 | no root fillet | fillet | yes | fillet |
| load-bracket | wrong-metal@0 | the other metal stated | material | yes | material |
| load-bracket | wrong-metal@1 | the other metal stated | material | yes | material |
| load-bracket | two@0 | the arm not joined to the plate | body | yes | body |
| load-bracket | two@1 | the arm not joined to the plate | body | yes | body |
| lap-joint | off@0 | one of B's holes 1 mm off | aligned | yes | aligned, bolt |
| lap-joint | off@1 | one of B's holes 1 mm off | aligned | yes | aligned, bolt |
| lap-joint | edge@0 | the rows 1 Ø from the plates' sides | edges | yes | pattern, edges, bolt |
| lap-joint | edge@1 | the rows 1 Ø from the plates' sides | edges | yes | pattern, edges, bolt |
| lap-joint | spread@0 | both plates' rows 2 mm further apart | pattern | yes | pattern, bolt |
| lap-joint | spread@1 | both plates' rows 2 mm further apart | pattern | yes | pattern, edges, bolt |
| lap-joint | nub@0 | a nub under B, 1 mm into A | contacts | yes | contacts, bolt |
| lap-joint | nub@1 | a nub under B, 1 mm into A | contacts | yes | contacts, bolt |
| lap-joint | turns@0 | B on one bolt hole, free to turn | mated | yes | mated, bolt |
| lap-joint | turns@1 | B on one bolt hole, free to turn | mated | yes | mated, bolt |
| lap-joint | one@0 | plate B never added | plates | yes | plates, pattern, aligned, edges, bolt |
| lap-joint | one@1 | plate B never added | plates | yes | plates, pattern, aligned, edges, bolt |
| snap-fit-box | no-material@0 | the brief without the stated material: the hooks' strain unknown | flex | yes | flex |
| snap-fit-box | no-material@1 | the brief without the stated material: the hooks' strain unknown | flex | yes | flex |
| snap-fit-box | hook-short@0 | one hook fewer than asked | hooks | yes | hooks |
| snap-fit-box | hook-short@1 | one hook fewer than asked | hooks | yes | hooks |
| snap-fit-box | no-ledge@0 | one hook with no ledge | latched | yes | latched |
| snap-fit-box | no-ledge@1 | one hook with no ledge | latched | yes | latched |
| snap-fit-box | ledge-moved@0 | the ledges 2 mm along their walls | latched | yes | latched |
| snap-fit-box | ledge-moved@1 | the ledges 2 mm along their walls | latched | yes | latched |
| snap-fit-box | tight@0 | the ledges down on the catches: no fit gap | clearance | yes | clearance |
| snap-fit-box | tight@1 | the ledges down on the catches: no fit gap | clearance | yes | clearance |
| snap-fit-box | shallow@0 | ledges 0.15 deep: the catch misses them | latched | yes | latched |
| snap-fit-box | shallow@1 | ledges 0.15 deep: the catch misses them | latched | yes | latched |
| snap-fit-box | low@0 | ledges 0.6 lower, through the catches | fits | yes | latched, clearance, fits |
| snap-fit-box | low@1 | ledges 0.6 lower, through the catches | fits | yes | latched, clearance, fits |
| snap-fit-box | into-wall@0 | hooks 1 mm outward, into their walls | fits | yes | latched, clearance, fits |
| snap-fit-box | into-wall@1 | hooks 1 mm outward, into their walls | fits | yes | latched, clearance, fits |
| snap-fit-box | loose@0 | a loose piece beside it | solids | yes | box, solids |
| snap-fit-box | loose@1 | a loose piece beside it | solids | yes | box, solids |
| snap-fit-box | wide@0 | the box and lid 5 mm wider than asked | box | yes | box |
| snap-fit-box | wide@1 | the box and lid 5 mm wider than asked | box | yes | box |
| pcb-enclosure | moved@0 | a standoff 1 mm off its hole | standoffs | yes | standoffs |
| pcb-enclosure | moved@1 | a standoff 1 mm off its hole | standoffs | yes | standoffs |
| pcb-enclosure | tall@0 | the standoffs 3 mm taller, into the components | components | yes | standoffs, components |
| pcb-enclosure | tall@1 | the standoffs 3 mm taller, into the components | components | yes | standoffs, components |
| pcb-enclosure | no-cable@0 | no cable hole | cable | yes | cable |
| pcb-enclosure | no-cable@1 | no cable hole | cable | yes | cable |
| pcb-enclosure | no-vent@0 | no vent | vents | yes | vents |
| pcb-enclosure | no-vent@1 | no vent | vents | yes | vents |
| pcb-enclosure | thin@0 | walls 0.6 | min-wall | yes | cable, vents, min-wall |
| pcb-enclosure | thin@1 | walls 0.6 | min-wall | yes | cable, vents, min-wall |
| pcb-enclosure | loose@0 | a loose piece beside it | solids | yes | box, solids |
| pcb-enclosure | loose@1 | a loose piece beside it | solids | yes | box, solids |
| pcb-enclosure | wide@0 | 5 mm too wide | box | yes | box, cable, vents |
| pcb-enclosure | wide@1 | 5 mm too wide | box | yes | box, cable, vents |
| sheet-pcb-enclosure | k-off@0 | K 0.05 off | flat-length | yes | flat-length, flat-width, flat-area |
| sheet-pcb-enclosure | k-off@1 | K 0.05 off | flat-length | yes | flat-length, flat-width, flat-area |
| sheet-pcb-enclosure | k-area@0 | K 0.1 off | flat-area | yes | flat-length, flat-width, flat-area |
| sheet-pcb-enclosure | k-area@1 | K 0.1 off | flat-area | yes | flat-length, flat-width, flat-area |
| sheet-pcb-enclosure | shallow@0 | the flanges 3 lower | volume | yes | volume, flat-length, flat-width, flat-area |
| sheet-pcb-enclosure | shallow@1 | the flanges 3 lower | volume | yes | volume, flat-length, flat-width, flat-area, loops |
| sheet-pcb-enclosure | width@0 | the flanges 3 lower | flat-width | yes | volume, flat-length, flat-width, flat-area |
| sheet-pcb-enclosure | width@1 | the flanges 3 lower | flat-width | yes | volume, flat-length, flat-width, flat-area, loops |
| sheet-pcb-enclosure | three@0 | three flanges | bends | yes | volume, flat-length, flat-area, bends |
| sheet-pcb-enclosure | three@1 | three flanges | bends | yes | volume, flat-length, flat-area, bends |
| sheet-pcb-enclosure | moved@0 | a hole 1 mm off | standoff-holes | yes | standoff-holes |
| sheet-pcb-enclosure | moved@1 | a hole 1 mm off | standoff-holes | yes | standoff-holes |
| sheet-pcb-enclosure | no-slot@0 | no connector slot | loops | yes | volume, flat-area, loops |
| sheet-pcb-enclosure | no-slot@1 | no connector slot | loops | yes | volume, flat-area, loops |
| sheet-pcb-enclosure | loose@0 | a loose piece beside it | solids | yes | volume, solids |
| sheet-pcb-enclosure | loose@1 | a loose piece beside it | solids | yes | volume, solids |
| print-in-place | fused@0 | gap 0: the ring on the axle | gaps | yes | gaps |
| print-in-place | fused@1 | gap 0: the ring on the axle | gaps | yes | gaps |
| print-in-place | loose@0 | gap 1.5 mm, past 2·fitGap | gaps | yes | gaps |
| print-in-place | loose@1 | gap 1.5 mm, past 2·fitGap | gaps | yes | gaps |
| print-in-place | no-top@0 | the top flange left off: it slides off along +Z | captive | yes | gaps, captive |
| print-in-place | no-top@1 | the top flange left off: it slides off along +Z | captive | yes | gaps, captive |
| print-in-place | extra@0 | a loose block beside it | solids | yes | solids, gaps, captive |
| print-in-place | extra@1 | a loose block beside it | solids | yes | solids, gaps, captive |
| print-in-place | thin@0 | the ring's wall 0.3 mm | print | yes | print |
| print-in-place | thin@1 | the ring's wall 0.3 mm | print | yes | print |
| five-part-assembly | unmated@0 | the shaft with no axial mate: it slides too | freedoms | yes | placed, freedoms |
| five-part-assembly | unmated@1 | the shaft with no axial mate: it slides too | freedoms | yes | placed, freedoms |
| five-part-assembly | meet@0 | the shaft 1 mm over the bore | contacts | yes | placed, freedoms, contacts, mass |
| five-part-assembly | meet@1 | the shaft 1 mm over the bore | contacts | yes | placed, freedoms, contacts, mass |
| five-part-assembly | missing@0 | no cap | parts | yes | parts, placed, mass |
| five-part-assembly | missing@1 | no cap | parts | yes | parts, placed, mass |
| five-part-assembly | aluminium-shaft@0 | the shaft left aluminium | mass | yes | mass |
| five-part-assembly | aluminium-shaft@1 | the shaft left aluminium | mass | yes | mass |
| five-part-assembly | thick@0 | the brackets 2 mm thicker | mass | yes | placed, freedoms, mass |
| five-part-assembly | thick@1 | the brackets 2 mm thicker | mass | yes | placed, freedoms, mass |
| five-part-assembly | moved@0 | bracket B 5 mm further along | placed | yes | placed, freedoms, mass |
| five-part-assembly | moved@1 | bracket B 5 mm further along | placed | yes | placed, freedoms, mass |
| product-brief | bore@0 | the bore 0.5 too big (knob) / one screw hole (hook) | bore | yes | volume, bore, flat |
| product-brief | bore@1 | the bore 0.5 too big (knob) / one screw hole (hook) | screw-holes | yes | volume, screw-holes |
| product-brief | flat@0 | no flat (knob) / the back too thin (hook) | flat | yes | volume, flat |
| product-brief | flat@1 | no flat (knob) / the back too thin (hook) | box | yes | box, volume |
| product-brief | no-brief@0 | the brief not written | brief | yes | brief |
| product-brief | no-brief@1 | the brief not written | brief | yes | brief |
| product-brief | rounder@0 | the edge rounded 0.5 more (knob) / the lip 2 higher (hook) | volume | yes | volume |
| product-brief | rounder@1 | the edge rounded 0.5 more (knob) / the lip 2 higher (hook) | volume | yes | box, volume |
| product-brief | loose@0 | a loose piece beside it | solids | yes | box, volume, solids |
| product-brief | loose@1 | a loose piece beside it | solids | yes | box, volume, solids |
| two-axis-arm | short@0 | the forearm too short for the reach | reach | yes | reach |
| two-axis-arm | short@1 | the forearm too short for the reach | reach | yes | reach |
| two-axis-arm | aluminium-payload@0 | the payload block left aluminium | payload | yes | payload |
| two-axis-arm | aluminium-payload@1 | the payload block left aluminium | payload | yes | payload |
| two-axis-arm | weak@0 | the joints rated 0.001 N·m: the motors too small for the move | margins | yes | margins |
| two-axis-arm | weak@1 | the joints rated 0.001 N·m: the motors too small for the move | margins | yes | margins |
| two-axis-arm | elbow-fixed@0 | the elbow held by an angle mate | joints | yes | joints, reach, payload, margins |
| two-axis-arm | elbow-fixed@1 | the elbow held by an angle mate | joints | yes | joints, reach, payload, margins |
| two-axis-arm | loose-payload@0 | the payload unmated: a part not connected | joints | yes | joints, reach, payload |
| two-axis-arm | loose-payload@1 | the payload unmated: a part not connected | joints | yes | joints, reach, payload |
| two-axis-arm | unrated@0 | the joints' range set, their effort and velocity not: the URDF needs them | urdf | yes | margins, urdf |
| two-axis-arm | unrated@1 | the joints' range set, their effort and velocity not: the URDF needs them | urdf | yes | margins, urdf |
