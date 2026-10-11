// Optional smoke test: start Delta without Firebase env vars at localhost:3000,
// install Playwright, then run `node tests/bank-import.browser.mjs`.
// Uses an isolated Chrome profile and synthetic local-only data.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
  const choose = async (scope, label, option) => {
    await scope.getByRole('button', { name: label, exact: true }).click();
    await scope.getByRole('option', { name: option, exact: true }).click();
  };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const uid = 'dev-user-001';
    if (!localStorage.getItem('smoke-seeded')) {
      const now = Date.now();
      localStorage.setItem('delta_local_user', JSON.stringify({ uid, email: 'test@example.invalid' }));
      const state = {
        accounts: [
          { id: 'a', name: 'Bank A', type: 'regular', isShared: true, defaultMyShareRatio: 0.5, createdAt: now, updatedAt: now },
          { id: 'b', name: 'Bank B', type: 'regular', createdAt: now, updatedAt: now },
        ],
        categories: [{ id: 'unc', label: 'Uncategorized', type: 'both', createdAt: now, updatedAt: now }],
        tags: [{ id: 'tag', label: 'Work', createdAt: now, updatedAt: now }],
        recurring: [],
        settings: { currency: 'EUR', initialized: true, darkMode: false, createdAt: now, updatedAt: now },
        transactions: [{ id: 'manual', name: 'Already recorded fee', amount: 6.9, date: new Date(2026, 9, 6, 12).getTime(), accountId: 'a', categoryId: 'unc', tagIds: [], type: 'expense', status: 'normal', createdAt: now, updatedAt: now }],
      };
      for (const [key, value] of Object.entries(state)) localStorage.setItem(`delta_${uid}_${key}`, JSON.stringify(value));
      localStorage.setItem('smoke-seeded', 'true');
    }
    const payload = { version: 2, bank: 'boursobank', accountRef: 'a'.repeat(64), currency: 'EUR', warnings: [], transactions: [
      { sourceId: 'fee', date: '2026-10-06', amountCents: -690, name: 'Bank fee', description: 'BANK FEE', bankCategory: 'Fees' },
      { sourceId: 'transfer', date: '2026-10-07', amountCents: 100000, name: 'Incoming transfer', description: 'TRANSFER', bankCategory: 'Transfers' },
      { sourceId: 'lunch', date: '2026-10-08', amountCents: -1200, name: 'Lunch', description: 'RESTAURANT', bankCategory: 'Food', status: 'pending' },
    ] };
    window.addEventListener('message', event => {
      if (event.data?.type === 'delta-bank-import:request') {
        if (new URLSearchParams(location.search).has('isolated-world')) return;
        const type = new URLSearchParams(location.search).has('expired-draft') ? 'delta-bank-import:expired' : 'delta-bank-import:payload';
        window.postMessage({ type, token: event.data.token, payload }, location.origin);
      }
    });
  });
  await page.goto('http://localhost:3000/import#bank-import=12345678-1234-1234-1234-123456789abc');
  await page.getByText('3 loaded transactions', { exact: true }).waitFor();
  await page.locator('fieldset').nth(2).waitFor();
  const lunchSelection = page.getByRole('checkbox', { name: 'Select Lunch', exact: true });
  assert.equal(await lunchSelection.isEnabled(), true);
  await lunchSelection.uncheck();
  await choose(page, 'Delta account for this bank account', 'Bank A');
  assert.equal(await lunchSelection.isChecked(), false);
  await lunchSelection.focus();
  await page.keyboard.press('Space');
  assert.equal(await lunchSelection.isChecked(), true);
  assert.equal(await page.locator('fieldset').nth(2).getByLabel('Notes', { exact: true }).inputValue(), '');
  assert.equal(await page.locator('fieldset').nth(2).getByRole('button', { name: 'Status', exact: true }).innerText(), 'Pending');
  const validate = page.getByRole('button', { name: 'Validate 2 transactions', exact: true });
  await validate.waitFor();
  assert.equal(await page.locator('fieldset').nth(0).getByRole('checkbox').first().isChecked(), false);
  await choose(page.locator('fieldset').nth(1), 'Type', 'Transfer between my accounts');
  await validate.click();
  await page.getByRole('alert').filter({ hasText: 'choose the other transfer account' }).waitFor();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('delta_dev-user-001_transactions')).length), 1);
  await choose(page.locator('fieldset').nth(1), 'From account', 'Bank B');
  await page.locator('fieldset').nth(2).getByLabel('My share (%)').fill('25');
  await page.locator('fieldset').nth(2).getByLabel('Notes').fill('Business lunch');
  await page.locator('fieldset').nth(2).getByText('Tags (0)').click();
  await page.locator('fieldset').nth(2).getByLabel('Work', { exact: true }).check();
  if (process.env.IMPORT_SCREENSHOT) await page.screenshot({ path: process.env.IMPORT_SCREENSHOT, fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await validate.click();
  await page.getByRole('status').filter({ hasText: '2 imported.' }).waitFor();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('delta_dev-user-001_transactions')));
  assert.equal(saved.length, 3);
  const transfer = saved.find(t => t.name === 'Incoming transfer');
  assert.equal(transfer.type, 'transfer');
  assert.equal(transfer.accountId, 'b');
  assert.equal(transfer.transferAccountId, 'a');
  assert.equal(transfer.description, '');
  const lunch = saved.find(t => t.name === 'Lunch');
  assert.equal(lunch.myShareAmount, 3);
  assert.equal(lunch.description, 'Business lunch');
  assert.deepEqual(lunch.tagIds, ['tag']);
  assert.equal(lunch.status, 'pending');
  await page.reload();
  await page.getByText('3 loaded transactions', { exact: true }).waitFor();
  await choose(page, 'Delta account for this bank account', 'Bank A');
  const empty = page.getByRole('button', { name: 'Validate 0 transactions', exact: true });
  await empty.waitFor();
  assert.equal(await empty.isDisabled(), true);
  await page.getByRole('button', { name: 'Clear draft', exact: true }).click();
  await page.getByText('Draft cleared. Saved transactions remain in Delta.').waitFor();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('delta_dev-user-001_transactions')).length), 3);
  await page.goto('http://localhost:3000/import?expired-draft#bank-import=12345678-1234-1234-1234-123456789abc');
  await page.getByRole('alert').filter({ hasText: 'This draft has expired.' }).waitFor();
  // Wait beyond the bridge timeout: an actual reply must never become "no response".
  await page.waitForTimeout(10500);
  assert.match(await page.getByRole('alert').innerText(), /This draft has expired/);
  assert.equal(await page.getByText('No userscript response.', { exact: false }).count(), 0);
  // Exercise the actual generated userscript in a separate Chromium world.
  // Disable its legacy postMessage sender to prove the DOM transport works alone.
  await page.goto('http://localhost:3000/import?isolated-world#bank-import=12345678-1234-1234-1234-123456789abc');
  const cdp = await page.context().newCDPSession(page);
  const { frameTree } = await cdp.send('Page.getFrameTree');
  const { executionContextId } = await cdp.send('Page.createIsolatedWorld', { frameId: frameTree.frame.id, worldName: 'delta-userscript-test' });
  const isolatedPayload = { version: 2, bank: 'boursobank', accountRef: 'a'.repeat(64), currency: 'EUR', warnings: [], transactions: [
    { sourceId: 'isolated', date: '2026-10-09', amountCents: -505, name: 'Isolated-world transaction', description: 'SYNTHETIC', bankCategory: 'Food' },
  ] };
  const injected = await cdp.send('Runtime.evaluate', { contextId: executionContextId, expression: `
    const entries = new Map([['delta-import:12345678-1234-1234-1234-123456789abc', {createdAt: Date.now(), payload: ${JSON.stringify(isolatedPayload)}}]]);
    globalThis.GM_listValues = () => [...entries.keys()];
    globalThis.GM_getValue = key => entries.get(key);
    globalThis.GM_deleteValue = key => entries.delete(key);
    window.postMessage = () => {};
    ${readFileSync('public/delta-bank-import.user.js', 'utf8')}
  ` });
  assert.equal(injected.exceptionDetails, undefined);
  await page.getByText('1 loaded transactions', { exact: true }).waitFor();
  await choose(page, 'Delta account for this bank account', 'Bank A');
  await page.getByRole('button', { name: 'Validate 1 transactions', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Clear draft', exact: true }).click();
  const remaining = await cdp.send('Runtime.evaluate', { contextId: executionContextId, expression: 'entries.size', returnByValue: true });
  assert.equal(remaining.result.value, 0);
  assert.deepEqual(errors, []);
  console.log('PASS: mobile layout, duplicate exclusion, validation, incoming transfer, shared share, tags/notes, saving, repeat import, clearing, expired-draft timeout, and isolated-world DOM bridge.');
} finally {
  await browser.close();
}
