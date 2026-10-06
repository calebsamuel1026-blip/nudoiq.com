#!/usr/bin/env node
// Build the Amazon Relay lane rate pages from NudoIQ's own board data.
//
//   node tools/build-lane-pages.mjs
//
// Data:  ../research/seo/lane-data-2026-10-05/lanes.json  (written by analyze.py in that folder; see METHOD.md)
// Words: ../research/seo/lane-data-2026-10-05/copy.json   (Martha's intro and FAQ answers; null = [[MARTHA: ...]] placeholder)
// Output: amazon-relay-rates/index.html (hub), amazon-relay-rates/<o>-to-<d>/index.html (one per lane),
//         amazon-relay-rates/<CSV> (aggregates only), and idempotent merges into sitemap.xml, llms.txt,
//         llms-full.txt and the /guides/ hub card list. Also writes MARTHA-PLACEHOLDERS.md next to the data.
//
// The <head> tracking block, header, CTA and footer are copied at build time from a current guide page
// (TEMPLATE below), so tracking stays identical to the guides. Numbers, table labels and data captions are
// generated from the data; customer-facing prose (intros, FAQ answers) comes only from copy.json.
//
// NOTE: tools/build-guides.mjs rewrites guides/index.html, llms.txt and llms-full.txt from scratch. Run this
// script again after build-guides.mjs, or the hub link and llms entries for these pages drop out.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.resolve(ROOT, '../research/seo/lane-data-2026-10-05');
const SITE = 'https://nudoiq.com';
const HUB = 'amazon-relay-rates';
const TEMPLATE = 'how-much-does-amazon-relay-pay';   // a current guide built by build-guides.mjs
const PUBLISHED = '2026-10-05';

const J = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'lanes.json'), 'utf8'));
const COPY = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'copy.json'), 'utf8'));
const P = J.params, N = J.national, LANES = J.lanes;
const CSV_NAME = `amazon-relay-lane-rates-${P.as_of}.csv`;
const UPDATED = P.as_of;

// ── formatting ───────────────────────────────────────────────────
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const usd0 = (v) => (v == null ? '–' : '$' + Math.round(v).toLocaleString('en-US'));
const usd2 = (v) => (v == null ? '–' : '$' + v.toFixed(2));
const pct = (v) => (v == null ? '–' : Math.round(v * 100) + '%');
const int = (v) => (v == null ? '–' : Math.round(v).toLocaleString('en-US'));
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dLong = (d) => { const [y, m, dd] = d.split('-').map(Number); return `${MONTHS[m - 1]} ${dd}, ${y}`; };
const dShort = (d) => { const [, m, dd] = d.split('-').map(Number); return `${MONTHS[m - 1].slice(0, 3)} ${dd}`; };
const range = (a, b) => (a.slice(0, 4) === b.slice(0, 4) ? `${dLong(a).replace(/, \d{4}$/, '')} to ${dLong(b)}` : `${dLong(a)} to ${dLong(b)}`);
const dur = (m) => (m == null ? '–' : m < 90 ? `${Math.round(m)} minutes` : `${(m / 60).toFixed(1)} hours`);
const durShort = (m) => (m == null ? '–' : m < 90 ? `${Math.round(m)} min` : `${(m / 60).toFixed(1)} h`);
const signed = (x) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(1) + '%';
const TRIP = { all: 'All loads', OW: 'One way', RT: 'Round trip', MS: 'Multi-stop', UNCLASSIFIED: 'Trip type not known' };
const laneName = (l) => `${l.o_name} to ${l.d_name}`;
const laneShort = (l) => `${l.o} to ${l.d}`;
const laneUrl = (l) => `/${HUB}/${l.slug}/`;
const SRC_PHRASE = 'from loads seen by NudoIQ users on the Amazon Relay board';

// ── template pieces copied from a current guide ──────────────────
const T = fs.readFileSync(path.join(ROOT, TEMPLATE, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const cut = (re, what) => { const m = T.match(re); if (!m) throw new Error(`template: ${what} not found in /${TEMPLATE}/`); return m[0]; };
const HEAD_TPL = cut(/^<!DOCTYPE html>[\s\S]*?<link rel="stylesheet" href="\/assets\/guide\.css">\n/, 'head block');
// Anything else the guide carries after its JSON-LD and before </head> (e.g. the Microsoft UET tag) is tracking too: keep it.
const HEAD_TAIL = cut(/<link rel="stylesheet" href="\/assets\/guide\.css">\n[\s\S]*?<\/head>/, 'head tail')
  .replace(/^<link[^\n]*\n/, '').replace(/<\/head>$/, '')
  .replace(/ *<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/g, '');
const TOP_TPL = cut(/<body[^>]*>[\s\S]*?<\/header>\n/, 'header');
const CTA_TPL = cut(/ {4}<aside class="cta">[\s\S]*?<\/aside>\n/, 'CTA');
const FOOT_TPL = cut(/ {4}<div class="footer">[\s\S]*$/, 'footer');
const TPL_TITLE = T.match(/<title>([^<]*)<\/title>/)[1];
const TPL_DESC = T.match(/<meta name="description" content="([^"]*)">/)[1];

function head({ title, description, url, slug, ld }) {
  let h = HEAD_TPL;
  const swap = (from, to, all = false) => {
    if (!h.includes(from)) throw new Error(`template: cannot find ${from.slice(0, 60)}`);
    h = all ? h.split(from).join(to) : h.replace(from, () => to);
  };
  swap(`<title>${TPL_TITLE}</title>`, `<title>${esc(title)}</title>`);
  swap(`content="${TPL_DESC}"`, `content="${esc(description)}"`, true);         // meta + og description
  swap(`content="${TPL_TITLE}"`, `content="${esc(title)}"`, true);               // og:title
  swap(`${SITE}/${TEMPLATE}/`, url, true);                                       // canonical + og:url
  swap(`content_name: "${TEMPLATE}"`, `content_name: ${JSON.stringify(slug)}`, true);
  return h + `  <link rel="stylesheet" href="/assets/lane-rates.css">\n` +
    ld.map((o) => `  <script type="application/ld+json">\n${JSON.stringify(o, null, 2)}\n  </script>`).join('\n') + '\n' + HEAD_TAIL + '</head>\n';
}

// ── Martha placeholders ──────────────────────────────────────────
const PH = [];   // collected for MARTHA-PLACEHOLDERS.md
function words(key, what, facts) {
  const v = key.split('.').reduce((o, k) => (o == null ? o : o[k]), COPY);
  if (typeof v === 'string' && v.trim()) return { text: v.trim(), ph: false };
  PH.push({ key, what, facts });
  return { text: `[[MARTHA: ${what} (key ${key}; facts in MARTHA-PLACEHOLDERS.md)]]`, ph: true };
}
const inlineMd = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
const show = (w) => (w.ph ? `<mark class="martha">${esc(w.text)}</mark>` : inlineMd(w.text));
const plain = (s) => s.replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

// ── shared bits ──────────────────────────────────────────────────
const crumbs = (items) => items.map(([n, u]) => (u ? `<a href="${u}">${esc(n)}</a>` : `<span aria-current="page">${esc(n)}</span>`)).join(' &nbsp;&rsaquo;&nbsp; ');
const crumbLd = (items) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([n, u], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: SITE + u })) });
const ORG = { '@type': 'Organization', '@id': `${SITE}/#organization`, name: 'NudoIQ', url: `${SITE}/`,
  logo: `${SITE}/brand/mark/icon128.png`, email: 'contact@nudoiq.com',
  sameAs: ['https://chromewebstore.google.com/detail/nudoiq/bjilnjgfdndecmamphkkcpplfmniocgk', 'https://t.me/nudoiqsupport'] };
