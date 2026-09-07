/* ---------------------------------------------------------------------------
 * proof-zoom.js — a click on a screenshot is the highest-intent signal on the
 * page, so it opens the feature, not just a bigger picture.
 *
 * WHY THIS EXISTS. Microsoft Clarity, 7 days: 25 homepage sessions produced 24
 * dead clicks, and the ranked targets were not the navigation. They were the
 * product screenshots and the price:
 *
 *     "Privacy-safe product exam…"      64 dead clicks
 *     "$49.99 a month. Every fea…"      64
 *     "The board said $632. Nudo…"      48
 *     "NudoIQ Bid Advisor showin…"      48
 *
 * A dead click is Clarity's name for a click that changed nothing. The nav
 * anchors were the obvious suspect and they are fine — #features, #pricing and
 * #faq all resolve; that hypothesis was checked and dropped before any code.
 *
 * Caleb's read, which is the right one: somebody who clicks a screenshot is not
 * asking for more pixels, they are asking about that feature. So the lightbox
 * carries the feature's own explanation and a way to act on it.
 *
 * WHERE THE WORDS COME FROM. Nothing here is newly written. Every screenshot on
 * this page already sits inside a `div.split` next to its own heading and four
 * or five paragraphs of feature copy. The panel lifts that block verbatim. Two
 * reasons: this session does not write customer-facing copy, and copy that is
 * cloned from the page can never drift out of sync with the page.
 *
 * WHAT IT MEASURES. `ProofZoom` fires with the shot filename, and `ProofZoomCTA`
 * fires when someone goes to the store from inside a panel. Those two together
 * answer a question nobody has been able to answer: **which feature is doing the
 * selling.** We have never had that, and it is the cheapest way to get it.
 *
 * The store link is a real <a href>, not a click handler. mobile-bridge.js
 * already delegates on a[href*=chromewebstore] — StoreClick on desktop, the
 * install-needs-a-computer sheet on mobile. An anchor inherits both and cannot
 * drift out of sync with the buttons elsewhere on the page.
 * ------------------------------------------------------------------------- */
