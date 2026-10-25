/* =============================================================================
   Theraglee — the Google Analytics tag on the pages.
   -----------------------------------------------------------------------------
   chrome() in app.js calls loadAnalyticsTag() once the page has its header.
   It reads the two settings the admin screen's Google Analytics tab keeps in
   app_config (ga_measurement_id, ga_tag_enabled) and, when the switch is on,
   adds Google's gtag script to the page. The decision is shouldLoadTag(), kept
   pure so tests/google-analytics/check.mjs can exercise it:

     - nothing loads until the switch is on and the id looks like a GA4 id;
     - a browser that sends Global Privacy Control or Do Not Track is left
       alone, as the privacy policy promises to honor opt-out signals;
     - an administrator's own visits are not counted, as with every other
       count on the admin screen.

   The tag is set up with Google signals, ad personalization and ad storage
   off, so it measures pages and nothing more. docs/google-analytics.md says
   what has to be true of the privacy policy before the switch goes on.
   ============================================================================= */

export const MEASUREMENT_ID = /^G-[A-Z0-9]{6,12}$/;

/** True when the tag should go on this page. `cfg` is app_config as an
 *  object; `nav` is the browser's navigator (or a stand-in in tests). */
export function shouldLoadTag(cfg, { nav = globalThis.navigator, admin = false, alreadyLoaded = false } = {}) {
  if (alreadyLoaded || admin) return false;
  if (cfg?.ga_tag_enabled !== 'true' || !MEASUREMENT_ID.test(cfg?.ga_measurement_id || '')) return false;
  if (nav?.globalPrivacyControl === true) return false;
  if (nav?.doNotTrack === '1' || globalThis.doNotTrack === '1') return false;
  return true;
}

/** Adds the gtag script and configures it for the measurement id. */
export function mountTag(id) {
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  // Consent Mode: pages are measured; nothing is stored or used for ads.
  window.gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted',
  });
  window.gtag('js', new Date());
  window.gtag('config', id, { allow_google_signals: false, allow_ad_personalization_signals: false, send_page_view: true });
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
  s.dataset.theraglee = 'analytics';
  document.head.appendChild(s);
}

/** Reads the settings and mounts the tag when shouldLoadTag() says so.
 *  Never throws: a page is not held up by analytics. */
export async function loadAnalyticsTag(sb, { admin = false } = {}) {
  try {
    const { data } = await sb.from('app_config').select('key,value').like('key', 'ga_%');
    const cfg = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
    const alreadyLoaded = !!document.querySelector('script[data-theraglee="analytics"]');
    if (shouldLoadTag(cfg, { admin, alreadyLoaded })) mountTag(cfg.ga_measurement_id);
  } catch (err) {
    console.debug('analytics tag', err?.message || err);
  }
}
