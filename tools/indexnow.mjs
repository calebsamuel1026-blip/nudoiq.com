#!/usr/bin/env node
// Ping IndexNow so Bing, Yandex, Seznam and Naver re-crawl nudoiq.com within
// minutes of a deploy instead of whenever they next happen to come round.
// Google does not participate — Google is covered by the Search Console
// sitemap (submitted 2026-09-15) and by its own crawl schedule.
//
// Run AFTER the site is live, never before: IndexNow verifies the key file at
// https://nudoiq.com/<KEY>.txt on every call, and a URL that 404s when the
// crawler arrives is worse than not having pinged at all.
//
//   node tools/indexnow.mjs                 # ping every URL in sitemap.xml
//   node tools/indexnow.mjs /  /es/         # ping only these paths
//
// The key file must stay deployed. Deleting it silently disables this.

import fs from 'node:fs';

const KEY = '635f3e59e49fb63fec7965e3210faf43';
const HOST = 'nudoiq.com';
const ENDPOINT = 'https://api.indexnow.org/IndexNow';

function urlsFromSitemap() {
  const xml = fs.readFileSync(new URL('../sitemap.xml', import.meta.url), 'utf8');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

const args = process.argv.slice(2);
const urlList = args.length
  ? args.map((p) => (p.startsWith('http') ? p : `https://${HOST}${p.startsWith('/') ? p : '/' + p}`))
  : urlsFromSitemap();

if (!urlList.length) {
  console.error('No URLs to submit.');
  process.exit(1);
}

// The key file has to be reachable before the ping, or the whole batch is
// rejected. Check it rather than discovering the failure in a 403.
const probe = await fetch(`https://${HOST}/${KEY}.txt`).catch(() => null);
if (!probe || !probe.ok) {
  console.error(`Key file not live at https://${HOST}/${KEY}.txt — deploy it first.`);
  process.exit(1);
}
const probeBody = (await probe.text()).trim();
if (probeBody !== KEY) {
  console.error(`Key file content mismatch: expected ${KEY}, got "${probeBody.slice(0, 40)}".`);
  process.exit(1);
}

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: `https://${HOST}/${KEY}.txt`,
    urlList,
  }),
});

// 200 and 202 both mean accepted; 202 means the key is still being validated.
console.log(`IndexNow ${res.status} ${res.statusText} — ${urlList.length} URL(s)`);
urlList.forEach((u) => console.log('  ' + u));
if (!res.ok && res.status !== 202) {
  console.error(await res.text());
  process.exit(1);
}
