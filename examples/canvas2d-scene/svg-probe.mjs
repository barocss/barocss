import assert from 'node:assert/strict';
import { importSVGElement, stringifySceneJSON, parseSceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';

const ns = 'http://www.w3.org/2000/svg';
function element(localName, values, ...childNodes) {
  const attributes = Object.entries(values).map(([name, value]) => ({ name, value }));
  return { nodeType: 1, localName, namespaceURI: ns, attributes, childNodes,
    ownerDocument: { doctype: null },
    getAttribute(name) { return values[name] ?? null; },
    hasAttribute(name) { return Object.hasOwn(values, name); } };
}
const path = element('path', { d: 'M 0 0 L 100 0 L 100 100 L 0 100 Z M 25 25 L 75 25 L 75 75 L 25 75 Z',
  fill: '#e03939' });
const curve = element('path', { id: 'Curve', transform: 'translate(10 20) rotate(15) scale(1 1)',
  d: 'M 0 0 Q 10 20 30 0 C 40 10 50 10 60 0', fill: 'none', stroke: '#222d44',
  'stroke-width': '4', 'stroke-linejoin': 'bevel' });
const root = element('svg', { id: 'SvgBoard', width: '600', height: '300', viewBox: '0 0 300 150' },
  element('g', { id: 'Artwork' }, path, curve));
const { scene, diagnostics } = importSVGElement(root);
assert.equal(scene.version, 5);
assert.equal(scene.contextId, 'SvgBoard');
assert.equal(scene.nodes[0].clip, true);
assert.equal(scene.nodes[0].children[0].transform.scaleX, 2);
assert.equal(scene.nodes[0].children[0].transform.scaleY, 2);
assert.deepEqual(diagnostics.pathIds, ['SvgPath1', 'Curve']);
assert.equal(scene.nodes[0].children[0].children[0].children[0].fill.rule, 'nonzero');
assert.deepEqual(parseSceneJSON(stringifySceneJSON(scene)), scene);
const centered = importSVGElement(element('svg', { width: '600', height: '300',
  viewBox: '0 0 100 100' }));
assert.deepEqual([centered.scene.nodes[0].children[0].transform.x,
  centered.scene.nodes[0].children[0].transform.scaleX], [150, 3]);
const stretched = importSVGElement(element('svg', { width: '600', height: '300',
  viewBox: '0 0 100 100', preserveAspectRatio: 'none' }));
assert.deepEqual([stretched.scene.nodes[0].children[0].transform.scaleX,
  stretched.scene.nodes[0].children[0].transform.scaleY], [6, 3]);
const alpha = importSVGElement(element('svg', { width: '600', height: '300',
  viewBox: '0 0 300 150' }, element('path', { id: 'Alpha',
  d: 'M 0 0 L 10 0 L 10 10 Z', fill: '#ff0000', 'fill-opacity': '0.5' })));
assert.equal(alpha.scene.nodes[0].children[0].children[0].fill.color[3], 0.5);
function reject(node, code, pattern) {
  assert.throws(() => importSVGElement(node), error =>
    error.code === code && pattern.test(error.message));
}
reject(element('svg', { width: '600', height: '300', viewBox: '0 0 300 150' },
  element('path', { d: 'M 0 0 A 10 10 0 0 1 20 20' })), 'UNSUPPORTED_FEATURE', /syntax/);
reject(element('svg', { width: '600', height: '300', viewBox: '0 0 300 150' },
  element('path', { filter: 'url(#blur)', d: 'M 0 0 L 10 0 L 10 10 Z' })),
  'UNSUPPORTED_FEATURE', /attribute filter/);
reject(element('svg', { width: '600', height: '300', viewBox: '0 0 300 150' },
  element('use', { href: 'https://example.invalid/x.svg' })),
  'UNSUPPORTED_FEATURE', /element use/);
reject(element('svg', { width: '600', height: '300', viewBox: '0 0 300 150' },
  element('g', { transform: 'scale(2) translate(10)' }, path)),
  'UNSUPPORTED_FEATURE', /transform order/);
console.log(JSON.stringify({ result: 'ok', version: scene.version, diagnostics,
  viewportModes: ['centered-meet', 'none'], paintAlpha: 0.5,
  refusals: ['arc', 'filter', 'external-use', 'transform-order'] }));