const PUBLISHER = { '@type': 'Organization', '@id': `${SITE}/#organization`, name: 'NudoIQ', logo: { '@type': 'ImageObject', url: `${SITE}/brand/mark/icon128.png` } };
const VARIABLES = [
  ['Final board price', 'USD', 'Median and interquartile range of the last price a NudoIQ user saw on the Amazon Relay board for each load'],
  ['Rate per mile', 'USD per mile', 'Final board price divided by the load miles shown on the board'],
  ['Load miles', 'miles', 'Miles shown on the board; round-trip miles include the return leg'],
  ['Time on the board', 'minutes', 'First to last sighting, for loads seen leaving while the lane was still being watched'],
  ['Share of loads raised in price', 'percent', 'Loads whose board price went up at least once while posted'],
  ['Trip type', 'one way / round trip', 'Loads split by trip type so round trips are compared with round trips'],
].map(([name, unitText, description]) => ({ '@type': 'PropertyValue', name, unitText, description }));

function datasetLd({ name, description, url, spatial, first, last, keywords }) {
  return { '@context': 'https://schema.org', '@type': 'Dataset', '@id': `${url}#dataset`, name, description, url,
    creator: { '@id': `${SITE}/#organization` }, publisher: { '@id': `${SITE}/#organization` },
    datePublished: PUBLISHED, dateModified: UPDATED, temporalCoverage: `${first}/${last}`,
    spatialCoverage: { '@type': 'Place', name: spatial }, variableMeasured: VARIABLES, isAccessibleForFree: true,
    measurementTechnique: 'Distinct Amazon Relay loads seen on the load board by users of the NudoIQ browser extension, deduplicated by load ID; medians and interquartile ranges by trip type.',
    keywords: ['Amazon Relay', 'Amazon Relay rates', 'rate per mile', 'load board', ...keywords],
    distribution: [{ '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: `${SITE}/${HUB}/${CSV_NAME}` }] };
}
function articleLd({ headline, description, url, abstract }) {
  return { '@context': 'https://schema.org', '@type': 'Article', headline, description, abstract, mainEntityOfPage: url, url,
    image: `${SITE}/assets/og-image-1200x630.png`, datePublished: PUBLISHED, dateModified: UPDATED, inLanguage: 'en-US',
    author: { '@type': 'Organization', name: 'NudoIQ', url: `${SITE}/` }, about: { '@id': `${SITE}/#software` },
    isBasedOn: { '@id': `${url}#dataset` }, publisher: PUBLISHER };
}
const faqLd = (faq) => ({ '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: plain(f.a.text) } })) });

const statCards = (cards) => `<div class="lr-stats">${cards.map(([v, l, s]) =>
  `<div class="lr-stat"><p class="v">${v}</p><p class="l">${esc(l)}</p>${s ? `<p class="s">${esc(s)}</p>` : ''}</div>`).join('')}</div>`;

function table({ caption, cols, rows, cls = '' }) {
  return `<div class="tbl"><table class="lr-t ${cls}"><caption><span class="cap">${esc(caption)}</span></caption><thead><tr>${cols.map((c, i) =>
    `<th scope="col"${i ? ' class="num"' : ''}>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) =>
    `<tr>${r.map((c, i) => (i ? `<td class="num">${c}</td>` : `<th scope="row">${c}</th>`)).join('')}</tr>`).join('')}</tbody></table></div>`;
}

// Range chart: one row per group, bar = middle 50% of rate per mile, dot = median. Inline SVG, no libraries.
// Two copies (wide and narrow viewBox) so the text stays readable at 1440 and at 375; CSS shows one.
function rangeSvg({ id, title, rows, W, fs, desc }) {
  const padL = 4, padR = 4, rowH = fs * 3.7, top = 6;
  const vals = rows.flatMap((r) => [r.p25, r.p75]).filter((v) => v != null);
  const lo = Math.max(0, Math.floor(Math.min(...vals) * 2) / 2 - 0.5), hi = Math.ceil(Math.max(...vals) * 2) / 2 + 0.5;
  const x = (v) => padL + ((v - lo) / (hi - lo)) * (W - padL - padR);
  const axisY = top + rows.length * rowH + 4;
  const H = Math.ceil(axisY + fs * 1.6);
  const step = (hi - lo) / (W < 400 ? 4 : 6) > 0.5 ? 1 : 0.5;
  const ticks = []; for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) ticks.push(t);
  const g = rows.map((r, i) => {
    const y = top + i * rowH, by = y + fs * 1.75;
    return `<g><text x="${padL}" y="${(y + fs).toFixed(1)}" class="lab" font-size="${fs}">${esc(r.label)}</text><text x="${W - padR}" y="${(y + fs).toFixed(1)}" class="val" text-anchor="end" font-size="${fs}">${usd2(r.med)}/mi</text>` +
      `<rect x="${padL}" y="${by.toFixed(1)}" width="${W - padL - padR}" height="${fs * 0.7}" rx="${fs * 0.35}" class="track"/>` +
      `<rect x="${x(r.p25).toFixed(1)}" y="${by.toFixed(1)}" width="${Math.max(2, x(r.p75) - x(r.p25)).toFixed(1)}" height="${fs * 0.7}" rx="${fs * 0.35}" class="iqr"/>` +
      `<circle cx="${x(r.med).toFixed(1)}" cy="${(by + fs * 0.35).toFixed(1)}" r="${(fs * 0.48).toFixed(1)}" class="med"/></g>`;
  }).join('');
  const axis = ticks.map((t) => `<line x1="${x(t).toFixed(1)}" x2="${x(t).toFixed(1)}" y1="${top + fs * 1.4}" y2="${axisY}" class="grid"/><text x="${Math.min(W - fs * 1.5, Math.max(fs * 1.5, x(t))).toFixed(1)}" y="${(axisY + fs * 1.3).toFixed(1)}" text-anchor="middle" class="tick" font-size="${(fs * 0.85).toFixed(1)}">${usd2(t)}</text>`).join('');
  return `<svg class="lr-svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-t ${id}-d"><title id="${id}-t">${esc(title)}</title><desc id="${id}-d">${esc(desc)}</desc>${axis}${g}</svg>`;
}
function rangeChart({ id, title, rows, note }) {
  const desc = rows.map((r) => `${r.label}: median ${usd2(r.med)} per mile, middle half ${usd2(r.p25)} to ${usd2(r.p75)}`).join('; ');
  return `<figure class="lr-chart" id="${id}"><figcaption>${esc(title)}</figcaption>
<div class="lr-wide">${rangeSvg({ id: `${id}-w`, title, rows, W: 640, fs: 13.5, desc })}</div>
<div class="lr-narrow">${rangeSvg({ id: `${id}-n`, title, rows, W: 340, fs: 13, desc })}</div>
<p class="lr-key"><span class="k-iqr"></span>Middle 50% of loads <span class="k-med"></span>Median${note ? ` &middot; ${esc(note)}` : ''}</p></figure>`;
}

// Medians first, ranges after, so the key numbers are visible before a phone has to scroll the table sideways.
const rateRow = (label, b) => (b && b.n >= P.min_sub && b.pay_med != null
  ? [esc(label), int(b.n), usd0(b.pay_med), usd2(b.rpm_med), int(b.miles_med), `${usd0(b.pay_p25)}–${usd0(b.pay_p75)}`, `${usd2(b.rpm_p25)}–${usd2(b.rpm_p75)}`]
  : [esc(label), int(b ? b.n : 0), `<span class="lr-few">Fewer than ${P.min_sub} loads</span>`, '', '', '', '']);
const RATE_COLS = ['Trip type', 'Loads', 'Median final price', 'Median per mile', 'Median miles', 'Middle 50% price', 'Middle 50% per mile'];

function dwellTable(b, scope) {
  if (b.dep_mins_med == null) return `<p class="lr-note">Not enough loads were seen leaving the board ${scope} to report a time on the board (${int(b.dep_n)} seen; ${P.min_dwell} needed).</p>`;
  return table({ caption: `Time on the board ${scope}: ${int(b.dep_n)} loads seen leaving the board while the lane was still being watched, first seen ${range(b.first_date, b.last_date)}, ${SRC_PHRASE}.`,
    cls: 'lr-kv', cols: ['Measure', 'Value'], rows: [
      ['Median time from first to last sighting', dur(b.dep_mins_med)],
      ['Middle 50% of loads', `${durShort(b.dep_mins_p25)} to ${durShort(b.dep_mins_p75)}`],
      ['Gone within 30 minutes of first sighting', pct(b.dep_share_30)],
      ['Still posted more than 4 hours after first sighting', pct(b.dep_share_240)],
    ] });
}
function priceTable(b, scope) {
  return table({ caption: `Price changes ${scope}: ${int(b.n)} distinct loads first seen ${range(b.first_date, b.last_date)}, ${SRC_PHRASE}.`,
    cls: 'lr-kv', cols: ['Measure', 'Value'], rows: [
      ['Price raised at least once while posted', pct(b.share_raised)],
      ['Price cut at least once while posted', pct(b.share_cut)],
      ['Final price higher than first price seen', pct(b.share_ended_higher)],
      ['Final price lower than first price seen', pct(b.share_ended_lower)],
      ['Median rise, among loads that ended higher', b.raise_pct_med == null ? '–' : `${b.raise_pct_med.toFixed(1)}%`],
      ['Median first price seen / median final price', `${usd0(b.posted_pay_med)} / ${usd0(b.pay_med)}`],
    ] });
}
const GROUP_LABEL = { 'Morning (6-12)': 'Morning, 6 am to noon ET', 'Afternoon (12-18)': 'Afternoon, noon to 6 pm ET', 'Evening (18-24)': 'Evening, 6 pm to midnight ET',
  'Night (0-6)': 'Night, midnight to 6 am ET', 'Weekday (Mon-Fri)': 'Weekday (Mon–Fri)', 'Weekend (Sat-Sun)': 'Weekend (Sat–Sun)' };
function patternBlock(pats, scope) {
  const sig = pats.filter((p) => p.significant);
  if (!pats.length) return `<p class="lr-note">Too few one-way loads ${scope} to test time-of-day or weekday patterns.</p>`;
  const out = [];
  for (const p of sig) {
    const order = ['Morning (6-12)', 'Afternoon (12-18)', 'Evening (18-24)', 'Night (0-6)', 'Weekday (Mon-Fri)', 'Weekend (Sat-Sun)'];
    const rows = Object.entries(p.groups).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
      .map(([k, g]) => [esc(GROUP_LABEL[k] || k), int(g.n), usd2(g.rpm_med), int(g.miles_med), signed((g.adj_index / Math.min(...Object.values(p.groups).map((x) => x.adj_index)) - 1) * 100)]);
    const n = Object.values(p.groups).reduce((t, g) => t + g.n, 0);
    out.push(table({ caption: `Rate per mile by ${p.test.startsWith('part') ? 'time of day NudoIQ users first saw the load (Eastern Time)' : 'day of week'} ${scope}: ${int(n)} one-way loads, ${SRC_PHRASE}. Difference after allowing for trip length: ${p.test.includes('Kruskal') ? 'Kruskal-Wallis' : 'Mann-Whitney'} p ${p.p < 0.0001 ? '< 0.0001' : '= ' + p.p.toFixed(4)}.`,
      cols: ['When first seen', 'One-way loads', 'Median per mile', 'Median miles', 'Gap vs. lowest slot, same trip length'], rows }));
  }
  const nonsig = pats.filter((p) => !p.significant).map((p) => (p.test.startsWith('part') ? 'time of day' : 'weekday vs weekend'));
  if (nonsig.length) out.push(`<p class="lr-note">No clear difference by ${nonsig.join(' or ')} ${scope} (one-way loads, allowing for trip length; p &ge; ${P.sig_p} or a gap under 5%).</p>`);
  return out.join('\n');
}
const methodNote = `<aside class="lr-method"><p><strong>How these numbers were counted.</strong> Each load is counted once, however many times NudoIQ users saw it. Prices are the last price shown on the Amazon Relay board for that load. They are observed board prices, not what any carrier was paid or earned. One-way and round-trip loads are split because Relay&rsquo;s round-trip miles include the drive back. Full method on the <a href="/${HUB}/#method">Amazon Relay rates overview</a>.</p><p>NudoIQ is not affiliated with Amazon. Amazon did not provide, review or endorse this data.</p></aside>`;

const RELATED_FIXED = [
  ['/get/', 'NudoIQ for the Amazon Relay load board', 'Lane Intelligence shows these numbers next to each load on your own board.'],
  ['/amazon-relay-load-board/', 'How the Amazon Relay Load Board Works', null],
  ['/amazon-relay-scorecard/', 'Amazon Relay scorecard: how the performance score works and how to dispute it', null],
];
function related(extra) {
  const items = [...extra, ...RELATED_FIXED];
  return `    <nav class="related" aria-label="Related pages">
      <h2>Related</h2>
      <div class="cards">
${items.map(([u, t]) => `        <a href="${u}">${esc(t)}</a>`).join('\n')}
      </div>
    </nav>
`;
}

function page({ title, description, url, slug, ld, trail, h1, intro, byline, body, faq, extraRelated }) {
  return head({ title, description, url, slug, ld }) + TOP_TPL.replace(/<body[^>]*>/, '<body data-layout="lane-rates" data-clarity-unmask="true">') + `
  <div class="doc-hero"><div class="doc-hero-in">
    <nav class="crumbs" aria-label="Breadcrumb">${crumbs(trail.map(([n, u], i) => [n, i === trail.length - 1 ? null : u]))}</nav>
    <h1 class="page-title">${esc(h1)}</h1>
    <p class="page-subtitle">${show(intro)}</p>
    ${byline}
  </div></div>

  <div class="container lr">
    <article class="prose">
${body}
    </article>

    <section class="faq" aria-labelledby="faq-h">
      <h2 id="faq-h">Frequently asked questions</h2>
${faq.map((f) => `      <details><summary>${esc(f.q)}</summary><div class="a"><p>${show(f.a)}</p></div></details>`).join('\n')}
    </section>

${CTA_TPL}
${related(extraRelated)}
${FOOT_TPL}`;
}
const byline = (first, last) => `<p class="byline">NudoIQ data &middot; Loads first seen <time datetime="${first}">${dLong(first)}</time> to <time datetime="${last}">${dLong(last)}</time> &middot; Published <time datetime="${PUBLISHED}">${dLong(PUBLISHED)}</time> &middot; Last updated <time datetime="${UPDATED}">${dLong(UPDATED)}</time></p>`;

// ── facts used in sentences and placeholders ─────────────────────
const best = (l) => (l.OW && l.OW.pay_med != null ? ['OW', l.OW] : ['all', l.all]);
function laneAnswer(l) {
  const a = l.all, [k, b] = best(l);
  let s = `NudoIQ users saw ${int(a.n)} distinct Amazon Relay loads from ${l.o_name} to ${l.d_name} first seen from ${range(a.first_date, a.last_date)}. `;
  s += `${k === 'OW' ? 'One-way loads' : 'All loads'} had a median final board price of ${usd0(b.pay_med)} and a median of ${usd2(b.rpm_med)} per mile (median trip ${int(b.miles_med)} miles; middle half of loads: ${usd2(b.rpm_p25)} to ${usd2(b.rpm_p75)} per mile).`;
  if (l.RT && l.RT.pay_med != null) s += ` Round trips had a median of ${usd0(l.RT.pay_med)} and ${usd2(l.RT.rpm_med)} per mile (median ${int(l.RT.miles_med)} miles, counting the drive back).`;
  s += ` ${pct(a.share_raised)} of loads were raised in price at least once while posted.`;
  return s;
}
function laneFacts(l) {
  const a = l.all, ow = l.OW, rt = l.RT;
  const f = [`Lane: ${laneName(l)} (${l.pair}); ${int(a.n)} distinct loads first seen ${range(a.first_date, a.last_date)} on ${a.days} different days, ${SRC_PHRASE}.`,
    `Trip types: ${Object.entries(l.trip_counts).map(([t, n]) => `${TRIP[t] || t} ${int(n)}`).join(', ')}.`,
    `All loads: median final board price ${usd0(a.pay_med)} (middle half ${usd0(a.pay_p25)}–${usd0(a.pay_p75)}), ${usd2(a.rpm_med)}/mile (middle half ${usd2(a.rpm_p25)}–${usd2(a.rpm_p75)}), median ${int(a.miles_med)} miles.`];
  if (ow.pay_med != null) f.push(`One way (${int(ow.n)} loads): median ${usd0(ow.pay_med)}, ${usd2(ow.rpm_med)}/mile (middle half ${usd2(ow.rpm_p25)}–${usd2(ow.rpm_p75)}), median ${int(ow.miles_med)} miles.`);
  if (rt.pay_med != null) f.push(`Round trip (${int(rt.n)} loads): median ${usd0(rt.pay_med)}, ${usd2(rt.rpm_med)}/mile (middle half ${usd2(rt.rpm_p25)}–${usd2(rt.rpm_p75)}), median ${int(rt.miles_med)} miles (round-trip miles include the drive back).`);
  else f.push(`Round trip: only ${int(rt.n)} loads, too few to report.`);
  f.push(a.dep_mins_med != null
    ? `Time on board (${int(a.dep_n)} loads seen leaving): median ${dur(a.dep_mins_med)} from first to last sighting; ${pct(a.dep_share_30)} gone within 30 minutes; ${pct(a.dep_share_240)} still posted after 4 hours. Leaving the board is not proof of a booking, and a load may have been posted before a NudoIQ user first saw it.`
    : `Time on board: not enough loads seen leaving (${int(a.dep_n)}), so no figure.`);
  f.push(`Price moves: ${pct(a.share_raised)} raised at least once, ${pct(a.share_cut)} cut at least once; ${pct(a.share_ended_higher)} ended above their first price (median rise ${a.raise_pct_med == null ? '–' : a.raise_pct_med.toFixed(1) + '%'}), ${pct(a.share_ended_lower)} ended below.`);
  if (l.cities.length) f.push(`Busiest city pairs: ${l.cities.slice(0, 3).map((c) => `${c.ocity} to ${c.dcity} (${c.n} loads, ${usd2(c.rpm_med)}/mile)`).join('; ')}.`);
  const sig = l.patterns.filter((p) => p.significant);
  f.push(sig.length ? `Time pattern (one-way, allowing for trip length): ${sig.map((p) => Object.entries(p.groups).map(([k, g]) => `${k} ${usd2(g.rpm_med)} (${signed((g.adj_index / Math.min(...Object.values(p.groups).map((x) => x.adj_index)) - 1) * 100)} vs. the lowest slot at the same trip length)`).join(', ')).join('; ')}.`
    : 'No significant time-of-day or weekday difference.');
  f.push(`Top origin cities: ${l.top_origins.map((o) => `${o.city} (${o.n})`).join(', ')}.`);
  f.push('Rules: board prices, not earnings; no promises; NudoIQ not affiliated with Amazon; Amazon did not provide the data.');
  return f;
}

// ── lane pages ───────────────────────────────────────────────────
for (const l of LANES) {
  const url = `${SITE}${laneUrl(l)}`, a = l.all, [bk, b] = best(l);
  const slugKey = l.slug;
  const h1 = `Amazon Relay rates: ${laneName(l)} (${laneShort(l)})`;
  const title = `Amazon Relay Rates ${laneShort(l)}: Lane Data | NudoIQ`;
  const description = `Amazon Relay ${laneShort(l)} rates from ${int(a.n)} loads seen ${dShort(a.first_date)}–${dShort(a.last_date)}, ${a.last_date.slice(0, 4)}: ${bk === 'OW' ? 'one-way ' : ''}median ${usd0(b.pay_med)} a load and ${usd2(b.rpm_med)} a mile (median trip ${int(b.miles_med)} mi).`;
  const facts = laneFacts(l);
  const intro = words(`lanes.${slugKey}.intro`, `1-2 sentence standfirst for the ${laneShort(l)} lane page`, facts);
  const faqDefs = [
    ['pay', `How much do Amazon Relay loads from ${l.o_name} to ${l.d_name} pay?`, facts.slice(0, 5)],
    ...(a.dep_mins_med != null ? [['board', `How long do ${laneShort(l)} loads stay on the Amazon Relay board?`, facts.filter((x) => /^Time on board|^Lane/.test(x))]] : []),
    ['raise', `Does Amazon raise the price on ${laneShort(l)} Relay loads that sit on the board?`, facts.filter((x) => /^Price moves|^Lane/.test(x))],
    l.RT.pay_med != null
      ? ['trip', `Do round trips pay less per mile than one-way loads from ${l.o_name} to ${l.d_name}?`, facts.filter((x) => /^One way|^Round trip|^Lane/.test(x)).concat([`Across all lanes, round trips priced at a median ${N.rt_ow_rpm_ratio_city_pairs.median_ratio.toFixed(2)}x the one-way rate per mile on the same city pair (${N.rt_ow_rpm_ratio_city_pairs.pairs} city pairs).`])]
      : ['time', `Does the time of day change Amazon Relay rates from ${l.o_name} to ${l.d_name}?`, facts.filter((x) => /^Time pattern|^Lane/.test(x))],
    ['source', 'Where do these Amazon Relay rate numbers come from?', [facts[0], `Each load counted once (deduplicated by load ID); price = last price seen on the board; one-way and round trips split; time on board only for loads seen leaving while the lane was still watched.`, `Most loads in this lane start in ${l.top_origins[0].city} (${l.top_origins[0].n} of ${a.n}), because that is where NudoIQ users search.`, facts[facts.length - 1]]],
  ];
  const faq = faqDefs.map(([k, q, fx]) => ({ q, a: words(`lanes.${slugKey}.faq.${k}`, `answer, 2-4 sentences, to "${q}"`, fx) }));

  const chartRows = [];
  if (l.OW.rpm_med != null) chartRows.push({ label: `One way (${int(l.OW.n)} loads)`, med: l.OW.rpm_med, p25: l.OW.rpm_p25, p75: l.OW.rpm_p75 });
  if (l.RT.rpm_med != null) chartRows.push({ label: `Round trip (${int(l.RT.n)} loads)`, med: l.RT.rpm_med, p25: l.RT.rpm_p25, p75: l.RT.rpm_p75 });
  chartRows.push({ label: `All loads (${int(a.n)})`, med: a.rpm_med, p25: a.rpm_p25, p75: a.rpm_p75 });
  for (const c of l.cities.slice(0, 5)) chartRows.push({ label: `${c.ocity} to ${c.dcity} (${c.n})`, med: c.rpm_med, p25: c.rpm_p25, p75: c.rpm_p75 });

  const other = (l.trip_counts.UNCLASSIFIED || 0) + (l.trip_counts.MS || 0);
  const body = [
    `<section class="answer" aria-label="Short answer"><p class="lbl">Short answer</p><p>${esc(laneAnswer(l))}</p></section>`,
    statCards([
      [usd0(b.pay_med), bk === 'OW' ? 'Median one-way final price' : 'Median final price', `${int(b.miles_med)} miles median`],
      [usd2(b.rpm_med), bk === 'OW' ? 'Median one-way rate per mile' : 'Median rate per mile', `Middle 50%: ${usd2(b.rpm_p25)}–${usd2(b.rpm_p75)}`],
      [pct(a.share_raised), 'Loads raised in price while posted', `${int(a.n)} loads`],
      a.dep_mins_med != null ? [durShort(a.dep_mins_med), 'Median time on the board', `${int(a.dep_n)} loads seen leaving`] : [int(a.n), 'Distinct loads', `${a.days} days with data`],
    ]),
    `<h2 id="rates">${esc(laneShort(l))} Amazon Relay rates by trip type</h2>`,
    table({ caption: `${laneName(l)} Amazon Relay loads by trip type: ${int(a.n)} distinct loads first seen ${range(a.first_date, a.last_date)}, ${SRC_PHRASE}.`,
      cols: RATE_COLS, rows: [rateRow('One way', l.OW), rateRow('Round trip', l.RT), rateRow('All loads', a)] }),
    other ? `<p class="lr-note">${int(other)} loads with an unknown or multi-stop trip type are counted in All loads only. Round-trip miles include the drive back, so round trips show more miles and a lower rate per mile.</p>` : `<p class="lr-note">Round-trip miles include the drive back, so round trips show more miles and a lower rate per mile.</p>`,
    rangeChart({ id: `chart-${l.slug}`, title: `${laneShort(l)} rate per mile: median and middle 50% of loads`, rows: chartRows, note: `${int(a.n)} loads, ${range(a.first_date, a.last_date)}` }),
    ...(l.cities.length ? [`<h2 id="city-pairs">Busiest city pairs from ${esc(l.o_name)} to ${esc(l.d_name)}</h2>`,
      table({ caption: `City pairs with at least ${P.min_city} loads: ${int(l.cities.reduce((t, c) => t + c.n, 0))} of the ${int(a.n)} ${laneShort(l)} loads first seen ${range(a.first_date, a.last_date)}, ${SRC_PHRASE}.`,
        cols: ['City pair', 'Loads', 'Median final price', 'Median per mile', 'Median miles', 'One way per mile', 'Round trip per mile'],
        rows: l.cities.map((c) => [esc(`${c.ocity} to ${c.dcity}`), int(c.n), usd0(c.pay_med), usd2(c.rpm_med), int(c.miles_med),
          c.ow_rpm_med != null ? usd2(c.ow_rpm_med) : `<span class="lr-few" title="${c.ow_n} one-way loads">–</span>`,
          c.rt_rpm_med != null ? usd2(c.rt_rpm_med) : `<span class="lr-few" title="${c.rt_n} round trips">–</span>`]) }),
      `<p class="lr-note">Per-mile figures by trip type are shown when a city pair has at least ${P.min_sub} loads of that type (&ndash; = fewer).</p>`] : []),
    `<h2 id="time-on-board">How long ${esc(laneShort(l))} loads stay on the board</h2>`,
    dwellTable(a, `on ${laneShort(l)}`),
    `<h2 id="price-changes">How ${esc(laneShort(l))} prices changed while posted</h2>`,
    priceTable(a, `on ${laneShort(l)}`),
    `<h2 id="timing">Time of day and day of week</h2>`,
    patternBlock(l.patterns, `on ${laneShort(l)}`),
    methodNote,
  ].join('\n');

  const others = LANES.filter((o) => o.slug !== l.slug).map((o) => [laneUrl(o), `Amazon Relay rates: ${laneName(o)} (${laneShort(o)})`]);
  const trail = [['Home', '/'], ['Guides', '/guides/'], ['Amazon Relay rates', `/${HUB}/`], [laneShort(l), laneUrl(l)]];
  const abstract = laneAnswer(l);
  const ld = [articleLd({ headline: h1, description, url, abstract }), crumbLd(trail), faqLd(faq), { '@context': 'https://schema.org', '@graph': [ORG] },
    datasetLd({ name: `Amazon Relay rates, ${laneName(l)} (${laneShort(l)}), NudoIQ board data`, url,
      description: `Final board prices, rate per mile, miles, time on the board and price changes for ${int(a.n)} distinct Amazon Relay loads from ${l.o_name} to ${l.d_name} first seen ${range(a.first_date, a.last_date)}, ${SRC_PHRASE}. Split by one-way and round trip. Observed board prices, not carrier earnings. Not provided by Amazon.`,
      spatial: `${l.o_name} to ${l.d_name}, United States`, first: a.first_date, last: a.last_date, keywords: [`${l.o_name} to ${l.d_name}`, `${laneShort(l)} freight`] })];
  const html = page({ title, description, url, slug: `${HUB}/${l.slug}`, ld, trail, h1, intro, byline: byline(a.first_date, a.last_date), body, faq,
    extraRelated: [[`/${HUB}/`, 'Amazon Relay rates by lane (all lanes)'], ...others.slice(0, 3)] });
  fs.mkdirSync(path.join(ROOT, HUB, l.slug), { recursive: true });
  fs.writeFileSync(path.join(ROOT, HUB, l.slug, 'index.html'), html);
  l._title = h1; l._desc = description;
}

// ── hub ──────────────────────────────────────────────────────────
{
  const a = N.all, ow = N.by_trip.OW, rt = N.by_trip.RT, url = `${SITE}/${HUB}/`;
  const first = a.first_date, last = a.last_date;
  const tnShare = (N.origin_states.find((s) => s.state === 'TN') || { n: 0 }).n / a.n;
  const topCity = N.origin_cities[0];
  const ratio = N.rt_ow_rpm_ratio_city_pairs;
  const answer = `NudoIQ users saw ${int(a.n)} distinct Amazon Relay loads first seen from ${range(first, last)}. One-way loads had a median final board price of ${usd0(ow.pay_med)} and a median of ${usd2(ow.rpm_med)} per mile (median trip ${int(ow.miles_med)} miles; middle half ${usd2(ow.rpm_p25)} to ${usd2(ow.rpm_p75)} per mile). Round trips had a median of ${usd2(rt.rpm_med)} per mile, because their miles include the drive back. ${pct(a.share_raised)} of loads were raised in price at least once while posted. Most loads started in Tennessee, where NudoIQ users search most.`;
  const facts = [
    `${int(a.n)} distinct loads first seen ${range(first, last)} (${a.days} days with data in the 90-day window), ${SRC_PHRASE}; ${int(N.n_all_time)} loads since ${dLong(N.all_time_first)}.`,
    `One way (${int(ow.n)}): median ${usd0(ow.pay_med)}, ${usd2(ow.rpm_med)}/mile (middle half ${usd2(ow.rpm_p25)}–${usd2(ow.rpm_p75)}), ${int(ow.miles_med)} miles.`,
    `Round trip (${int(rt.n)}): median ${usd0(rt.pay_med)}, ${usd2(rt.rpm_med)}/mile (middle half ${usd2(rt.rpm_p25)}–${usd2(rt.rpm_p75)}), ${int(rt.miles_med)} miles. On the same city pair, round trips priced at a median ${ratio.median_ratio.toFixed(2)}x the one-way rate per mile (${ratio.pairs} city pairs).`,
    `All loads: median ${usd0(a.pay_med)}, ${usd2(a.rpm_med)}/mile, ${int(a.miles_med)} miles.`,
    `Time on board (${int(a.dep_n)} loads seen leaving): median ${dur(a.dep_mins_med)}; ${pct(a.dep_share_30)} gone within 30 minutes; ${pct(a.dep_share_240)} still posted after 4 hours. Leaving the board is not proof of a booking, and a load may have been posted before a NudoIQ user first saw it.`,
    `Price moves: ${pct(a.share_raised)} raised at least once, ${pct(a.share_cut)} cut at least once; ${pct(a.share_ended_higher)} ended higher than first seen (median rise ${a.raise_pct_med.toFixed(1)}%); median first price ${usd0(a.posted_pay_med)} vs median final ${usd0(a.pay_med)}.`,
    `Coverage: ${pct(tnShare)} of loads start in Tennessee; ${topCity.city} alone is ${int(topCity.n)} of ${int(a.n)}. Lanes with their own page: ${LANES.map((l) => `${l.pair} (${l.all.n})`).join(', ')}.`,
    `Equipment type is not recorded, so no box truck vs tractor split.`,
    'Rules: board prices, not earnings; no promises; NudoIQ not affiliated with Amazon; Amazon did not provide the data.',
  ];
  const intro = words('hub.intro', '1-2 sentence standfirst for the Amazon Relay rates hub', facts);
  const faqDefs = [
    ['rpm', 'What is the average Amazon Relay rate per mile?', [facts[0], facts[1], facts[2], facts[3], facts[6]]],
    ['roundtrip', 'Do Amazon Relay round trips pay less per mile than one-way loads?', [facts[1], facts[2]]],
    ['speed', 'How fast do loads leave the Amazon Relay load board?', [facts[0], facts[4], 'We can see that a load left the board, not who booked it or why.']],
    ['raise', 'Does Amazon raise the price of Relay loads that are not booked?', [facts[5]]],
    ['official', 'Are these Amazon Relay rates from Amazon?', [facts[0], facts[8], 'Rates are what the board showed NudoIQ users; individual carriers may see different loads and prices.']],
    ['tennessee', 'Why are most of these lanes in Tennessee?', [facts[6], 'Lanes need at least 30 loads seen on at least 10 different days in 90 days to get a page; more lanes will be added as users in other areas search.']],
  ];
  const faq = faqDefs.map(([k, q, fx]) => ({ q, a: words(`hub.faq.${k}`, `answer, 2-4 sentences, to "${q}"`, fx) }));

  const chartRows = LANES.filter((l) => l.OW.rpm_med != null).map((l) => ({ label: `${laneShort(l)} one way (${int(l.OW.n)})`, med: l.OW.rpm_med, p25: l.OW.rpm_p25, p75: l.OW.rpm_p75 }));
  chartRows.push({ label: `All lanes, one way (${int(ow.n)})`, med: ow.rpm_med, p25: ow.rpm_p25, p75: ow.rpm_p75 });
  chartRows.push({ label: `All lanes, round trip (${int(rt.n)})`, med: rt.rpm_med, p25: rt.rpm_p25, p75: rt.rpm_p75 });

  const lanesRows = LANES.map((l) => { const [k, b] = best(l); return [
    `<a href="${laneUrl(l)}">${esc(laneShort(l))} rates</a>`, int(l.all.n), `${usd2(b.rpm_med)}${k === 'OW' ? '' : '*'}`, `${usd0(b.pay_med)}${k === 'OW' ? '' : '*'}`,
    int(b.miles_med), l.RT.rpm_med != null ? usd2(l.RT.rpm_med) : '–', durShort(l.all.dep_mins_med), `${dShort(l.all.first_date)}–${dShort(l.all.last_date)}`]; });
  const snapRows = N.snapshots.map((s) => [esc(`${s.o} to ${s.d}`), int(s.n),
    s.ow && s.ow.rpm_med != null ? usd2(s.ow.rpm_med) : `<span class="lr-few" title="${int(s.ow ? s.ow.n : 0)} one-way loads">–</span>`, usd2(s.rpm_med),
    `${dShort(s.first_date)}–${dShort(s.last_date)}`, int(s.days), esc(s.top_origin)]);
  const tripRows = ['OW', 'RT', 'MS', 'UNCLASSIFIED'].map((t) => rateRow(TRIP[t], N.by_trip[t])).concat([rateRow('All loads', a)]);
  const p = P;
  const body = [
    `<section class="answer" aria-label="Short answer"><p class="lbl">Short answer</p><p>${esc(answer)}</p></section>`,
    statCards([
      [usd2(ow.rpm_med), 'Median one-way rate per mile', `${int(ow.n)} one-way loads`],
      [usd2(rt.rpm_med), 'Median round-trip rate per mile', `${int(rt.n)} round trips`],
      [pct(a.share_raised), 'Loads raised in price while posted', `Median rise ${a.raise_pct_med.toFixed(0)}% when it ended higher`],
      [durShort(a.dep_mins_med), 'Median time on the board', `${int(a.dep_n)} loads seen leaving`],
    ]),
    `<h2 id="by-trip-type">Amazon Relay rates by trip type</h2>`,
    table({ caption: `All Amazon Relay loads in the data by trip type: ${int(a.n)} distinct loads first seen ${range(first, last)}, ${SRC_PHRASE}.`, cols: RATE_COLS, rows: tripRows }),
    `<p class="lr-note">On the same city pair, round trips were priced at a median ${ratio.median_ratio.toFixed(2)} times the one-way rate per mile (${ratio.pairs} city pairs with at least 3 loads of each type). Equipment type is not recorded in the data, so there is no box truck vs tractor split.</p>`,
    `<h2 id="lanes">Amazon Relay rates by lane</h2>`,
    rangeChart({ id: 'chart-lanes', title: 'One-way rate per mile by lane: median and middle 50% of loads', rows: chartRows, note: `${range(first, last)}` }),
    table({ caption: `Lanes with at least ${p.min_lane} loads seen on at least ${p.min_days} days: loads first seen ${range(first, last)}, ${SRC_PHRASE}. One-way figures unless marked *.`,
      cols: ['Lane', 'Loads', 'Median per mile', 'Median final price', 'Median miles', 'Round trip per mile', 'Median time on board', 'Dates'], rows: lanesRows }),
    snapRows.length ? `<h3 id="short-window">Lanes seen in a short window (no page yet)</h3>` : '',
    snapRows.length ? table({ caption: `Lanes with at least ${p.min_lane} loads but seen on fewer than ${p.min_days} days, so they read as a snapshot, not a typical rate: ${SRC_PHRASE}.`,
      cols: ['Lane', 'Loads', 'One way per mile', 'All loads per mile', 'Dates', 'Days with data', 'Main origin'], rows: snapRows }) : '',
    `<h2 id="time-on-board">How long Amazon Relay loads stay on the board</h2>`,
    dwellTable(a, 'across all lanes'),
    `<h2 id="price-changes">How Amazon Relay prices changed while posted</h2>`,
    priceTable(a, 'across all lanes'),
    `<h2 id="timing">Time of day and day of week</h2>`,
    patternBlock(N.patterns, 'across all lanes'),
    `<h2 id="coverage">Where the data comes from</h2>`,
    table({ caption: `Origin cities of the ${int(a.n)} loads first seen ${range(first, last)}, ${SRC_PHRASE}. The data follows where NudoIQ users search.`,
      cols: ['Origin city', 'Loads', 'Share'], rows: N.origin_cities.map((c) => [esc(c.city), int(c.n), pct(c.n / a.n)]) }),
    `<h2 id="method">Method</h2>`,
    `<ul class="lr-list">
<li><strong>Source.</strong> Amazon Relay loads that appeared on the load board in the browsers of NudoIQ users, recorded by the NudoIQ extension: price, miles, origin, destination and the time each load was seen. Amazon did not provide, review or endorse this data, and NudoIQ is not affiliated with Amazon.</li>
<li><strong>Window.</strong> Loads first seen from ${dLong(p.window_start_et)} to ${dLong(p.as_of)} (90 days, Eastern Time). Data exists for ${a.days} of those days.</li>
<li><strong>One load, one row.</strong> The extension can log the same load many times (every tab, every refresh, a check every 10 minutes). Each load is counted once by its load ID.</li>
<li><strong>Price.</strong> &ldquo;Final price&rdquo; is the last price a NudoIQ user saw for the load before it left the board. Relay prices go up and down while a load is posted, so the first price seen is reported separately. These are board prices, not what any carrier was paid or earned, and they do not include your costs.</li>
<li><strong>Rate per mile.</strong> Final price divided by the miles shown on the board. Round trips are split from one-way loads because their miles include the drive back. A load is a round trip when Relay marks it as one, when it ends where it started, or when its miles are at least 1.7 times the shortest trip seen between the same two cities. Loads that could not be classified count in &ldquo;All loads&rdquo; only.</li>
<li><strong>Medians and middle 50%.</strong> Medians, with the 25th to 75th percentile range, so a few unusual loads do not move the numbers.</li>
<li><strong>Lanes.</strong> A lane is an origin state and destination state. A lane gets a page when it has at least ${p.min_lane} distinct loads seen on at least ${p.min_days} different days. City pairs are shown with at least ${p.min_city} loads, and a trip-type figure with at least ${p.min_sub} loads.</li>
<li><strong>Time on the board.</strong> Minutes from the first time a NudoIQ user saw a load to the last time, counted only for loads that were missing when the same lane was checked again ${p.gone_window_min[0]} to ${p.gone_window_min[1]} minutes later. A load may have been posted before anyone saw it, and leaving the board does not always mean it was booked, so treat this as a guide. At least ${p.min_dwell} such loads are needed to show the figure.</li>
<li><strong>Time of day.</strong> Tested on one-way loads only, after allowing for trip length (shorter runs price higher per mile). A difference is shown only when p &lt; ${p.sig_p} and the gap is at least 5%. &ldquo;When first seen&rdquo; is when a NudoIQ user first saw the load, not when Amazon posted it.</li>
<li><strong>Limits.</strong> The data follows where NudoIQ users search, so most loads start in Tennessee, and the lanes here are not a national sample. Equipment type is not recorded. Numbers will change as more loads are seen.</li>
</ul>`,
    `<p class="dl"><a href="/${HUB}/${CSV_NAME}" download>${CSV_NAME}</a> <span>(CSV, aggregate numbers only, no load IDs)</span></p>`,
  ].filter(Boolean).join('\n');

  const title = 'Amazon Relay Rates by Lane: Rate per Mile Data | NudoIQ';
  const description = `Amazon Relay rates from ${int(a.n)} loads seen ${dShort(first)}–${dShort(last)}, ${last.slice(0, 4)}: one-way median ${usd2(ow.rpm_med)}/mile, round trip ${usd2(rt.rpm_med)}/mile, by lane.`;
  const trail = [['Home', '/'], ['Guides', '/guides/'], ['Amazon Relay rates', `/${HUB}/`]];
  const h1 = 'Amazon Relay rates by lane';
  const ld = [articleLd({ headline: 'Amazon Relay rates by lane: rate per mile from NudoIQ board data', description, url, abstract: answer }), crumbLd(trail), faqLd(faq),
    { '@context': 'https://schema.org', '@graph': [ORG] },
    { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Amazon Relay lane rate pages', itemListElement: LANES.map((l, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}${laneUrl(l)}`, name: l._title })) },
    datasetLd({ name: 'Amazon Relay lane rates, NudoIQ board data', url,
      description: `Final board prices, rate per mile, miles, time on the board and price changes for ${int(a.n)} distinct Amazon Relay loads first seen ${range(first, last)}, ${SRC_PHRASE}, by trip type and by lane (origin state to destination state). Observed board prices, not carrier earnings. Not provided by Amazon.`,
      spatial: 'United States (mostly loads starting in Tennessee)', first, last, keywords: ['lane rates', 'freight rates', 'Tennessee', 'Kentucky', 'Georgia'] })];
  const html = page({ title, description, url, slug: HUB, ld, trail, h1, intro, byline: byline(first, last), body, faq,
    extraRelated: LANES.slice(0, 3).map((l) => [laneUrl(l), l._title]) });
  fs.mkdirSync(path.join(ROOT, HUB), { recursive: true });
  fs.writeFileSync(path.join(ROOT, HUB, 'index.html'), html);
  N._title = h1; N._desc = description; N._answer = answer;
}

