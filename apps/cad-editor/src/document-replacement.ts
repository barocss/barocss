import { CadEditorError, type CadEditorSession, type CadEditorSnapshot, type CadEditorView } from '@barocss/cad-editor';

const STATE_FIELDS = ['generation', 'displayGeneration', 'selectedBodyId', 'selection', 'pending',
  'curveSelection','view','selectionTransition', 'candidate', 'dirty', 'downloadStatus', 'disposed'] as const;
type ReplacementState = Pick<CadEditorSnapshot, typeof STATE_FIELDS[number]>;
export type ReplacementAnchor = ReplacementState & { session: CadEditorSession };
export interface ReplacementTarget {
  kind: 'open' | 'sample';
  text: string;
  filename: string;
  displayBodyIds?: string[];
  view?: CadEditorView;
}

function requireReplacement(condition: boolean, code: 'INPUT' | 'STALE' | 'LIFECYCLE', message: string): asserts condition {
  if (!condition) throw new CadEditorError(code, message, { field: 'document-replacement' });
}
function state(snapshot: CadEditorSnapshot): ReplacementState {
  return structuredClone(Object.fromEntries(STATE_FIELDS.map(field => [field, snapshot[field]]))) as ReplacementState;
}
/** Compare own data without coercion, getter calls or signed-zero normalization. */
function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b) || Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  const left = Object.getOwnPropertyDescriptors(a), right = Object.getOwnPropertyDescriptors(b);
  const keys = Reflect.ownKeys(a), otherKeys = Reflect.ownKeys(b);
  return keys.length === otherKeys.length && keys.every(key => typeof key === 'string'
    && Object.hasOwn(right, key) && 'value' in left[key] && 'value' in right[key]
    && left[key].enumerable === right[key].enumerable && same(left[key].value, right[key].value));
}

export function captureReplacementAnchor(session: CadEditorSession): ReplacementAnchor {
  const snapshot = session.getSnapshot();
  requireReplacement(!snapshot.disposed, 'LIFECYCLE', 'The document session is disposed.');
  requireReplacement(Object.keys(snapshot.pending).length === 0 && snapshot.selectionTransition === null
    && snapshot.candidate === null, 'INPUT', 'Apply or discard the draft and resolve the current decision first.');
  return { session, ...state(snapshot) };
}

export function assertReplacementCurrent(session: CadEditorSession, anchor: ReplacementAnchor): void {
  requireReplacement(anchor !== null && typeof anchor === 'object' && !Array.isArray(anchor)
    && [Object.prototype, null].includes(Object.getPrototypeOf(anchor)), 'STALE', 'The replacement request is no longer current.');
  const fields = Object.getOwnPropertyDescriptors(anchor), keys = Reflect.ownKeys(anchor);
  requireReplacement(keys.length === STATE_FIELDS.length + 1 && keys.every(key => typeof key === 'string'
    && (key === 'session' || STATE_FIELDS.includes(key as typeof STATE_FIELDS[number]))
    && 'value' in fields[key] && fields[key].enumerable === true)
    && fields.session?.value === session, 'STALE', 'The replacement request belongs to another state or session.');
  const snapshot = session.getSnapshot();
  requireReplacement(!snapshot.disposed && Object.keys(snapshot.pending).length === 0
    && snapshot.selectionTransition === null && snapshot.candidate === null
    && STATE_FIELDS.every(field => same(snapshot[field], fields[field].value)),
  'STALE', 'The document changed. Start Open or New again.');
}

export function copyReplacementTarget(target:ReplacementTarget):ReplacementTarget {
  requireReplacement(target!==null&&typeof target==='object'&&!Array.isArray(target)
    &&[Object.prototype,null].includes(Object.getPrototypeOf(target)),'INPUT','A plain replacement target is required.');
  const fields=Object.getOwnPropertyDescriptors(target),keys=Reflect.ownKeys(target);
  requireReplacement(keys.length>=3&&keys.length<=5&&['kind','text','filename'].every(key=>Object.hasOwn(fields,key))
    &&keys.every(key=>typeof key==='string'&&['kind','text','filename','displayBodyIds','view'].includes(key)
      &&'value' in fields[key]&&fields[key].enumerable),'INPUT','Replacement fields must be plain own data.');
  const kind=fields.kind.value,text=fields.text.value,filename=fields.filename.value;
  requireReplacement((kind==='open'||kind==='sample')&&typeof text==='string'&&typeof filename==='string','INPUT','An Open or sample target is required.');
  const result:ReplacementTarget={kind,text,filename};
  if(Object.hasOwn(fields,'displayBodyIds')&&fields.displayBodyIds!.value!==undefined){
    const ids:unknown=fields.displayBodyIds!.value;
    requireReplacement(Array.isArray(ids)&&Object.getPrototypeOf(ids)===Array.prototype,'INPUT','Display body IDs must be a plain array.');
    const entries=Object.getOwnPropertyDescriptors(ids);
    requireReplacement(Reflect.ownKeys(ids).length===ids.length+1,'INPUT','Display body IDs must be dense own data.');
    result.displayBodyIds=Array.from({length:ids.length},(_,index)=>{const entry=entries[String(index)];
      requireReplacement(entry!==undefined&&entry.enumerable===true&&'value' in entry&&typeof entry.value==='string','INPUT','Display IDs must be own strings.');return entry.value;});
  }
  if(Object.hasOwn(fields,'view')&&fields.view!.value!==undefined){
    const view:unknown=fields.view!.value;
    requireReplacement(view!==null&&typeof view==='object'&&!Array.isArray(view)&&[Object.prototype,null].includes(Object.getPrototypeOf(view)),'INPUT','A plain incoming view is required.');
    const values=Object.getOwnPropertyDescriptors(view),viewKeys=Reflect.ownKeys(view);
    requireReplacement(viewKeys.every(key=>typeof key==='string'&&'value' in values[key]&&values[key].enumerable),'INPUT','View fields must be own data.');
    if(values.kind?.value==='document'){
      requireReplacement(viewKeys.length===1,'INPUT','Document view has only its kind.');result.view={kind:'document'};
    }else{
      requireReplacement(viewKeys.length===3&&['kind','bodyId','count'].every(key=>Object.hasOwn(values,key))
        &&values.kind.value==='curve-focus'&&typeof values.bodyId.value==='string'
        &&Number.isInteger(values.count.value)&&values.count.value>=2&&values.count.value<=129,'INPUT','A bounded explicit Curve focus is required.');
      result.view={kind:'curve-focus',bodyId:values.bodyId.value,count:values.count.value};
    }
  }
  return result;
}
