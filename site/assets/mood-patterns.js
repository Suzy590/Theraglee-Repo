/* ==========================================================================
   Theraglee — what may be shaping a member's mood.
   The factors a member rates after tapping the day's emoji, the weather they
   can pick, and analyze(), which looks across their days for the factors that
   move with their mood. No imports, so tests/mood-patterns/check.mjs can run
   it under plain Node. The Mood tab (mood-ui.js) draws from it; the columns
   are in supabase/migrations/20260925120000_mood_factors.sql and
   docs/mood.md is the guide.
   ========================================================================== */

/* How many days of entries before any pattern is shown. They do not have to
   be in a row. */
export const MIN_DAYS = 7;

/* The day's overall mood, 1 to 5, as the emoji row shows it. */
export const MOODS = [
  [1, '😞', 'Rough'], [2, '🙁', 'Low'], [3, '😐', 'Okay'], [4, '🙂', 'Good'], [5, '😄', 'Great'],
];

/* [column, label, what 10 means, the phrase a finding reads with, the noun for "focus on"].
   Every factor is rated 1 (terrible) to 10 (fantastic) for how it feels today,
   so a higher number is always the better day, stress and loneliness included. */
export const FACTORS = [
  ['sleep',       'Sleep',                      '10 = rested and fantastic',
   'your sleep felt better', 'sleep'],
  ['home_stress', 'Home life stress',           '10 = home feels calm, no stress',
   'home life felt less stressful', 'home life'],
  ['work_stress', 'School/work stress',         '10 = school or work feels calm, no stress',
   'school or work felt less stressful', 'school or work'],
  ['nutrition',   'Nutrition',                  '10 = you feel great about how you ate',
   'you felt better about how you ate', 'nutrition'],
  ['hunger',      'Hunger in this moment',      '10 = just right, not too hungry or too full',
   'your hunger felt more in balance', 'regular meals and snacks'],
  ['loneliness',  'Loneliness',                 '10 = connected, not lonely at all',
   'you felt less lonely', 'feeling connected'],
  ['thoughts',    'Overall thoughts',           '10 = your thoughts feel fantastic',
   'your overall thoughts felt better', 'your thoughts'],
  ['activity',    'Level of physical activity', '10 = you feel great about how much you moved',
   'you felt better about how much you moved', 'physical activity'],
  ['social',      'Social interaction',         '10 = your time with people felt fantastic',
   'your social interaction felt better', 'social interaction'],
];

/* [key, emoji, label]. The keys are a data contract: mood_logs.weather checks them. */
export const WEATHER = [
  ['sunny', '☀️', 'Sunny'], ['partly_cloudy', '⛅', 'Partly cloudy'], ['cloudy', '☁️', 'Cloudy'],
  ['rainy', '🌧️', 'Rainy'], ['stormy', '⛈️', 'Stormy'], ['snowy', '❄️', 'Snowy'],
  ['foggy', '🌫️', 'Foggy'], ['windy', '💨', 'Windy'], ['hot', '🥵', 'Hot'], ['cold', '🥶', 'Cold'],
];

/* A link needs at least this much correlation (Pearson's r, either way) to be
   worth telling the member about. */
export const LINK = 0.3;
/* A weather type needs this many days, and a gap from the member's usual mood
   of at least this much (on the 1 to 5 scale), to be mentioned. */
export const WEATHER_DAYS = 2;
export const WEATHER_GAP = 0.5;

const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

/* Pearson's correlation coefficient, or null when either side never changes
   (every day rated the same says nothing about what moves with what). */
export function pearson(xs, ys) {
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  if (!sxx || !syy) return null;
  return sxy / Math.sqrt(sxx * syy);
}

export const strength = (r) => {
  const x = Math.abs(r);
  return x >= 0.7 ? 'strong' : x >= 0.5 ? 'moderate' : x >= LINK ? 'modest' : 'little';
};

const one = (x) => (Math.round(x * 10) / 10).toFixed(1);

/* Looks across a member's mood_logs rows for what moves with their mood.
   Returns { days, ready, factors, findings, focus, weather, statements }:
   - days: how many days have a mood; ready once that reaches MIN_DAYS.
   - factors: every factor, with how many days rated it, its average and r
     (null until it has MIN_DAYS ratings that are not all the same).
   - findings: the factors whose |r| is at least LINK, strongest first.
   - focus: of the factors that rise with mood, the one rated lowest on
     average, which is where a change may matter most. Null if none.
   - weather: weather types with WEATHER_DAYS or more days whose average mood
     is at least WEATHER_GAP from the member's usual.
   - statements: plain sentences for the member, in the order to show them. */
export function analyze(rows) {
  const logged = (rows || []).filter(r => Number.isFinite(r?.mood));
  const days = logged.length;
  const ready = days >= MIN_DAYS;
  const usual = days ? mean(logged.map(r => r.mood)) : null;

  const factors = FACTORS.map(([key, label, , phrase, noun]) => {
    const rated = logged.filter(r => Number.isFinite(r[key]));
    const n = rated.length;
    const avg = n ? mean(rated.map(r => r[key])) : null;
    const r = n >= MIN_DAYS ? pearson(rated.map(x => x[key]), rated.map(x => x.mood)) : null;
    return { key, label, phrase, noun, n, avg, r };
  });

  const findings = ready
    ? factors.filter(f => f.r !== null && Math.abs(f.r) >= LINK)
        .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
    : [];

  const rising = findings.filter(f => f.r > 0);
  const focus = rising.length
    ? rising.reduce((lo, f) => (f.avg < lo.avg ? f : lo))
    : null;

  const weather = [];
  if (ready) {
    for (const [key, emoji, label] of WEATHER) {
      const moods = logged.filter(r => r.weather === key).map(r => r.mood);
      if (moods.length < WEATHER_DAYS) continue;
      const avg = mean(moods);
      if (Math.abs(avg - usual) >= WEATHER_GAP) weather.push({ key, emoji, label, n: moods.length, avg });
    }
    weather.sort((a, b) => Math.abs(b.avg - usual) - Math.abs(a.avg - usual));
  }

  const statements = [];
  if (ready) {
    for (const f of findings) {
      statements.push(f.r > 0
        ? `On days ${f.phrase}, your mood tended to be better too (a ${strength(f.r)} link).`
        : `On days ${f.phrase}, your mood tended to be lower (a ${strength(f.r)} link). That is less common, and worth noticing.`);
    }
    for (const w of weather) {
      statements.push(`On ${w.label.toLowerCase()} days (${w.n} of them), your mood averaged ${one(w.avg)} out of 5, `
        + `compared with ${one(usual)} across all your days.`);
    }
    if (focus) {
      statements.push(`Your ${focus.label.toLowerCase()} ratings average ${one(focus.avg)} out of 10 and move with `
        + `your mood, so ${focus.noun} may be a good place to focus if you want to advocate for a change in your life.`);
    }
    if (!statements.length) {
      statements.push('No single factor stands out yet. That is useful to know too. '
        + 'Keep rating the factors each day, and patterns tend to get clearer as the days add up.');
    }
  }

  return { days, ready, usual, factors, findings, focus, weather, statements };
}
