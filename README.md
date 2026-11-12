# nudoiq.com

The marketing site for NudoIQ, a Chrome extension that works inside the Amazon Relay load board for owner-operators, small fleets and dispatchers.

Live: **https://nudoiq.com**

## Why

Carriers on Amazon Relay spend hours refreshing the load board and doing per-load math by hand. The extension refreshes the board, alerts or books loads that clear the carrier's own rules, and shows net profit per load. This site explains it, answers the questions carriers search for, and sends them to the Chrome Web Store.

NudoIQ is independent and not affiliated with Amazon.

## How it works

- **Static HTML on GitHub Pages** (custom domain in `CNAME`). Each page is a folder with an `index.html`: the home page, feature and comparison pages, and a set of guide pages that answer specific Amazon Relay questions.
- **Generated pages.** Node scripts in `tools/` build pages from data or copy files, so copy changes don't require editing HTML by hand:
  - `build-es.mjs` writes the Spanish home page (`es/`) from `index.html` plus `es-dictionary.json`, localizing meta tags and JSON-LD; `check-i18n.mjs` fails when the two drift apart
  - `build-guides.mjs` builds the guide pages from Markdown
  - `build-lane-pages.mjs` builds lane rate pages from the product's own board data
  - `build-support.mjs`, `build-android.mjs` build doc pages from JSON copy
  - `apply-copy.mjs` applies a copy handoff to `index.html` and the Spanish dictionary
  - `stamp-store-utm.mjs` tags every Chrome Web Store link so installs can be split by page (`--check` for CI)
  - `indexnow.mjs` pings IndexNow after a deploy
- **Free tools** (`tools/relay-load-calculator/`, `tools/relay-dispute-letter/`): browser-only calculators published as pages.
- **Funnel tracking.** Pages post a closed set of funnel events to a Supabase Edge Function.
- **Search and AI discoverability.** `sitemap.xml`, `robots.txt`, `hreflang` between English and Spanish, JSON-LD, and `llms.txt` / `llms-full.txt` summaries for language-model crawlers.
- `_config.yml` keeps the build scripts and their data out of the published site.

## Tech stack

HTML, CSS and vanilla JavaScript, Node.js build scripts (ES modules, no dependencies to install), Supabase Edge Functions for funnel events, GitHub Pages with a custom domain.

## Run locally

```bash
python -m http.server 8000         # then open http://localhost:8000
node tools/build-es.mjs            # after changing English copy in index.html
node tools/check-i18n.mjs          # confirm the English and Spanish pages match
```
