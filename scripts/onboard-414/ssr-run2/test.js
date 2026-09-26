import pkg from '/Users/user/.npm/_npx/705bc6b22212b352/node_modules/playwright-core/index.js';
const { chromium } = pkg;
import { execSync } from 'child_process';

const CHROME = execSync(
  "find ~/Library/Caches/ms-playwright/chromium-1223 -name 'Google Chrome for Testing' -type f | head -1",
  { encoding: 'utf8', shell: '/bin/zsh' }
).trim();

console.log('Chrome path:', CHROME);

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ javaScriptEnabled: false });

await page.goto('http://localhost:8280', { waitUntil: 'networkidle' });
const html = await page.content();

console.log('HTML length:', html.length);
console.log('Has SSR style tag:', html.includes('<style data-barocss-ssr'));
console.log('SUCCESS: Page rendered without JavaScript');

await browser.close();
process.exit(0);
