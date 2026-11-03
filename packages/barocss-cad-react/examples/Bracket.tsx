/** Actual demo modeling source. No fixture Doc, manual feature IDs or refs. */
import { Difference, Target, Tools, Union, Extrude, Rectangle, Circle } from '../src/index.js';

export function Bracket({ width }: { width: number }) {
  const holes = [
    { key: 'front-left', at: [10, 10] as const },
    { key: 'front-right', at: [width - 10, 10] as const },
    { key: 'rear-left', at: [10, 44] as const },
    { key: 'rear-right', at: [width - 10, 44] as const },
  ];
  return <Difference>
    <Target><Union>
      <Extrude distance={6}><Rectangle min={[0, 0]} max={[width, 60]} /></Extrude>
      <Extrude distance={56}><Rectangle min={[0, 54]} max={[width, 60]} /></Extrude>
    </Union></Target>
    <Tools>
      {holes.map(hole => <Extrude key={hole.key} from={-1} distance={8}>
        <Circle center={hole.at} radius={3} />
      </Extrude>)}
      <Extrude from={34} distance={14}>
        <Rectangle min={[width / 2 - 10, 53]} max={[width / 2 + 10, 61]} />
      </Extrude>
    </Tools>
  </Difference>;
}
