# Discrete material boundaries

The contract and22cases are frozen before execution. This sample qualifies the existing one-step sphere/floor friction law. It does not change the solver.

Each graph creates22public Worlds and accepts22steps. The runner saves exact binary64 input, reference, before-state and after-state words. It stops on the first failure. The physical references use Newton normal momentum, a uniform sphere's inertia, angular impulse about the center, and zero contact slip for sticking. Boundary impulse magnitudes are frozen independently of the solver implementation.

The Source graph imports the corrected persistent-impact bundle. The Native graph imports the canonical public dist entry. The runner checks176frozen file hashes, including the bundle, its source inputs, model builders, prior build receipt and Native JavaScript modules. The default manifest is `PROVIDER-PINS-01.json`. A changed hash stops the run. Review and refreeze changed inputs explicitly. Do not rebuild or rerun earlier successful campaigns for this sample.

Run only through the existing heavy gate and180-second command wrapper after the frozen contract is accepted:

```sh
node examples/physics-material-boundaries-2276/api-run.mjs fresh-receipt-id
```

For a repaired provider, create a new pin manifest. Keep `PROVIDER-PINS-01.json` unchanged. The new manifest must use format `barocss-physics-provider-pins`, version1, and list `sourceModule`, `nativeModule`, `buildReceipt`, and a `files` map with byte counts and SHA256 hashes. All three entry paths must be in that map. Include the new bundle's source inputs and Native modules. Pass the new manifest explicitly; the runner does not rebuild or refresh pins. Expected cases and gates stay fixed.

```sh
node examples/physics-material-boundaries-2276/api-run.mjs fresh-repaired-id examples/physics-material-boundaries-2276/PROVIDER-PINS-02.json
```

Use a new receipt ID. Results are written under `evidence/fresh-receipt-id/`. `summary.json` records PASS or the first failure, per-graph counts, maximum residuals and the proof boundary. A physical failure is evidence. Do not loosen a gate or change production to make this sample pass without a separate decision.

The scope is one uniform sphere against a finite static floor, with no gravity or CCD. Persistent friction, boxes, sustained support, multiple contacts, equipment and manufacturing remain outside this result. No runtime, build or browser job was run while these files were authored.
