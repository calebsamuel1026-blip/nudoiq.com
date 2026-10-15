#!/usr/bin/env node
// Stamp UTMs on every Chrome Web Store link that has none, so the Web Store dashboard can split installs by page.
//
//   node tools/stamp-store-utm.mjs            stamp every tracked page (idempotent; prints what changed)
//   node tools/stamp-store-utm.mjs --check    exit 1 if any page still has an unstamped store link
//
// Added 2026-10-14 (research/funnel/FUNNEL-LEAK-AUDIT-2026-10-14.md, leak 3). Scheme (Caleb, 2026-10-14):
//   utm_source=nudoiq.com&utm_medium=site&utm_campaign=<page-slug>
// <page-slug> is the page path with "/" turned into "-": /amazon-relay-load-board/ -> amazon-relay-load-board,
// /es/amazon-relay-pagos/ -> es-amazon-relay-pagos, /privacy.html -> privacy.
//
// A link that already carries utm_source is left alone (the Russian pages use utm_medium=ru on purpose).
// Runtime scripts still win at click time: the gclid / msclkid blocks set google / bing, and mobile-bridge.js and
// the /m/ script pass a landing URL's own UTMs through (an email or social arrival keeps its campaign).
// The home page and /es/ are skipped: build-es.mjs generates /es/ from /, and mobile-bridge.js stamps both at click.
// Generators call stampHtml() on their output (build-guides, build-lane-pages, build-support, build-android) so a
// rebuild cannot drop the UTMs.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LINK = /href="(https:\/\/chromewebstore\.google\.com\/detail\/[^"#]*?)(#[^"]*)?"/g;
const SKIP = new Set(['index.html', 'es/index.html']);

export function slugFor(rel) {
  const p = rel.replace(/\\/g, '/').replace(/(^|\/)index\.html$/, '').replace(/\.html$/, '').replace(/\/+$/, '');
  return (p || 'home').replace(/\//g, '-').replace(/[^a-z0-9.-]/gi, '').slice(0, 80) || 'home';
}

export function stampHtml(html, slug) {
  return html.replace(LINK, (m, url, hash) => {
    if (/[?&](amp;)?utm_source=/.test(url)) return m;
    const sep = url.includes('?') ? '&amp;' : '?';
    return `href="${url}${sep}utm_source=nudoiq.com&amp;utm_medium=site&amp;utm_campaign=${slug}${hash || ''}"`;
  });
}

export function stampFile(abs) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  if (SKIP.has(rel)) return false;
  const before = fs.readFileSync(abs, 'utf8');
  const after = stampHtml(before, slugFor(rel));
  if (after !== before) { fs.writeFileSync(abs, after); return true; }
  return false;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const check = process.argv.includes('--check');
  const files = execSync('git ls-files "*.html"', { cwd: ROOT, encoding: 'utf8' }).split('\n')
    .filter((f) => f && !/variants\/|\.bak|backup/.test(f) && !SKIP.has(f));
  let bad = 0, changed = 0;
  for (const f of files) {
    const abs = path.join(ROOT, f);
    const html = fs.readFileSync(abs, 'utf8');
    const out = stampHtml(html, slugFor(f));
    if (out === html) continue;
    if (check) { bad++; console.log('unstamped:', f); continue; }
    fs.writeFileSync(abs, out); changed++; console.log('stamped:', f, '->', slugFor(f));
  }
  console.log(check ? `${bad} page(s) with unstamped store links` : `${changed} page(s) stamped`);
  if (check && bad) process.exit(1);
}
