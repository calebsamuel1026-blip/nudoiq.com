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
const TODAY = new Date().toISOString().slice(0, 10);

// Display order on the hub and in "related" lists.
const ORDER = [
  'amazon-relay-load-board', 'what-is-amazon-relay', 'amazon-relay-requirements',
  'amazon-relay-insurance-requirements', 'amazon-relay-box-truck', 'how-much-does-amazon-relay-pay',
  'is-amazon-relay-worth-it', 'amazon-relay-scorecard', 'amazon-relay-auto-refresh',
  'amazon-relay-auto-booker', 'best-amazon-relay-extensions', 'loadfetcher-alternative',
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
  <link rel="stylesheet" href="/assets/doc.css">
  <link rel="stylesheet" href="/assets/guide.css">
${extraLd.map((o) => `  <script type="application/ld+json">\n${JSON.stringify(o, null, 2)}\n  </script>`).join('\n')}
</head>
<body>

  <div class="promo">7-day trial &middot; $49.99/month after trial &middot; Cancel anytime &middot; English and Spanish</div>

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

for (const p of pages) {
  const url = `${SITE}/${p.slug}/`;
  const trail = [['Home', '/'], ['Guides', '/guides/'], [stripMd(p.h1), `/${p.slug}/`]];
  const ld = [
    { '@context': 'https://schema.org', '@type': 'Article', headline: stripMd(p.h1), description: p.description,
      mainEntityOfPage: url, image: `${SITE}/assets/og-image-1200x630.png`, datePublished: p.published || TODAY, dateModified: TODAY,
      author: { '@type': 'Organization', name: 'NudoIQ', url: SITE + '/' },
      publisher: { '@type': 'Organization', name: 'NudoIQ', logo: { '@type': 'ImageObject', url: `${SITE}/brand/mark/icon128.png` } } },
    crumbLd(trail.map(([n, u], i) => [n, i === trail.length - 1 ? `/${p.slug}/` : u])),
  ];
  if (p.faq.length) ld.push({ '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: p.faq.map((f) => ({ '@type': 'Question', name: stripMd(f.q), acceptedAnswer: { '@type': 'Answer', text: stripMd(f.a) } })) });

  const related = pages.filter((o) => o.slug !== p.slug);
  // Prefer neighbours in ORDER so every page links to a different set.
  const idx = ORDER.indexOf(p.slug);
  related.sort((a, b) => ((ORDER.indexOf(a.slug) - idx + 12) % 12) - ((ORDER.indexOf(b.slug) - idx + 12) % 12));

  const html = head({ title: p.title, description: p.description, url, extraLd: ld, slug: p.slug }) + `
  <div class="doc-hero"><div class="doc-hero-in">
    <nav class="crumbs" aria-label="Breadcrumb">${crumbs(trail.map(([n, u], i) => [n, i === trail.length - 1 ? null : u]))}</nav>
    <h1 class="page-title">${inline(p.h1)}</h1>
    ${p.intro ? `<p class="page-subtitle">${inline(p.intro)}</p>` : ''}
  </div></div>

  <div class="container">
    <article class="prose">
${md(p.body, { h2Ids: true })}
    </article>
${p.faq.length ? `
    <section class="faq" aria-labelledby="faq-h">
      <h2 id="faq-h">Frequently asked questions</h2>
${p.faq.map((f) => `      <details><summary>${inline(f.q)}</summary><div class="a">${md(f.a)}</div></details>`).join('\n')}
    </section>` : ''}

    <aside class="cta">
      <div><h2>Know what the next load is worth before you take it.</h2><p>7-day free trial &middot; Cancel anytime &middot; 5.0 on the Chrome Web Store</p></div>
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
  let xml = fs.readFileSync(file, 'utf8');
  const urls = ['guides', ...pages.map((p) => p.slug)];
  for (const s of urls) {
    const loc = `${SITE}/${s}/`;
    const entry = `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${s === 'guides' ? '0.8' : '0.7'}</priority>\n  </url>\n`;
    const re = new RegExp(`  <url>\\n    <loc>${loc.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}</loc>[\\s\\S]*?</url>\\n`);
    xml = re.test(xml) ? xml.replace(re, entry) : xml.replace('</urlset>', entry + '</urlset>');
  }
  fs.writeFileSync(file, xml);
}

console.log(`Built ${pages.length} guides + hub:`);
for (const p of pages) {
  const words = stripMd(p.body).split(' ').length;
  const warn = [p.title.length > 62 && `title ${p.title.length}ch`, p.description.length > 160 && `desc ${p.description.length}ch`, words < 700 && `${words} words`].filter(Boolean);
  console.log(`  /${p.slug}/  ${words}w  ${p.faq.length} FAQ${warn.length ? '  ⚠ ' + warn.join(', ') : ''}`);
}
