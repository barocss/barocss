// Focused host race and controlled-timestamp checks; not RAF performance evidence.
async (page) => {
  const check=(ok,message)=>{if(!ok)throw new Error(message);};
  await page.reload(); await page.waitForFunction(()=>window.game?.observe().state==='ready');
  const cap=await page.evaluate(()=>{
    const stats=window.__gameApplicationGL;
    window.game.play();
    let request=stats.scheduled.at(-1); cancelAnimationFrame(request.token);
    const t=performance.now(); request.callback(t);
    request=stats.scheduled.at(-1); cancelAnimationFrame(request.token); request.callback(t+1000);
    window.game.pause();
    return window.game.observe();
  });
  check(cap.ticks.length===2 && cap.ticks[0].deltaMS===0 && cap.ticks[1].elapsedMS===1000 && cap.ticks[1].deltaMS===100 && cap.scene.frameIndex===1,'controlled cap');
  await page.goto('http://127.0.0.1:31082/packages/barocss-canvas2d/consumer/game.html?delayMS=1000');
  await page.waitForFunction(()=>window.game?.observe().counts.loadsDecoded===1);
  await page.getByRole('button',{name:'Dispose',exact:true}).click();
  await page.waitForFunction(()=>window.game.observe().counts.loadsIgnored===1);
  const late=await page.evaluate(()=>window.game.observe());
  check(late.disposed && late.counts.rendererCreations===0 && late.counts.renders===0,'late load after dispose');
  await page.goto('http://127.0.0.1:31082/packages/barocss-canvas2d/consumer/game.html?delayMS=1000');
  await page.waitForFunction(()=>window.game?.observe().counts.loadsDecoded===1);
  await page.getByRole('button',{name:'Cancel load',exact:true}).click();
  await page.waitForFunction(()=>window.game.observe().counts.loadsIgnored===1);
  const canceled=await page.evaluate(()=>window.game.observe());
  check(canceled.state==='canceled' && canceled.counts.rendererCreations===0,'cancel load');
  await page.getByRole('button',{name:'Load atlas',exact:true}).click();
  await page.waitForFunction(()=>window.game.observe().state==='ready');
  const reloaded=await page.evaluate(()=>window.game.observe());
  check(reloaded.counts.rendererCreations===1 && reloaded.counts.manualRenders===1 && reloaded.counts.renders===1,'reloaded one app');
  return {cap,late,canceled,reloaded};
}
