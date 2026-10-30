# Kernel fillet scaling on an ellipse extrude (for #2265 and #2259)

Repro: `CASE=ellipse-fillet1 node run.mjs perf.ts` from this folder. `run.mjs` bundles with esbuild from the worktree; adjust its absolute paths to your checkout. The case is a 30 × 12 ellipse extruded 8 mm with a fillet of radius 1 on the single edge `n1.side[e17]|n1.top`. `fscale.sh` reruns the case with `ELLIPSE_POINTS` swapped for the smaller counts below.

| Profile | Side faces | One-edge fillet | Extrude only |
|---|---|---|---|
| circle r=… (reference) | 1 | 233 ms | 19 ms |
| ellipse N=12 | 24 | 2,540 ms | 52 ms |
| ellipse N=24 | 48 | 8,312 ms | 81 ms |
| ellipse N=48 | 96 | 30,634 ms | 143 ms |
| ellipse N=96 (shipped) | 192 | 112,137 ms | 254 ms |

- **Scaling:** the fillet cost grows roughly with the square of the side-face count. The extrude itself stays cheap.
- **Rim limit:** selecting all 192 rim edges is refused by the kernel's 1–64 edge limit (`perf2.out.txt`).
- **Wrong title:** that refusal was titled "This chamfer has no edges" on a fillet. D364 later fixed the title in the refactor lane.
- **Refusal:** D366 refuses fillets and chamfers on an ellipse's side edges until the kernel scales.
