#!/usr/bin/env node
// Apply a copywriter JSON handoff to index.html + tools/es-dictionary.json.
//
//   node tools/apply-copy.mjs ../research/copy/PLAIN-ENGLISH-2026-09-15.json
//
// The JSON is { "dataTKey": { "en": "...", "es": "..." }, ... }.
//
// Why this exists rather than a pile of sed: every visible string on this site
// is a [data-t] leaf, English lives in index.html and Spanish lives in the
// dictionary, and the two have to move together or `node tools/build-es.mjs`
// fails. Doing it by hand is how a key ends up English-only on /es/.
//
// It refuses to write anything if a key is missing from either side, and it
// refuses copy containing an em dash, because that is the rule that prompted
// this pass in the first place.
import fs from 'node:fs';
import path from 'node:path';

const file = process.argv[2];
if (!file) {
  console.error('usage: node tools/apply-copy.mjs <copy.json>');
  process.exit(1);
}
const copy = JSON.parse(fs.readFileSync(file, 'utf8'));
const htmlPath = 'index.html';
const dictPath = 'tools/es-dictionary.json';

let html = fs.readFileSync(htmlPath, 'utf8');
const dict = JSON.parse(fs.readFileSync(dictPath, 'utf8'));

const problems = [];
const DASH = /[—–]/;

for (const [key, val] of Object.entries(copy)) {
  if (!val || typeof val.en !== 'string' || typeof val.es !== 'string') {
    problems.push(`${key}: needs both "en" and "es"`);
    continue;
  }
  if (DASH.test(val.en)) problems.push(`${key}: en still contains an em/en dash`);
  if (DASH.test(val.es)) problems.push(`${key}: es still contains an em/en dash`);
  if (!(key in dict)) problems.push(`${key}: not an existing dictionary key`);
  if (!new RegExp(`data-t="${key}"`).test(html)) problems.push(`${key}: not present in index.html`);
}
if (problems.length) {
  console.error('Refusing to write:\n  ' + problems.join('\n  '));
  process.exit(1);
}

// HTML entities, matching what build-es.mjs does on the way out.
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

let replaced = 0;
html = html.replace(/(data-t="([A-Za-z0-9]+)"[^>]*>)([^<]*)(<)/g, (whole, open, key, _body, close) => {
  if (!(key in copy)) return whole;
  replaced++;
  return open + esc(copy[key].en) + close;
});

for (const [key, val] of Object.entries(copy)) dict[key] = val.es;

fs.writeFileSync(htmlPath, html);
fs.writeFileSync(dictPath, JSON.stringify(dict, null, 2) + '\n');
console.log(`Applied ${Object.keys(copy).length} key(s), ${replaced} element(s) in ${path.basename(htmlPath)}.`);
console.log('Now run: node tools/build-es.mjs && node tools/check-i18n.mjs');
