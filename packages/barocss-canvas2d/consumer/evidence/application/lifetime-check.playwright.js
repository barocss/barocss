// Playwright CLI run-code function. Run from the repository worktree.
async (page) => {
  return await page.evaluate(async () => {
    const {createCanvas2DApplication}=await import('@barocss/canvas2d');
    const assert=(ok,message)=>{if(!ok)throw new Error(message)};
    function measuredCanvas(){
      const canvas=document.createElement('canvas');
      const gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:false,preserveDrawingBuffer:true,stencil:true});
      assert(gl,'real WebGL2');
      const live={Buffer:new Set(),VertexArray:new Set(),Program:new Set(),Shader:new Set(),Texture:new Set()};
      const created={},deleted={};
      for(const kind of Object.keys(live)){
        created[kind]=0;deleted[kind]=0;
        const create=gl['create'+kind].bind(gl),remove=gl['delete'+kind].bind(gl);
        gl['create'+kind]=(...args)=>{const object=create(...args);if(object){live[kind].add(object);created[kind]++;}return object;};
        gl['delete'+kind]=(object)=>{if(live[kind].delete(object))deleted[kind]++;return remove(object);};
      }
      const listeners=new Set();
      const add=canvas.addEventListener.bind(canvas),remove=canvas.removeEventListener.bind(canvas);
      canvas.addEventListener=(name,callback,...rest)=>{if(name.startsWith('webglcontext'))listeners.add(callback);return add(name,callback,...rest);};
      canvas.removeEventListener=(name,callback,...rest)=>{listeners.delete(callback);return remove(name,callback,...rest);};
      return {canvas,read:()=>({created:{...created},deleted:{...deleted},live:Object.fromEntries(Object.entries(live).map(([key,value])=>[key,value.size])),contextListeners:listeners.size})};
    }
    const renderer={logicalSize:{width:16,height:16},dpr:2};
    const synchronous=measuredCanvas();let syncCode=null;
    try{createCanvas2DApplication(synchronous.canvas,{contextId:'SynchronousFail',renderer,autoStart:true,scheduler:{requestFrame(cb){cb(0);return 1},cancelFrame(){}}});}catch(error){syncCode=error.code;}
    const syncCounts=synchronous.read();
    assert(syncCode==='INVALID_SCENE' && Object.values(syncCounts.live).every(x=>x===0) && syncCounts.contextListeners===0 && syncCounts.created.Program>0,'constructor cleanup');
    const cancellation=measuredCanvas(); const expected=new Error('Injected host cancel failure'); let queued=null, cancels=0;
    const app=createCanvas2DApplication(cancellation.canvas,{contextId:'CancelFail',renderer,scheduler:{requestFrame(cb){queued=cb;return 1},cancelFrame(){cancels++;throw expected}}});
    const offs=[];for(let i=0;i<127;i++)offs.push(app.onUpdate(()=>{}));let limit=null;
    try{app.onUpdate(()=>{});}catch(error){limit=error.code;}
    assert(limit==='SCENE_LIMIT','internal listener consumes one slot');
    for(const off of offs){off();off();}
    const invalidPriorities=[];for(const priority of [-100,101,-0,0.5,NaN,Infinity]){let code=null;try{app.onUpdate(()=>{},priority)}catch(error){code=error.code}invalidPriorities.push({priority:String(priority),code});assert(code==='INVALID_SCENE','priority');}
    let listenerCode=null;try{app.onUpdate(null)}catch(error){listenerCode=error.code}assert(listenerCode==='INVALID_SCENE','listener');
    app.start();let sameError=false;try{app.dispose()}catch(error){sameError=error===expected}
    const codes={};for(const [name,action] of Object.entries({appStart:()=>app.start(),appRender:()=>app.render(),tickerStart:()=>app.ticker.start(),rendererRender:()=>app.renderer.render()})){try{action();codes[name]='ACCEPTED'}catch(error){codes[name]=error.code}}
    const cancelCounts=cancellation.read();queued(16);app.dispose();
    assert(sameError && !app.running && cancels===1 && Object.values(codes).every(x=>x==='DISPOSED') && Object.values(cancelCounts.live).every(x=>x===0) && cancelCounts.contextListeners===0,'cancel failure cleanup');
    const batching=measuredCanvas();let callback=null;const order=[];
    const batch=createCanvas2DApplication(batching.canvas,{contextId:'Batch',renderer,scheduler:{requestFrame(cb){callback=cb;return 1},cancelFrame(){}}});
    let renderCalls=0;const render=batch.renderer.render.bind(batch.renderer);batch.renderer.render=()=>{renderCalls++;render();};
    let offB=()=>{};batch.onUpdate(()=>{order.push('A');offB();batch.onUpdate(()=>order.push('C'),0)},1);offB=batch.onUpdate(()=>order.push('B'),0);
    batch.start();callback(0);callback(16);batch.dispose();assert(order.join(',')==='A,B,A,C' && renderCalls===2,'subscription snapshot and one render per batch');
    return {synchronous:{code:syncCode,counts:syncCounts},cancellation:{sameError,cancels,codes,counts:cancelCounts},listenerLimit:limit,invalidPriorities,listenerCode,batchOrder:order,renderCalls,measurement:'Actual WebGL2 handle creation/deletion and context listeners; injected host scheduler failures; no GPU memory measurement'};
  });
}
