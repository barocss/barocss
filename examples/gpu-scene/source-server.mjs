import {startSourceServer} from '../cad-preview/source-server.mjs';
const running=await startSourceServer(Number(process.env.PORT??5180),{gpuScene:true});console.log('GPU scene from original source: '+running.url);for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await running.close();process.exit(0);});
