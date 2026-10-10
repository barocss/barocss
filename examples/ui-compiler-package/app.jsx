import React, { useEffect, useState } from 'react';
import { Layout, Card, Text, Input, Button } from '@barocss/ui';

const unitPrice = 1800;
export default function GeneratedUi({ initialState, canSave, onState, onSave }) {
  const [count, setCount] = useState(initialState.count);
  const [name, setName] = useState(initialState.name);
  useEffect(() => { onState({ name, count }); }, [name, count, onState]);
  return <Layout><Card>
    <Text>Compiled UI</Text>
    <Text>Count: {count}</Text>
    <Text>Total: {count * unitPrice}</Text>
    <Input label="Name" value={name} onChange={(event) => setName(event.target.value.slice(0, 80))} />
    <Button disabled={count >= 1000} onClick={() => setCount((value) => Math.min(1000, value + 1))}>Add</Button>
    <Button disabled={!canSave} onClick={() => onSave({ name, count })}>Save</Button>
  </Card></Layout>;
}
