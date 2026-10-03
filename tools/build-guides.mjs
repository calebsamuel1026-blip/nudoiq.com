#!/usr/bin/env node
// Build the Amazon Relay guide pages from the copywriter's Markdown.
//
//   node tools/build-guides.mjs
//
// Source: ../research/seo-pages/<slug>.md (frontmatter + Markdown + "## Frequently asked questions").
// Output: <slug>/index.html for each page, guides/index.html (the hub), and the guide URLs merged
// into sitemap.xml. Words come from the source files only; this script adds layout, schema and links.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.resolve(ROOT, '../research/seo-pages');
const SITE = 'https://nudoiq.com';
const CWS = 'https://chromewebstore.google.com/detail/nudoiq/bjilnjgfdndecmamphkkcpplfmniocgk';

// Guides first went live on 2026-09-20. A page's frontmatter may carry `published:` and `updated:`
// (YYYY-MM-DD); `updated` drives the visible "Last updated" line, Article dateModified and sitemap lastmod,
// so a rebuild never bumps a date on a page whose words did not change.
const FIRST_PUBLISHED = '2026-09-20';
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'carrier-data.json'), 'utf8'));
const DATA_SLUG = 'amazon-relay-carrier-data';
const CSV_NAME = 'amazon-relay-carrier-data-2026.csv';
const SOFTWARE = {
  '@type': 'SoftwareApplication', '@id': `https://nudoiq.com/#software`, name: 'NudoIQ',
  applicationCategory: 'BusinessApplication', applicationSubCategory: 'Browser Extension',
  operatingSystem: 'Chrome, Microsoft Edge, Brave, and other Chromium-based browsers',
  url: 'https://nudoiq.com/', downloadUrl: 'https://chromewebstore.google.com/detail/nudoiq/bjilnjgfdndecmamphkkcpplfmniocgk',
  offers: { '@type': 'Offer', price: '49.99', priceCurrency: 'USD', availability: 'https://schema.org/InStock', url: 'https://nudoiq.com/#pricing',
    description: '7-day free trial, no card needed to start. $49.99 per month after the trial. Cancel anytime.',
    priceSpecification: { '@type': 'UnitPriceSpecification', price: '49.99', priceCurrency: 'USD', unitCode: 'MON', billingDuration: 'P1M' } },
  publisher: { '@id': 'https://nudoiq.com/#organization' },
};
const ORG = { '@type': 'Organization', '@id': 'https://nudoiq.com/#organization', name: 'NudoIQ', url: 'https://nudoiq.com/',
  logo: 'https://nudoiq.com/brand/mark/icon128.png', email: 'contact@nudoiq.com',
  sameAs: ['https://chromewebstore.google.com/detail/nudoiq/bjilnjgfdndecmamphkkcpplfmniocgk', 'https://t.me/nudoiqsupport'] };

