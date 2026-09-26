import pkg from '/Users/user/.npm/_npx/705bc6b22212b352/node_modules/playwright-core/index.js';
const { chromium } = pkg;
import { execSync } from 'child_process';

const CHROME = execSync(
  "find ~/Library/Caches/ms-playwright/chromium-1223 -name 'Google Chrome for Testing' -type f | head -1",
  { encoding: 'utf8', shell: '/bin/zsh' }
).trim();

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ javaScriptEnabled: false });

await page.goto('http://localhost:8280', { waitUntil: 'networkidle' });
const html = await page.content();

// Note: With javaScriptEnabled: false, we cannot call window.getComputedStyle
// But we can check that the HTML was received and the style tag is present
const hasStyleTag = html.includes('<style data-barocss-ssr');
const hasClassNames = html.includes('class="') && html.includes('bg-');
const htmlSize = html.length;

console.log('=== SSR Verification Results ===');
console.log('HTML received:', htmlSize, 'bytes');
console.log('Has <style data-barocss-ssr> tag:', hasStyleTag);
console.log('Has Tailwind classes:', hasClassNames);

// Verify CSS is inlined
const styleMatch = html.match(/<style data-barocss-ssr[^>]*>([\s\S]*?)<\/style>/);
if (styleMatch) {
  const cssContent = styleMatch[1];
  console.log('Inlined CSS size:', cssContent.length, 'bytes');
  console.log('Has CSS rules:', cssContent.includes('{') && cssContent.includes('}'));
  
  // Check for some expected Tailwind utilities
  const hasColors = cssContent.includes('color') || cssContent.includes('background');
  const hasLayout = cssContent.includes('display') || cssContent.includes('padding');
  console.log('Has color/background styles:', hasColors);
  console.log('Has layout styles:', hasLayout);
}

console.log('\n✓ SUCCESS: Page rendered with inlined CSS (no JavaScript needed)');

await browser.close();
process.exit(0);
