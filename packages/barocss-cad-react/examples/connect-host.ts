import {ModelHost,type EnginePort,type MassPolicy,type ExistingViewerSink} from '../src/engine.js';
/** Transfer the newly created sink only after successful connection; failure closes it immediately. */
export function connectHost(engine:EnginePort,massPolicy:MassPolicy,sink:ExistingViewerSink):ModelHost {
  let host:ModelHost|undefined;
  try {
    host=new ModelHost({engine,ownership:'borrowed',massPolicy,sink,ownsSink:true});
    host.connect();
    return host;
  } catch(error) {
    try { if(host)host.dispose();else sink.dispose(); } catch { /* Cleanup cannot replace the connection error. */ }
    throw error;
  }
}