// Display order on the hub and in "related" lists.
const ORDER = [
  'amazon-relay-load-board', 'what-is-amazon-relay', 'amazon-relay-requirements',
  'amazon-relay-insurance-requirements', 'amazon-relay-box-truck', 'how-much-does-amazon-relay-pay',
  'is-amazon-relay-worth-it', 'amazon-relay-scorecard', 'amazon-relay-auto-refresh',
  'amazon-relay-auto-booker', 'best-amazon-relay-extensions', 'loadfetcher-alternative',
  'amazon-relay-loads', 'amazon-relay-carrier-data', 'amazon-relay-box-truck-loads', 'amazon-relay-power-only',
  'amazon-relay-dispatcher', 'amazon-relay-account-suspended', 'amazon-relay-load-board-not-showing-loads',
  'how-to-book-multiple-loads-on-amazon-relay',
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function parse(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: missing frontmatter`);
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  for (const k of ['slug', 'title', 'description', 'h1']) if (!meta[k]) throw new Error(`${file}: no ${k}`);
  let body = m[2];
  let faq = [];
  const fi = body.search(/^## (Frequently asked questions|FAQ)/im);
  if (fi >= 0) {
    const faqMd = body.slice(fi).replace(/^## .*\n/, '');
    body = body.slice(0, fi);
    faq = faqMd.split(/^### /m).slice(1).map((blk) => {
      const [q, ...rest] = blk.split('\n');
      return { q: q.trim(), a: rest.join('\n').trim() };
    }).filter((x) => x.q && x.a);
  }
  return { ...meta, body: body.trim(), faq };
}

function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, h) => {
      const ext = /^https?:/.test(h) && !h.startsWith(SITE);
      return `<a href="${h}"${ext ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`;
    });
}

// Enough Markdown for the brief's format: headings, paragraphs, lists, tables, bold, links.
function md(src, { h2Ids = false } = {}) {
  const lines = src.split('\n');
  const out = [];
  let i = 0;
  const slugify = (t) => t.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    const ph = l.trim().match(/^\[\[(chart:[a-z-]+|csv)\]\]$/);
    if (ph) { out.push(placeholder(ph[1])); i++; continue; }
    let h;
    if ((h = l.match(/^(#{2,4})\s+(.*)$/))) {
      const n = h[1].length; const t = inline(h[2].trim());
      out.push(n === 2 && h2Ids ? `<h2 id="${slugify(h[2])}">${t}</h2>` : `<h${n}>${t}</h${n}>`);
      i++; continue;
    }
    if (/^\s*\|/.test(l)) {
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(rows[0]);
      const bodyRows = rows.slice(1).filter((r) => !/^\s*\|?\s*:?-{2,}/.test(r));
      out.push('<div class="tbl"><table><thead><tr>' + head.map((c) => `<th>${inline(c)}</th>`).join('') +
        '</tr></thead><tbody>' + bodyRows.map((r) => '<tr>' + cells(r).map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
        '</tbody></table></div>');
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
      const ordered = /^\s*\d+\./.test(l);
      const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        let item = lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, '');
        while (i < lines.length && lines[i].trim() && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i])) item += ' ' + lines[i++].trim();
        items.push(`<li>${inline(item)}</li>`);
      }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{2,4}\s|\s*\||\s*([-*]|\d+\.)\s+)/.test(lines[i])) para.push(lines[i++].trim());
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}

const stripMd = (s) => s.replace(/\*\*|\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim();

function head({ title, description, url, extraLd, slug }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta name="theme-color" content="#FFBB8C">
  <link rel="canonical" href="${url}">
  <link rel="icon" href="/assets/favicon.png" type="image/png" sizes="any">
  <meta property="og:site_name" content="NudoIQ">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${SITE}/assets/og-image-1200x630.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${SITE}/assets/og-image-1200x630.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&display=swap">
  <!-- Microsoft Clarity -->
  <script type="text/javascript">
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "y9n5ejt2k9");
  </script>
  <!-- Meta Pixel: same ID as the home page, so guide readers join the site audience that ads retarget
       and seed lookalikes from. ViewContent tags which guide; InstallClick marks a Web Store click.
       Caleb approved 2026-09-19. -->
  <script>
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '1601820741955520');
    fbq('track', 'PageView');
    fbq('track', 'ViewContent', {content_category: 'guide', content_name: ${JSON.stringify(slug)}});
    document.addEventListener('click', function(e){
      var a = e.target.closest && e.target.closest('a[href*="chromewebstore.google.com"]');
      if (a) fbq('trackCustom', 'InstallClick', {content_name: ${JSON.stringify(slug)}});
    });
  </script>
  <noscript><img height="1" width="1" style="display:none"
    src="https://www.facebook.com/tr?id=1601820741955520&ev=PageView&noscript=1" alt=""></noscript>
  <!-- Carry fbclid through the Chrome Web Store install gap (same as the home page). -->
  <script>
    (function(){
      try{
        var p=new URLSearchParams(location.search),c=p.get('fbclid');
        if(c){localStorage.setItem('nudoiq_fbc','fb.1.'+Date.now()+'.'+c);
              localStorage.setItem('nudoiq_fbc_ts',String(Date.now()));}
      }catch(e){}
    })();
  </script>
  <!-- Google tag (Google Ads AW-18464861190): counts a Chrome Web Store click from any CTA on this page as the
       store-click conversion, so ad sitelinks that land here are measured the same way as /get/. No customer data sent. -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=AW-18464861190"></script>
  <script>window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'AW-18464861190');
    document.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('a[href*="chromewebstore.google.com"]');
      if (a) { try { gtag('event', 'conversion', { send_to: 'AW-18464861190/qNEZCOvXy_8cEIbY3eRE' }); } catch (x) {} } }, true);</script>
  <link rel="alternate" type="text/plain" href="/llms.txt" title="LLM summary">
  <link rel="stylesheet" href="/assets/doc.css">
  <link rel="stylesheet" href="/assets/guide.css">
${extraLd.map((o) => `  <script type="application/ld+json">\n${JSON.stringify(o, null, 2)}\n  </script>`).join('\n')}
</head>
<body>

  <div class="promo">7 days free, no card needed &middot; Runs in your own Chrome &middot; English and Spanish</div>

  <header class="top"><div class="wrap topin">
    <a class="brand" href="/" aria-label="NudoIQ home"><svg class="wordmark" viewBox="0 0 158 40" role="img" aria-label="NudoIQ"><text x="0" y="31" font-family="Inter Tight, Inter, Arial, sans-serif" font-size="32" font-weight="600" letter-spacing="-0.03em"><tspan fill="#3366FF">N</tspan><tspan fill="#161616">udoIQ</tspan></text></svg></a>
    <nav class="navpills" aria-label="Main navigation">
      <a href="/#features">Features</a><a href="/#pricing">Pricing</a><a href="/guides/">Guides</a><a href="/#faq">FAQ</a>
    </nav>
    <div class="navright">
      <a class="btn btn-go btn-sm" href="${CWS}" target="_blank" rel="noopener">Add NudoIQ to Chrome</a>
    </div>
  </div></header>
`;
}

const FOOT = `
    <div class="footer">
      &copy; 2026 NudoIQ &nbsp;&middot;&nbsp; <a href="/">nudoiq.com</a> &nbsp;&middot;&nbsp; <a href="/guides/">Amazon Relay guides</a> &nbsp;&middot;&nbsp; <a href="/privacy.html">Privacy</a> &nbsp;&middot;&nbsp; <a href="/refund-policy.html">Refund policy</a> &nbsp;&middot;&nbsp; <a href="/terms.html">Terms</a> &nbsp;&middot;&nbsp; <a href="mailto:contact@nudoiq.com">Contact</a>
    </div>
    <p class="tm">Amazon and Amazon Relay are trademarks of Amazon.com, Inc. or its affiliates. NudoIQ is an independent product and is not affiliated with, endorsed by, or sponsored by Amazon.com, Inc. Amazon Relay requirements change; confirm current rules at relay.amazon.com.</p>

  </div>
</body>
</html>
`;

const crumbs = (items) => items.map(([n, u]) =>
  u ? `<a href="${u}">${esc(n)}</a>` : `<span aria-current="page">${esc(n)}</span>`).join(' &nbsp;&rsaquo;&nbsp; ');
const crumbLd = (items) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([n, u], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: SITE + (u || '') })),
});

