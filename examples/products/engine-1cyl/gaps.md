# P1 gaps, with minimal repros

These are the gaps P1 found. The roadmap's PG table numbers them, and the coordinator assigns their owners. Each one
says what happens, what was expected, the lane whose code it is, and the workaround the build uses until it's fixed.

## PG-4: a gear on a part locked to a shaft isn't coupled

**Repro.** Make two shafts, each a `cylinder` turning on concentric and coincident mates to the base, 45 apart. Add
two gear parts (m 1.5, 20 and 40 teeth), each `lock`ed to its shaft.

- What happens: `robot().joints()` gives `couplings: []` and no `GEAR_NOT_COUPLED` note.
- With the same gears made as bodies of the shaft parts themselves, `couplings` has one entry, the follower at
  −0.5.

**Expected.** A gear on a link's rigid group (the parts fixed to it) couples the same way a gear body on the link does.

**Owner.** Outer lane. In `robot/joints.ts`, `gearCouplings` reads `gearsOf(j.child)`, the child part only.

**Workaround.** Each timing gear is a body of its shaft's part, the crankshaft's and the camshaft's own. A BOM then
lists the gear inside its shaft.

## PG-5: no cam joint

The joint tree has no cam–follower pair, so a follower can't be driven by its lobe. Valve lift and timing can't be
checked by motion.

**Owner.** Outer lane (robot), a new pair kind.

**Workaround.** The followers are locked to the case on the lobes' base circles. The cycle sweep leaves out a follower
that no joint moves, and its report says so.

## PG-6: sweeps use display meshes, coarser than a running fit

`sweep_path`, and `robot().sweep` through `robotViewOf`, test contact on the display meshes. Those have 8 segments
per quarter turn, so a chord sits 0.135 mm inside a bore of radius 28. A piston with 0.1 mm radial clearance therefore
reads as touching its bore at the assembled pose: "cylinder-block touches piston at 0°".

**Expected.** Running fits (0.02 to 0.1 mm here) sweep clear. Either the sweep tessellates to a chord tolerance well
under the least clearance, or it tests exact surfaces where the hulls meet.

**Owner.** Outer lane: `robot/verbs.ts` `sweepLinksOf` and `robot/sweep.ts`.

**Workaround.** `check.ts` builds the sweep's view at 24 segments per quarter turn (a chord of 0.015 mm at r 28).

## PG-7: closeLoop takes only four-bar loops

`robot/loop.ts` `closureOf` and `closeLoop` close a planar loop of exactly three turning joints. The engine's
slider-crank loop is crank, rod and piston on its pin (a slide and a turn), with the piston in its bore. It is refused:
"[NOT_ONE_LOOP] a planar loop has three moving joints round it besides its pin; this one has 5". The core therefore
has no way to move the mechanism through its cycle with the loop closed.

**Expected.** A loop with slides closes too, with the loop's own mates as the residual (a concentric mate as axis on
axis, a flat mate as its distance).

**Owner.** Outer lane (RM8).

**Workaround.** `check.ts` closes every loop at each crank angle by damped Gauss–Newton on the loop's mates, starting
from the previous pose. The worst residual over 720° is about 1e-10 mm.

## Lock: the agent can't lock parts

The studio's Lock (`app/assembly/useAssembly.ts`) writes a `lock` mate with `rel`, the part's placement in the other
part's own coordinates. The agent's `add_mate` writes no `rel`, and the core has no lock verb.

**Owner.** Outer lane: `assembly/edit.ts`, plus an agent action.

**Workaround.** The facade's `Assembly.lock` (`api/assemblyCore.ts` `lockDoc`) mirrors the studio's write. It can
move into `assembly/edit.ts` as is.
