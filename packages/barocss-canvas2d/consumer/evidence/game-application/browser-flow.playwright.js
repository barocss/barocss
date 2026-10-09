// Playwright CLI run-code function. Actual UI/RAF and test-only GL observation.
async (page) => {
  const errors = [], warnings = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if(message.type()==='warning') warnings.push(message.text()); });
  await page.addInitScript(() => {
    const stats = { colorClears: 0, draws: 0, scheduled: [], canceled: [] };
    window.__gameApplicationGL = stats;
    const clear = WebGL2RenderingContext.prototype.clear;
    WebGL2RenderingContext.prototype.clear = function(bits) {
      if(bits & this.COLOR_BUFFER_BIT) stats.colorClears++;
      return clear.call(this,bits);
    };
    const draw = WebGL2RenderingContext.prototype.drawArrays;
    WebGL2RenderingContext.prototype.drawArrays = function(...args) { stats.draws++; return draw.apply(this,args); };
    const request = window.requestAnimationFrame, cancel = window.cancelAnimationFrame;
    window.requestAnimationFrame = callback => {
      const token = request.call(window,callback); stats.scheduled.push({token,callback}); return token;
    };
    window.cancelAnimationFrame = token => { stats.canceled.push(token); cancel.call(window,token); };
  });
  await page.reload();
  await page.waitForFunction(()=>window.game?.observe().state==='ready');
  const result = { userAgent:await page.evaluate(()=>navigator.userAgent), stages:[], errors, warnings };
  const check = (ok,text)=>{if(!ok)throw new Error(text);};
  const observe = async name => {
    const value = await page.evaluate(()=>({ ...window.game.observe(), gl: {
      colorClears: window.__gameApplicationGL.colorClears, draws: window.__gameApplicationGL.draws
    }}));
    result.stages.push({name,...value}); return value;
  };
  const click = name=>page.getByRole('button',{name,exact:true}).click();
  let s=await observe('initial');
  check(s.scene.appRunning===false && s.scene.frameIndex===0 && s.backing.width===640,'initial stopped');
  check(s.scene.actorOpaque.hit==='Actor' && s.scene.actorTransparent.hit==='Back','initial hits');
  check(s.gl.colorClears===1 && s.gl.draws===5,'initial actual render commands');
  await click('Step 100 ms'); s=await observe('paused Step');
  check(s.scene.frameIndex===1 && s.pendingFrames===0 && s.gl.colorClears===2,'single manual step');
  await click('Reset'); s=await observe('reset'); check(s.scene.frameIndex===0 && s.score===0,'reset');
  await click('Play'); await page.waitForFunction(()=>window.game.observe().counts.automaticCompleted>=12);
  await click('Pause'); s=await observe('actual RAF pause');
  check(s.counts.automaticCompleted>0 && s.ticks.some(t=>t.deltaMS===0),'actual RAF first zero');
  check(s.gl.colorClears===s.counts.renders && s.gl.draws===s.counts.renders*5,'one actual render per completed update');
  const paused=s;
  await page.waitForTimeout(180); s=await observe('pause held');
  check(s.counts.tickCallbacks===paused.counts.tickCallbacks && s.pendingFrames===0,'pause held');
  await click('Play'); await page.waitForFunction(n=>window.game.observe().counts.automaticCompleted>n,paused.counts.automaticCompleted);
  await click('Pause'); s=await observe('resume');
  check(s.ticks.some(t=>t.frame>0 && t.deltaMS===0),'resume zero');
  await click('Reset'); s=await observe('before drag');
  const box=await page.locator('#scene').boundingBox();
  const actor=s.scene.actorOpaque.point;
  await page.mouse.move(box.x+actor.x,box.y+actor.y); await page.mouse.down();
  await page.mouse.move(box.x+370,box.y+235,{steps:5}); s=await observe('captured outside');
  check(s.scene.capture==='Actor' && s.scene.domCapture && s.dragging,'both captures outside');
  // Offset is local(8,16). Put the actor center at Token1 center using inverse-known parent transform.
  const t=s.scene.parentTransform, x=110-8, y=42;
  const destination={x:t.x+Math.cos(t.rotation)*t.scaleX*x-Math.sin(t.rotation)*t.scaleY*y,
    y:t.y+Math.sin(t.rotation)*t.scaleX*x+Math.cos(t.rotation)*t.scaleY*y};
  await page.mouse.move(box.x+destination.x,box.y+destination.y,{steps:5}); await page.mouse.up();
  s=await observe('one token pickup'); check(s.score===1 && !s.dragging && !s.scene.domCapture && !s.scene.capture,'pickup released');
  await click('Reset');
  await click('Fail automatic update'); await page.waitForFunction(()=>window.game.observe().automaticFailure!==null);
  s=await observe('automatic admission refused');
  check(s.automaticFailure.code==='INVALID_ASSET' && s.automaticFailure.retained && s.automaticFailure.treeChanged,'partial retention');
  check(!s.scene.appRunning && s.pendingFrames===0 && !s.scene.sceneMatchesTree,'automatic failure stopped');
  check(s.gl.colorClears===s.counts.renders,'failure did not draw');
  await click('Repair and Play'); await page.waitForFunction(()=>window.game.observe().scene.sceneMatchesTree);
  await click('Pause'); s=await observe('repair'); check(s.scene.sceneMatchesTree && !s.scene.appRunning,'repair accepted');
  await click('Reject crop edit'); s=await observe('crop refusal'); check(s.refusal.code==='INVALID_SCENE' && s.refusal.retained,'crop');
  await click('Reject missing asset'); s=await observe('candidate refusal'); check(s.refusal.code==='INVALID_ASSET' && s.refusal.retained,'candidate');
  await click('Play'); await click('Dispose'); s=await observe('dispose');
  check(s.disposed && s.pendingFrames===0 && !s.scene.appRunning,'disposed');
  const counts=s.counts;
  await page.mouse.click(box.x+30,box.y+30); await page.waitForTimeout(150);
  s=await observe('after disposed input');
  check(s.counts.renders===counts.renders && s.counts.tickCallbacks===counts.tickCallbacks && s.counts.pointerEvents===counts.pointerEvents,'disposed callbacks quiet');
  result.staleReplay=await page.evaluate(()=>{
    const stats=window.__gameApplicationGL, before=window.game.observe();
    const saved=stats.scheduled.find(s=>stats.canceled.includes(s.token));
    if(!saved)throw new Error('no canceled RAF');
    saved.callback(performance.now());
    const after=window.game.observe();
    return {before:before.counts,after:after.counts,pending:after.pendingFrames};
  });
  check(result.staleReplay.after.renders===result.staleReplay.before.renders && result.staleReplay.after.tickCallbacks===result.staleReplay.before.tickCallbacks && result.staleReplay.after.staleCallbacks===result.staleReplay.before.staleCallbacks+1,'late native callback ignored');
  check(errors.length===0 && warnings.length===0,'browser console');
  return result;
}
