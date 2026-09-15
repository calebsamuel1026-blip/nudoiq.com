/* ---------------------------------------------------------------------------
 * mobile-bridge.js — stop losing 100% of phone traffic.
 *
 * Problem this solves: every CTA on the site points at the Chrome Web Store.
 * On a phone the Web Store's own button reads "Add to Desktop" — Google
 * admitting the install cannot happen there. So today a phone visitor taps a
 * button and hits a wall. Social and paid traffic is overwhelmingly mobile.
 *
 * What this does: on a phone, a CTA no longer navigates. It opens a sheet that
 * hands the visitor a way to get back here from a computer, and fires a Meta
 * pixel event so the intent is measurable instead of invisible.
 *
 * Desktop behaviour is untouched — the links work exactly as before.
 *
 * Copy status: REVIEWED 2026-09-15. The placeholder strings this file shipped with
 * went live on nudoiq.com and stayed live; they are now replaced with copywriter
 * text (research/copy/GAP-REPAIRS-2026-09-15.json). Every visible string still lives
 * in COPY below — change it there and nowhere else, and route the new words through
 * the copywriter, never write them here.
 * ------------------------------------------------------------------------- */
(function () {
  'use strict';

  // --- copy, written by the copywriter agent (Haiku) 2026-09-15 ------------
  // This sheet is what EVERY phone visitor from Instagram, Facebook, TikTok and YouTube
  // Shorts sees, because the product is a desktop Chrome extension. It shipped with the
  // placeholder strings still in it, including 'never touches your Amazon password' - the
  // same unverifiable claim that was deleted from the rest of the site on 2026-09-14.
  // Replaced with reviewed copy. Source: research/copy/GAP-REPAIRS-2026-09-15.json
  var COPY = {
    en: {
      title: "Get NudoIQ on your computer",
      body: "NudoIQ installs on Chrome from any computer. Email the link to yourself, copy it, or come back on desktop. Start free for 7 days.",
      email: "Email me the install link",
      copy: "Copy the link instead",
      copied: "Link copied",
      desktop: "I'll open it on desktop",
      close: "Close",
      subject: "Your NudoIQ install link",
      mailBody: "Install NudoIQ on your computer:\n\n{url}\n\nFree for 7 days, then $49.99/month. Cancel anytime.\nIndependent software. Not affiliated with Amazon."
    },
    es: {
      title: "Instala NudoIQ en tu computadora",
      body: "NudoIQ se instala en Chrome desde cualquier computadora. Envíate el enlace, cópialo, o vuelve en desktop. Prueba gratis 7 días.",
      email: "Enviarme el enlace por correo",
      copy: "Copiar enlace",
      copied: "Enlace copiado",
      desktop: "Lo abro en desktop",
      close: "Cerrar",
      subject: "Tu enlace de instalación de NudoIQ",
      mailBody: "Instala NudoIQ en tu computadora:\n\n{url}\n\nGratis 7 días, luego $49.99/mes. Cancela en cualquier momento.\nSoftware independiente. No afiliado con Amazon."
    }
  };

  var STORE_HOST = 'chromewebstore.google.com';

  // Substring matching on the raw href was wrong in a way that broke a live
  // feature: the mobile sheet's "email me the link" button is a mailto: whose
  // BODY contains the store URL, so the capture listener below matched it,
  // cancelled the email and reopened the sheet — while still logging
  // MobileBridgeEmail as if it had worked. Parsing the resolved anchor instead
  // means only a real https navigation to the store host counts, and mailto:,
  // tel: and same-page anchors can never match no matter what they quote.
  function isStoreLink(a) {
    return !!a && a.protocol === 'https:' && a.hostname === STORE_HOST;
  }

  function isMobile() {
    // Coarse pointer + no hover is the reliable signal; UA is the fallback.
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var ua = /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(navigator.userAgent);
    return coarse || ua;
  }

  function lang() {
    return document.documentElement.lang === 'es' || location.pathname.indexOf('/es') === 0 ? 'es' : 'en';
  }

  function track(name, params) {
    try { if (window.fbq) window.fbq('trackCustom', name, params || {}); } catch (e) {}
    try { if (window.clarity) window.clarity('event', name); } catch (e) {}
  }

  function injectStyles() {
    var css = [
      '.nq-sheet-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.66);z-index:9998;opacity:0;transition:opacity .18s ease}',
      '.nq-sheet-backdrop.is-open{opacity:1}',
      '.nq-sheet{position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#0B0C0E;color:#fff;',
      'border-top-left-radius:6px;border-top-right-radius:6px;padding:24px 20px calc(24px + env(safe-area-inset-bottom));',
      'transform:translateY(100%);transition:transform .22s cubic-bezier(.2,.8,.2,1);font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}',
      '.nq-sheet.is-open{transform:translateY(0)}',
      '.nq-sheet h2{font-size:20px;line-height:1.2;margin:0 0 8px;font-weight:600;letter-spacing:-.02em;color:#fff}',
      '.nq-sheet p{font-size:15px;line-height:1.45;margin:0 0 20px;color:#A8ADB5}',
      '.nq-sheet button,.nq-sheet a.nq-btn{display:block;width:100%;box-sizing:border-box;text-align:center;',
      'font:600 16px/1 Inter,system-ui,sans-serif;padding:16px;border-radius:6px;border:0;margin:0 0 10px;cursor:pointer;text-decoration:none}',
      '.nq-primary{background:#E0A32E;color:#0B0C0E}',
      '.nq-secondary{background:transparent;color:#fff;border:1px solid #1E2126 !important}',
      '.nq-tertiary{background:none;color:#6B7280;font-weight:400 !important;font-size:14px !important;padding:8px !important}',
      '.nq-note{font-size:12px;color:#6B7280;text-align:center;margin:12px 0 0}',
      // shown only when the clipboard refuses, so the link is still selectable by hand
      '.nq-url{width:100%;margin:10px 0 0;padding:12px;border-radius:12px;border:1px solid #1E2126;' +
        'background:#0C0E11;color:#fff;font-size:14px;font-family:inherit;-webkit-user-select:all;user-select:all}'
    ].join('');
    var s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  function openSheet(storeUrl) {
    var t = COPY[lang()];
    var backdrop = document.createElement('div');
    backdrop.className = 'nq-sheet-backdrop';

    var sheet = document.createElement('div');
    sheet.className = 'nq-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');

    var mail = 'mailto:?subject=' + encodeURIComponent(t.subject) +
               '&body=' + encodeURIComponent(t.mailBody.replace('{url}', storeUrl));

    sheet.innerHTML =
      '<h2>' + t.title + '</h2>' +
      '<p>' + t.body + '</p>' +
      '<a class="nq-btn nq-primary" data-nq="email" href="' + mail + '">' + t.email + '</a>' +
      '<button class="nq-secondary" data-nq="copy">' + t.copy + '</button>' +
      '<button class="nq-tertiary" data-nq="desktop">' + t.desktop + '</button>' +
      '<p class="nq-note">Independent software. Not affiliated with Amazon.</p>';

    function close() {
      sheet.classList.remove('is-open');
      backdrop.classList.remove('is-open');
      setTimeout(function () { sheet.remove(); backdrop.remove(); }, 220);
    }

    backdrop.addEventListener('click', close);

    sheet.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-nq]');
      if (!btn) return;
      var kind = btn.getAttribute('data-nq');

      if (kind === 'email') {
        track('MobileBridgeEmail', { url: storeUrl });
        setTimeout(close, 400);
      } else if (kind === 'copy') {
        e.preventDefault();
        var done = function () {
          btn.textContent = t.copied;
          track('MobileBridgeCopy', { url: storeUrl });
        };
        // A refused clipboard must not report success: it told the reader the link
        // was copied when it was not, and counted a MobileBridgeCopy that never
        // happened. Fall back to showing the URL so they can select it by hand.
        var failed = function () {
          var out = sheet.querySelector('.nq-url');
          if (!out) {
            out = document.createElement('input');
            out.className = 'nq-url';
            out.readOnly = true;
            out.setAttribute('aria-label', 'nudoiq.com install link');
            btn.insertAdjacentElement('afterend', out);
          }
          out.value = storeUrl;
          out.focus();
          out.select();
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(storeUrl).then(done).catch(failed);
        } else {
          var ta = document.createElement('textarea');
          ta.value = storeUrl;
          document.body.appendChild(ta);
          ta.select();
          var ok = false;
          try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
          ta.remove();
          if (ok) { done(); } else { failed(); }
        }
      } else if (kind === 'desktop') {
        track('MobileBridgeOverride', { url: storeUrl });
        window.location.href = storeUrl;
      }
    });

    document.body.appendChild(backdrop);
    document.body.appendChild(sheet);
    requestAnimationFrame(function () {
      backdrop.classList.add('is-open');
      sheet.classList.add('is-open');
    });

    track('MobileBridgeOpened', { url: storeUrl });
  }

  // StoreClick is the Meta ad-optimisation event: a visitor who CAN install
  // actually left for the Chrome Web Store.
  //
  // It deliberately never fires on mobile. A mobile visitor cannot install a
  // desktop Chrome extension, so counting their click would teach Meta to buy
  // the one audience guaranteed not to convert — which is exactly the leak the
  // 2026-09-07 campaign audit found in the live ad set. Reusing isMobile() here
  // rather than repeating the test keeps the two paths from drifting apart.
  //
  // Website-origin, and carries nothing the extension observed, so it is clean
  // under Chrome's Limited Use policy. Same boundary as capi.ts server-side.
  // Chrome Web Store forwards utm_source / utm_medium / utm_campaign to its GA4
  // property (aggregate store views + installs by campaign; not per-person, not
  // sent back to Meta). The landing URL's own UTMs win; otherwise mark site traffic.
  function withStoreUtm(href) {
    try {
      var u = new URL(href), page = new URLSearchParams(location.search);
      var d = { utm_source: 'nudoiq.com', utm_medium: 'website', utm_campaign: 'site' };
      ['utm_source', 'utm_medium', 'utm_campaign'].forEach(function (k) {
        if (!u.searchParams.get(k)) u.searchParams.set(k, page.get(k) || d[k]);
      });
      // utm_content (the ad id from {{ad.id}}) and utm_term are carried too when the
      // landing URL has them. Google documents only source/medium/campaign for the
      // store's GA4 reports, so per-ad store reporting is NOT claimed; forwarding
      // keeps the id in the URL in case it is exposed. Never defaulted. (L06, 2026-09-15)
      ['utm_content', 'utm_term'].forEach(function (k) {
        if (!u.searchParams.get(k) && page.get(k)) u.searchParams.set(k, page.get(k));
      });
      return u.toString();
    } catch (err) { return href; }
  }

  function initDesktopStoreClick() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!isStoreLink(a)) return;
      a.href = withStoreUtm(a.href);
      // A click something else already cancelled is not a store visit, so it
      // must not be counted. This check comes BEFORE track() deliberately.
      if (e.defaultPrevented) return;

      track('StoreClick', { lang: lang(), path: location.pathname });

      // A same-tab store link unloads the page before fbq's beacon leaves the
      // browser, so the event is fired and then discarded — which is the
      // leading explanation for a dataset holding 50 ProofZooms and zero
      // StoreClicks, ProofZoom being the one event that never navigates.
      // Every store CTA now carries target="_blank"; this holds the navigation
      // briefly for any link that does not, so a CTA added later without one
      // cannot silently reintroduce the bug.
      //
      // It must not touch a click the browser is about to handle specially:
      // ctrl/meta open a background tab, shift a new window, alt a download,
      // and any of those already leave this document alive. Only an unmodified
      // primary-button click on a target-less link gets the delay.
      var plain = !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey &&
                  (e.button === 0 || e.button === undefined);
      if (!a.target && plain) {
        var href = a.href;
        e.preventDefault();
        setTimeout(function () { window.location.href = href; }, 150);
      }
    });
  }

  function init() {
    if (!isMobile()) { initDesktopStoreClick(); return; }
    injectStyles();
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (!isStoreLink(a)) return;
      e.preventDefault();
      openSheet(a.href);
    }, true);
    track('MobileVisitorDesktopOnlyProduct');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
