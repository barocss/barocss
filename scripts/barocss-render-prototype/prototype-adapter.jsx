import { useState } from 'react';
import { Renderer } from '../../packages/barocss-render/src/index.jsx';
import { Layout, Card, Text, Input, Button } from './visual.jsx';

const components = {
  Layout, Card, Text,
  Input: ({ node, state, setState }) => <Input node={node} value={state.name}
    onChange={(value) => setState((old) => ({ ...old, name: value }))} />,
  Button: ({ node, onAction }) => <Button node={node} onClick={onAction} />,
};

export function PrototypeArm({ spec, onSave, onState }) {
  const [state, internalSetState] = useState({ name: 'Ada' });
  const setState = (updater) => internalSetState((old) => {
    const next = typeof updater === 'function' ? updater(old) : updater;
    onState(next);
    return next;
  });
  return <Renderer spec={spec} components={components} state={state} setState={setState} actions={{ save: onSave }} />;
}
