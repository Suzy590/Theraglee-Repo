/* =============================================================================
   Theraglee — mental health trivia: the pure parts.
   -----------------------------------------------------------------------------
   Everything here runs without Supabase or a DOM, so tests/trivia-fixture can
   import it under Node. trivia.html does the rendering and the saving.

   A "play" is one pass through a set's 10 questions. Options are shuffled per
   play from a seed, so the correct answer does not sit in the same place twice
   and a replay is still a fair test.
   ============================================================================= */

export const QUESTIONS_PER_SET = 10;

export const DIFFICULTY = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };

/* What a score means, in words. Encouraging on purpose: this is a way to learn,
   not a test anyone can fail. */
export function band(score, total = QUESTIONS_PER_SET) {
  const pct = total ? score / total : 0;
  if (pct >= 1)   return { key: 'perfect', label: 'Perfect score',   text: 'Every one. You know this topic inside out.' };
  if (pct >= .8)  return { key: 'strong',  label: 'Strong',          text: 'Nearly all of it. The one or two you missed are worth a second look below.' };
  if (pct >= .6)  return { key: 'solid',   label: 'Solid',           text: 'A good grip on the basics, with a few gaps that the explanations fill in.' };
  if (pct >= .4)  return { key: 'learning', label: 'Learning',       text: 'You picked up several new things today. Play it again in a few days and watch the score climb.' };
  return             { key: 'fresh',   label: 'Fresh ground',    text: 'This one was mostly new to you, which is the whole point. Read the notes and try again.' };
}

/* Small deterministic PRNG (mulberry32) so a play can be replayed from its seed. */
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(list, random = Math.random) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The questions of a set with their options shuffled for one play.
    Each returned question carries `options` (shuffled) and `answer` (its new index). */
export function playOrder(set, seed = Date.now()) {
  const random = rng(seed);
  return set.questions.map(q => {
    const order = shuffle(q.options.map((_, i) => i), random);
    return {
      q: q.q,
      why: q.why,
      options: order.map(i => q.options[i]),
      answer: order.indexOf(q.answer),
    };
  });
}

/** Score a finished play: `picks` is the chosen option index per question. */
export function score(questions, picks) {
  let right = 0;
  questions.forEach((q, i) => { if (picks[i] === q.answer) right++; });
  return right;
}

/** Roll-up for the index page: how many sets played, perfect, and the average best. */
export function summarize(sets, scores) {
  let played = 0, perfect = 0, sum = 0;
  for (const s of sets) {
    const r = scores.get(s.slug);
    if (!r) continue;
    played++;
    sum += r.best / (r.total || QUESTIONS_PER_SET);
    if (r.best >= (r.total || QUESTIONS_PER_SET)) perfect++;
  }
  return { played, perfect, avg: played ? Math.round((sum / played) * 100) : 0 };
}

/* localStorage key for one set's scores, used as the fallback (and the cache)
   for the trivia_scores table. */
export const scoreKey = (slug) => 'tg.trivia.' + slug;
