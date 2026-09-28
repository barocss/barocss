// The private renderer accepts data only. Applications own the component and action registry.
const own = (value) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  // JSON objects can cross a same-origin iframe boundary and have another realm's Object.prototype.
  return prototype === null || Object.getPrototypeOf(prototype) === null;
};
const entries = (value) => Object.keys(value);
const TYPES = Object.freeze({
  Layout: { props: ['id', 'columns', 'gap'], container: true },
  Card: { props: ['id', 'padding', 'tone'], container: true },
  Text: { props: ['id', 'text'], container: false },
  Input: { props: ['id', 'label', 'value'], container: false },
  Button: { props: ['id', 'label'], container: false },
});
const choices = Object.freeze({
  columns: ['responsive', 'single'], gap: ['fractional', 'wide'],
  padding: ['fractional', 'spacious'], tone: ['light', 'dark'],
});
const idPattern = /^[a-z][a-z0-9-]{0,31}$/;

export function validateSpec(spec) {
  const errors = [];
  const fail = (path, message) => errors.push({ path, message });
  if (!own(spec)) return { ok: false, errors: [{ path: '$', message: 'Expected a JSON object' }] };
  for (const key of entries(spec)) if (!['root', 'elements'].includes(key)) fail(key, 'Unknown field');
  if (!own(spec.elements)) fail('elements', 'Expected an object');
  if (typeof spec.root !== 'string' || !idPattern.test(spec.root)) fail('root', 'Expected a node ID');
  if (errors.length) return { ok: false, errors };
  const ids = entries(spec.elements);
  if (ids.length < 2 || ids.length > 32) fail('elements', 'Expected 2 to 32 nodes');
  if (!Object.hasOwn(spec.elements, spec.root)) fail('root', 'Root node is missing');
  for (const id of ids) {
    const path = `elements.${id}`;
    const node = spec.elements[id];
    if (!idPattern.test(id)) fail(path, 'Invalid node ID');
    if (!own(node)) { fail(path, 'Expected an object'); continue; }
    const type = typeof node.type === 'string' && Object.hasOwn(TYPES, node.type) ? TYPES[node.type] : null;
    if (!type) { fail(`${path}.type`, 'Component is not registered'); continue; }
    for (const key of entries(node)) if (!['type', 'props', 'children', 'on'].includes(key)) fail(`${path}.${key}`, 'Unknown field');
    if (!own(node.props)) { fail(`${path}.props`, 'Expected an object'); continue; }
    for (const key of entries(node.props)) if (!type.props.includes(key)) fail(`${path}.props.${key}`, 'Prop is not allowed');
    for (const key of type.props) if (!(key in node.props)) fail(`${path}.props.${key}`, 'Required prop is missing');
    if (node.props.id !== id) fail(`${path}.props.id`, 'ID must match the node key');
    for (const key of type.props.filter((name) => choices[name])) {
      if (!choices[key].includes(node.props[key])) fail(`${path}.props.${key}`, 'Style choice is not allowed');
    }
    for (const key of ['text', 'label']) if (key in node.props &&
      (typeof node.props[key] !== 'string' || node.props[key].length < 1 || node.props[key].length > 300))
      fail(`${path}.props.${key}`, 'Expected 1 to 300 text characters');
    if (node.type === 'Input' && (!own(node.props.value) ||
      entries(node.props.value).length !== 1 || node.props.value.$bindState !== '/name'))
      fail(`${path}.props.value`, 'Only the named form binding is allowed');
    if (!Array.isArray(node.children) || node.children.some((child) => typeof child !== 'string'))
      fail(`${path}.children`, 'Expected node ID array');
    else if (!type.container && node.children.length) fail(`${path}.children`, 'Leaf components cannot have children');
    if ('on' in node && (node.type !== 'Button' || !own(node.on) || entries(node.on).length !== 1 ||
      !own(node.on.press) || entries(node.on.press).length !== 1 || node.on.press.action !== 'save'))
      fail(`${path}.on`, 'Only the named save action is allowed');
    if (node.type === 'Button' && !('on' in node)) fail(`${path}.on`, 'Button requires the save action');
  }
  if (spec.elements[spec.root]?.type !== 'Layout') fail('root', 'Root must be a Layout');
  if (errors.length) return { ok: false, errors };
  const seen = new Set(), active = new Set();
  function visit(id, path) {
    if (!Object.hasOwn(spec.elements, id)) { fail(path, 'Referenced node is missing'); return; }
    if (active.has(id)) { fail(path, 'Cycle is not allowed'); return; }
    if (seen.has(id)) { fail(path, 'Node must have one parent'); return; }
    seen.add(id); active.add(id);
    for (const [index, child] of spec.elements[id].children.entries()) visit(child, `elements.${id}.children.${index}`);
    active.delete(id);
  }
  if (Object.hasOwn(spec.elements, spec.root)) visit(spec.root, 'root');
  for (const id of ids) if (!seen.has(id)) fail(`elements.${id}`, 'Unreachable node');
  return { ok: errors.length === 0, errors };
}

export const STYLE_CLASSES = Object.freeze({
  Layout: { responsive: 'grid grid-cols-1 md:grid-cols-2', single: 'grid grid-cols-1', fractional: 'gap-2.5', wide: 'gap-3.5' },
  Card: { fractional: 'p-3.5', spacious: 'p-5.5', light: 'bg-white text-slate-900', dark: 'bg-slate-900 text-white' },
});

export function classesFor(node) {
  if (node.type === 'Layout') return `${STYLE_CLASSES.Layout[node.props.columns]} ${STYLE_CLASSES.Layout[node.props.gap]}`;
  if (node.type === 'Card') return `rounded-xl ${STYLE_CLASSES.Card[node.props.padding]} ${STYLE_CLASSES.Card[node.props.tone]}`;
  return '';
}
