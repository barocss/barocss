# Physics error entry consumer

This bounded consumer checks the existing `PhysicsError` exports from the public
root, `/cloth`, `/fluid` and `/fluid-cad` entries. It takes one admitted cloth
step, disposes the cloth world and catches the genuine `DISPOSED` error. It also
checks a live rigid world's invalid dt retention and malformed input for each
of the four public factories. It records the error name, exact message, cause
presence, own constructor and the four-entry `instanceof` matrix.

Use Node 22 and the existing repository dependencies. The private manifest
declares Physics and CAD workspace dependencies. Setup creates only their
normal local links. Generated `node_modules` is ignored by Git. No install,
root workspace or lock-file edit is needed.

```sh
export PATH=/Users/user/.nvm/versions/node/v22.22.0/bin:$PATH
node examples/physics-error-entry/setup.mjs
node examples/physics-error-entry/probe.mjs compiled --observe
node examples/physics-error-entry/probe.mjs source
node examples/physics-error-entry/probe.mjs compiled
```

Run the affected Physics library build before the compiled checkpoint. Existing
CAD compiled targets are also required by the transitive compiled consumer.
Every run checks all six published Physics JavaScript and declaration targets.
Reports are JSON on stdout; the delivery owner saves them at the exact measured
source head. The Git head and dirty flag are read again on each run.

`--observe` allows constructor inequality for the pre-repair baseline. It still
requires real factory errors, each entry's own error class, the exact error code,
name and message, one actual cloth step and full invalid-dt state retention.
Normal mode requires constructor equality and every genuine error to be
`instanceof` all four exported references.

Source mode uses ordinary public imports and standard esbuild TypeScript
resolution. It adds no aliases, resolver plugins or custom conditions. Explicit
compiled mode reuses the complete transitive published export-map resolver from
`examples/workspace-source/probe.mjs`. Both modes bundle in memory and execute
the resulting ESM in a separate actual Node process. The metafile requires
Physics and CAD inputs from the requested `src` or `dist` family, with zero
inputs from the other family.

The identity scope is one own package graph. This does not prove identity across
package versions, JavaScript realms or independent consumer bundles. It does
not test package publication, archive contents, Viewer pixels or numerical
simulation acceptance. The frozen implementation contract is in `CONTRACT.md`.
