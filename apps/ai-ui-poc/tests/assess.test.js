import test from 'node:test';
import assert from 'node:assert/strict';
import { BENCHMARK_FIXTURES } from '../fixtures/benchmark.js';
import { assessFixture } from '../src/assess.js';

const tags = { Stack: 'div', Text: 'p', Button: 'button', Card: 'section', Image: 'img' };

function text(value) {
  return { nodeType: 3, nodeValue: value, textContent: value };
}

function element(tree) {
  const content = tree.component === 'Text' ? tree.props.text :
    tree.component === 'Button' ? tree.props.label : null;
  const childNodes = content === null ? tree.children.map(element) : [text(content)];
  return {
    nodeType: 1, localName: tags[tree.component], dataset: { uiNode: tree.id },
    classList: { length: tree.classes.length, contains: (cls) => tree.classes.includes(cls) },
    childNodes, type: tree.component === 'Button' ? 'button' : undefined,
    alt: tree.props.alt,
    getAttribute: (name) => name === 'src' ? tree.props.src : null,
    get firstChild() { return childNodes[0]; },
    get children() { return childNodes.filter((node) => node.nodeType === 1); },
    get textContent() { return childNodes.map((node) => node.textContent).join(''); },
  };
}

function previewFor(tree) {
  const root = element(tree);
  const childNodes = [root];
  return {
    childNodes,
    get children() { return childNodes.filter((node) => node.nodeType === 1); },
    get firstElementChild() { return this.children[0]; },
    get textContent() { return childNodes.map((node) => node.textContent).join(''); },
    querySelector: (tag) => {
      function find(node) {
        if (node.localName === tag) return node;
        return node.children?.map(find).find(Boolean);
      }
      return find(root);
    },
    ownerDocument: { defaultView: { getComputedStyle: () => ({
      textAlign: 'center', display: 'block', backgroundColor: 'oklch(0.637 0.237 25.331)',
    }) } },
  };
}

test('unexpected text nodes fail exact structure and text assessment', () => {
  const fixture = BENCHMARK_FIXTURES.find((item) => item.id === 'ui-03');
  const preview = previewFor(fixture.mockTree);
  assert.equal(assessFixture(fixture, preview).structureAndTextPass, true);

  preview.firstElementChild.childNodes.push(text('EXTRA UNEXPECTED TEXT'));
  let result = assessFixture(fixture, preview);
  assert.equal(result.structureAndTextPass, false);
  assert.equal(result.checkedStylePass, false);

  preview.firstElementChild.childNodes.pop();
  preview.childNodes.push(text('OUTSIDE ROOT'));
  result = assessFixture(fixture, preview);
  assert.equal(result.structureAndTextPass, false);
  assert.equal(result.checkedStylePass, false);
});

test('unexpected text inside Card fails assessment', () => {
  const fixture = BENCHMARK_FIXTURES.find((item) => item.id === 'ui-02');
  const preview = previewFor(fixture.mockTree);
  assert.equal(assessFixture(fixture, preview).structureAndTextPass, true);

  const card = preview.firstElementChild.children[1];
  card.childNodes.push(text('EXTRA CARD TEXT'));
  const result = assessFixture(fixture, preview);
  assert.equal(result.structureAndTextPass, false);
  assert.equal(result.checkedStylePass, false);
});