(function () {
  'use strict';

  var STORE = 'https://chromewebstore.google.com/detail/nudoiq/bjilnjgfdndecmamphkkcpplfmniocgk';
  var ES = document.documentElement.lang === 'es' || location.pathname.indexOf('/es') === 0;
  var CTA = ES ? 'Instalar NudoIQ — 7 días gratis' : 'Add NudoIQ to Chrome — 7 days free';
  var CLOSE = ES ? 'Cerrar' : 'Close';

  function track(name, params) {
    try { if (window.fbq) window.fbq('trackCustom', name, params || {}); } catch (e) {}
    try { if (window.clarity) window.clarity('event', name); } catch (e) {}
  }


  /* ── Depth copy: what the panel says that the page does not ──────────
   * Caleb, on the first version: "dont js repeat the information on the main
   * page, talk about how we calculate the lane intelligence prices, our
   * formula". Right — a panel that mirrors the section it sits inside is a
   * bigger picture and nothing else.
   *
   * These are keyed by screenshot filename and take priority over the page
   * copy. The technical facts behind them were read out of content.js and are
   * recorded in research/FEATURE-MECHANISMS.md; the words are the copywriter's,
   * in research/copy/FEATURE-DEPTH-COPY.md. Three features have their
   * mechanism extracted so far — the rest fall back to the page copy, which is
   * weaker but honest, and the gap is written down rather than papered over.
   */
  var DEPTH = {
    'shot-lane-intelligence': {
      h: 'How the price is actually calculated',
      p: "A lane's target price isn't one carrier's screenshot — it's built from ranked evidence: " +
         "confirmed bookings count most, watched departures next, inferred ones least. Under 15 " +
         "observations, the estimate blends toward the wider corridor instead of guessing on thin " +
         "data. Every booking loses half its weight every 21 days, so a three-week-old rate pulls " +
         "half as hard as today's. The confidence label is a real statistic — relative error and " +
         "effective sample size — not a vibe."
    },
    'shot-dispute': {
      h: 'What the dispute letter actually argues',
      p: "The letter argues from Amazon's own policy, not fairness. Load accepted within 5 hours? " +
         "Amazon's policy grants a 30-minute grace period to assign a driver, and a 5-minute " +
         "reassignment window. Held at origin by Amazon staff, or stuck in a cellular dead zone — " +
         "not carrier-controllable, per Amazon's rules. It won't fight traffic delays; Amazon calls " +
         "those carrier-controllable, always. First review is automated: short, citing exact policy " +
         "language and timestamps. Denied? The second draft is longer, demanding a yes-or-no answer."
    },
    'shot-refresher': {
      h: "Why the refresh doesn't slow down in the background",
      p: "Chrome throttles background tabs to about one timer tick a minute. Switch tabs while " +
         "watching the board, and a normal 3-second refresh would quietly stretch to 60 seconds — " +
         "right when you're not looking. NudoIQ runs its refresh loop off a Web Worker, which " +
         "Chrome doesn't throttle the same way, so it keeps firing at full speed in the background. " +
         "Each interval also carries ±20% random jitter, so it never lands on a predictable metronome."
    },
    'shot-net-profit': {
      h: 'Net profit counts the empty mile back',
      p: "A 226-mile load isn't costed at 226 miles. Turn on the empty-return setting and NudoIQ " +
         "doubles it to 452, then adds your deadhead to pickup, before it touches fuel, driver pay, " +
         "or maintenance. Board rate-per-mile never counts that empty leg back. Diesel price is " +
         "pulled live for your state — and if that lookup fails, NudoIQ keeps your last real " +
         "number instead of quietly overwriting every price on the board with a stale average."
    },
    'shot-backhaul': {
      h: 'Backhaul searches from where the trip really ends',
      p: "A tour has no single “destination” field — just a list of stops. NudoIQ reads every " +
         "stop on the trip, keeps only the delivery-type ones, and takes the last one as your actual " +
         "endpoint. Backhaul search then runs from that real endpoint back toward home, inside the " +
         "mileage radius you set. It's searching from where you'll actually be, not from a guess."
    },
    'shot-realmiles': {
      h: 'Real Miles maps every stop, not just two',
      p: "Board mileage on a multi-stop load is often just origin to destination — the stops in " +
         "between don't count. Real Miles builds the actual Google Maps route through every stop on " +
         "the run, so you see the true routed distance before you accept, not after. On a single-stop " +
         "load there's nothing to correct, so it doesn't try."
    },
    'shot-post-truck': {
      h: "Post A Truck can't misreport your equipment",
      p: "Load records get pruned during a long shift to keep memory in check. A pruned record used " +
         "to fall back to a hardcoded 26' box truck — so a carrier running a 53' trailer could get " +
         "posted as a box truck and matched against freight it can't haul. That's fixed. What Post A " +
         "Truck posts now comes from the equipment on your actual load record, every time."
    },
    'shot-instantbook': {
      h: 'Instant Book only books what you searched',
      p: "NudoIQ runs background searches to keep the board fresh — but those searches never become " +
         "what Instant Book submits. What gets booked is built from the search you actually ran and " +
         "saw on screen, not one the software ran behind the scenes. Same rule protects Post A " +
         "Truck's origin: a harvested location never stands in for where you are."
    },
    'shot-autobook': {
      h: 'Autobook confirmations get through quiet hours',
      p: "Set quiet hours and NudoIQ holds new-load and price-up alerts until they end. A booked load " +
         "is different — it's a confirmation, not an interruption, so autobook success messages go " +
         "out on Telegram regardless of quiet hours. You shouldn't have to wake up and wonder if a " +
         "load booked itself while you were asleep."
    }
  };

  /* ── Find the feature block a screenshot belongs to ─────────────────── */

  function detailFor(img) {
    // Climb to the nearest ancestor that is a feature block. `div.split` is the
    // page's own two-column feature layout; stopping there rather than at "any
    // ancestor with a heading" is what keeps the hero image from dragging in
    // the entire page.
    var host = img.closest('.split');
    if (!host) return null;
    var h = host.querySelector('h2, h3');
    var parts = [].slice.call(host.querySelectorAll('p, li'))
      .map(function (n) { return { tag: n.tagName, text: (n.innerText || '').trim() }; })
      .filter(function (n) { return n.text.length > 20; });
    if (!h && !parts.length) return null;
    return { heading: h ? h.innerText.trim() : '', parts: parts };
  }

  /* ── Styles ─────────────────────────────────────────────────────────── */

  function styles() {
    var css = [
      // Visible by default and faded in with a CSS animation rather than by
      // toggling a class from requestAnimationFrame. The class version was
      // observed stuck at opacity 0 on a mobile viewport — the frame callback
      // raced the insert — which renders the whole panel translucent over the
      // page. A keyframe runs on insertion and cannot be missed.
      '@keyframes nq-zoom-in{from{opacity:0}to{opacity:1}}',
      '.nq-zoom-b{position:fixed;inset:0;background:rgba(10,10,12,.88);z-index:9990;opacity:1;',
        'animation:nq-zoom-in .16s ease;transition:opacity .16s ease;overflow:auto;padding:24px;display:flex;align-items:flex-start;justify-content:center}',
      '.nq-zoom-f{background:#fff;border-radius:16px;overflow:hidden;width:min(1180px,96vw);',
        'display:grid;grid-template-columns:minmax(0,1.35fr) minmax(300px,.9fr);',
        'box-shadow:0 30px 90px -24px rgba(0,0,0,.65);margin:auto}',
      '.nq-zoom-img{background:#F4F5F7;display:flex;align-items:center;justify-content:center;padding:18px;min-width:0}',
      '.nq-zoom-img img{max-width:100%;max-height:76vh;object-fit:contain;border-radius:8px;display:block}',
      '.nq-zoom-d{padding:30px 30px 26px;display:flex;flex-direction:column;gap:14px;',
        'font-family:"Inter Tight",Inter,system-ui,-apple-system,Segoe UI,sans-serif;overflow:auto;max-height:88vh}',
      '.nq-zoom-d h3{margin:0;font-size:22px;line-height:1.22;font-weight:600;letter-spacing:-.02em;color:#161616}',
      '.nq-zoom-d p{margin:0;font-size:15px;line-height:1.55;color:#333232}',
      '.nq-zoom-d ul{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:7px}',
      '.nq-zoom-d li{font-size:15px;line-height:1.5;color:#333232}',
      '.nq-zoom-cap{font-size:12.5px;line-height:1.45;color:#6B6B6B;border-top:1px solid #ECECEF;padding-top:12px;margin-top:auto}',
      '.nq-zoom-cta{display:flex;align-items:center;justify-content:center;min-height:48px;padding:14px 18px;',
        'border-radius:999px;background:#3366FF;color:#fff !important;text-decoration:none;font-weight:600;font-size:15.5px}',
      '.nq-zoom-cta:hover{background:#2551B8}',
      '.nq-zoom-x{position:fixed;top:14px;right:16px;width:44px;height:44px;border:0;border-radius:999px;',
        'background:rgba(255,255,255,.16);color:#fff;font-size:22px;line-height:1;cursor:pointer;z-index:9992}',
      '.nq-zoom-x:hover{background:rgba(255,255,255,.28)}',
      'img[data-nq-zoom]{cursor:zoom-in}',
      '@media (max-width:900px){.nq-zoom-f{grid-template-columns:1fr}.nq-zoom-d{max-height:none;padding:22px}',
        '.nq-zoom-img img{max-height:44vh}.nq-zoom-b{padding:12px}}',
      '@media (prefers-reduced-motion:reduce){.nq-zoom-b{animation:none}}'
    ].join('');
    var s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ── The panel ──────────────────────────────────────────────────────── */

  function open(img) {
    var opener = document.activeElement;
    var shot = (img.getAttribute('src').split('/').pop() || '').replace(/\.(webp|png|jpg)$/, '');
    var deep = DEPTH[shot];
    var detail = deep ? { heading: deep.h, parts: [{ tag: 'P', text: deep.p }] } : detailFor(img);
    var alt = img.getAttribute('alt') || '';

    var b = document.createElement('div');
    b.className = 'nq-zoom-b';
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-modal', 'true');
    b.setAttribute('aria-label', detail && detail.heading ? detail.heading : (alt || 'Product screenshot'));

    var f = document.createElement('div');
    f.className = 'nq-zoom-f';

    var pane = document.createElement('div');
    pane.className = 'nq-zoom-img';
    var big = document.createElement('img');
    big.src = img.currentSrc || img.src;
    big.alt = alt;
    pane.appendChild(big);

    var d = document.createElement('div');
    d.className = 'nq-zoom-d';

    if (detail) {
      if (detail.heading) {
        var h = document.createElement('h3');
        h.textContent = detail.heading;
        d.appendChild(h);
      }
      var ul = null;
      detail.parts.forEach(function (part) {
        if (part.tag === 'LI') {
          if (!ul) { ul = document.createElement('ul'); d.appendChild(ul); }
          var li = document.createElement('li');
          li.textContent = part.text;
          ul.appendChild(li);
        } else {
          ul = null;
          var p = document.createElement('p');
          p.textContent = part.text;
          d.appendChild(p);
        }
      });
    }

    // The alt text is the most precise description of what is in the picture —
    // it names the actual numbers on screen — so it earns a place as the caption
    // rather than being thrown away once the image is enlarged.
    if (alt) {
      var cap = document.createElement('p');
      cap.className = 'nq-zoom-cap';
      cap.textContent = alt;
      d.appendChild(cap);
    }

    var a = document.createElement('a');
    a.className = 'nq-zoom-cta';
    a.href = STORE;                      // real href — see the header note
    a.textContent = CTA;
    a.addEventListener('click', function () { track('ProofZoomCTA', { shot: shot }); });
    d.appendChild(a);

    f.appendChild(pane);
    f.appendChild(d);

    var x = document.createElement('button');
    x.className = 'nq-zoom-x';
    x.type = 'button';
    x.setAttribute('aria-label', CLOSE);
    x.innerHTML = '&times;';

    b.appendChild(f);
    b.appendChild(x);

    function close() {
      b.style.opacity = '0';
      document.removeEventListener('keydown', onKey, true);
      document.documentElement.style.overflow = '';
      setTimeout(function () { b.remove(); if (opener && opener.focus) opener.focus(); }, 180);
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
      if (e.key !== 'Tab') return;
      // Keep focus inside: close button and CTA are the only two stops.
      var stops = [x, a];
      var i = stops.indexOf(document.activeElement);
      e.preventDefault();
      stops[(i + (e.shiftKey ? stops.length - 1 : 1)) % stops.length].focus();
    }

    b.addEventListener('click', function (e) { if (e.target === b) close(); });
    x.addEventListener('click', close);
    document.addEventListener('keydown', onKey, true);

    document.documentElement.style.overflow = 'hidden';
    document.body.appendChild(b);
    x.focus();

    track('ProofZoom', { shot: shot, depth: !!deep });
  }

  /* ── Wiring ─────────────────────────────────────────────────────────── */

  function wireShots() {
    var n = 0;
    [].slice.call(document.querySelectorAll('img[src*="shot-"]')).forEach(function (img) {
      if (img.closest('a')) return;
      img.setAttribute('data-nq-zoom', '1');
      img.setAttribute('tabindex', '0');
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', (ES ? 'Ver más sobre: ' : 'See more about: ') +
        (img.getAttribute('alt') || 'this feature'));
      img.addEventListener('click', function () { open(img); });
      img.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(img); }
      });
      n++;
    });
    return n;
  }

  function linkify(el, label) {
    if (!el || el.closest('a')) return false;
    var a = document.createElement('a');
    a.href = STORE;
    a.setAttribute('aria-label', label);
    a.style.cssText = 'color:inherit;text-decoration:none;display:block;cursor:pointer';
    el.parentNode.insertBefore(a, el);
    a.appendChild(el);
    return true;
  }

  function wirePrice() {
    var n = 0, pricing = document.querySelector('#pricing');
    var label = ES ? 'Obtener NudoIQ — $49.99 al mes' : 'Get NudoIQ — $49.99 a month';
    if (pricing) {
      if (linkify(pricing.querySelector('h2'), label)) n++;
      if (linkify(pricing.querySelector('.price .pricetop'), label)) n++;
    }
    [].slice.call(document.querySelectorAll('.fig')).forEach(function (fig) {
      if (!/\$49\.99/.test(fig.textContent || '')) return;
      var h = fig.querySelector('h3');
      if (!h || h.closest('a')) return;
      var a = document.createElement('a');
      a.href = '#pricing';
      a.style.cssText = 'color:inherit;text-decoration:none';
      h.parentNode.insertBefore(a, h);
      a.appendChild(h);
      n++;
    });
    return n;
  }

  function init() {
    styles();
    var s = wireShots(), p = wirePrice();
    if (window.console && console.debug) {
      console.debug('[NudoIQ] proof-zoom: ' + s + ' shots, ' + p + ' price targets');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
