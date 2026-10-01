import { validateSpec } from './contract.mjs';

export { validateSpec, classesFor } from './contract.mjs';

// A stable node ID is the React key. The host owns components, form state, and actions.
export function Renderer({ spec, components, state, setState, actions, contract }) {
  const checked = validateSpec(spec, contract);
  if (!checked.ok) throw new Error(`Invalid spec: ${checked.errors[0].path}`);
  const handlers = new Map();
  for (const node of Object.values(spec.elements)) {
    const name = node.on?.press?.action;
    if (name && !handlers.has(name)) {
      const handler = actions && Object.getOwnPropertyDescriptor(actions, name);
      if (!handler || typeof handler.value !== 'function')
        throw new Error(`Missing registered action: ${name}`);
      handlers.set(name, handler.value);
    }
  }
  function render(id) {
    const node = spec.elements[id];
    const Component = components[node.type];
    if (typeof Component !== 'function') throw new Error(`Missing registered component: ${node.type}`);
    const children = node.children.map(render);
    const actionName = node.on?.press?.action;
    return <Component key={id} node={node} state={state} setState={setState}
      onAction={actionName ? () => handlers.get(actionName)() : undefined}>{children}</Component>;
  }
  return render(spec.root);
}
