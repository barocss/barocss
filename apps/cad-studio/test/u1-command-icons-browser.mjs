// D411: live scoped U1 mappings and construction tool, with no model Apply/download.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';
import { modelGroupNames, openModelGroup } from './model-rail-helper.mjs';
const gallery = resolve(process.argv[3] ?? ''); assert.ok(process.argv[3]);
const registry = JSON.parse(await readFile(join(gallery, 'registry.json'), 'utf8')), metadata = JSON.parse(await readFile(join(gallery, 'producer-inputs.json'), 'utf8'));
const f = await createFlow({ name: 'u1-command-icons', envFrozen: 'U1_COMMAND_ICONS_SOURCE_FROZEN', output: process.argv[2], qualification: 'D411_U1_ICON_LEGIBILITY',
  initialFiles: ['apps/cad-studio/test/model-rail-helper.mjs', 'apps/cad-studio/test/u1-command-icons-browser.mjs', 'apps/cad-studio/test/u1-icon-gallery.mjs', 'apps/cad-studio/test/fixtures/bracket.bcad', join(gallery, 'selected-20-48.html'), join(gallery, 'full-20.html')],
  extraFrozen: Object.keys(metadata.inputs).filter(p => p !== 'apps/cad-studio/u1-icon-gallery.tsx'),
  requiredFrozen: ['apps/cad-studio/src/ui/cadIcons.tsx', 'apps/cad-studio/src/ui/ModelTools.tsx', 'apps/cad-studio/src/ui/commandIcons.ts'],
  limits: ['Only16 U1 drawings change; canonical box control and84 registry drawings including D410five remain unchanged.', 'Whole100-icon20px gallery is a visual context/collision guard, not proof every user can identify every CAD meaning.', 'Real command IDs/accessible labels/available toolbar mapping and construction tool are checked; no model operation Apply or geometric behavior acceptance.', 'No font asset download, Save/export/download or paid call. U3 generic UI font migration and U4 Fillet unification remain separate.'] });
const signature = svg => [...svg.querySelectorAll('path,circle,ellipse,rect,polygon,polyline,line')].map(e => [e.tagName,...['d','cx','cy','r','rx','ry','x','y','width','height','points','x1','y1','x2','y2','transform'].map(n => e.getAttribute(n))]);
let expected; const fonts = { stylesheets: 0, assets: 0 };
async function icon(locator, name) { assert.equal(await locator.locator('svg.cad-icon').count(),1,name); assert.equal(await locator.locator('.ms').count(),0,name); assert.deepEqual(await locator.locator('svg').evaluate(signature),expected[name],name); }
await f.run(async () => {
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async (...args) => { const c = await newContext(...args); await c.route('https://fonts.googleapis.com/**',r=>{fonts.stylesheets++;return r.fulfill({status:200,contentType:'text/css',body:''});}); await c.route('https://fonts.gstatic.com/**',r=>{fonts.assets++;return r.fulfill({status:204,body:''});}); return c; };
  try { await f.newPage(); } finally { f.browser.newContext = newContext; }
  f.phase='final selected and full gallery'; const page=await f.context.newPage();
  try { await page.setViewportSize({width:1200,height:1000}); await page.setContent(await readFile(join(gallery,'selected-20-48.html'),'utf8')); expected={}; for(const name of registry.selected) expected[name]=await page.locator('.dark [data-icon="'+name+'"] svg').first().evaluate(signature); await page.screenshot({path:join(f.output,'00-selected-20-48.png'),fullPage:true}); await page.setContent(await readFile(join(gallery,'full-20.html'),'utf8')); assert.equal(await page.locator('.dark svg').count(),100); await page.screenshot({path:join(f.output,'00-full-20.png'),fullPage:true}); } finally { await page.close(); }
  f.phase='live unchanged model and scoped command icons'; await f.openFile(join(f.app,'test/fixtures/bracket.bcad'),2); await f.page.waitForFunction(()=>window.__studioDoc?.nodes?.[0]?.max?.[0]===30&&window.__studioDoc.nodes[1]?.height===6); const original=await f.doc();
  const toolbarLabels = new Set();
  for (const name of modelGroupNames) {
    const group = await openModelGroup(f.page, name);
    for (const command of registry.commands) {
      const button = group.getByRole('button', { name: command.label, exact: true });
      if (await button.count() === 1 && await button.isVisible()) {
        await icon(button, command.icon);
        toolbarLabels.add(command.label);
      }
    }
  }
  assert.ok(toolbarLabels.has('Box'), 'Box remains in the Model rail');
  await f.page.evaluate(() => document.activeElement?.blur());
  const checks=[];
  for(const [index,command] of registry.commands.entries()) { await f.page.keyboard.press('Space');const palette=f.page.getByRole('dialog',{name:'Command palette',exact:true});await palette.waitFor(); await palette.locator('input').fill(command.label); const item=palette.locator('.pl-item').filter({has:f.page.locator('.pl-label',{hasText:new RegExp('^'+command.label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')})}).first();await item.waitFor();await icon(item,command.icon); if([0,4,8,12].includes(index))await f.snapshot('palette-'+command.id);await f.page.keyboard.press('Escape');await palette.waitFor({state:'hidden'});checks.push({id:command.id,label:command.label,icon:command.icon,toolbar:toolbarLabels.has(command.label)}); }
  f.phase='actual construction icon without dashed strokes';await f.page.click('.mode button:text-is("Sketch")');await f.sketchPanel().waitFor();const construction=f.page.getByRole('button',{name:'Construction',exact:true});await icon(construction,'cad-sk-construction');assert.equal(await construction.locator('[stroke-dasharray]').count(),0);await construction.click();await f.snapshot('construction-reference');await f.page.keyboard.press('Escape');await f.sketchPanel().waitFor({state:'hidden'});await f.same(original);
  assert.equal(fonts.assets,0);assert.ok(fonts.stylesheets>=1);assert.deepEqual(f.report.downloads,[]);f.report.observations.push({commands:checks,constructionNoDashes:true,documentUnchanged:true,fonts,commandApply:'NOT_RUN',outboundFiles:'NOT_RUN'});
});
