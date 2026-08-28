#!/usr/bin/env node
// Regenerates es/index.html from index.html + tools/es-dictionary.json.
// Run after any copy change to index.html:  node tools/build-es.mjs
import fs from 'node:fs';

const src = fs.readFileSync('index.html', 'utf8');
const es = JSON.parse(fs.readFileSync('tools/es-dictionary.json', 'utf8'));

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

let doc = src;
const missing = [];
let n = 0;

// every [data-t] element is a leaf, so its text runs to the next tag
doc = doc.replace(/(data-t="([A-Za-z0-9]+)"[^>]*>)([^<]*)(<)/g, (whole, open, key, body, close) => {
  if (!(key in es)) { missing.push(key); return whole; }
  n++;
  return open + esc(es[key]) + close;
});

doc = doc.replace('<html lang="en">', '<html lang="es">');
doc = doc.replace('<a href="/" hreflang="en" aria-current="page">EN</a><a href="/es/" hreflang="es">ES</a>',
                  '<a href="/" hreflang="en">EN</a><a href="/es/" hreflang="es" aria-current="page">ES</a>');

const TITLE_ES = 'NudoIQ | Herramientas para el tablero de cargas de Amazon Relay';
const DESC_ES = 'Alertas de cargas, tarifas de mercado, cartas de disputa de scorecard, reportes de flota y pagos a conductores. Extensión de Chrome para Amazon Relay.';
const SOCIAL_ES = 'Inteligencia de tarifas de mercado, cartas de disputa de scorecard, alertas de cargas, reportes de flota y estados de pago para transportistas de Amazon Relay.';

doc = doc.replace(/<title>[^<]*<\/title>/, '<title>' + TITLE_ES + '</title>');
doc = doc.replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + DESC_ES + '">');
doc = doc.replace('<link rel="canonical" href="https://nudoiq.com/">', '<link rel="canonical" href="https://nudoiq.com/es/">');
doc = doc.replace('<meta property="og:url" content="https://nudoiq.com/">', '<meta property="og:url" content="https://nudoiq.com/es/">');
doc = doc.replace('<meta property="og:locale" content="en_US">', '<meta property="og:locale" content="es_US">');
doc = doc.replace('<meta property="og:locale:alternate" content="es_US">', '<meta property="og:locale:alternate" content="en_US">');
doc = doc.replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + TITLE_ES + '">');
doc = doc.replace(/<meta name="twitter:title" content="[^"]*">/, '<meta name="twitter:title" content="' + TITLE_ES + '">');
doc = doc.replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + SOCIAL_ES + '">');
doc = doc.replace(/<meta name="twitter:description" content="[^"]*">/, '<meta name="twitter:description" content="' + SOCIAL_ES + '">');

// page now lives one level down
doc = doc.replace(/(src|href)="(assets\/[^"]+)"/g, '$1="/$2"');
doc = doc.replace(/href="(privacy\.html|refund-policy\.html)"/g, 'href="/$1"');

// localize structured data
const ldRe = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/;
const graph = JSON.parse(src.match(ldRe)[1]);
for (const node of graph['@graph']) {
  if (node['@type'] === 'WebPage') {
    node['@id'] = 'https://nudoiq.com/es/#webpage';
    node.url = 'https://nudoiq.com/es/';
    node.name = TITLE_ES;
    node.inLanguage = 'es-US';
  }
  if (node['@type'] === 'FAQPage') {
    node['@id'] = 'https://nudoiq.com/es/#faq';
    node.isPartOf = { '@id': 'https://nudoiq.com/es/#webpage' };
    node.inLanguage = 'es-US';
    const faqIds = [];
    for (let i = 1; es['faq' + i + 'Q']; i++) faqIds.push(i);
    node.mainEntity = faqIds.map((i) => ({
      '@type': 'Question',
      name: es['faq' + i + 'Q'],
      acceptedAnswer: { '@type': 'Answer', text: i === 6 ? es.faq6A + ' contact@nudoiq.com ' + es.faq6B : es['faq' + i + 'A'] },
    }));
  }
  if (node['@type'] === 'SoftwareApplication') {
    if (Array.isArray(node.review)) {
      node.review = node.review.map((r, i) => ({ ...r, reviewBody: es['review' + (i + 1)] || r.reviewBody }));
    }
    node.description = 'NudoIQ es una extensión de Chrome para transportistas de Amazon Relay: inteligencia de tarifas de mercado, cartas de disputa de scorecard, alertas de cargas, reglas de búsqueda y reserva, ruta para camiones, resumen HOS, reportes de flota y estados de pago para conductores.';
    node.featureList = [es.price1, es.price2, es.price3, es.priceDispute, es.price4, es.price5, es.price6];
  }
}
doc = doc.replace(ldRe, () => '<script type="application/ld+json">' + String.fromCharCode(10) + JSON.stringify(graph, null, 2) + String.fromCharCode(10) + '  </script>');

if (missing.length) {
  console.error('Missing Spanish for: ' + [...new Set(missing)].join(', '));
  process.exit(1);
}
fs.mkdirSync('es', { recursive: true });
fs.writeFileSync('es/index.html', doc);
console.log('es/index.html rebuilt: ' + n + ' strings translated, ' + doc.length + ' bytes');
