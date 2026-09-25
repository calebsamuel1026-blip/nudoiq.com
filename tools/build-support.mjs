// Builds /support/index.html from the copywriter's JSON, on the same doc.css shell
// every other policy page uses. Rebuild after editing the copy:
//   node nudoiq-website/tools/build-support.mjs
//
// The only thing this does to the words is link markup: the copy carries bare URLs
// and a chrome://extensions href, which Chrome refuses to navigate to from a web
// page, so that one becomes plain text instead of a dead link.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.resolve(here, '..');
const copy = JSON.parse(fs.readFileSync(
  path.resolve(site, '../research/copy/SUPPORT-PAGE-2026-09-24.json'), 'utf8'));

const A = 'style="color:var(--accent);font-weight:600"';

function polish(html) {
  return html
    // chrome://extensions cannot be linked from a page — Chrome blocks the navigation.
    .replace(/<a href="chrome:\/\/extensions">([^<]*)<\/a>/g, '<strong>$1</strong>')
    // bare addresses the copy wrote as text or as their own link text
    .replace(/<strong>contact@nudoiq\.com<\/strong>/g,
             `<a href="mailto:contact@nudoiq.com" ${A}>contact@nudoiq.com</a>`)
    .replace(/(?<!["/>])\bcontact@nudoiq\.com\b(?![^<]*<\/a>)/g,
             `<a href="mailto:contact@nudoiq.com" ${A}>contact@nudoiq.com</a>`)
    .replace(/<strong>https:\/\/t\.me\/nudoiqsupport<\/strong>/g,
             `<a href="https://t.me/nudoiqsupport" target="_blank" rel="noopener" ${A}>@nudoiqsupport</a>`)
    .replace(/<a href="https:\/\/t\.me\/nudoiqsupport">[^<]*<\/a>/g,
             `<a href="https://t.me/nudoiqsupport" target="_blank" rel="noopener" ${A}>@nudoiqsupport</a>`)
    // internal links: give them the house style and readable anchor text
    .replace(/<a href="\/billing\/">[^<]*<\/a>/g, `<a href="/billing/" ${A}>Stripe billing portal</a>`)
    .replace(/<a href="\/privacy\.html">[^<]*<\/a>/g, `<a href="/privacy.html" ${A}>privacy policy</a>`)
    .replace(/<a href="\/uninstall\/">[^<]*<\/a>/g, `<a href="/uninstall/" ${A}>uninstall page</a>`)
    .replace(/<a href="\/refund-policy\.html">[^<]*<\/a>/g, `<a href="/refund-policy.html" ${A}>refund policy</a>`)
    .replace(/<a href="\/guides\/">[^<]*<\/a>/g, `<a href="/guides/" ${A}>guides</a>`);
}

const sections = copy.sections.map(s =>
  `    <div class="section">\n      <h2>${s.heading}</h2>\n      ${polish(s.html)}\n    </div>`
).join('\n\n');

const title = 'Support | NudoIQ';
const desc  = copy.meta_description;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>${title}</title>
  <meta name="description" content="${desc}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta name="theme-color" content="#FFBB8C">
  <link rel="canonical" href="https://nudoiq.com/support/">
  <link rel="icon" href="/assets/favicon.png" type="image/png" sizes="any">
  <meta property="og:site_name" content="NudoIQ">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://nudoiq.com/support/">
  <meta property="og:image" content="https://nudoiq.com/assets/og-image-1200x630.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="https://nudoiq.com/assets/og-image-1200x630.png">
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
    <a href="/">Home</a> &nbsp;&rsaquo;&nbsp; <span aria-current="page">Support</span>
  </nav>
    <h1 class="page-title">Support</h1>
    <p class="page-subtitle">NudoIQ Chrome Extension &nbsp;&middot;&nbsp; Last updated: September 24, 2026</p>
  </div></div>

  <div class="container">

${sections}

    <div class="footer">
      &copy; 2026 NudoIQ &nbsp;&middot;&nbsp; <a href="/">nudoiq.com</a> &nbsp;&middot;&nbsp; <a href="/privacy.html">Privacy policy</a> &nbsp;&middot;&nbsp; <a href="/terms.html">Terms of Service</a> &nbsp;&middot;&nbsp; <a href="/refund-policy.html">Refund policy</a> &nbsp;&middot;&nbsp; <a href="/es/" hreflang="es">Espa&ntilde;ol</a> &nbsp;&middot;&nbsp; Independent software for Amazon Relay carriers
    </div>

  </div>

  <script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://nudoiq.com/" },
    { "@type": "ListItem", "position": 2, "name": "Support", "item": "https://nudoiq.com/support/" }
  ]
}
  </script>
</body>
</html>
`;

fs.mkdirSync(path.join(site, 'support'), { recursive: true });
fs.writeFileSync(path.join(site, 'support', 'index.html'), html, 'utf8');
console.log(`support/index.html  ${copy.sections.length} sections  ${html.length} bytes`);