// ── load ─────────────────────────────────────────────────────────
const pages = fs.readdirSync(SRC).filter((f) => /^[a-z][a-z0-9-]*.md$/.test(f))
  .map((f) => parse(path.join(SRC, f)))
  .sort((a, b) => (ORDER.indexOf(a.slug) + 1 || 99) - (ORDER.indexOf(b.slug) + 1 || 99));
if (!pages.length) { console.error('No guide sources found in', SRC); process.exit(1); }

const fmtDate = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const n = (v) => (typeof v === 'number' ? v.toLocaleString('en-US') : v);

// [[chart:<id>]] and [[csv]] in the copy become a table-chart (a real <table> with CSS bars, no JS) or the CSV link.
function placeholder(key) {
  if (key === 'csv') {
    return `<p class="dl"><a href="/${DATA_SLUG}/${CSV_NAME}" download>${CSV_NAME}</a> <span>(CSV, aggregate numbers only)</span></p>`;
  }
  const c = DATA.charts[key.slice(6)];
  if (!c) throw new Error(`unknown chart placeholder ${key}`);
  const bi = c.bar;
  const max = Math.max(...c.rows.map((r) => r[bi]));
  const total = c.rows.reduce((t, r) => t + r[bi], 0);
  const cell = (v) => (c.pct ? `${v.toFixed(1)}%` : n(v));
  const rows = c.rows.map((r) => {
    const w = max ? Math.max(0.5, (r[bi] / max) * 100) : 0;
    const cells = r.slice(1).map((v, j) => (j + 1 === bi
      ? `<td class="bar"><span class="b" style="width:${w.toFixed(1)}%"></span><span class="v">${cell(v)}</span></td>`
      : `<td class="num">${cell(v)}</td>`)).join('');
    const share = c.share ? `<td class="num">${((r[bi] / total) * 100).toFixed(1)}%</td>` : '';
    return `<tr><th scope="row">${esc(r[0])}</th>${cells}${share}</tr>`;
  }).join('');
  return `<figure class="chart" id="chart-${key.slice(6)}"><figcaption>${esc(c.caption)}</figcaption>
<div class="tbl"><table><thead><tr>${c.cols.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
<p class="src">Source: ${esc(c.source)}</p></figure>`;
}

