async(page)=>{
 const url=new URL(page.url()),id=url.searchParams.get('proof');if(url.hostname!=='127.0.0.1'||!/^[a-z0-9-]+$/.test(id??''))throw Error('Expected owned localhost proof');
 const report={status:'RUNNING',browserVersion:page.context().browser()?.version(),checks:[],scenarios:{},pageErrors:[],consoleErrors:[],requests:[],firstFailure:null};
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),need=(v,m)=>{if(!v)throw Error(m);},snap=()=>page.evaluate(()=>window.roundedCcd.snapshot());
 page.on('pageerror',e=>report.pageErrors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});page.on('request',r=>report.requests.push(r.url()));
 async function check(name,work){await work();report.checks.push({name,status:'PASS'});}
 function poses(s){need(s.lastPresented.stepIndex===s.state.stepIndex,'Display step must match accepted step');need(s.viewer.motion.frame.timeSeconds===s.state.timeSeconds,'Display clock must match World');need(s.viewer.motion.frame.poses.length===2,'Render both accepted bodies');
  for(const b of s.state.bodies){const p=s.viewer.motion.frame.poses.find(p=>p.targetId===b.id);need(same(p.rotation,b.orientationXYZW),'Accepted XYZW must be unchanged');need(same(p.translation,b.positionM.map(v=>v*1000)),'Accepted position must convert m to mm exactly once');}
 }
 async function pixels(){return page.evaluate(async()=>{const d=await window.roundedCcd.readPixels(),c=document.querySelector('#viewer');let blue=0,orange=0,hash=2166136261;for(let i=0;i<d.length;i++){hash=Math.imul(hash^d[i],16777619)>>>0;if(i%4===0){if(d[i+2]>d[i]+30)blue++;if(d[i]>d[i+2]+30)orange++;}}return{bytes:d.length,width:c.width,height:c.height,blue,orange,hash};});}
 try{
  await page.setViewportSize({width:1440,height:1080});await page.goto(url.href);await page.waitForFunction(()=>window.roundedCcd?.snapshot().viewer?.status==='ready'||window.roundedCcd?.snapshot().run.error,{},{timeout:20000});need(!(await snap()).run.error,'Viewer initialization must succeed');
  await check('initial two-body real GPU scene and exact accepted poses',async()=>{const s=await snap();need(s.state.stepIndex===0&&!s.run.running,'Start paused at zero');poses(s);const p=await pixels();need(p.blue>100&&p.orange>100&&p.bytes===p.width*p.height*4,'Read actual sphere and box GPU pixels');report.initial={state:s.state,pixels:p};});
  for(const preset of ['corner','face','vertex','expanded-corner-miss','rotated'])await check(preset+' actual World hit/miss, normal, distance and render',async()=>{
    await page.locator('#preset').selectOption(preset);const before=await snap(),p0=await pixels();await page.locator('#step').click();const s=await snap();poses(s);need(s.state.stepIndex===1&&s.recording.frames.length===1,'One button appends one World step');
    const miss=preset==='expanded-corner-miss';need(s.state.ccdHits.length===(miss?0:1),'Hit/miss must match independent geometric case');
    const overlay=await page.locator('#contact-overlay').getAttribute('data-has-hit');
    if(miss){need(overlay==='false','A miss must show no normal/contact marker');need(s.state.contacts.length===0,'No false contact on expanded-corner path');need(Math.abs(s.state.bodies.find(b=>b.id==='ccd.ball').positionM[0]-1)<1e-12,'Miss must complete original travel');}
    else{
      const hit=s.firstHit;need(Math.abs(hit.centerToBoxDistanceM-s.scenario.radiusM)<=1e-12,'Public TOI must be on actual rounded boundary');need(overlay==='true','Real contact marker must render');
      need(Math.abs(hit.normalFixtureToBody.reduce((sum,v)=>sum+v*v,0)-1)<1e-12,'Normal must be unit');need(s.state.contacts.length>0,'Hit must produce actual contact response');
      if(preset==='corner'){need(Math.abs(hit.toiFraction-.1889957660359269)<=1e-12,'C03 must replace old false early time');need(Math.abs(hit.normalFixtureToBody[0]+Math.sqrt(.75))<=1e-12&&Math.abs(hit.normalFixtureToBody[1]-.5)<=1e-12,'True edge normal');}
      const point=JSON.parse(await page.locator('#contact-overlay').getAttribute('data-world-point'));
      for(let i=0;i<3;i++)need(Math.abs(point[i]-(hit.centerM[i]-hit.normalFixtureToBody[i]*s.scenario.radiusM))<=1e-12,'Marker must be anchored to physical TOI contact point');
    }
    const p=await pixels();need(p.blue>50&&p.orange>100&&p.hash!==p0.hash,'Physics movement must change real GPU pixels with both bodies visible');report.scenarios[preset]={state:s.state,firstHit:s.firstHit,recording:s.recording,viewerMotion:s.viewer.motion,pixels:p};
    if(preset==='corner')await page.screenshot({path:`output/playwright/rounded-ccd/${id}/corner.png`,fullPage:true});
  });
  await check('all16 original boundary inputs render with actual hit/miss/initial ownership',async()=>{
    report.boundaryCases=[];
    const ids=await page.locator('#preset option').evaluateAll(options=>options.map(o=>o.value).filter(id=>id.startsWith('case-')));need(ids.length===16,'Exactly16 frozen boundary controls');
    for(const preset of ids){
      await page.locator('#preset').selectOption(preset);const before=await snap();await page.locator('#step').click();const s=await snap();poses(s);need(s.state.stepIndex===1,'Boundary control must actually step');
      const wanted=s.scenario.expectedClass,hit=s.state.ccdHits[0]??null;need(Boolean(hit)===(wanted==='HIT'),'Independent boundary hit classification');
      if(hit){need(Math.abs(s.firstHit.centerToBoxDistanceM-s.scenario.radiusM)<=1e-12,'Boundary TOI witness');need(s.state.contacts.length>0,'Boundary contact response exists');need(await page.locator('#contact-overlay').getAttribute('data-has-hit')==='true','Boundary contact marker exists');}
      else{need(await page.locator('#contact-overlay').getAttribute('data-has-hit')==='false','No marker on no swept hit');if(wanted==='INITIAL_DISCRETE_OWNED')need((await page.locator('#result').innerText()).includes('이산 경로'),'Initial ownership must not be labelled a miss');}
      const p=await pixels();need(p.orange>100&&p.blue>50,'Both final boundary body pixels exist');report.boundaryCases.push({id:s.scenario.id,wanted,state:s.state,firstHit:s.firstHit,pixels:p});
    }
  });
  await check('desktop1280/1920 resize and camera orbit retain accepted state',async()=>{
    const before=await snap();for(const width of [1280,1920]){await page.setViewportSize({width,height:1080});await page.waitForTimeout(100);const s=await snap();need(same(s.state,before.state),'Resize cannot advance Physics');poses(s);need(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Desktop layout fits');}
    const bounds=await page.locator('#viewer').boundingBox(),previous=await snap();await page.mouse.move(bounds.x+bounds.width*.5,bounds.y+bounds.height*.5);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.6,bounds.y+bounds.height*.6,{steps:5});await page.mouse.up();const after=await snap();need(!same(previous.viewer.camera,after.viewer.camera),'Orbit changes camera');need(same(previous.state,after.state),'Orbit leaves accepted state');await page.locator('#home').click();
  });
  await check('keyboard step, play/pause and reset use actual recorder clock',async()=>{
    await page.locator('#preset').selectOption('face');await page.locator('#step').focus();await page.keyboard.press('Enter');need((await snap()).state.stepIndex===1,'Keyboard step');await page.locator('#play').focus();await page.keyboard.press('Space');await page.waitForFunction(()=>window.roundedCcd.snapshot().state.stepIndex>=3,{},{timeout:5000});await page.keyboard.press('Space');const s=await snap();need(!s.run.running,'Pause');await page.waitForTimeout(120);need(same((await snap()).state,s.state),'No hidden steps while paused');poses(s);await page.locator('#reset').click();need((await snap()).state.stepIndex===0,'Reset clears World clock');
  });
  await page.setViewportSize({width:1440,height:1080});await page.locator('#preset').selectOption('corner');await page.locator('#step').click();await page.screenshot({path:`output/playwright/rounded-ccd/${id}/desktop.png`,fullPage:true});
  need(report.pageErrors.length===0&&report.consoleErrors.length===0,'No page/GPU console errors');need(report.requests.every(r=>r.startsWith(url.origin+'/')),'Local assets only');report.status='PASS_BROWSER_ROUNDED_CCD';
 }catch(e){report.status='FAIL_BROWSER_ROUNDED_CCD';report.firstFailure={message:e.message,stack:e.stack};try{report.failureSnapshot=await snap();}catch{}}
 return report;
}
