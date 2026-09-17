/* ==========================================================================
   Membership tiers — the one place for tier names, copy and fallback prices.

   Live prices come from app_config (edit them on the admin screen under
   "Prices shown on the site"); DEFAULT_PRICES is what shows if that read
   fails. The landing page, the dashboard and the account page all render
   the same cards from here, so the pitch never drifts between them.
   ========================================================================== */

export const DEFAULT_PRICES = {
  basic_monthly: '9',  basic_yearly: '90',
  premium_monthly: '19', premium_yearly: '190',
};

export const PLANS_INTRO = {
  title: "Start free. Upgrade when you're ready for more.",
  lede: 'Every account starts free — no card needed. Paid memberships unlock library access and deeper tools, whenever you want them.',
};

export const PLANS_NOTE =
  'Cancel anytime from your dashboard in two clicks. Your journal entries and tracking history stay yours, free or paid.';

// level matches TIERS in app.js: 1 Free, 2 Basic, 3 Premium.
export const PLANS = [
  { key: 'free', level: 1, name: 'Registered Free',
    feats: [
      'Browse the therapist directory, no account needed',
      'Your private dashboard with mood tracking',
      'Extensive library of mental health articles',
      'Tons of self-discovery tools',
      'Daily mental health quotes, tips, fun facts, and affirmations',
      'Journal prompts with your own private journal',
      'Mental health checklists',
      '7-Day Mental health challenges',
      'Theraglee Match Mode — let the right therapist find you',
    ],
    cta: { label: 'Create my free account', href: 'signup.html' } },
  { key: 'basic', level: 2, name: 'Basic',
    feats: [
      'Everything in Free, plus:',
      'Expanded library access',
      'Every mental health quiz',
      'Interactive mental health worksheets',
      'Mental health trivia',
      'Downloadable desktop pet',
    ],
    cta: { label: 'Go Basic', href: 'pricing.html' } },
  { key: 'premium', level: 3, name: 'Premium', featured: true,
    feats: [
      'Everything in Basic, plus:',
      'Mood-based music playlists',
      'Local mental health resource map',
      'Mandalas to print or color online',
      'Mental health goal tracking',
      'Mood tracking to help you see patterns over time',
      'Gain deeper insights from your mood and goal tracking',
    ],
    cta: { label: 'Go Premium', href: 'pricing.html' } },
];

/** Display prices from app_config, falling back to DEFAULT_PRICES. */
export async function loadPrices(sb) {
  const prices = { ...DEFAULT_PRICES };
  try {
    const { data } = await sb.from('app_config').select('key,value').like('key', 'display_%');
    for (const r of data || []) {
      const k = r.key.replace(/^display_/, '');
      if (k in prices && r.value) prices[k] = r.value;
    }
  } catch (e) { console.error(e); }
  return prices;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function priceBlock(plan, prices) {
  if (plan.key === 'free') {
    return `<div class="price">$0<small> forever</small></div><span class="alt">no card required</span>`;
  }
  return `<div class="price">$${esc(prices[plan.key + '_monthly'])}<small>/month</small></div>
    <span class="alt">or $${esc(prices[plan.key + '_yearly'])}/year</span>`;
}

/** The three tier cards. `level` is the viewer's tier (0 for a visitor). */
export function tierCards({ prices = DEFAULT_PRICES, level = 0 } = {}) {
  return `<div class="tiers">${PLANS.map((p) => {
    const mine = level === p.level;
    const below = level > p.level;
    const cta = mine  ? `<span class="btn ghost block tier-current">Your current plan</span>`
              : below ? `<span class="btn ghost block tier-current">Included in your plan</span>`
              : `<a class="btn block ${p.featured ? '' : 'ghost'}" href="${p.cta.href}">${esc(p.cta.label)}</a>`;
    return `<div class="tier ${p.featured ? 'featured' : ''}">
      ${p.featured ? '<span class="flag">Most popular</span>' : ''}
      <h3>${esc(p.name)}</h3>
      ${priceBlock(p, prices)}
      <ul>${p.feats.map((f) => `<li class="${/^Everything in /.test(f) ? 'lead' : ''}">${esc(f)}</li>`).join('')}</ul>
      ${cta}
    </div>`;
  }).join('')}</div>`;
}
