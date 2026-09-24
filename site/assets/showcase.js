/* ==========================================================================
   Theraglee — the feature showcase strip under the header.
   A row of cards, one per feature, that the visitor can scroll or swipe and
   that advances by itself when left alone. Every card is a link. A feature
   the viewer cannot open yet sends a visitor to sign-up (and on to the feature
   afterwards), and a signed-in member whose tier is too low to the plans.
   Mounted by chrome() in app.js on every page except the therapist dashboard.
   ========================================================================== */
import { DOORS, tierName } from './app.js';

/* [name, description, where it opens, tier needed]. Tier 0 is open to everyone,
   1 needs a free account, 2 is Basic and 3 is Premium (see TIERS in app.js).
   The first card is Theraglee Match Mode, drawn bigger and in brand green. */
export const FEATURES = [
  ['Theraglee Match Mode',
   'Flip one switch and let licensed therapists near you reach out. Your name stays private until you reply.',
   'dashboard.html#match-mode', 1],
  ['Daily Quote',
   'A few words worth carrying through the day, picked fresh every morning.',
   'dashboard.html#daily-quote', 1],
  ['Daily Mental Health Tip',
   'One small, practical thing to try today.',
   'dashboard.html#daily-tip', 1],
  ['Daily Mental Health Did You Know',
   'A quick fact about how minds work, new each day.',
   'dashboard.html#daily-fact', 1],
  ['Daily Affirmation',
   'A steadying line to start the day with, chosen for you.',
   'dashboard.html#affirm-card', 1],
  ['Daily Journal Prompt',
   'A fresh question each day to write about, in your private journal.',
   'dashboard.html#daily-prompt', 1],
  ['Personal Journal',
   'Write freely or follow a prompt. Every entry stays yours alone.',
   'journal.html', 1],
  ['Mood Tracker',
   'Log how you feel in one tap and watch the pattern over time.',
   'goals.html#mood', 3],
  ['Self-Discovery Tools',
   'Short, interactive ways to notice your own patterns. Free for everyone.',
   'discover.html', 0],
  ['Mental Health Quizzes',
   'Scored and explained self-assessments. Never a diagnosis.',
   'explore.html?type=quiz', 2],
  ['Mental Health Worksheets',
   'Thought records, values maps and self-compassion letters you fill in online.',
   'explore.html?type=worksheet', 2],
  ['Mental Health Checklists',
   'Work through a list step by step with your progress saved.',
   'explore.html?type=checklist', 1],
  ['Articles',
   'New mental health reads added every day, open to everyone.',
   'articles.html', 0],
  ['Mandalas',
   'Print one for your pencils, or color it right on the screen.',
   'mandalas.html', 3],
  ['Mental Health Trivia',
   'Test what you know with quick quizzes on how minds work.',
   'trivia.html', 2],
  ['Desktop Pet',
   'Meet Pip, a small companion who lives on your screen.',
   'pet.html', 2],
  ['Mental Health Goals and Progress Tracking',
   'Set what you are aiming for and see how far you have come.',
   'goals.html', 3],
  ['Music Playlists by Mood',
   'Music matched to how you feel right now.',
   'goals.html#music', 3],
  ['Mental Health Local Resource Map',
   'Find support near you on a map, plus national lines that answer any time.',
   'goals.html#map', 3],
];

const ADVANCE_MS = 4500;   // how long each card is shown before the strip moves on
const RESUME_MS  = 9000;   // how long after the visitor last touched it before it moves again

/** Where a card sends someone (see the note at the top). */
const hrefFor = (href, need, a) =>
  a.level >= need ? href
  : !a.authenticated ? `${DOORS.member.signup}?next=${encodeURIComponent(href)}`
  : 'pricing.html';

/**
 * Draws the strip and puts it right after `after` (the site header).
 *   a      the access object from chrome()
 */
export function mountShowcase(a, after) {
  const sec = document.createElement('section');
  sec.className = 'showcase';
  sec.setAttribute('aria-roledescription', 'carousel');
  sec.setAttribute('aria-label', 'Everything Theraglee offers');
  sec.innerHTML = `<div class="wrap">
    <div class="showcase-head">
      <p class="showcase-kicker">Everything on Theraglee</p>
      <div class="showcase-nav">
        <button type="button" class="showcase-arrow" data-dir="-1" aria-label="Previous feature">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
        <button type="button" class="showcase-arrow" data-dir="1" aria-label="Next feature">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>
      </div>
    </div>
    <div class="showcase-track" tabindex="0" aria-live="off">
      ${FEATURES.map(([name, blurb, href, need], i) => {
        const locked = a.level < need;
        const star = i === 0;
        return `<a class="showcase-card${star ? ' star' : ''}${locked ? ' locked' : ''}"
            href="${hrefFor(href, need, a)}" aria-label="${name}${locked ? `, ${tierName(need)} membership` : ''}">
          ${star ? '<span class="showcase-flag"><span class="dot"></span> Featured</span>' : ''}
          <strong class="showcase-name">${name}</strong>
          <span class="showcase-blurb">${blurb}</span>
          ${locked ? `<span class="badge lock">${tierName(need)}</span>` : ''}
        </a>`;
      }).join('')}
    </div>
  </div>`;
  after.insertAdjacentElement('afterend', sec);

  const track = sec.querySelector('.showcase-track');
  const cards = [...track.querySelectorAll('.showcase-card')];

  // The card nearest the left edge of the strip, which is the one "on show".
  const current = () => {
    const x = track.scrollLeft;
    let best = 0, gap = Infinity;
    cards.forEach((c, i) => { const d = Math.abs(c.offsetLeft - x); if (d < gap) { gap = d; best = i; } });
    return best;
  };

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const goTo = (i) => {
    const n = (i + cards.length) % cards.length;
    track.scrollTo({ left: cards[n].offsetLeft - cards[0].offsetLeft, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  /* ---- moving by itself ----
     Advances one card at a time while the strip is on screen, the tab is
     visible and the visitor is not using it. Anything they do (hover, touch,
     wheel or trackpad, keyboard, focus) pauses it, and it resumes once they
     have been still for a while. The visitor's own scrolling is caught by those
     input events rather than by scroll events, which the strip's own moves and
     the browser's snap adjustments fire too. People who ask their device for
     less motion get a strip that stays put until they move it. */
  let timer = null, held = false, resume = null, seen = true;
  const stop  = () => { clearTimeout(timer); timer = null; };
  const start = () => {
    if (reduceMotion || timer || held || !seen || document.hidden) return;
    timer = setTimeout(() => { timer = null; goTo(current() + 1); start(); }, ADVANCE_MS);
  };
  const pause = () => {
    stop(); held = true;
    clearTimeout(resume);
    resume = setTimeout(() => { held = false; start(); }, RESUME_MS);
  };

  ['pointerdown', 'wheel', 'touchstart', 'keydown', 'focusin'].forEach(ev =>
    sec.addEventListener(ev, pause, { passive: true }));
  sec.addEventListener('mouseenter', () => { stop(); held = true; clearTimeout(resume); });
  sec.addEventListener('mouseleave', () => { held = false; start(); });

  sec.querySelectorAll('.showcase-arrow').forEach(b => b.addEventListener('click', () => {
    pause(); goTo(current() + Number(b.dataset.dir));
  }));
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(current() + 1); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); goTo(current() - 1); }
  });

  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
  new IntersectionObserver((entries) => {
    seen = entries.some(e => e.isIntersecting);
    seen ? start() : stop();
  }, { threshold: .25 }).observe(sec);

  start();
  return sec;
}
