/**
 * Headless smoke test: onboarding → draft → scenario → series → tabs → reload.
 * Uses the system Edge/Chrome via Playwright channels (no browser download).
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:5173/';
const SHOTS = new URL('../smoke-shots/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
mkdirSync(SHOTS, { recursive: true });

const errors = [];
let browser;
for (const channel of ['msedge', 'chrome']) {
  try {
    browser = await chromium.launch({ channel, headless: true });
    console.log('launched', channel);
    break;
  } catch { /* try next */ }
}
if (!browser) {
  console.error('No system browser channel available');
  process.exit(2);
}

const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});

const shot = (name) => page.screenshot({ path: SHOTS + name + '.png' });
const clickText = async (text) => {
  await page.locator(`text=${text}`).first().click();
};

async function step(name, fn) {
  try {
    await fn();
    console.log('OK  ', name);
  } catch (e) {
    console.log('FAIL', name, '-', e.message.split('\n')[0]);
    await shot('FAIL-' + name.replace(/\W+/g, '_'));
    throw e;
  }
}

await step('load hero', async () => {
  await page.goto(BASE);
  await page.waitForSelector('#hero', { timeout: 8000 });
  await shot('01-hero');
});

await step('take the job', async () => {
  await clickText('Take the job');
  await page.waitForSelector('#obcity');
  await shot('02-name');
});

await step('name -> colours', async () => {
  await clickText('Next');
  await page.waitForSelector('#wheel');
  await page.locator('.gcell').nth(5).click();
  await shot('03-colours');
});

await step('colours -> class', async () => {
  await clickText('Next');
  await page.waitForSelector('.classcard');
  await page.locator('.classcard').nth(2).click();
  await shot('04-class');
});

await step('class -> vibe', async () => {
  await clickText('Next');
  await page.waitForSelector('.vcell');
  await shot('05-vibe');
});

await step('vibe -> paperwork', async () => {
  await clickText('Next');
  await page.waitForSelector('#obcode');
  const code = await page.locator('#obcode').textContent();
  if (!/^[A-Z2-9]{6}$/.test(code || '')) throw new Error('bad league code: ' + code);
  await shot('06-paperwork');
});

await step('open the draft', async () => {
  await clickText('Open the draft');
  await page.waitForSelector('#drdeck .dcard', { timeout: 8000 });
  await shot('07-draft');
});

await step('draft 12 rounds', async () => {
  for (let i = 0; i < 14; i++) {
    const btn = page.locator('#drdeck .dcard[data-di="0"] [data-act="drtake"]');
    if (!(await btn.count())) break;
    await btn.click({ timeout: 8000 });
    await page.waitForTimeout(450);
    const stillDrafting = await page.locator('#drdeck .dcard').count();
    if (!stillDrafting) break;
  }
  await shot('08-after-draft');
});

await step('club tab shows scenario', async () => {
  // the draft-complete path routes to club automatically; make sure we are there
  await page.locator('.tab[data-tab="club"]').click();
  await page.waitForSelector('#v-club');
  await page.waitForSelector('#sccard', { timeout: 5000 });
  await shot('09-club-scenario');
});

await step('resolve scenario', async () => {
  await page.locator('[data-act="scchoice"]').first().click();
  await page.waitForTimeout(700);
  await shot('10-scenario-done');
});

await step('play the series', async () => {
  await page.locator('[data-act="series"]').click();
  await page.waitForSelector('[data-anim="g"]', { timeout: 8000 });
  await shot('11-recap');
  await page.locator('[data-act="closesheet"]').click();
  await page.waitForTimeout(400);
});

for (const tab of ['roster', 'market', 'park', 'league']) {
  await step('tab ' + tab, async () => {
    await page.locator(`.tab[data-tab="${tab}"]`).click();
    await page.waitForSelector(`#v-${tab}`);
    const text = await page.locator(`#v-${tab}`).innerText();
    if (text.trim().length < 40) throw new Error('view looks empty');
    await page.waitForTimeout(900); /* let the entrance stagger finish */
    const visible = await page.locator(`#v-${tab} .panel`).first().evaluate(
      (el) => parseFloat(getComputedStyle(el).opacity) > 0.9
    ).catch(() => true);
    if (!visible) throw new Error('panels stayed invisible after animation');
    await shot('12-' + tab);
  });
}

await step('reload restores save', async () => {
  await page.reload();
  await page.waitForSelector('#views .view', { timeout: 8000 });
  const onboardVisible = await page.locator('#onboard').isVisible().catch(() => false);
  if (onboardVisible) throw new Error('onboarding shown after reload — save did not restore');
  await shot('13-reloaded');
});

await browser.close();

if (errors.length) {
  console.log('\nJS errors seen:');
  errors.forEach((e) => console.log(' -', e));
  process.exit(1);
}
console.log('\nSmoke test passed with no JS errors.');
