import { writeFileSync, readFileSync } from 'node:fs';
import { extractBankTransactions } from './bank-extractors.mjs';

const header = `// ==UserScript==
// @name         Delta — CIC & BoursoBank import
// @namespace    https://delta-d85d8.web.app
// @version      1.1.0
// @description  Review loaded bank transactions in Delta before saving.
// @match        https://www.cic.fr/fr/banque/mouvements.html*
// @match        https://clients.boursobank.com/compte/*
// @match        https://delta-d85d8.web.app/*
// @match        http://localhost:3000/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_openInTab
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @noframes
// ==/UserScript==
`;
const runtime = readFileSync(new URL('./userscript-runtime.js', import.meta.url), 'utf8');
writeFileSync(new URL('../public/delta-bank-import.user.js', import.meta.url), `${header}\n(function () {\n'use strict';\n${extractBankTransactions.toString()}\n${runtime}\n})();\n`);
