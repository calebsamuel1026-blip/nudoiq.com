/* ---------------------------------------------------------------------------
 * proof-zoom.js — make the two things visitors actually click do something.
 *
 * WHY THIS EXISTS. Microsoft Clarity, 7 days: 25 homepage sessions produced 24
 * dead clicks, and the ranked targets were not the nav. They were the product
 * screenshots and the price:
 *
 *     "Privacy-safe product exam…"      64 dead clicks
 *     "$49.99 a month. Every fea…"      64
 *     "The board said $632. Nudo…"      48
 *     "NudoIQ Bid Advisor showin…"      48
 *
 * A dead click is Clarity's name for a click that changed nothing. People were
 * reaching for a closer look at the evidence and for the offer, and both were
 * inert. The nav anchors, for the record, were fine — #features, #pricing and
 * #faq all resolve; that hypothesis was checked and dropped.
 *
 * The sample is small and mostly not carriers (see the launch-readiness audit:
 * the traffic that week was Caleb, Claude, and the Chrome Web Store review team
 * in India). But the SHAPE of the signal is worth building for, because it is
 * behaviour rather than opinion: the two things a visitor reaches for are the
 * proof and the price.
 *
 * WHAT IT DOES
 *   1. Every product screenshot opens full-size in a lightbox, captioned with
 *      its own alt text, and fires ProofZoom with the shot name — so once there
 *      is real traffic we learn WHICH screenshot people want to inspect. That
 *      is a direct read on which feature is doing the selling.
 *   2. The pricing headline and the price card become real links to the Chrome
 *      Web Store.
 *
 * ON POINT 2, THE IMPORTANT DETAIL: they are real <a href> elements pointing at
 * the store, NOT click handlers. That is deliberate. mobile-bridge.js already
 * delegates on `a[href*=chromewebstore]` — it fires StoreClick on desktop and
 * intercepts with the install-needs-a-computer sheet on mobile. Using an anchor
 * means both behaviours are inherited for free and cannot drift out of sync
 * with the ones on the existing buttons. Re-implementing either here would be
 * two copies of the same rule.
 * ------------------------------------------------------------------------- */
