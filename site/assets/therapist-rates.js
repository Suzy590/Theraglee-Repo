/* Therapist membership rates on the therapist-facing pages.
   The numbers printed in the HTML ($29/month, $290/year, $20/month founding)
   are only what shows until app_config loads; the admin screen's Stripe setup
   tab is the one place they are edited (display_therapist_monthly,
   display_therapist_yearly, display_therapist_founding and the founding
   offer's on/off switch, spots and deadline), so no page can drift from what
   the checkout sells.

   Mark the numbers with these classes and call fillTherapistRates():
     .tg-rate-monthly   .tg-rate-yearly   .tg-rate-founding
     .tg-founding       anything that only makes sense while the founding
                        offer is open (hidden when it is closed)
     .tg-founding-cta   a "Join as a founding therapist" link; when the offer
                        is closed it becomes the regular "Start your listing" */
import { sb } from './app.js';
import { foundingOffer } from './plans.js';

export async function fillTherapistRates() {
  const { data: rows } = await sb.from('app_config').select('key,value')
    .in('key', ['display_therapist_monthly', 'display_therapist_yearly', 'founding_enabled',
                'price_therapist_founding', 'display_therapist_founding', 'founding_spots', 'founding_deadline']);
  const cfg = Object.fromEntries((rows || []).map((r) => [r.key, r.value]));
  const fill = (cls, text) => document.querySelectorAll('.' + cls).forEach((el) => { el.textContent = text; });
  if (cfg.display_therapist_monthly) fill('tg-rate-monthly', cfg.display_therapist_monthly);
  if (cfg.display_therapist_yearly) fill('tg-rate-yearly', cfg.display_therapist_yearly);

  const offer = foundingOffer(cfg);
  if (offer.open && offer.rate) {
    fill('tg-rate-founding', offer.rate);
  } else {
    document.querySelectorAll('.tg-founding').forEach((el) => { el.hidden = true; });
    document.querySelectorAll('.tg-founding-cta').forEach((a) => {
      a.href = 'therapist-signup.html'; a.textContent = 'Start your listing';
    });
  }
  return { cfg, offer };
}
