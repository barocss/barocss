import { Icon } from './atoms';
import { useStoreValue, type ValueStore } from '../state/valueStore';

/** The exploded view's button (R1c (3b)): subscribed to the explode factor itself — the App follows only whether it is on. */
export function ExplodeButton({ store }: { store: ValueStore<number> }) {
  const explode = useStoreValue(store);
  return <button className={'chip snap' + (explode ? ' on' : '')} aria-label="Explode" data-tip="Exploded view" data-tip-desc="Spread the parts out from the middle to see how they go together (display only): click for more, then off"
    onClick={() => store.set(e => [0, 0.5, 1, 2][([0, 0.5, 1, 2].indexOf(e) + 1) % 4])}><Icon name="open_with" small />{explode ? `Explode ×${explode}` : 'Explode'}</button>;
}
