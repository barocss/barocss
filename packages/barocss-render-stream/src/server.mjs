import { ServerRuntime } from '@barocss/server';
import { validateSpec, classesFor, getRenderSpecDefinition } from '@barocss/render';
import { STREAM_LIMITS, validateIdentity, validateInputRecord, exactFields } from './protocol.mjs';

export function createCompiler({ identity, contract }) {
  validateIdentity(identity); identity = structuredClone(identity);
  const definition = getRenderSpecDefinition(contract);
  contract = structuredClone(definition.permissions);
  const idPattern = new RegExp(definition.syntax.idPattern);
  const runtime = new ServerRuntime();
  const elements = Object.create(null);
  let root = null, seq = 0, snapshots = 0, final = null, halted = false, finished = false;
  const guarded = (operation) => {
    if (halted || finished) throw new Error('Compiler stopped');
    try { return operation(); } catch (error) { halted = true; throw error; }
  };
  const candidate = (sourceSeq) => {
    if (++snapshots > STREAM_LIMITS.snapshots) throw new Error('Snapshot limit');
    const spec = structuredClone({ root, elements });
    const checked = validateSpec(spec, contract);
    if (!checked.ok) throw new Error(`Invalid checkpoint: ${checked.errors[0].path}`);
    const classes = Object.values(spec.elements).map(classesFor).filter(Boolean).join(' ');
    const css = runtime.generateCss(classes);
    if (typeof css !== 'string' || new TextEncoder().encode(css).length > STREAM_LIMITS.cssBytes) throw new Error('Compiled CSS limit');
    return { sourceSeq, spec, css };
  };
  return {
    accept(record) { return guarded(() => {
      if (final) throw new Error('Record after commit');
      if (seq >= STREAM_LIMITS.inputRecords) throw new Error('Input record limit');
      validateInputRecord(record, identity, seq + 1); seq++;
      if (record.type === 'root') {
        if (!idPattern.test(record.id)) throw new Error('Invalid root ID');
        root = record.id; return null;
      }
      if (record.type === 'node') {
        if (!idPattern.test(record.id)) throw new Error('Invalid node ID');
        const node = record.node;
        exactFields(node, Object.hasOwn(node, 'on') ? ['type', 'props', 'children', 'on'] : ['type', 'props', 'children']);
        if (!Object.hasOwn(elements, record.id) && Object.keys(elements).length >= STREAM_LIMITS.nodes) throw new Error('Node limit');
        elements[record.id] = structuredClone(node); return null;
      }
      const compiled = candidate(record.seq);
      if (record.type === 'commit') { final = { ...compiled, final: true }; return structuredClone(final); }
      return compiled;
    }); },
    finish() { return guarded(() => {
      if (!final) throw new Error('Missing compiler commit');
      finished = true; return structuredClone(final);
    }); },
  };
}
