import pkg from '/Users/user/.npm/_npx/705bc6b22212b352/node_modules/playwright-core/index.js';
const { chromium } = pkg;
import { execSync } from 'child_process';

const CHROME = execSync(
  "find ~/Library/Caches/ms-playwright/chromium-1223 -name 'Google Chrome for Testing' -type f | head -1",
  { encoding: 'utf8', shell: '/bin/zsh' }
).trim();

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ javaScriptEnabled: true });

await page.goto('http://localhost:8280', { waitUntil: 'networkidle' });

// With JS enabled, check computed styles
const titleStyle = await page.evaluate(() => {
  const h2 = document.querySelector('h2');
  if (!h2) return null;
  const styles = window.getComputedStyle(h2);
  return { fontSize: styles.fontSize, fontWeight: styles.fontWeight };
});

const priceStyle = await page.evaluate(() => {
  const spans = document.querySelectorAll('span');
  for (const span of spans) {
    if (span.textContent.includes('$99')) {
      const styles = window.getComputedStyle(span);
      return { fontSize: styles.fontSize, fontWeight: styles.fontWeight };
    }
  }
  return null;
});

const buttonStyle = await page.evaluate(() => {
  const button = document.querySelector('button');
  if (!button) return null;
  const styles = window.getComputedStyle(button);
  return { backgroundColor: styles.backgroundColor, color: styles.color };
});

console.log('=== Computed Styles (with JavaScript) ===');
console.log('Title font-size:', titleStyle?.fontSize, 'font-weight:', titleStyle?.fontWeight);
console.log('Price font-size:', priceStyle?.fontSize, 'font-weight:', priceStyle?.fontWeight);
console.log('Button background:', buttonStyle?.backgroundColor, 'color:', buttonStyle?.color);

const hasStyles = 
  titleStyle && titleStyle.fontSize === '24px' &&
  priceStyle && priceStyle.fontSize === '36px' &&
  buttonStyle && (buttonStyle.backgroundColor.includes('oklch') || buttonStyle.backgroundColor.includes('rgb'));

if (hasStyles) {
  console.log('\n✓ All styles properly applied');
} else {
  console.log('\n✗ Some styles not applied');
}

await browser.close();
process.exit(hasStyles ? 0 : 1);
