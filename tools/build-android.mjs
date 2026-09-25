// Builds /android/index.html from the copywriter's JSON, on the same doc.css shell the policy
// pages use. Rebuild after editing the copy:
//   node nudoiq-website/tools/build-android.mjs
//
// Why this page exists: the cold email lands on a phone, and Chrome on Android cannot run
// extensions, so a carrier reading it on the road currently hits a dead end. Lemur Browser does
// run Chrome Web Store extensions, so this turns the dead end into an install.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.resolve(here, '..');
const src = path.resolve(site, '../research/copy/ANDROID-PAGE-2026-09-25.json');
if (!fs.existsSync(src)) {
  console.error(`no copy at ${src} — the copywriter writes it; this file only lays it out.`);
  process.exit(1);
}
const copy = JSON.parse(fs.readFileSync(src, 'utf8'));
const A = 'style="color:var(--accent);font-weight:600"';
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const steps = (copy.steps || []).map(s => `
      <div class="section">
        <h2>${esc(s.n)}. ${esc(s.heading)}</h2>
        <p>${esc(s.text)}</p>
      </div>`).join('\n');

const faq = (copy.faq || []).map(f => `
      <div class="section">
        <h2>${esc(f.q)}</h2>
        <p>${esc(f.a)}</p>
      </div>`).join('\n');

const title = copy.meta_title || 'NudoIQ on Android | NudoIQ';
const desc = copy.meta_description || '';

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta name="theme-color" content="#FFBB8C">
  <link rel="canonical" href="https://nudoiq.com/android/">
  <link rel="icon" href="/assets/favicon.png" type="image/png" sizes="any">
  <meta property="og:site_name" content="NudoIQ">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://nudoiq.com/android/">
  <meta property="og:image" content="https://nudoiq.com/assets/og-image-1200x630.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="https://nudoiq.com/assets/og-image-1200x630.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&display=swap">
  <script type="text/javascript">
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "y9n5ejt2k9");
  </script>
  <link rel="stylesheet" href="/assets/doc.css">
</head>
<body>

  <div class="promo">7-day trial &middot; $49.99/month after trial &middot; Cancel anytime &middot; English and Spanish</div>

  <header class="top"><div class="wrap topin">
    <a class="brand" href="/" aria-label="NudoIQ home"><svg class="wordmark" viewBox="0 0 158 40" role="img" aria-label="NudoIQ"><text x="0" y="31" font-family="Inter Tight, Inter, Arial, sans-serif" font-size="32" font-weight="600" letter-spacing="-0.03em"><tspan fill="#3366FF">N</tspan><tspan fill="#161616">udoIQ</tspan></text></svg></a>
    <nav class="navpills" aria-label="Main navigation">
      <a href="/#features">Features</a><a href="/#pricing">Pricing</a><a href="/#faq">FAQ</a>
    </nav>
    <div class="navright">
      <div class="lang" aria-label="Language"><a href="/" hreflang="en" aria-current="page">EN</a><a href="/es/" hreflang="es">ES</a></div>
      <a class="btn btn-go btn-sm" href="https://chromewebstore.google.com/detail/nudoiq/bjilnjgfdndecmamphkkcpplfmniocgk" target="_blank" rel="noopener">Add NudoIQ to Chrome</a>
    </div>
  </div></header>

  <div class="doc-hero"><div class="doc-hero-in">
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="/">Home</a> &nbsp;&rsaquo;&nbsp; <span aria-current="page">Android</span>
  </nav>
    <h1 class="page-title">${esc(copy.h1 || 'NudoIQ on Android')}</h1>
    <p class="page-subtitle">${esc(copy.intro || '')}</p>
  </div></div>

  <div class="container">

    <div class="section" style="border-left:3px solid var(--accent);padding-left:16px">
      <p><strong>${esc(copy.honesty_note || '')}</strong></p>
    </div>

${steps}

    <div class="section">
      <h2>Near a computer instead?</h2>
      <p>${esc(copy.computer_instead || '')}</p>
      <p><a href="https://chromewebstore.google.com/detail/nudoiq/bjilnjgfdndecmamphkkcpplfmniocgk" target="_blank" rel="noopener" ${A}>Add NudoIQ to Chrome</a> &nbsp;&middot;&nbsp; <a href="/get/" ${A}>Get the link on your computer</a></p>
    </div>

${faq}

    <div class="footer">
      &copy; 2026 NudoIQ &nbsp;&middot;&nbsp; <a href="/">nudoiq.com</a> &nbsp;&middot;&nbsp; <a href="/privacy.html">Privacy policy</a> &nbsp;&middot;&nbsp; <a href="/terms.html">Terms of Service</a> &nbsp;&middot;&nbsp; <a href="/support/">Support</a> &nbsp;&middot;&nbsp; <a href="/es/" hreflang="es">Espa&ntilde;ol</a> &nbsp;&middot;&nbsp; Independent software for Amazon Relay carriers
    </div>

  </div>

  <script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": ${JSON.stringify(copy.h1 || 'Install NudoIQ on Android')},
  "step": ${JSON.stringify((copy.steps || []).map(s => ({
    '@type': 'HowToStep', position: s.n, name: s.heading, text: s.text,
  })))}
}
  </script>
</body>
</html>
`;

fs.mkdirSync(path.join(site, 'android'), { recursive: true });
fs.writeFileSync(path.join(site, 'android', 'index.html'), html, 'utf8');
console.log(`android/index.html  ${(copy.steps || []).length} steps  ${html.length} bytes`);