// ── public CSV (aggregates only) ─────────────────────────────────
{
  const q = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const cols = ['scope', 'lane', 'city_pair', 'trip_type', 'loads', 'first_seen_from', 'first_seen_to', 'days_with_data', 'median_final_price_usd', 'p25_final_price_usd', 'p75_final_price_usd',
    'median_rate_per_mile_usd', 'p25_rate_per_mile_usd', 'p75_rate_per_mile_usd', 'median_miles', 'median_first_price_usd', 'loads_seen_leaving', 'median_minutes_on_board',
    'share_raised_at_least_once', 'share_cut_at_least_once', 'share_final_above_first'];
  const r2 = (v, d = 2) => (v == null ? null : Number(v.toFixed(d)));
  const row = (scope, lane, cp, trip, b) => [scope, lane, cp, trip, b.n, b.first_date, b.last_date, b.days, r2(b.pay_med), r2(b.pay_p25), r2(b.pay_p75), r2(b.rpm_med, 3), r2(b.rpm_p25, 3), r2(b.rpm_p75, 3),
    r2(b.miles_med, 1), r2(b.posted_pay_med), b.dep_n, r2(b.dep_mins_med, 1), r2(b.share_raised, 3), r2(b.share_cut, 3), r2(b.share_ended_higher, 3)];
  const lines = [cols.join(',')];
  lines.push(row('all_lanes', '', '', 'all', N.all).map(q).join(','));
  for (const t of ['OW', 'RT', 'MS', 'UNCLASSIFIED']) if (N.by_trip[t].n >= P.min_sub) lines.push(row('all_lanes', '', '', t, N.by_trip[t]).map(q).join(','));
  for (const l of LANES) {
    lines.push(row('lane', l.pair, '', 'all', l.all).map(q).join(','));
    for (const t of ['OW', 'RT']) if (l[t].pay_med != null) lines.push(row('lane', l.pair, '', t, l[t]).map(q).join(','));
    for (const c of l.cities) lines.push(row('city_pair', l.pair, `${c.ocity} ${l.o} to ${c.dcity} ${l.d}`, 'all', c).map(q).join(','));
  }
  for (const s of N.snapshots) lines.push(row('short_window_lane', s.pair, '', 'all', s).map(q).join(','));
  fs.writeFileSync(path.join(ROOT, HUB, CSV_NAME), lines.join('\n') + '\n');
}

