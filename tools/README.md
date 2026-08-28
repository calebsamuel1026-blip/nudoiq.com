# tools/

## es-dictionary.json
The Spanish copy for every `data-t="<key>"` element on the site.

The site used to ship this dictionary as an inline JavaScript object in
`index.html` and swap text on click. That kept the Spanish copy invisible to
search engines — one URL, one indexable language. Spanish now lives at its own
indexable URL (`/es/index.html`) with `hreflang` pointing both ways, and the
inline dictionary was removed (it also cut ~7.6 KB of JS from every page load).

## build-es.mjs
`es/index.html` is **generated**. Never edit it by hand.

```bash
node tools/build-es.mjs
```

It reads `index.html` plus `es-dictionary.json`, swaps every `data-t` string,
localizes the title/description/canonical/og tags and the JSON-LD, rewrites
relative asset paths for the subdirectory, and writes `es/index.html`. It exits
non-zero listing any key that has no Spanish entry.

## Changing copy
1. Edit the English string in `index.html`.
2. Add or update the matching key in `es-dictionary.json`.
3. `node tools/build-es.mjs`
4. `node tools/check-i18n.mjs` to confirm the two pages are in sync.

`check-i18n.mjs` reports keys missing from the Spanish page, keys that exist
only there, and keys whose text is still identical in both. It exits non-zero
when the pages have drifted, so it can be wired into CI.
