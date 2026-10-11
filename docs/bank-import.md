# CIC and BoursoBank import

## Install and use

1. Deploy the updated Delta app before using the production destination. The existing hosted app will not recognize `/import` until it is updated.
2. Install Tampermonkey in your browser. Open `/delta-bank-import.user.js` on your updated Delta site and accept the userscript installation, or paste `public/delta-bank-import.user.js` into a new Tampermonkey script and save.
3. Log into a bank normally and open an individual account’s movements. The script opens a Delta draft automatically once the list appears. Tampermonkey’s script menu can disable automatic opening.
4. In Delta, sign in if needed, choose the corresponding account, check the selected rows, and fill in categories, tags, names and notes. For shared accounts, check your share. Mark internal movements as transfers and select the other account.
5. Click **Validate** to save. Successful rows are marked individually; a failure leaves the remaining rows available for retry. **Clear draft** removes the temporary handoff without deleting saved transactions.

For local testing, run Delta at `http://localhost:3000`. On the bank page, use Tampermonkey’s **Delta: toggle localhost development destination** menu before collecting. Switch back for production.

## Extraction scope and matching

- Only DOM-loaded booked EUR movements are read. The script does not call bank APIs, log in, click bank controls, or load history itself. Use **Mouvements précédents** (BoursoBank) or **Plus d’opérations** (CIC), then the floating Delta button to collect again.
- Booking dates are used, not purchase dates embedded in card descriptions. Bourso pending card authorizations are excluded. Unknown statuses, malformed amounts/dates, and unreadable rows are excluded with counts.
- BoursoBank IDs identify transactions. CIC’s positional row IDs are deliberately ignored: fallback identity uses bank, hashed bank account, booking date, signed cents, original description and occurrence within the loaded list. Changing the loaded subset of identical CIC payments can change occurrence identity. Review matching entries; do not assume CIC matching is definitive.
- Existing Delta entries with the same account, local booking day and signed amount are flagged and initially unchecked, regardless of description. Identical entries within a draft are also initially unchecked. You may explicitly select legitimate separate payments.
- A deterministic Firestore document ID and a transaction prevent the same import identity from being created twice across tabs. Existing entries are never overwritten. Deleting an imported transaction allows importing it again. Local-only mode uses local storage and does not provide cross-tab atomic writes.
- Import an internal transfer only once. The other account’s bank entry will be a possible duplicate when its date and amount agree; differing booking dates require manual review. No automatic transfer pairing or foreign-currency conversion is performed.

## Data flow

The same userscript runs on the two bank domains and Delta. It keeps each draft in Tampermonkey storage under a random token and opens `/import#bank-import=<token>`. Transaction contents are never placed in the URL. The account identifier is SHA-256 hashed before handoff. Bank HTML, full URLs, anti-forgery tokens, cookies and credentials are not copied. Original bank descriptions may contain personal information and are retained as transaction metadata after validation.

The Delta page requests the token’s draft through DOM events in the same document, using JSON string details to cross userscript isolation boundaries. The userscript only accepts a DOM request for the token in the current page’s fragment. A same-origin, same-window message bridge remains for v1 compatibility. Drafts expire after 30 minutes; expired entries are removed the next time the script runs. Clearing a draft removes it immediately from userscript storage. A draft already displayed remains in memory until cleared or the page closes. No writes occur until validation in the signed-in Delta account.

If an enabled script produces **No userscript response**, update both the app and the installed userscript (version 1.0.1 or newer), reload both tabs, and create a fresh draft from the bank. Updating Git or deploying the app does not replace an already-installed Tampermonkey script: open the hosted `/delta-bank-import.user.js` link and confirm the update in Tampermonkey.

## Development

`scripts/bank-extractors.mjs` is the shared extractor, embedded unchanged into the installable script by `npm run build:userscript`. Runtime bridge/UI code is in `scripts/userscript-runtime.js`. Regenerate the public userscript after editing either source.

Run `npm run test:bank-import`, `npm run lint`, and `npm run build`. Tests use synthetic HTML based on the supplied page structures; raw bank samples must not be committed. Live Tampermonkey behavior and authenticated Firestore writes still need a user smoke test after deployment.

An optional browser smoke test is in `tests/bank-import.browser.mjs`. It needs Playwright and Chrome, and a local Delta server without Firebase environment variables. Run `node tests/bank-import.browser.mjs`; `PLAYWRIGHT_MODULE` may point to an existing Playwright module and `IMPORT_SCREENSHOT` may specify a screenshot path. The test uses an isolated browser profile with synthetic local storage only.
