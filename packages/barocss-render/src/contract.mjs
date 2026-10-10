import { RENDER_SPEC_DEFINITION as definition } from './definition.mjs';

// The renderer accepts data only. Applications own the component and action registry.
const own = (value) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  // JSON objects can cross a same-origin iframe boundary and have another realm's Object.prototype.
  return prototype === null || Object.getPrototypeOf(prototype) === null;
};
const entries = (value) => Object.keys(value);
const TYPES = definition.components;
const idPattern = new RegExp(definition.syntax.idPattern);
const legacyContract = definition.permissions;
const unsafeSegments = new Set(definition.syntax.unsafeNames);
const segmentPattern = new RegExp(definition.syntax.bindingSegmentPattern);
const bindingAllowed = (value) => typeof value === 'string' && value.length <= definition.limits.bindingLength &&
  value.startsWith(definition.syntax.bindingPrefix) && value.slice(1).split(definition.syntax.bindingSeparator).every((segment) =>
    segmentPattern.test(segment) && !unsafeSegments.has(segment));
const actionAllowed = (value) => typeof value === 'string' && idPattern.test(value) &&
  !unsafeSegments.has(value);

function checkContract(contract, fail) {
  if (!own(contract)) { fail('contract', 'Expected a host contract object'); return; }
  for (const key of Reflect.ownKeys(contract)) {
    if (!definition.fields.contract.includes(key)) fail('contract', 'Unknown contract field');
  }
  for (const [key, allowed] of [['textBindings', bindingAllowed], ['actions', actionAllowed]]) {
    const values = Object.hasOwn(contract, key) ? contract[key] : undefined;
    if (!Array.isArray(values) || values.length > definition.limits.declarations) {
      fail(`contract.${key}`, 'Expected an array of at most 32 declarations'); continue;
    }
    const seen = new Set();
    for (let index = 0; index < values.length; index++) {
      const value = Object.hasOwn(values, index) ? values[index] : undefined;
      if (!allowed(value)) fail(`contract.${key}.${index}`, 'Invalid declaration');
      else if (seen.has(value)) fail(`contract.${key}.${index}`, 'Duplicate declaration');
      seen.add(value);
    }
  }
}

