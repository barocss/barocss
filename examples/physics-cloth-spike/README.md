# Bounded cloth discovery

This is the numerical experiment for [SOFT-00 #825](https://github.com/barocss/barocss/issues/825#issuecomment-6079108390). The consumer is our developer 3D cloth-preview host. It measures feasibility for one sheet over a static sphere. It does not export a public Physics cloth API or supply a Viewer mesh.

With Node 22, from the repository root:

```sh
node examples/physics-cloth-spike/benchmark.mjs /tmp/cloth-discovery.json
node examples/physics-cloth-spike/analytic-probe.mjs
node examples/physics-cloth-spike/visual-loss-probe.mjs
```

`fixture.mjs` freezes inputs and feasibility thresholds. `topology.mjs` builds a square sheet, triangle-area vertex masses, pins and distance constraints. `constraints.mjs` contains PBD/XPBD distance projections and one static-sphere collision projection. `world.mjs` owns predicted positions and velocities; `metrics.mjs` measures the final accepted sheet; `trial.mjs` records 240-step costs and snapshots; `benchmark.mjs` compares models, iterations and repeat hashes. Mutable research state remains internal to this example directory.

The 17×17 sheet is 1 m square at Y=0.55 m, with two back corners pinned and density 0.2 kg/m². A static sphere is centred at [0,0.1,0] m with radius 0.3 m; collision offset is 0.002 m. Gravity and dt are fixed. Structural, shear and second-neighbour distance constraints are used. The latter is a bending surrogate, not a dihedral or calibrated cloth model. PBD stiffness and XPBD compliance are different visual parameter sets; their output comparison is not a matched material experiment. The 33×33 scene measures workload only.

The XPBD multiplier update follows [Macklin et al., equations 17–18 and Algorithm 1](https://matthias-research.github.io/pages/publications/XPBD.pdf). The baseline is [position-based distance projection](https://matthias-research.github.io/pages/publications/posBasedDyn.pdf). No paper's reported performance or material accuracy transfers to this JavaScript implementation.

The report includes finite-state checks, pinned-node drift, sphere penetration, structural-edge strain, minimum/centre height, warm p95 solver cost and repeat hashes. It does not test self-collision, tearing, moving obstacles, native CAD admission, Viewer/GPU time or material data. Quantitative material claims need an independent solver or measured cloth reference. Product delivery still needs copied-state/lifecycle/refusal contracts and a separately admitted derived indexed-mesh GPU/Viewer path.

The initial 4/8/16-iteration experiment failed the 10% stretch gate; its report is retained in `evidence/first-failure-2026-10-09.json`, with the original committed base and uncommitted-source flag. The next comparison uses 4×2, 8×2 and 16×1 internal substeps×iterations while retaining the same external 1/120 s step, fixture and thresholds. Compliance and velocity decay use each inner dt, and multipliers reset per substep. [Small Steps in Physics Simulation](https://mmacklin.com/smallsteps.pdf) motivates this comparison; local measurements decide feasibility.

`analytic-probe.mjs` checks the distance-constraint formula against a separately derived scalar equal-mass solution. It validates that one formula, not a cloth material. For CPU cost in Chromium, set `CLOTH_SPIKE_EVIDENCE=/tmp/cloth-browser.json` and run `node examples/physics-cloth-spike/server.mjs`. Open its URL and click **Run CPU trial**. The page records the 289-vertex XPBD 8×2 schedule; it performs no Viewer drawing or GPU timing. Optional `CLOTH_SPIKE_PORT` changes the port.

Collision projection applies to vertices. `visual-loss-probe.mjs` separately samples each rendered triangle's centroid and three edge midpoints against the displayed sphere. It reports remaining display penetration over all 240 host steps. Vertex separation is not continuous triangle collision. The future Viewer consumer must disclose this proxy loss and compare real screenshots with the numeric sample; it must not present the sphere reaction as calibrated fabric contact.
