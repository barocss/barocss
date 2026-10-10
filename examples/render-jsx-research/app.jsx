import React, { useEffect, useState } from 'react';
import { Layout, Card, Text, Input, Button } from '@research/ui';

const unitPrice = 1800;
export default function GeneratedUi({ initialState, canSave, onState, onSave }) {
  const [count, setCount] = useState(initialState.count);
  const [name, setName] = useState(initialState.name);
  useEffect(() => { onState({ name, count }); }, [name, count, onState]);
  return <Layout><Card>
    <Text>JSX로 만든 신청 화면</Text>
    <Text>개수: {count}</Text>
    <Text>금액: {count * unitPrice}원</Text>
    <Input label="이름" value={name} onChange={(event) => setName(event.target.value.slice(0, 80))} />
    <Button disabled={count >= 1000} onClick={() => setCount((value) => Math.min(1000, value + 1))}>더하기</Button>
    <Button disabled={!canSave} onClick={() => onSave({ name, count })}>저장</Button>
  </Card></Layout>;
}
