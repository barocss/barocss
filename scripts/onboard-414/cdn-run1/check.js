const path = require('path');
const PW_DIR = process.env.PW_DIR || '/Users/user/.npm/_npx/705bc6b22212b352';
const { chromium } = require(path.join(PW_DIR, 'node_modules', 'playwright-core'));

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME,
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(process.env.URL || 'http://localhost:8200/index.html');
  await page.waitForTimeout(2000);
  const result = await page.evaluate(() => {
    const btn = document.getElementById('late-btn');
    const cs = getComputedStyle(btn);
    return {
      backgroundColor: cs.backgroundColor,
      color: cs.color,
      paddingLeft: cs.paddingLeft,
      paddingTop: cs.paddingTop,
      borderRadius: cs.borderRadius,
    };
  });
  console.log(JSON.stringify({ result, errors }, null, 2));
  await browser.close();
})();
