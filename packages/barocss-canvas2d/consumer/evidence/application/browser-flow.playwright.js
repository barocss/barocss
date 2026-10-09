// Playwright CLI run-code function. Run from the repository worktree.
async (page) => {
  await page.reload();
  const result = { userAgent: await page.evaluate(() => navigator.userAgent), stages: [] };
  const check = (ok, text) => { if (!ok) throw new Error(text); };
  const observe = async name => {
    const value = await page.evaluate(() => window.__canvas2dApplicationConsumer.observe());
    result.stages.push({name, running:value.running, treeX:value.treeX, acceptedX:value.display.acceptedX,
      counts:value.counts, ticks:value.ticks, samples:value.display.samples, caught:value.caught,
      reentrantCode:value.reentrantCode, logs:value.logs, pendingToken:value.pendingToken,
      disposed:value.disposed, disposedCodes:value.disposedCodes, treeMatchesAcceptedScene:value.treeMatchesAcceptedScene });
    return value;
  };
  const click = name => page.getByRole('button', {name, exact:true}).click();
  let s = await observe('initial');
  check(!s.running && s.treeX===10 && s.display.samples[0].rgba.join(',')==='255,0,0,255','initial');
  await click('Start'); await click('Step +16 ms'); s=await observe('first');
  check(s.ticks[0].deltaMS===0 && s.treeX===20 && s.counts.postRenderCallbacks===1,'first');
  check(s.logs.some(x=>x.includes('raw-after-render:x=20:hit=Moving:rgba=255,0,0,255')),'automatic render precedes raw');
  const box=await page.locator('#scene').boundingBox();
  await page.mouse.click(box.x+25*box.width/160,box.y+40*box.height/100);
  s=await observe('real pointer'); check(s.counts.pointerEvents===1 && s.logs.includes('pointer:Moving:Moving'),'pointer');
  await click('Step +1000 ms'); s=await observe('capped');
  check(s.ticks[1].elapsedMS===1000 && s.ticks[1].deltaMS===100 && s.treeX===30,'cap');
  await click('Stop'); await click('Replay canceled callback'); s=await observe('stopped replay');
  check(!s.running && s.replay.unchanged,'cancel replay');
  await click('Resume'); await click('Step +16 ms'); s=await observe('resume');
  check(s.ticks.at(-1).deltaMS===0 && s.treeX===40,'resume zero');
  await click('Reject render during next update'); await click('Step +16 ms'); s=await observe('reentrant');
  check(s.reentrantCode==='INVALID_SCENE' && s.treeX===50 && s.counts.postRenderCallbacks===4,'reentrant');
  await click('Stop in next update'); await click('Step +16 ms'); s=await observe('stop in batch');
  check(!s.running && s.treeX===60 && s.display.acceptedX===60 && s.counts.postRenderCallbacks===5 && s.pendingToken===null,'stop completes batch');
  await click('Manual Render'); s=await observe('manual stopped'); check(!s.running && s.counts.manualRenderCalls===2,'manual');
  await click('Resume'); await click('Missing asset on next update'); await click('Step +16 ms'); s=await observe('missing asset');
  check(!s.running && s.caught.code==='INVALID_ASSET' && s.caught.retainedDisplay && s.treeX===70 && s.display.acceptedX===60 && !s.treeMatchesAcceptedScene,'admission retains only display');
  await click('Register missing asset and restart'); await click('Step +16 ms'); s=await observe('repaired');
  check(s.running && s.treeX===80 && s.display.acceptedX===80 && s.ticks.at(-1).deltaMS===0,'repair');
  await click('Throw on update'); await click('Step +16 ms'); s=await observe('callback error');
  check(!s.running && s.caught.sameDeliberateError && s.caught.retainedDisplay && s.treeX===90 && s.display.acceptedX===80,'same callback error');
  await click('Unsubscribe error and restart'); await click('Step +16 ms'); s=await observe('callback recovery');
  check(s.running && s.treeX===100 && s.display.acceptedX===100 && s.ticks.at(-1).deltaMS===0,'callback recovery');
  await page.screenshot({path:'packages/barocss-canvas2d/consumer/evidence/application/screen.png'});
  await click('Dispose'); s=await observe('disposed');
  check(!s.running && s.disposed && s.counts.hostListeners===0 && s.counts.updateSubscriptions===0 && s.counts.rawSubscriptions===0 && s.counts.pointerSubscriptions===0 && Object.values(s.disposedCodes).every(x=>x==='DISPOSED'),'disposed');
  result.disposedReplay=await page.evaluate(()=>window.__canvas2dApplicationConsumer.probeActions.replayCanceled());
  check(result.disposedReplay.unchanged,'disposed stale');
  result.cpuAfterDispose=await page.evaluate(()=>window.__canvas2dApplicationConsumer.probeActions.cpuAfterDispose());
  check(result.cpuAfterDispose.x===105,'cpu independent');
  await page.reload();
  await click('Start'); await click('Dispose in next update'); await click('Step +16 ms'); s=await observe('dispose in batch');
  check(s.disposed && s.treeX===10 && s.counts.updateCallbacks===1 && s.counts.postRenderCallbacks===0,'dispose aborts batch');
  return result;
}
