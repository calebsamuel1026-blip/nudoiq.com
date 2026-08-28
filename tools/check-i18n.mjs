#!/usr/bin/env node
// Compares the translatable [data-t] keys on index.html and es/index.html and
// reports drift. Run after editing copy on either page.
//   node tools/check-i18n.mjs
import fs from 'node:fs';

// [data-t] elements are all leaf text nodes, so text runs to the next tag.
const RE = /data-t="([A-Za-z0-9]+)"[^>]*>([^<]*)</g;

function parse(file) {
  const map = new Map();
  for (const [, key, text] of fs.readFileSync(file, 'utf8').matchAll(RE)) {
    map.set(key, text.trim());
  }
  return map;
}

const en = parse('index.html');
const es = parse('es/index.html');

const missing = [...en.keys()].filter((k) => !es.has(k));
const orphan = [...es.keys()].filter((k) => !en.has(k));
const identical = [...en.keys()].filter(
  (k) => es.has(k) && es.get(k) === en.get(k) && en.get(k).length > 3
);

function report(label, keys) {
  if (!keys.length) return 0;
  console.log('');
  console.log(`${label} (${keys.length}):`);
  for (const k of keys) console.log(`  - ${k}`);
  return keys.length;
}

console.log(`index.html: ${en.size} keys | es/index.html: ${es.size} keys`);

let problems = 0;
problems += report('Missing from es/index.html', missing);
problems += report('Present in es/index.html but not index.html', orphan);
report('Identical in both (may be intentional, e.g. brand names)', identical);

if (problems) {
  console.log('');
  console.log(`${problems} key(s) out of sync.`);
  process.exit(1);
}
console.log('');
console.log('All translation keys are in sync.');
