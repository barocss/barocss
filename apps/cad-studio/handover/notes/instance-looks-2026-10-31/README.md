# D390 — Row 10 ①: instance looks, inherited and overridden per occurrence

Tier: **full**, because it adds a document field, changes revision semantics, affects mass and the BOM, and touches both renderers. Three audit rounds with mutation, then an actual run. Issues: #2233; #538 stays open. [Qualification](qualification.json).

## Before

Placed instances rendered in a fixed grey: neither the part's colours nor any per-instance look reached the screen.

## Now

**Looks**
- Instances show their definition's colour, face colours and visibility. Parts inside sub-assemblies do too.
- An occurrence may override colour, material, faces or visibility. Each field records whether it comes from the definition or from this occurrence, and can be reset to the definition.
- A material override reaches everything that uses mass or material: the BOM, assembly mass, freshness, the team bundle, robot inertia and URDF, and 3MF.
- Documents without overrides are byte-identical to before.

**Revisions**
- Accepting a revision keeps the overrides.
- An override whose body the revision no longer makes (gone, split side removed, merged into another) is held and reported, never moved onto another body.

**Studio panel**
- The panel is compact, after the owner's feedback: just Colour and Material rows.
- Each overridden field shows a dot and a Reset icon.
- The rest sits under a closed "Details".

## Audits ([1](review/audit-round1.md), [2](review/audit-round2.md), [3](review/audit-round3.md))

**Round 1** found three high defects, where material overrides missed freshness, the bundle and the robot. It also found three medium and three low defects. All were fixed.

**Round 2** found one medium defect, where suppressed features caused false holds. It was fixed. It also confirmed that 454 outputs were byte-identical and killed six mutants.

**Round 3** was targeted and returned ACCEPT.

## Verification

- **Tests:** model 2354/2354; Studio 597/597.
- **Actual run ([run04](run04/receipt.json)).** The two cubes rendered red, as the definition says.
  1. Cube 2 was set to blue and steel, and its BOM mass matched the density arithmetic.
  2. Rev B was accepted, and the override was kept.
  3. A Save and a fresh Open both kept everything.
  4. Resetting the colour brought back red, and the steel stayed.

## Follow-ups

- **False "held" note.** A suppressed split followed by a union lists a live body as held. No data is lost.
- **Bundle.** Nested material overrides do not reach the bundle yet.
- **WebGL2.** It shows no face colours.
- **Panel header.** It could also move behind Details.