function writeCsv() {
  const q = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const lines = [['section', 'label', 'metric', 'value', 'unit', 'window', 'source'].join(',')];
  for (const [label, v, unit, win] of DATA.headline) {
    lines.push(['headline', label, 'value', v, unit, win, 'FMCSA Vehicle Inspection File (fx4q-ay7w)'].map(q).join(','));
  }
  for (const [id, c] of Object.entries(DATA.charts)) {
    for (const r of c.rows) {
      r.slice(1).forEach((v, j) => lines.push([id, r[0], c.cols[j + 1], v, c.pct ? 'percent' : 'count', DATA.window, c.source].map(q).join(',')));
    }
  }
  fs.mkdirSync(path.join(ROOT, DATA_SLUG), { recursive: true });
  fs.writeFileSync(path.join(ROOT, DATA_SLUG, CSV_NAME), lines.join('\n') + '\n');
}

for (const p of pages) {
  const url = `${SITE}/${p.slug}/`;
  const isData = p.slug === DATA_SLUG;
  p.published = p.published || FIRST_PUBLISHED;
  p.updated = p.updated || p.published;
  const authorLd = isData
    ? { '@type': 'Person', name: 'Caleb', jobTitle: 'Founder', worksFor: { '@id': `${SITE}/#organization` } }
    : { '@type': 'Organization', name: 'NudoIQ', url: SITE + '/' };
  const trail = [['Home', '/'], ['Guides', '/guides/'], [stripMd(p.h1), `/${p.slug}/`]];
  const article = { '@context': 'https://schema.org', '@type': 'Article', headline: stripMd(p.h1), description: p.description,
    mainEntityOfPage: url, url, image: `${SITE}/assets/og-image-1200x630.png`, datePublished: p.published, dateModified: p.updated,
    inLanguage: 'en-US', author: authorLd,
    publisher: { '@type': 'Organization', '@id': `${SITE}/#organization`, name: 'NudoIQ', logo: { '@type': 'ImageObject', url: `${SITE}/brand/mark/icon128.png` } } };
  if (p.answer) article.abstract = p.answer;
  const ld = [article, crumbLd(trail.map(([nm, u], i) => [nm, i === trail.length - 1 ? `/${p.slug}/` : u]))];
  if (p.faq.length) {
    ld.push({ '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: p.faq.map((f) => ({ '@type': 'Question', name: stripMd(f.q), acceptedAnswer: { '@type': 'Answer', text: stripMd(f.a) } })) });
  }
  ld.push({ '@context': 'https://schema.org', '@graph': [ORG, SOFTWARE] });
  if (isData) {
    ld.push({ '@context': 'https://schema.org', '@type': 'Dataset', name: stripMd(p.h1), description: p.description,
      url, creator: { '@id': `${SITE}/#organization` }, author: authorLd, datePublished: p.published, dateModified: p.updated,
      temporalCoverage: '2023-09-24/2026-09-22', spatialCoverage: { '@type': 'Place', name: 'United States' },
      keywords: ['Amazon Relay', 'Amazon freight', 'FMCSA roadside inspections', 'trucking carriers', 'motor carriers'],
      isBasedOn: ['https://data.transportation.gov/d/fx4q-ay7w', 'https://data.transportation.gov/d/wt8s-2hbx', 'https://data.transportation.gov/d/az4n-8mr2'],
      variableMeasured: Object.values(DATA.charts).map((c) => c.caption).concat(DATA.headline.map((h) => h[0])),
      distribution: [{ '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: `${url}${CSV_NAME}` }] });
  }

  const related = pages.filter((o) => o.slug !== p.slug);
  // Prefer neighbours in ORDER so every page links to a different set.
  const L = ORDER.length;
  const idx = ORDER.indexOf(p.slug);
  related.sort((a, b) => ((ORDER.indexOf(a.slug) - idx + L) % L) - ((ORDER.indexOf(b.slug) - idx + L) % L));
  const byline = `<p class="byline">${isData ? 'By Caleb, NudoIQ' : 'NudoIQ'} &middot; Published <time datetime="${p.published}">${fmtDate(p.published)}</time> &middot; Last updated <time datetime="${p.updated}">${fmtDate(p.updated)}</time></p>`;

  const html = head({ title: p.title, description: p.description, url, extraLd: ld, slug: p.slug }) + `
  <div class="doc-hero"><div class="doc-hero-in">
    <nav class="crumbs" aria-label="Breadcrumb">${crumbs(trail.map(([nm, u], i) => [nm, i === trail.length - 1 ? null : u]))}</nav>
    <h1 class="page-title">${inline(p.h1)}</h1>
    ${p.intro ? `<p class="page-subtitle">${inline(p.intro)}</p>` : ''}
    ${byline}
  </div></div>

  <div class="container">
    <article class="prose">
${p.answer ? `<section class="answer" aria-label="Short answer"><p class="lbl">Short answer</p><p>${inline(p.answer)}</p></section>\n` : ''}${md(p.body, { h2Ids: true })}
    </article>
${p.faq.length ? `
    <section class="faq" aria-labelledby="faq-h">
      <h2 id="faq-h">Frequently asked questions</h2>
${p.faq.map((f) => `      <details><summary>${inline(f.q)}</summary><div class="a">${md(f.a)}</div></details>`).join('\n')}
    </section>` : ''}

    <aside class="cta">
      <div><h2>Know what the next load is worth before you take it.</h2><p>7 days free, no card needed &middot; 5.0 on the Chrome Web Store</p></div>
      <a class="btn btn-go" href="${CWS}" target="_blank" rel="noopener">Start the 7-day trial</a>
    </aside>

    <nav class="related" aria-label="More Amazon Relay guides">
      <h2>More Amazon Relay guides</h2>
      <div class="cards">
${related.slice(0, 6).map((o) => `        <a href="/${o.slug}/">${inline(o.h1)}</a>`).join('\n')}
      </div>
    </nav>
${FOOT}`;
  fs.mkdirSync(path.join(ROOT, p.slug), { recursive: true });
  fs.writeFileSync(path.join(ROOT, p.slug, 'index.html'), html);
}
if (pages.some((p) => p.slug === DATA_SLUG)) writeCsv();

// ── hub ──────────────────────────────────────────────────────────
{
  const trail = [['Home', '/'], ['Guides', null]];
  // Hub words also come from the copywriter: research/seo-pages/_hub.md (frontmatter only).
  const hub = parse(path.join(SRC, '_hub.md'));
  const { title, description } = hub;
  const ld = [crumbLd([['Home', '/'], ['Guides', '/guides/']]),
    { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: pages.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/${p.slug}/`, name: stripMd(p.h1) })) }];
  const html = head({ title, description, url: `${SITE}/guides/`, extraLd: ld, slug: 'guides' }) + `
  <div class="doc-hero"><div class="doc-hero-in">
    <nav class="crumbs" aria-label="Breadcrumb">${crumbs(trail)}</nav>
    <h1 class="page-title">${inline(hub.h1)}</h1>
    ${hub.intro ? `<p class="page-subtitle">${inline(hub.intro)}</p>` : ''}
  </div></div>

  <div class="container" style="max-width:calc(var(--max) + 48px)">
    <section class="hub">
      <div class="cards">
${pages.map((p) => `        <a href="/${p.slug}/">${inline(p.h1)}<span>${esc(p.description)}</span></a>`).join('\n')}
      </div>
    </section>
${FOOT}`;
  fs.mkdirSync(path.join(ROOT, 'guides'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'guides', 'index.html'), html);
}

// ── sitemap ──────────────────────────────────────────────────────
{
  const file = path.join(ROOT, 'sitemap.xml');
  let xml = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const urls = ['guides', ...pages.map((p) => p.slug)];
  const lastmod = (sl) => (sl === 'guides' ? pages.reduce((m, p) => (p.updated > m ? p.updated : m), FIRST_PUBLISHED) : pages.find((p) => p.slug === sl).updated);
  for (const s of urls) {
    const loc = `${SITE}/${s}/`;
    const entry = `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod(s)}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${s === 'guides' ? '0.8' : '0.7'}</priority>\n  </url>\n`;
    const re = new RegExp(`  <url>\\n    <loc>${loc.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}</loc>[\\s\\S]*?</url>\\n`);
    xml = re.test(xml) ? xml.replace(re, entry) : xml.replace('</urlset>', entry + '</urlset>');
  }
  fs.writeFileSync(file, xml);
}

// ── llms.txt + llms-full.txt ─────────────────────────────────────
// Prose comes from the copywriter (research/seo-pages/_llms-*.md, newest file wins). This script only appends
// the page index (titles and meta descriptions, which are also copywriter text) and, for llms-full.txt,
// every guide's own Markdown with chart placeholders expanded into Markdown tables.
{
  const llmsSrc = fs.readdirSync(SRC).filter((f) => /^_llms-\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort().pop();
  if (llmsSrc) {
    const prose = fs.readFileSync(path.join(SRC, llmsSrc), 'utf8').replace(/\r\n/g, '\n').trim();
    const mdChart = (key) => {
      if (key === 'csv') return `CSV download: ${SITE}/${DATA_SLUG}/${CSV_NAME}`;
      const c = DATA.charts[key.slice(6)];
      const cols = c.share ? [...c.cols] : c.cols;
      const total = c.rows.reduce((t, r) => t + r[c.bar], 0);
      const fmt = (v) => (c.pct ? `${v.toFixed(1)}%` : n(v));
      return [`${c.caption}:`, '', `| ${cols.join(' | ')} |`, `|${cols.map(() => '---').join('|')}|`,
        ...c.rows.map((r) => `| ${r[0]} | ${r.slice(1).map(fmt).join(' | ')}${c.share ? ` | ${((r[c.bar] / total) * 100).toFixed(1)}%` : ''} |`),
        '', `Source: ${c.source}`].join('\n');
    };
    const abs = (s) => s.replace(/\]\(\/(?!\/)/g, `](${SITE}/`);
    const index = [
      '## Pages', '',
      `- [NudoIQ home](${SITE}/): product overview, features, pricing and FAQ.`,
      `- [NudoIQ en español](${SITE}/es/): the home page in Spanish.`,
      `- [Amazon Relay guides](${SITE}/guides/): every guide below in one list.`,
      ...pages.map((p) => `- [${stripMd(p.h1)}](${SITE}/${p.slug}/): ${p.description}`),
      '', '## Data', '',
      `- [${CSV_NAME}](${SITE}/${DATA_SLUG}/${CSV_NAME}): aggregate FMCSA inspection numbers behind ${SITE}/${DATA_SLUG}/ (no carrier names or DOT numbers).`,
      '', '## Optional', '',
      `- [Privacy policy](${SITE}/privacy.html)`, `- [Refund policy](${SITE}/refund-policy.html)`, `- [Terms](${SITE}/terms.html)`,
      `- [Full text of every guide](${SITE}/llms-full.txt)`,
    ].join('\n');
    fs.writeFileSync(path.join(ROOT, 'llms.txt'), `${prose}\n\n${index}\n`);
    const full = pages.map((p) => [
      `# ${stripMd(p.h1)}`, '', `URL: ${SITE}/${p.slug}/`, `Published: ${p.published}. Last updated: ${p.updated}.`, '',
      p.answer ? `Short answer: ${p.answer}\n` : '',
      abs(p.body.replace(/^\s*\[\[(chart:[a-z-]+|csv)\]\]\s*$/gm, (_, k) => mdChart(k))), '',
      p.faq.length ? '## Frequently asked questions\n\n' + p.faq.map((f) => `### ${f.q}\n${abs(f.a)}`).join('\n\n') : '',
    ].join('\n')).join('\n\n---\n\n');
    fs.writeFileSync(path.join(ROOT, 'llms-full.txt'), `${prose}\n\n---\n\n${full}\n`);
  } else {
    console.warn('No research/seo-pages/_llms-YYYY-MM-DD.md found; llms.txt left unchanged.');
  }
}

console.log(`Built ${pages.length} guides + hub:`);
for (const p of pages) {
  const words = stripMd(p.body).split(' ').length;
  const warn = [p.title.length > 62 && `title ${p.title.length}ch`, p.description.length > 160 && `desc ${p.description.length}ch`, words < 700 && `${words} words`].filter(Boolean);
  console.log(`  /${p.slug}/  ${words}w  ${p.faq.length} FAQ${warn.length ? '  ⚠ ' + warn.join(', ') : ''}`);
}