export function validateSpec(spec, contract = legacyContract) {
  const errors = [];
  const fail = (path, message) => errors.push({ path, message });
  checkContract(contract, fail);
  if (errors.length) return { ok: false, errors };
  const textBindings = new Set(contract.textBindings), actions = new Set(contract.actions);
  if (!own(spec)) return { ok: false, errors: [{ path: '$', message: 'Expected a JSON object' }] };
  for (const key of entries(spec)) if (!definition.fields.screen.includes(key)) fail(key, 'Unknown field');
  if (!own(spec.elements)) fail('elements', 'Expected an object');
  if (typeof spec.root !== 'string' || !idPattern.test(spec.root)) fail('root', 'Expected a node ID');
  if (errors.length) return { ok: false, errors };
  const ids = entries(spec.elements);
  if (ids.length < definition.limits.nodes[0] || ids.length > definition.limits.nodes[1]) fail('elements', 'Expected 2 to 32 nodes');
  if (!Object.hasOwn(spec.elements, spec.root)) fail('root', 'Root node is missing');
  for (const id of ids) {
    const path = `elements.${id}`;
    const node = spec.elements[id];
    if (!idPattern.test(id)) fail(path, 'Invalid node ID');
    if (!own(node)) { fail(path, 'Expected an object'); continue; }
    const type = typeof node.type === 'string' && Object.hasOwn(TYPES, node.type) ? TYPES[node.type] : null;
    if (!type) { fail(`${path}.type`, 'Component is not registered'); continue; }
    for (const key of entries(node)) if (!definition.fields.node.includes(key)) fail(`${path}.${key}`, 'Unknown field');
    if (!own(node.props)) { fail(`${path}.props`, 'Expected an object'); continue; }
    for (const key of entries(node.props)) if (!Object.hasOwn(type.props, key)) fail(`${path}.props.${key}`, 'Prop is not allowed');
    for (const key of entries(type.props)) if (!(key in node.props)) fail(`${path}.props.${key}`, 'Required prop is missing');
    if (definition.graph.matchingIds && node.props.id !== id) fail(`${path}.props.id`, 'ID must match the node key');
    for (const key of entries(type.props).filter((name) => Array.isArray(type.props[name]))) {
      if (!type.props[key].includes(node.props[key])) fail(`${path}.props.${key}`, 'Style choice is not allowed');
    }
    for (const key of definition.fields.textProps) if (key in node.props &&
      (typeof node.props[key] !== 'string' || node.props[key].length < definition.limits.text[0] || node.props[key].length > definition.limits.text[1]))
      fail(`${path}.props.${key}`, 'Expected 1 to 300 text characters');
    if (Object.hasOwn(type.props, 'value') && (!own(node.props.value) ||
      entries(node.props.value).length !== 1 || !Object.hasOwn(node.props.value, entries(type.props.value)[0]) ||
      !textBindings.has(node.props.value[entries(type.props.value)[0]])))
      fail(`${path}.props.value`, 'Text binding is not declared by the host');
    if (!Array.isArray(node.children) || node.children.some((child) => typeof child !== 'string'))
      fail(`${path}.children`, 'Expected node ID array');
    else if (definition.graph.leafChildrenEmpty && !type.container && node.children.length) fail(`${path}.children`, 'Leaf components cannot have children');
    const event = type.on && entries(type.on)[0];
    const actionField = event && entries(type.on[event])[0];
    if ('on' in node && (!event || !own(node.on) || entries(node.on).length !== 1 ||
      !own(node.on[event]) || entries(node.on[event]).length !== 1 || !Object.hasOwn(node.on[event], actionField) ||
      !actions.has(node.on[event][actionField])))
      fail(`${path}.on`, 'Action is not declared by the host');
    if (type.on && !('on' in node)) fail(`${path}.on`, 'Button requires a declared action');
  }
  if (spec.elements[spec.root]?.type !== definition.graph.rootType) fail('root', 'Root must be a Layout');
  if (errors.length) return { ok: false, errors };
  const seen = new Set(), active = new Set();
  function visit(id, path) {
    if (!Object.hasOwn(spec.elements, id)) { fail(path, 'Referenced node is missing'); return; }
    if (definition.graph.acyclic && active.has(id)) { fail(path, 'Cycle is not allowed'); return; }
    if (definition.graph.oneParent && seen.has(id)) { fail(path, 'Node must have one parent'); return; }
    seen.add(id); active.add(id);
    for (const [index, child] of spec.elements[id].children.entries()) visit(child, `elements.${id}.children.${index}`);
    active.delete(id);
  }
  if (Object.hasOwn(spec.elements, spec.root)) visit(spec.root, 'root');
  for (const id of ids) if (definition.graph.reachable && !seen.has(id)) fail(`elements.${id}`, 'Unreachable node');
  return { ok: errors.length === 0, errors };
}

/** Detached metadata, describing host permissions without granting new ones. */
export function getRenderSpecDefinition(contract = legacyContract) {
  const errors = [];
  checkContract(contract, (path, message) => errors.push({ path, message }));
  if (errors.length) throw new TypeError(`Invalid render contract: ${errors[0].path}: ${errors[0].message}`);
  const result = structuredClone(definition);
  result.permissions = { textBindings: [...contract.textBindings], actions: [...contract.actions] };
  result.components.Input.props.value.$bindState = [...contract.textBindings];
  result.components.Button.on.press.action = [...contract.actions];
  return result;
}

export const STYLE_CLASSES = definition.styleClasses;

export function classesFor(node) {
  if (!Object.hasOwn(STYLE_CLASSES, node.type)) return '';
  const props = TYPES[node.type].props;
  const classes = entries(props).filter((name) => Array.isArray(props[name]))
    .map((name) => STYLE_CLASSES[node.type][node.props[name]]).join(' ');
  return [STYLE_CLASSES[node.type].base, classes].filter(Boolean).join(' ');
}