// ── sitemap ──────────────────────────────────────────────────────
{
  const file = path.join(ROOT, 'sitemap.xml');
  let xml = fs.readFileSync(file, 'utf8');
  const nl = xml.includes('\r\n') ? '\r\n' : '\n';
  xml = xml.replace(/\r\n/g, '\n');
  const urls = [[`${SITE}/${HUB}/`, '0.7'], ...LANES.map((l) => [`${SITE}${laneUrl(l)}`, '0.6'])];
  for (const [loc, pr] of urls) {
    const entry = `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${UPDATED}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${pr}</priority>\n  </url>\n`;
    const re = new RegExp(`  <url>\\n    <loc>${loc.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}</loc>[\\s\\S]*?</url>\\n`);
    xml = re.test(xml) ? xml.replace(re, entry) : xml.replace('</urlset>', entry + '</urlset>');
  }
  fs.writeFileSync(file, xml.replace(/\n/g, nl));
}

// ── /guides/ hub card ────────────────────────────────────────────
{
  const file = path.join(ROOT, 'guides', 'index.html');
  let h = fs.readFileSync(file, 'utf8');
  h = h.replace(/ *<a href="\/amazon-relay-rates\/">[^\n]*\n/, '');
  const card = `        <a href="/${HUB}/">Amazon Relay rates by lane<span>${esc(N._desc)}</span></a>\n`;
  const anchor = h.match(/ *<a href="\/amazon-relay-carrier-data\/">[^\n]*\n/);
  if (!anchor) throw new Error('guides/index.html: carrier-data card not found');
  h = h.replace(anchor[0], () => anchor[0] + card);
  // ItemList JSON-LD on the hub: add the rates hub once.
  if (!h.includes(`"url": "${SITE}/${HUB}/"`)) {
    h = h.replace(/("url": "https:\/\/nudoiq\.com\/amazon-relay-carrier-data\/",\s*"name": "[^"]*"\s*\})/, (m0, g1) => `${g1},\n    {\n      "@type": "ListItem",\n      "position": 0,\n      "url": "${SITE}/${HUB}/",\n      "name": "Amazon Relay rates by lane"\n    }`);
    // renumber positions inside the ItemList block only (the BreadcrumbList block has its own)
    h = h.replace(/"@type": "ItemList"[\s\S]*?<\/script>/, (blk) => { let i = 0; return blk.replace(/"position": \d+/g, () => `"position": ${++i}`); });
  }
  fs.writeFileSync(file, h);
}

// ── llms.txt + llms-full.txt ─────────────────────────────────────
{
  const file = path.join(ROOT, 'llms.txt');
  let t = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  t = t.split('\n').filter((ln) => !ln.includes(`${SITE}/${HUB}/`)).join('\n').replace(/\n{3,}/g, '\n\n');
  const a = N.all, ow = N.by_trip.OW, rt = N.by_trip.RT;
  const para = `NudoIQ also publishes Amazon Relay lane rates from loads its users saw on the Amazon Relay board: ${int(a.n)} distinct loads first seen ${range(a.first_date, a.last_date)}, mostly starting in Tennessee. One-way loads had a median final board price of ${usd2(ow.rpm_med)} per mile and round trips ${usd2(rt.rpm_med)} per mile; ${pct(a.share_raised)} of loads were raised in price while posted. These are observed board prices, not carrier earnings, and Amazon did not provide the data. Lanes, method and caveats: ${SITE}/${HUB}/`;
  t = t.replace(/(## Original data\n\n[^\n]+\n)/, (m0, g1) => `${g1}\n${para}\n`);
  const pages = [`- [Amazon Relay rates by lane](${SITE}/${HUB}/): ${N._desc}`, ...LANES.map((l) => `- [${l._title}](${SITE}${laneUrl(l)}): ${l._desc}`)];
  t = t.replace(/(- \[Amazon Relay carrier data[^\n]*\n)/, (m0, g1) => `${g1}${pages.join('\n')}\n`);
  t = t.replace(/(## Data\n\n(?:- [^\n]*\n)+)/, (m0, g1) => `${g1}- [${CSV_NAME}](${SITE}/${HUB}/${CSV_NAME}): aggregate Amazon Relay lane rate numbers behind ${SITE}/${HUB}/ (no load IDs).\n`);
  if (!t.includes(`${SITE}/${HUB}/`)) throw new Error('llms.txt: anchors not found, nothing inserted');
  fs.writeFileSync(file, t);

  const ff = path.join(ROOT, 'llms-full.txt');
  let f = fs.readFileSync(ff, 'utf8').replace(/\r\n/g, '\n');
  const MARK = '# Amazon Relay rates by lane (NudoIQ board data)';
  const at = f.indexOf(`\n---\n\n${MARK}`);
  if (at >= 0) f = f.slice(0, at) + '\n';
  const mdT = (cols, rows) => [`| ${cols.join(' | ')} |`, `|${cols.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
  const strip = (s) => String(s).replace(/<[^>]+>/g, '');
  const rr = (label, b) => rateRow(label, b).map(strip);
  const sec = [MARK, '', `URL: ${SITE}/${HUB}/`, `Published: ${PUBLISHED}. Last updated: ${UPDATED}.`, '', `Short answer: ${N._answer}`, '',
    `Rates by trip type (${int(a.n)} distinct loads first seen ${range(a.first_date, a.last_date)}, ${SRC_PHRASE}):`, '',
    mdT(RATE_COLS, ['OW', 'RT', 'MS', 'UNCLASSIFIED'].map((k) => rr(TRIP[k], N.by_trip[k])).concat([rr('All loads', a)])), '',
    ...LANES.flatMap((l) => [`## ${l._title}`, '', `URL: ${SITE}${laneUrl(l)}`, '', laneAnswer(l), '',
      mdT(RATE_COLS, [rr('One way', l.OW), rr('Round trip', l.RT), rr('All loads', l.all)]), '']),
    'Method: each load counted once by load ID; final price = last price seen on the board; one-way and round trips split (round-trip miles include the drive back); medians with the middle 50%. Board prices, not carrier earnings. NudoIQ is not affiliated with Amazon, and Amazon did not provide or review this data.'];
  f = f.replace(/\n+$/, '\n') + `\n---\n\n${sec.join('\n')}\n`;
  fs.writeFileSync(ff, f);
}

// ── Martha placeholder list ──────────────────────────────────────
{
  const out = ['# Martha placeholders: Amazon Relay lane rate pages', '',
    `Generated by nudoiq-website/tools/build-lane-pages.mjs on ${UPDATED}. Fill each one in \`copy.json\` (same folder) at the key shown, then run \`node tools/build-lane-pages.mjs\` from nudoiq-website. A filled key replaces its [[MARTHA: ...]] marker on the page and in the FAQ JSON-LD.`, '',
    'Rules for every placeholder: these are observed Amazon Relay board prices, not earnings (no "make/earn $X"); no promises about rates or bookings; never imply Amazon endorsed, provided or reviewed the data; NudoIQ is not affiliated with Amazon. Use only the facts listed. Plain text; **bold** and [links](/path/) work.', '',
    'Already generated from the data (Martha may restyle wording, numbers must stay): the "Short answer" sentence, the meta descriptions, table captions, the method list on the hub and the method note on each lane page.', ''];
  for (const p of PH) out.push(`## \`${p.key}\``, '', `Write: ${p.what}.`, '', 'Facts:', '', ...p.facts.map((x) => `- ${x}`), '');
  fs.writeFileSync(path.join(DATA_DIR, 'MARTHA-PLACEHOLDERS.md'), out.join('\n'));
}

console.log(`Built /${HUB}/ + ${LANES.length} lane pages (${LANES.map((l) => l.slug).join(', ')}); ${PH.length} Martha placeholders open.`);
