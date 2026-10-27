---
work_id: P2-enclosure-checkpoint
artifact_type: brief
status: draft
owner_role: API lane
source_request: 2026-10-24 owner handover
last_updated: 2026-10-24
---

# P2 handheld enclosure: geometry checkpoint

Build a 150 × 72 × 28 mm handheld enclosure. Split the ABS housing at z = 18 mm. Use a nominal 2 mm wall and 1° wall draft. Add a lip and rebate with 0.1 mm nominal clearance, four screw bosses, four snap hooks, ribs, a battery bay and a connector opening. Place a 62 × 52 × 1.6 mm placeholder board on four standoffs. Add a 28 × 28 × 3 mm heat sink with six 1.5 × 28 × 12 mm fins. Place a cylindrical cell stand-in, radius 9.2 mm and length 65 mm. Use four annular insert stand-ins, outside radius 2 mm, bore radius 1.5 mm, length 5 mm.

These are example design inputs. They are not supplier dimensions or standards data. PCB/ECAD is deferred. The connector opening, cell, inserts and unthreaded board screws remain stand-ins. Fastener sizes use the shipped example file. No agent-authored rows may become person-supplied evidence.

Run with Node 22, after taking the heavy-run gate:

```sh
node examples/products/enclosure-handheld/run.mjs /absolute/external/output
node examples/products/enclosure-handheld/run.mjs --check /absolute/external/output/enclosure.bcad
node --test examples/products/enclosure-handheld/enclosure.test.mjs
```

The build writes documents and reports only to the output directory. It returns a nonzero exit code for build failures or unmet checks. The checker reads a saved document. It does not import the builder or require particular node ids. It checks the part inventory, locks, independent closed-form volumes and exploded display immutability. The volume tolerance is relative 1e-9.

Product acceptance remains open. Check gaps.md before interpreting a successful unit test. Nominal geometry checks do not clear full-feature wall, draft, interference or manufacturing findings. Connector and fastener acceptance need person-supplied rows. Complete product acceptance also requires accepted drawings, material masses and shop outputs.

The next engineering checkpoint is in `engineering.ts`. The plan corner radius is 8 mm, with corner centres at (±67, ±28). The oracle checks exact nominal supporting planes, signed outer-wall draft and the lip's straight, axial and cylindrical corner clearances. Length and angle tolerances are `1e-6` mm and `1e-6` degrees. They are fixed independently of measured results. The original relative volume tolerance remains `1e-9`.

Every exact body pair is checked for positive overlap, including containment. Conservative control-point bounds can skip only zero-volume pairs. Other pairs use the native analytic Boolean, with the core's unchanged `1e-6` mm³ threshold. Missing geometry and refusals fail the check. No thread engagement is accepted without its design evidence.

The default build and saved-document checker now include the engineering and manufacturing checks. To save their files outside the repository:

```sh
node examples/products/enclosure-handheld/run.mjs --check /absolute/external/output/enclosure.bcad --out /absolute/external/check-output
node --test examples/products/enclosure-handheld/engineering.test.mjs
```

`--engineering-only` repeats the engineering/output checks without repeating the earlier volume, lock and exploded-display checks. It still checks inventory and reports the missing-row gates. A failing engineering rule remains a failure even when its report or drawing was generated. A missing shop stock list remains a typed CAM refusal. Do not assign material densities to the board or cell to make a BOM total pass.
