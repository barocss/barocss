// Pure, fail-closed validation of untrusted model output before browser replay.
import { SCENARIOS } from '../json-render-446/contract.mjs';
import { ARMS, SAFE_BUTTON_CLASSES, SAFE_LAYOUT_CLASSES } from './plan.mjs';

const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const subsetKeys = (value, keys) => object(value) && Object.keys(value).every((key) => keys.includes(key));
const literal = (value) => typeof value === 'string' && value.length <= 200 && !/[<>]|(?:https?:|javascript:|data:)/i.test(value);
const numeric = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const classes = (value, allowed) => typeof value === 'string' && value.length <= 256 && value.trim() && value.trim().split(/\s+/).every((token) => allowed.includes(token));

export function parseFinal(raw) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 120_000) return { status: 'response-size', errors: ['Final response missing or exceeds 120KB'] };
  let envelope;
  try { envelope = JSON.parse(raw); } catch { return { status: 'parse', errors: ['Final response is not JSON'] }; }
  if (!exactKeys(envelope, ['specJson', 'cannotExpress']) || typeof envelope.specJson !== 'string' || typeof envelope.cannotExpress !== 'boolean') {
    return { status: 'envelope', errors: ['Invalid structured response envelope'] };
  }
  if (Buffer.byteLength(envelope.specJson) > 100_000) return { status: 'response-size', errors: ['Spec exceeds 100KB'] };
  let spec;
  try { spec = JSON.parse(envelope.specJson); } catch { return { status: 'parse-spec', errors: ['specJson is not JSON'] }; }
  return { status: 'parsed', spec, cannotExpress: envelope.cannotExpress, errors: [] };
}
export function safeSpec(spec, scenario, arm) {
  if (!Object.hasOwn(SCENARIOS, scenario) || !ARMS.includes(arm)) throw new Error('Unknown pilot arm/scenario');
  const fixture = SCENARIOS[scenario];
  const nodes = fixture.nodes;
  const ids = ['layout', ...nodes.map((node) => node.id)];
  const errors = [];
  if (!exactKeys(spec, ['root', 'elements']) || spec.root !== 'layout' || !object(spec.elements) || !exactKeys(spec.elements, ids)) {
    return ['Invalid root or element inventory'];
  }
  const layout = spec.elements.layout;
  if (!exactKeys(layout, ['type', 'props', 'children']) || layout.type !== 'Layout' || JSON.stringify(layout.children) !== JSON.stringify(ids.slice(1))) return ['Invalid Layout tree'];
  const props = layout.props;
  if (arm === 'variable') {
    if (!subsetKeys(props, ['id', 'density', 'columns', 'placement', 'variables']) || props?.id !== 'layout' || !['regular', 'compact'].includes(props?.density) || ![1, 2].includes(props?.columns) || !['side', 'stacked'].includes(props?.placement)) errors.push('Invalid bounded Layout props');
    if (object(props) && props.variables !== undefined) {
      const ranges = { paddingPx: [8, 32], gapPx: [8, 32], radiusPx: [0, 24] };
      if (!subsetKeys(props.variables, Object.keys(ranges)) || Object.entries(props.variables).some(([name, value]) => !numeric(value, ...ranges[name]))) errors.push('Invalid typed variables');
    }
  } else if (!exactKeys(props, ['id', 'className']) || props?.id !== 'layout' || !classes(props?.className, SAFE_LAYOUT_CLASSES)) errors.push('Invalid utility Layout classes');
  for (const node of nodes) {
    const entry = spec.elements[node.id];
    const hasAction = node.type === 'Button';
    if (!exactKeys(entry, hasAction ? ['type', 'props', 'children', 'on'] : ['type', 'props', 'children']) || entry?.type !== node.type || !Array.isArray(entry?.children) || entry.children.length) { errors.push(`Invalid ${node.id} node`); continue; }
    const p = entry.props;
    const baseKeys = node.type === 'Text' ? ['id', 'text'] : node.type === 'Button' ? ['id', 'label'] : node.type === 'Select' ? ['id', 'label', 'options', 'value'] : ['id', 'label', 'value'];
    const optional = node.type === 'Button' ? [arm === 'variable' ? 'hoverUnderline' : 'className'] : [];
    if (!subsetKeys(p, [...baseKeys, ...optional]) || !baseKeys.every((key) => Object.hasOwn(p, key)) || p.id !== node.id) { errors.push(`Invalid ${node.id} props`); continue; }
    if ('text' in p && !literal(p.text)) errors.push(`Invalid ${node.id} text`);
    if ('label' in p && !literal(p.label)) errors.push(`Invalid ${node.id} label`);
    if ('options' in p && (!Array.isArray(p.options) || p.options.length > 20 || p.options.some((value) => !literal(value)))) errors.push(`Invalid ${node.id} options`);
    if ('value' in p && !exactKeys(p.value, ['$bindState'])) errors.push(`Invalid ${node.id} binding shape`);
    if ('value' in p && p.value?.$bindState !== `/${node.id}`) errors.push(`Invalid ${node.id} state path`);
    if ('hoverUnderline' in p && typeof p.hoverUnderline !== 'boolean') errors.push(`Invalid ${node.id} hover flag`);
    if ('className' in p && !classes(p.className, SAFE_BUTTON_CLASSES)) errors.push(`Invalid ${node.id} button classes`);
    if (hasAction && (!exactKeys(entry.on, ['press']) || !exactKeys(entry.on.press, ['action']) || !['save', 'refresh', 'add'].includes(entry.on.press.action))) errors.push(`Invalid ${node.id} action`);
  }
  return errors;
}
export function semanticErrors(spec, scenario) {
  const fixture = SCENARIOS[scenario];
  const errors = [];
  for (const node of fixture.nodes) {
    const actual = spec.elements?.[node.id];
    if (!actual) { errors.push(`Missing ${node.id}`); continue; }
    for (const key of ['text', 'label', 'options']) if (node[key] !== undefined && JSON.stringify(actual.props?.[key]) !== JSON.stringify(node[key])) errors.push(`Changed ${node.id}.${key}`);
    if (node.action && actual.on?.press?.action !== node.action) errors.push(`Changed ${node.id} action`);
  }
  return errors;
}
