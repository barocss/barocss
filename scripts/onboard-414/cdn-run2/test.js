const { chromium } = require('/Users/user/.npm/_npx/705bc6b22212b352/node_modules/playwright-core');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

async function test() {
  const start = Date.now();
  const chromeExe = execSync("find ~/Library/Caches/ms-playwright/chromium-1223 -name 'Google Chrome for Testing' -type f | head -1", { shell: true }).toString().trim();

  console.log('Chrome:', chromeExe);

  const browser = await chromium.launch({ executablePath: chromeExe });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:8260/index.html');
    console.log('Page loaded');

    // Wait for static element to be styled
    await page.waitForTimeout(500);
    const staticBg = await page.evaluate(() => {
      const el = document.getElementById('static');
      return window.getComputedStyle(el).backgroundColor;
    });
    console.log('Static element bg:', staticBg);

    // Wait for dynamic element to get classes (1+ second)
    await page.waitForTimeout(1500);

    const dynamicClasses = await page.evaluate(() => {
      return document.getElementById('dynamic').className;
    });
    console.log('Dynamic element classes:', dynamicClasses);

    const dynamicBg = await page.evaluate(() => {
      const el = document.getElementById('dynamic');
      return window.getComputedStyle(el).backgroundColor;
    });
    const dynamicColor = await page.evaluate(() => {
      const el = document.getElementById('dynamic');
      return window.getComputedStyle(el).color;
    });
    const dynamicPadding = await page.evaluate(() => {
      const el = document.getElementById('dynamic');
      return window.getComputedStyle(el).padding;
    });

    console.log('Dynamic element bg:', dynamicBg);
    console.log('Dynamic element color:', dynamicColor);
    console.log('Dynamic element padding:', dynamicPadding);

    const success = dynamicBg && dynamicColor && !dynamicBg.includes('transparent') && dynamicColor !== 'rgba(0, 0, 0, 0)';
    const elapsed = Math.round((Date.now() - start) / 1000 / 60 * 100) / 100;

    console.log('\n=== RESULT ===');
    console.log('Success:', success);
    console.log('Time (minutes):', elapsed);

    process.exit(success ? 0 : 1);
  } catch (e) {
    console.error('Error:', e.message);
    await browser.close();
    process.exit(1);
  }
}

test();
