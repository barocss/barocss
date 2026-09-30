import { validateSpec } from './contract.mjs';

export { validateSpec, classesFor } from './contract.mjs';

// A stable node ID is the React key. The host owns components, form state, and actions.
export function Renderer({ spec, components, state, setState, actions }) {
  const checked = validateSpec(spec);
  if (!checked.ok) throw new Error(`Invalid spec: ${checked.errors[0].path}`);
  function render(id) {
    const node = spec.elements[id];
    const Component = components[node.type];
    if (typeof Component !== 'function') throw new Error(`Missing registered component: ${node.type}`);
    const children = node.children.map(render);
    const actionName = node.on?.press?.action;
    return <Component key={id} node={node} state={state} setState={setState}
      onAction={actionName ? () => actions[actionName]() : undefined}>{children}</Component>;
  }
  return render(spec.root);
}
