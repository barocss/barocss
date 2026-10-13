import { cad } from '@barocss/cad';

/** The same owned union → slot recipe as the editor's Cut a slot in a bracket preset. */
export function makeSlottedBracket() {
  const model = cad.model(), legWidth = model.parameter('legWidth', 8);
  const slotX = model.parameter('slotX', 16), slotY = model.parameter('slotY', 2);
  const slotWidth = model.parameter('slotWidth', 8), slotSpanY = model.parameter('slotSpanY', 4);
  const base = model.sketch.rectangle({ width: 32, height: 8 }).extrude(8);
  const leg = model.sketch.rectangle({ min: [-0, 0], max: [legWidth, 24] }).extrude(8);
  const bracket = base.union(leg);
  const tool = model.sketch.rectangle({ min: [slotX, slotY],
    max: [model.dimension.add(slotX, slotWidth), model.dimension.add(slotY, slotSpanY)] }).extrude(8);
  return model.build({ bracket, slotted: bracket.cut(tool) });
}

// Baseline exact integer-cell volumes: bracket3072, slotted2816 mm³.
// const original = makeSlottedBracket();
// const edited = original.withParameters({ slotWidth: 12 }); // slotted2688 mm³
// const saved = edited.save();
// const reopened = cad.load(saved); // cold rebuild; editor view choice is not serialized
// Invalid empty/disconnected edits throw and do not replace the previous snapshot.
// Preview is sampled native panel data; physical WebGPU/editor acceptance remains separate.
