import { usesOf, type ModelNode } from '../engine/doc';
import { featureId } from '../engine/ids';
import { refusal } from '../engine/refusal';
import type { EditField } from './editFields';
import { copyLoftSection, planeOf } from './profiles';

type Loft = Extract<ModelNode, { kind: 'loft' }>;
type Nodes = readonly ModelNode[];

function sectionOption(nodes: Nodes, loft: Loft, slot: number, source: number, parameters: Record<string, number>) {
  const section = loft.sections[slot], previous = nodes[section.sketch], sketch = nodes[source];
  if (typeof section.z !== 'number' || !Number.isFinite(section.z) || previous?.kind !== 'sketch'
    || sketch?.kind !== 'sketch' || sketch.suppressed || sketch.profile === 'band' || sketch.association || sketch.pocketFloor) return;
  try {
    const result = copyLoftSection(sketch, source, planeOf(previous), parameters);
    if ('segments' in result && result.z === section.z) return result.segments;
  } catch { return; }
}

/** Change only a uniquely owned plain section copy at its existing plane and History station. */
export function loftSectionSourceFields(nodes: Nodes, index: number, loft: Loft, parameters: Record<string, number>): EditField[] {
  const sources = loft.from;
  if (!sources || sources.length !== loft.sections.length || loft.suppressed
    || loft.sections.some(section => section.frame !== undefined)) return [];
  const copies = new Set(loft.sections.map(section => section.sketch));
  if (copies.size !== sources.length || sources.some(source => copies.has(source))) return [];
  return loft.sections.flatMap((section, slot): EditField[] => {
    const source = sources[slot], copy = nodes[section.sketch];
    const uniqueId = (candidate: number) => nodes.filter((_, i) => featureId(nodes, i) === featureId(nodes, candidate)).length === 1;
    if (copy?.kind !== 'sketch' || copy.profile !== 'loop' || copy.sideTags || copy.outline || copy.association || copy.pocketFloor
      || copy.regions?.length || copy.holes?.length || copy.construction?.length || copy.suppressed
      || source >= section.sketch || nodes[source]?.kind !== 'sketch' || section.sketch >= index
      || !uniqueId(source) || !uniqueId(section.sketch)
      || nodes.some((node, i) => i !== index && usesOf(node, nodes).includes(section.sketch))) return [];
    const options = nodes.flatMap((_, candidate) => {
      if (candidate >= section.sketch || !uniqueId(candidate) || copies.has(candidate) || sources.includes(candidate)
        || !sectionOption(nodes, loft, slot, candidate, parameters)) return [];
      return [{ value: featureId(nodes, candidate), label: `Copy Sketch ${candidate + 1}` }];
    });
    return [{
      kind: 'choice', key: `loftSource${slot}`, label: `Section ${slot + 1} source`,
      options: [{ value: featureId(nodes, source), label: `Sketch ${source + 1}` }, ...options],
      get: current => {
        const node = current[index];
        return node?.kind === 'loft' && node.from ? featureId(current, node.from[slot]) : '';
      },
      set: (current, value) => {
        const node = current[index], old = current[section.sketch];
        const candidate = current.findIndex((_, i) => featureId(current, i) === value);
        if (node?.kind !== 'loft' || !node.from || old?.kind !== 'sketch' || old.profile !== 'loop'
          || node.from[slot] === candidate || !options.some(option => option.value === value)) return [...current];
        const segments = sectionOption(current, node, slot, candidate, parameters);
        if (!segments) throw refusal('BAD_REFERENCE', 'Choose a closed profile on the existing section plane.');
        const from = node.from.map((source, i) => i === slot ? candidate : source);
        return current.map((item, i) => i === index ? { ...node, from } : i === section.sketch ? { ...old, segments } : item);
      },
    }];
  });
}
