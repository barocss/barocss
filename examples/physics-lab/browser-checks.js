async (page) => {
  const currentURL=new URL(page.url()),origin=currentURL.origin,runId=currentURL.searchParams.get('proof')??'manual';
  if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)||!/^[a-z0-9-]+$/.test(runId))throw new Error('Expected owned localhost preview and safe proof id');
  const screenshotDirectory=`output/playwright/physics-lab/${runId}`;
  const report={url:currentURL.href,status:'RUNNING',checks:[],firstFailure:null,consoleErrors:[],pageErrors:[],network:[],snapshots:{},pixels:{},comparison:null};
  report.browserVersion=page.context().browser()?.version()??null;
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  function need(condition,message){if(!condition)throw new Error(message);}
  const snap=()=>page.evaluate(()=>window.physicsLab.snapshot());
  const accepted=s=>({state:s.state,recording:s.recording,presented:s.presented});
  const pose=s=>{
    const b=s.state.bodies[0],frame=s.viewer.motion.frame,p=frame.poses[0],display=s.viewer.motion.displayPoses[0];
    need(s.presented.stepIndex===s.state.stepIndex,'Presented step must equal accepted step');
    need(frame.timeSeconds===s.state.timeSeconds,'Viewer time must equal accepted time');
    need(same(p.rotation,b.orientationXYZW)&&same(display.rotationXYZW,b.orientationXYZW),'Viewer must copy accepted XYZW rotation');
    need(same(p.translation,b.positionM.map(x=>x*1000))&&same(display.translation,p.translation),'Viewer must convert accepted m to mm once');
  };
  const pixels=()=>page.evaluate(async()=>{
    const data=await window.physicsLab.readPixels(),background=Array.from(data.slice(0,3));let covered=0,hash=2166136261;
    for(let i=0;i<data.length;i++){hash=Math.imul(hash^data[i],16777619)>>>0;if(i%4===0&&Math.abs(data[i]-background[0])+Math.abs(data[i+1]-background[1])+Math.abs(data[i+2]-background[2])>20)covered++;}
    const c=document.querySelector('#viewer');return{bytes:data.length,width:c.width,height:c.height,covered,hash};
  });
  const check=async(name,work)=>{const start=Date.now();await work();report.checks.push({name,status:'PASS',elapsedMs:Date.now()-start});};
  page.on('pageerror',e=>report.pageErrors.push(e.stack??String(e)));
  page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
  page.on('request',r=>report.network.push(r.url()));
  try{
    await page.setViewportSize({width:1440,height:1050});
    await page.goto(currentURL.href);
    await page.waitForFunction(()=>document.documentElement.dataset.labState==='ready',{},{timeout:20000});
    await check('actual WebGPU box and initial pose',async()=>{
      const s=await snap();need(s.state.stepIndex===0&&!s.running,'Sample must start paused at zero');pose(s);report.snapshots.initial=s.state;
      const p=await pixels();need(p.bytes===p.width*p.height*4&&p.covered>2000,'WebGPU readback must contain real body pixels');report.pixels.initial=p;
    });
    await check('single steps rotate body, display pose and pixels',async()=>{
      for(let i=0;i<12;i++)await page.locator('#step').click();const s=await snap();need(s.state.stepIndex===12&&s.recording.frames.length===12,'One UI step must append one accepted record');pose(s);
      need(!same(s.state.bodies[0].orientationXYZW,report.snapshots.initial.bodies[0].orientationXYZW),'Box orientation must change');
      const p=await pixels();need(p.hash!==report.pixels.initial.hash&&p.covered>2000,'Moving box must change real GPU pixels');report.pixels.rotated=p;report.snapshots.rotated=s.state;
    });
    await check('save, restore and actual continued execution',async()=>{
      await page.locator('#save').click();const saved=await snap();await page.locator('#step').click();const continued=await snap();
      await page.locator('#restore').click();const restored=await snap();need(same(restored.state,saved.state)&&same(restored.recording,saved.recording),'Restore must reproduce saved state/log');pose(restored);
      await page.locator('#step').click();const repeated=await snap();need(same(repeated.state,continued.state)&&same(repeated.recording,continued.recording),'Restored next step must match actual original continuation');pose(repeated);
      report.snapshots.restored=restored.state;report.snapshots.continued=repeated.state;
    });
    await check('numerical refusal preserves physics, log and display; recovery succeeds',async()=>{
      await page.locator('#torque-x').fill('1000000');await page.locator('#torque-y').fill('0');await page.locator('#torque-z').fill('0');
      const before=await snap();await page.locator('#step').click();const failed=await snap();need(failed.lastError?.code==='NUMERIC_LIMIT','Actual World must refuse oversized torque numerically');
      need(same(accepted(before),accepted(failed)),'Rejected numerical step must preserve accepted state, recording and displayed frame');pose(failed);
      report.snapshots.refusal={error:failed.lastError,acceptedStep:failed.state.stepIndex};await page.locator('#torque-x').fill('0');await page.locator('#step').click();const recovered=await snap();need(recovered.state.stepIndex===before.state.stepIndex+1&&!recovered.lastError,'A valid next step must recover');pose(recovered);
    });
    await check('preset applies initial impulse once and reissues constant torque',async()=>{
      await page.locator('#preset').selectOption('torque');await page.locator('#step').click();await page.locator('#step').click();const s=await snap();pose(s);
      need(s.recording.frames[0].commands.filter(c=>c.kind==='angularImpulse').length===1,'First preset step must apply J once');
      need(s.recording.frames[1].commands.every(c=>c.kind!=='angularImpulse'),'J must expire');need(s.recording.frames.every(f=>f.commands.some(c=>c.kind==='torque')),'Host must reissue tau');
      need((await page.locator('#energy-error-label').innerText()).includes('근사'),'Forced work diagnostic must be labelled approximate');report.snapshots.forced=s.state;
    });
    await check('independent three-grid matched-time comparison and scene preservation',async()=>{
      const before=await snap();await page.locator('#compare').click();await page.waitForFunction(()=>window.physicsLab.snapshot().comparison!==null,{},{timeout:20000});
      const after=await snap();need(same(accepted(before),accepted(after)),'Comparison must retain current experiment state/log/display');
      const c=after.comparison;report.comparison=c;need(c.pass&&c.results.length===3&&c.results.every(r=>r.matched.length===6&&r.pass),'All18 matched frames must pass independent browser gates');
      need(c.results.map(r=>r.steps).join(',')==='6,12,24','Grids must use original step counts');need((await page.locator('#comparison-rows .result-pass').count())===3,'Table must show three actual passes');report.comparison=c;
    });
    await page.screenshot({path:screenshotDirectory+'/desktop.png',fullPage:true});
    await page.screenshot({path:screenshotDirectory+'/desktop-viewport.png',fullPage:false});
    await check('sphere custom inputs and keyboard step/play/pause',async()=>{
      await page.locator('#shape').selectOption('sphere');await page.locator('#mass').fill('3.2');await page.locator('#radius').fill('.17');await page.locator('#hz').selectOption('60');await page.locator('#apply').click();
      let s=await snap();need(s.config.shape==='sphere'&&s.config.massKg===3.2&&s.config.radiusM===.17&&s.config.hz===60&&s.state.stepIndex===0,'Form must reset actual model and interval');pose(s);
      const p=await pixels();need(p.covered>2000,'Sphere must produce real GPU pixels');report.pixels.sphere=p;
      await page.locator('#step').focus();await page.keyboard.press('Enter');need((await snap()).state.stepIndex===1,'Keyboard Enter must step');
      await page.locator('#play').focus();await page.keyboard.press('Space');await page.waitForFunction(()=>window.physicsLab.snapshot().state.stepIndex>=3,{},{timeout:5000});
      await page.keyboard.press('Space');s=await snap();need(!s.running,'Keyboard Space must pause');const stopped=s.state.stepIndex;await page.waitForTimeout(150);need((await snap()).state.stepIndex===stopped,'Paused simulation must not advance');pose(await snap());
    });
    await check('capsule and coordinate transport through public Viewer',async()=>{
      await page.locator('#preset').selectOption('capsule');await page.locator('#orientation').selectOption('cyclic');await page.locator('#apply').click();await page.locator('#step').click();const s=await snap();
      need(s.config.shape==='capsule'&&same(s.config.orientationXYZW,[.5,.5,.5,.5]),'Capsule form must preserve selected initial orientation');pose(s);
      const p=await pixels();need(p.covered>2000,'Capsule must produce real GPU pixels');report.pixels.capsule=p;report.snapshots.capsule=s.state;
    });
    await check('save survives model reset and reconstructs original model',async()=>{
      await page.locator('#save').click();const saved=await snap();await page.locator('#preset').selectOption('free');need((await snap()).config.shape==='box','Reset preset must replace capsule model');
      await page.locator('#restore').click();const s=await snap();need(same(s.state,saved.state)&&same(s.config,saved.config),'Restore must recreate saved config and actual state');pose(s);
    });
    await check('orbit and camera reset alter view without advancing physics',async()=>{
      const before=await snap(),box=await page.locator('#viewer').boundingBox();await page.mouse.move(box.x+box.width*.55,box.y+box.height*.45);await page.mouse.down();await page.mouse.move(box.x+box.width*.65,box.y+box.height*.55,{steps:6});await page.mouse.up();
      const after=await snap();need(!same(before.viewer.camera,after.viewer.camera),'Pointer orbit must change camera');need(same(before.state,after.state),'Camera must not advance physics');
      const p=await pixels();need(p.hash!==report.pixels.capsule.hash,'Orbit must change GPU pixels');await page.locator('#home').click();pose(await snap());
    });
    await check('desktop resize retains state and renders at1280 and1920 widths',async()=>{
      const before=await snap();
      for(const width of [1280,1920]){
        await page.setViewportSize({width,height:1080});await page.waitForTimeout(120);const after=await snap();
        need(same(before.state,after.state),'Desktop resize must retain accepted state');pose(after);
        const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,canvas:document.querySelector('#viewer').getBoundingClientRect().width}));
        need(layout.scroll<=layout.width+1&&layout.canvas>700,'Desktop layout must fit and retain its working canvas');
        const p=await pixels();need(p.covered>2000,'Desktop canvas must render body');report.pixels['desktop'+width]=p;
      }
      await page.screenshot({path:screenshotDirectory+'/desktop-wide.png',fullPage:true});await page.setViewportSize({width:1440,height:1050});
    });
    await check('recording horizon stops at512 without hidden extra steps',async()=>{
      await page.locator('#preset').selectOption('free');await page.locator('#hz').selectOption('240');await page.locator('#apply').click();await page.locator('#speed').selectOption('1');await page.locator('#play').click();
      await page.waitForFunction(()=>window.physicsLab.snapshot().state.stepIndex===512,{},{timeout:45000});const s=await snap();need(!s.running&&s.recording.frames.length===512,'Horizon must stop recorder and host exactly at512');pose(s);
      need(await page.locator('#play').isDisabled()&&await page.locator('#step').isDisabled(),'Horizon must disable further advancement');const before=s.state;await page.waitForTimeout(150);need(same((await snap()).state,before),'No hidden steps after horizon');report.snapshots.horizon=s.state;
      await page.locator('#reset').click();need((await snap()).state.stepIndex===0,'Reset must recover from horizon');
    });
    need(report.pageErrors.length===0&&report.consoleErrors.length===0,'No unhandled page or GPU/console errors');
    need(report.network.every(url=>url.startsWith(origin+'/')),'Page must request only local assets');
    report.status='PASS_BROWSER_PHYSICS_LAB';
  }catch(error){report.status='FAIL_BROWSER_PHYSICS_LAB';report.firstFailure={message:error.message,stack:error.stack};try{report.failureSnapshot=await snap();}catch(snapshotError){report.failureSnapshotError=snapshotError.message;}}
  return report;
}
