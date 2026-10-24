# Brief: a single-cylinder four-stroke engine, 125 cc class

Design and model an air-cooled single-cylinder four-stroke engine, as an assembly of its parts, ready for drawings
and manufacture. It is judged by `check.ts` (run `node examples/products/engine-1cyl/run.mjs --check <doc.bcad>`) on
the saved assembly document alone, so how it was built doesn't matter.

## Size

- Displacement between 110 and 135 cc. A bore of about 56 mm and a stroke of about 50 mm fit.
- The stroke is twice the crank radius. The connecting rod is about four crank radii long between centres.

## Parts

Name each part for what it is, because the checks find parts by name. Each part needs a material from the studio's
library, since masses come from them.

- **Crankcase**: two halves, or a single case. The base part may be the case.
- **Crankshaft**:
  - main journals in the case's bearings;
  - two webs with counterweights;
  - a crankpin;
  - a seat for its timing gear.
- **Connecting rod**: a big end on the crankpin and a small end on the piston pin.
- **Piston**: ring grooves, the pin's bore, and its **piston pin**.
- **Piston rings**: at least two, in the grooves.
- **Cylinder** (block or barrel): its bore, with a few tenths of clearance round the piston; finned.
- **Cylinder head**:
  - a combustion chamber;
  - two valve seats and their ports;
  - valve guides;
  - a spark plug hole;
  - stud holes.
- **Valves** (2): intake and exhaust, each with a **valve spring** (2).
- **Camshaft**: two lobes, geared 2:1 to the crank.
- **Followers** for the lobes.
- **Fasteners**: head bolts and case screws. Fastener sizes come from rows a person gives you: load
  `packages/barocss-cad-model/samples/rows/fastener-sizes.json`. Never write rows yourself.

## Mechanism

Mate the parts so that the crank's turn drives everything:

- the crankshaft turns in the case's bearings;
- the rod turns on the crankpin;
- the piston turns on the rod's small end;
- the piston slides in the bore. This closes the slider-crank loop.

The camshaft turns in its own bearing, and the timing gears mesh at 2:1 (camshaft at half the crank's speed). Lock
everything that is fastened. Assemble at top or bottom dead centre.

## Manufacture

Make each part ready for its maker:

- Give it its process (the Library panel's Process): cast parts in A356 by die casting, with their pull; turned and
  milled parts by `cnc-turning` or `cnc-milling`.
- For a cast part:
  - load the casting rules a person gives you, `packages/barocss-cad-model/samples/rows/casting-rules.json`;
  - set the pattern's inputs (set_casting): the faces machined after casting (bores, seats, joint faces), the gate,
    your shrinkage.
- Give it a dimensioned drawing (auto_dimension).
- Mark bought what is bought: the fasteners already are, and mark the springs.

The outputs are each part's drawing (SVG, DXF and PDF), its manufacturability report, the CAM package of each machined
part, the BOM and the purchase list.

## What the checks require

| check | requirement |
|---|---|
| parts | every part named above is present |
| solves | the mates solve; the joint tree has no problems |
| cycle | the crank turns 720° in 5° steps with the loop closed at each step; stroke = 2 × crank radius; displacement 110–135 cc; the assembled pose at a dead centre |
| timing | the camshaft geared to the crank at exactly 0.5 |
| sweep | no two parts touch anywhere through the 720° cycle |
| masses | every part has a material and a mass; the engine's modelled parts weigh 3–12 kg dry |
| balance | balance factor 0.4–0.8: the counterweights carry all of the rod's turning share (⅔ of the rod) plus that fraction of the reciprocating mass (piston, pin, rings, ⅓ of the rod) |
| outputs | every made part has a process, a manufacturability report, and a drawing with dimensions and no error. A cast part also has its pattern's inputs (machined faces). A machined part also has its CAM package, or the typed wait for a person's stock list. The BOM lists every part, and its mass matches the parts' own. A rule failing in a part's report is listed as a finding, not a check failure |

## Known limits of the tools today

The checks allow for these.

- A follower can't be driven by its cam yet, because there is no cam joint. A follower that no joint moves is left
  out of the sweep, and the check says so.
- A gear on a separate part locked to a shaft isn't coupled by the joint tree. Make each timing gear a body of its
  shaft's part.
- The sweep leaves out two kinds of contact that are there by design:
  - a running fit's own surfaces on a concentric mate, and meshing gear teeth;
  - a joint's parent and child seated on a flat mate (the rod on its web).

  Everything else is certified between the 5° poses.
- No stock list ships as sample rows, so a CAM package waits for a person's list (set_stock) and is refused with
  STOCK_NONE_LOADED. The check accepts that wait and names the parts waiting.

The R7 checker reports MMGS values: displacement in mm³ (110000–135000), mass in g (3000–12000), lengths in mm and counterweight moment in g·mm. These are the same physical limits as the brief's cm³ and kg values. Robot calculations keep their internal radians; document and public angles use degrees. The saved fixture follows the latest stored field names. Runtime requalification requires the assembled R7 consumer checkpoint.
