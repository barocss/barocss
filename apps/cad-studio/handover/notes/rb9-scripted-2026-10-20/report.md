# RB9 ladder — scripted agent (seed 2026)

Each rung: n trials on fresh documents, parameters sampled from the seed — trial 0 every parameter at its low end, 1 at its high end, 2 and 3 alternating, then random on the step grid. The checker is hidden from the agent and runs on the part it leaves. pass = every hard predicate holds; pass@1 = c/n; pass@k any, pass^k all; RS = the mean share of hard predicates holding. Each mutant is a seeded wrong design run on both range ends, killed when its targeted predicate fails.

| rung | title | passed | pass@1 | pass@k | pass^k | RS | mutants killed | predicates no mutant kills |
|---|---|---|---|---|---|---|---|---|
| 1 | block with hole | 5/5 | 1.00 | 1 | 1 | 1.000 | 12/12 | — |
| 2 | washer | 5/5 | 1.00 | 1 | 1 | 1.000 | 12/12 | — |
| 3 | printed phone stand | 5/5 | 1.00 | 1 | 1 | 1.000 | 12/12 | — |
| 5 | sheet-metal L-bracket | 5/5 | 1.00 | 1 | 1 | 1.000 | 14/14 | — |
| 10 | sheet-metal PCB enclosure | 5/5 | 1.00 | 1 | 1 | 1.000 | 16/16 | — |
| 13 | product from a brief | 5/5 | 1.00 | 1 | 1 | 1.000 | 10/10 | — |

Overall: 30/30 trials pass (100 %); mutants killed 76/76.

## Trials

| rung | trial | seed | parameters | pass | RS | failed | calls | ms |
|---|---|---|---|---|---|---|---|---|
| block-hole | 0 | 2026 | w 30, d 30, h 8, dh 3 | yes | 1.000 | — | 2 | 35 |
| block-hole | 1 | 2026 | w 120, d 120, h 40, dh 48 | yes | 1.000 | — | 2 | 11 |
| block-hole | 2 | 2026 | w 30, d 120, h 8, dh 12 | yes | 1.000 | — | 2 | 9 |
| block-hole | 3 | 2026 | w 120, d 30, h 40, dh 3 | yes | 1.000 | — | 2 | 8 |
| block-hole | 4 | 2026 | w 54, d 73, h 36, dh 15.5 | yes | 1.000 | — | 2 | 9 |
| washer | 0 | 2026 | D 8, d 3.2, t 0.8 | yes | 1.000 | — | 1 | 8 |
| washer | 1 | 2026 | D 40, d 28, t 4 | yes | 1.000 | — | 1 | 8 |
| washer | 2 | 2026 | D 8, d 5.6, t 0.8 | yes | 1.000 | — | 1 | 8 |
| washer | 3 | 2026 | D 40, d 16, t 4 | yes | 1.000 | — | 1 | 11 |
| washer | 4 | 2026 | D 16.5, d 8.9, t 3.6 | yes | 1.000 | — | 1 | 9 |
| phone-stand | 0 | 2026 | w 60, D 50, H 40, g 10 | yes | 1.000 | — | 5 | 16 |
| phone-stand | 1 | 2026 | w 100, D 90, H 80, g 14 | yes | 1.000 | — | 5 | 15 |
| phone-stand | 2 | 2026 | w 60, D 90, H 40, g 14 | yes | 1.000 | — | 5 | 14 |
| phone-stand | 3 | 2026 | w 100, D 50, H 80, g 10 | yes | 1.000 | — | 5 | 14 |
| phone-stand | 4 | 2026 | w 71, D 69, H 74, g 13 | yes | 1.000 | — | 5 | 14 |
| sheet-l-bracket | 0 | 2026 | t 1, r 1, k 0.3, a 30, b 25, w 20, dh 3 | yes | 1.000 | — | 2 | 74 |
| sheet-l-bracket | 1 | 2026 | t 3, r 9, k 0.5, a 60, b 50, w 40, dh 13 | yes | 1.000 | — | 2 | 44 |
| sheet-l-bracket | 2 | 2026 | t 1, r 3, k 0.3, a 60, b 25, w 40, dh 3 | yes | 1.000 | — | 2 | 42 |
| sheet-l-bracket | 3 | 2026 | t 3, r 3, k 0.5, a 30, b 50, w 20, dh 6.5 | yes | 1.000 | — | 2 | 41 |
| sheet-l-bracket | 4 | 2026 | t 1.5, r 3, k 0.48, a 51, b 35, w 24, dh 5.5 | yes | 1.000 | — | 2 | 41 |
| sheet-pcb-enclosure | 0 | 2026 | t 1, r 1, k 0.3, A 80, B 50, h 15, inset 8, dh 2.5, sw 10, sh 4 | yes | 1.000 | — | 1 | 251 |
| sheet-pcb-enclosure | 1 | 2026 | t 2, r 4, k 0.5, A 140, B 100, h 35, inset 15, dh 4, sw 30, sh 25 | yes | 1.000 | — | 1 | 227 |
| sheet-pcb-enclosure | 2 | 2026 | t 1, r 2, k 0.3, A 140, B 50, h 35, inset 8, dh 4, sw 10, sh 28 | yes | 1.000 | — | 1 | 226 |
| sheet-pcb-enclosure | 3 | 2026 | t 2, r 2, k 0.5, A 80, B 100, h 15, inset 15, dh 2.5, sw 30, sh 4 | yes | 1.000 | — | 1 | 209 |
| sheet-pcb-enclosure | 4 | 2026 | t 1, r 1.5, k 0.48, A 121, B 69, h 19, inset 11.5, dh 3.1, sw 25, sh 10.5 | yes | 1.000 | — | 1 | 212 |
| product-brief | 0 | 2026 | kind knob, R 10, H 12, ds 4, f 0.4, depth 4.8, fr 0.5, w 20, t 3, a 20, l 8 | yes | 1.000 | — | 6 | 191 |
| product-brief | 1 | 2026 | kind hook, R 25, H 25, ds 8, f 1, depth 17.5, fr 3, w 40, t 6, a 50, l 20 | yes | 1.000 | — | 8 | 46 |
| product-brief | 2 | 2026 | kind knob, R 25, H 12, ds 8, f 0.4, depth 8.3, fr 0.5, w 40, t 3, a 50, l 8 | yes | 1.000 | — | 6 | 296 |
| product-brief | 3 | 2026 | kind hook, R 10, H 25, ds 4, f 1, depth 10, fr 3, w 20, t 6, a 20, l 20 | yes | 1.000 | — | 8 | 42 |
| product-brief | 4 | 2026 | kind knob, R 17, H 23, ds 7, f 0.6, depth 10.7, fr 2, w 28, t 5.5, a 43, l 10 | yes | 1.000 | — | 6 | 75 |

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
