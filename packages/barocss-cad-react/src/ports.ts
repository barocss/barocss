/** Inject the existing engine client. This contract owns no Worker or wire decoder. */
import type {StudioDoc} from '@barocss/cad-model/engine/doc';
import type {BodyResult,EvalResult} from '@barocss/cad-model/engine/evaluate';
import type {FriendlyError} from '@barocss/cad-model/engine/errors';
import type {MassFields,NativeMassEnvelope} from '@barocss/cad-model/engine/nativeMassWire';
export interface MassPatch {ref:number;fields:MassFields;nativeMass:NativeMassEnvelope}
export interface EnginePort {
  evaluate(doc:StudioDoc,revision:number):Promise<EvalResult|null>;
  restart():boolean;
  dispose():void;
  onFailure(listener:(error:FriendlyError)=>void):()=>void;
  onMasses(listener:(patches:MassPatch[])=>void):()=>void;
}
export interface MassPolicy {
  /** Inject existing provenance-aware withMasses. Never merge by coincident ref alone. */
  merge(bodies:BodyResult[],patches:MassPatch[]):BodyResult[];
}
export interface Owner {
  readonly hostEpoch:number;
  readonly declaration:number;
  readonly evaluationRevision:number;
  readonly fingerprint:string;
}
export interface ExistingViewerSink {
  show(bodies:readonly BodyResult[],owner:Owner,stillCurrent:()=>boolean):Promise<void>;
  snapshot():unknown;
  dispose():void;
}
export interface ModelHostOptions {
  engine:EnginePort;
  ownership:'owned'|'borrowed';
  massPolicy:MassPolicy;
  sink:ExistingViewerSink;
  ownsSink:boolean;
}