(function () {
  'use strict';

  var STORE = 'https://chromewebstore.google.com/detail/nudoiq/bjilnjgfdndecmamphkkcpplfmniocgk';

  function track(name, params) {
    try { if (window.fbq) window.fbq('trackCustom', name, params || {}); } catch (e) {}
    try { if (window.clarity) window.clarity('event', name); } catch (e) {}
  }

  /* ── 1. Screenshot lightbox ─────────────────────────────────────────── */

  function styles() {
    var css = [
      '.nq-zoom-b{position:fixed;inset:0;background:rgba(10,10,12,.88);z-index:9990;',
        'opacity:0;transition:opacity .16s ease;display:flex;align-items:center;justify-content:center;padding:24px}',
      '.nq-zoom-b.is-open{opacity:1}',
      '.nq-zoom-f{max-width:min(1400px,96vw);max-height:92vh;display:flex;flex-direction:column;gap:10px}',
      '.nq-zoom-f img{max-width:100%;max-height:82vh;object-fit:contain;border-radius:6px;',
        'background:#fff;box-shadow:0 24px 70px -20px rgba(0,0,0,.7)}',
      '.nq-zoom-cap{color:#E7E7EA;font:400 13px/1.45 "Inter Tight",Inter,system-ui,sans-serif;max-width:80ch}',
      '.nq-zoom-x{position:absolute;top:16px;right:18px;width:44px;height:44px;border:0;border-radius:6px;',
        'background:rgba(255,255,255,.12);color:#fff;font-size:24px;line-height:1;cursor:pointer}',
      '.nq-zoom-x:hover{background:rgba(255,255,255,.22)}',
      // the affordance: without it nobody knows the image is clickable
      'img[data-nq-zoom]{cursor:zoom-in}',
      '@media (prefers-reduced-motion:reduce){.nq-zoom-b{transition:none}}'
    ].join('');
    var s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  function open(img) {
    var opener = document.activeElement;

    var b = document.createElement('div');
    b.className = 'nq-zoom-b';
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-modal', 'true');
    b.setAttribute('aria-label', img.getAttribute('alt') || 'Product screenshot');

    var f = document.createElement('div');
    f.className = 'nq-zoom-f';

    var big = document.createElement('img');
    big.src = img.currentSrc || img.src;
    big.alt = img.getAttribute('alt') || '';

    var cap = document.createElement('p');
    cap.className = 'nq-zoom-cap';
    cap.textContent = img.getAttribute('alt') || '';

    var x = document.createElement('button');
    x.className = 'nq-zoom-x';
    x.type = 'button';
    x.setAttribute('aria-label', 'Close');
    x.innerHTML = '&times;';

    f.appendChild(big);
    if (cap.textContent) f.appendChild(cap);
    b.appendChild(f);
    b.appendChild(x);

    function close() {
      b.classList.remove('is-open');
      document.removeEventListener('keydown', onKey, true);
      setTimeout(function () { b.remove(); if (opener && opener.focus) opener.focus(); }, 180);
    }
    // Captured, because the page's own listeners stop propagation in places.
    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      // Only one focusable element in here, so Tab simply stays on it.
      if (e.key === 'Tab') { e.preventDefault(); x.focus(); }
    }

    b.addEventListener('click', function (e) { if (e.target === b || e.target === f) close(); });
    x.addEventListener('click', close);
    document.addEventListener('keydown', onKey, true);

    document.body.appendChild(b);
    requestAnimationFrame(function () { b.classList.add('is-open'); });
    x.focus();

    // The shot filename is the useful dimension: it says which FEATURE the
    // visitor wanted a closer look at.
    var name = (big.src.split('/').pop() || '').replace(/\.(webp|png|jpg)$/, '');
    track('ProofZoom', { shot: name });
  }

  function wireShots() {
    var shots = [].slice.call(document.querySelectorAll('img[src*="shot-"]'));
    shots.forEach(function (img) {
      if (img.closest('a')) return;           // already does something; leave it
      img.setAttribute('data-nq-zoom', '1');
      img.setAttribute('tabindex', '0');
      img.setAttribute('role', 'button');
      var alt = img.getAttribute('alt') || 'product screenshot';
      img.setAttribute('aria-label', 'Enlarge: ' + alt);
      img.addEventListener('click', function () { open(img); });
      img.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(img); }
      });
    });
    return shots.length;
  }

  /* ── 2. The price becomes a link ────────────────────────────────────── */

  function linkify(el, label) {
    if (!el || el.closest('a')) return false;
    var a = document.createElement('a');
    a.href = STORE;                            // real href: see the header note
    a.setAttribute('aria-label', label);
    a.style.cssText = 'color:inherit;text-decoration:none;display:block;cursor:pointer';
    el.parentNode.insertBefore(a, el);
    a.appendChild(el);
    return true;
  }

  function wirePrice() {
    var n = 0;
    var pricing = document.querySelector('#pricing');
    if (pricing) {
      // The headline carrying the number — 64 dead clicks landed here.
      if (linkify(pricing.querySelector('h2'), 'Get NudoIQ — $49.99 a month')) n++;
      // And the price card itself.
      if (linkify(pricing.querySelector('.price .pricetop'), 'Get NudoIQ — $49.99 a month')) n++;
    }
    // The "what it costs a day" stat card sits far above the pricing section and
    // repeats the number, so it collected clicks of its own.
    [].slice.call(document.querySelectorAll('#features .fig, .figs .fig')).forEach(function (fig) {
      if (/\$49\.99|costs a day/i.test(fig.textContent || '')) {
        var h = fig.querySelector('h3');
        if (h && !h.closest('a')) {
          var a = document.createElement('a');
          a.href = '#pricing';
          a.style.cssText = 'color:inherit;text-decoration:none';
          h.parentNode.insertBefore(a, h);
          a.appendChild(h);
          n++;
        }
      }
    });
    return n;
  }

  function init() {
    styles();
    var shots = wireShots();
    var priced = wirePrice();
    if (window.console && console.debug) {
      console.debug('[NudoIQ] proof-zoom: ' + shots + ' shots, ' + priced + ' price targets');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
