const tags = Object.freeze({ Stack: 'div', Text: 'p', Button: 'button', Card: 'section', Image: 'img' });

function sameStructure(expected, actual) {
  if (!actual || actual.nodeType !== 1 || actual.localName !== tags[expected.component] ||
    actual.dataset.uiNode !== expected.id) return false;
  if (actual.classList.length !== expected.classes.length ||
    expected.classes.some((cls) => !actual.classList.contains(cls))) return false;
  if (expected.component === 'Text' || expected.component === 'Button') {
    const text = expected.component === 'Text' ? expected.props.text : expected.props.label;
    if (actual.childNodes.length !== 1 || actual.firstChild.nodeType !== 3 || actual.firstChild.nodeValue !== text) return false;
    if (expected.component === 'Button' && actual.type !== 'button') return false;
  }
  if (expected.component === 'Image' &&
    (actual.getAttribute('src') !== expected.props.src || actual.alt !== expected.props.alt || actual.childNodes.length !== 0)) return false;
  if (expected.component === 'Text' || expected.component === 'Button') return true;
  const children = actual.childNodes;
  return children.length === expected.children.length &&
    expected.children.every((child, index) => sameStructure(child, children[index]));
}

function styleCheck(cls, style, element) {
  switch (cls) {
    // div and p are block by default, so only the button makes this check useful.
    case 'block': return element.localName === 'button' ? style.display === 'block' : null;
    case 'text-center': return style.textAlign === 'center';
    case 'overflow-hidden': return style.overflow === 'hidden';
    // BaroCSS default red-500 token. A non-transparent browser default is not enough.
    case 'bg-red-500': return style.backgroundColor === 'oklch(0.637 0.237 25.331)';
    default: return null;
  }
}

export function assessFixture(fixture, preview) {
  const root = preview.firstElementChild;
  const structureAndTextPass = preview.childNodes.length === 1 &&
    sameStructure(fixture.mockTree, root) &&
    fixture.expect.texts.every((value) => preview.textContent.includes(value)) &&
    fixture.expect.components.every((component) => Boolean(preview.querySelector(tags[component])));
  const checkedStyles = [];
  const uncheckedClasses = new Set();

  function visit(expected, actual) {
    if (!actual) return;
    const style = preview.ownerDocument.defaultView.getComputedStyle(actual);
    for (const cls of expected.classes) {
      const pass = styleCheck(cls, style, actual);
      if (pass === null) uncheckedClasses.add(cls);
      else checkedStyles.push({ nodeId: expected.id, className: cls, pass });
    }
    expected.children.forEach((child, index) => visit(child, actual.children[index]));
  }
  if (structureAndTextPass) visit(fixture.mockTree, root);
  return {
    structureAndTextPass,
    checkedStylePass: structureAndTextPass && checkedStyles.every((check) => check.pass),
    checkedStyles,
    uncheckedClasses: [...uncheckedClasses].sort(),
  };
}
