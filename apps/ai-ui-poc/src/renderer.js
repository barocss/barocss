const tags = Object.freeze({ Stack: 'div', Text: 'p', Button: 'button', Card: 'section', Image: 'img' });

export function renderTree(tree, doc = document) {
  if (!Object.hasOwn(tags, tree.component)) throw new TypeError('Unregistered component');
  const element = doc.createElement(tags[tree.component]);
  element.dataset.uiNode = tree.id;
  for (const cls of tree.classes) element.classList.add(cls);
  switch (tree.component) {
    case 'Text': element.textContent = tree.props.text; break;
    case 'Button':
      element.type = 'button';
      element.textContent = tree.props.label;
      element.addEventListener('click', () => {
        if (tree.props.actionId === 'show_notice') element.dispatchEvent(new CustomEvent('poc:notice', { bubbles: true }));
      });
      break;
    case 'Image':
      element.src = tree.props.src;
      element.alt = tree.props.alt;
      break;
    default:
      for (const child of tree.children) element.append(renderTree(child, doc));
  }
  return element;
}
