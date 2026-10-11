// Optional smoke test: start Delta without Firebase env vars at localhost:3000,
// install Playwright, then run `node tests/bank-import.browser.mjs`.
// Uses an isolated Chrome profile and synthetic local-only data.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
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
    const payload = { version: 1, bank: 'boursobank', accountRef: 'a'.repeat(64), currency: 'EUR', warnings: [], transactions: [
      { sourceId: 'fee', date: '2026-10-06', amountCents: -690, name: 'Bank fee', description: 'BANK FEE', bankCategory: 'Fees' },
      { sourceId: 'transfer', date: '2026-10-07', amountCents: 100000, name: 'Incoming transfer', description: 'TRANSFER', bankCategory: 'Transfers' },
      { sourceId: 'lunch', date: '2026-10-08', amountCents: -1200, name: 'Lunch', description: 'RESTAURANT', bankCategory: 'Food' },
    ] };
    window.addEventListener('message', event => {
      if (event.data?.type === 'delta-bank-import:request') window.postMessage({ type: 'delta-bank-import:payload', token: event.data.token, payload }, location.origin);
    });
  });
  await page.goto('http://localhost:3000/import#bank-import=12345678-1234-1234-1234-123456789abc');
  await page.getByText('BoursoBank · 3 loaded transactions').waitFor();
  await page.getByLabel('Delta account for this bank account').selectOption('a');
  await page.locator('fieldset').nth(2).waitFor();
  const validate = page.getByRole('button', { name: 'Validate 2 transactions', exact: true });
  await validate.waitFor();
  assert.equal(await page.locator('fieldset').nth(0).getByRole('checkbox').first().isChecked(), false);
  await page.locator('fieldset').nth(1).locator('select').first().selectOption('transfer');
  await validate.click();
  await page.getByRole('alert').filter({ hasText: 'choose the other transfer account' }).waitFor();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('delta_dev-user-001_transactions')).length), 1);
  await page.locator('fieldset').nth(1).locator('select').nth(1).selectOption('b');
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
  const lunch = saved.find(t => t.name === 'Lunch');
  assert.equal(lunch.myShareAmount, 3);
  assert.equal(lunch.description, 'Business lunch');
  assert.deepEqual(lunch.tagIds, ['tag']);
  await page.reload();
  await page.getByText('BoursoBank · 3 loaded transactions').waitFor();
  await page.getByLabel('Delta account for this bank account').selectOption('a');
  const empty = page.getByRole('button', { name: 'Validate 0 transactions', exact: true });
  await empty.waitFor();
  assert.equal(await empty.isDisabled(), true);
  await page.getByRole('button', { name: 'Clear draft', exact: true }).click();
  await page.getByText('Draft cleared. Saved transactions remain in Delta.').waitFor();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('delta_dev-user-001_transactions')).length), 3);
  assert.deepEqual(errors, []);
  console.log('PASS: mobile layout, duplicate exclusion, validation, incoming transfer, shared share, tags/notes, saving, repeat import and clearing.');
} finally {
  await browser.close();
}
