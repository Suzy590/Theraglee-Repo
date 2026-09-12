/* ==========================================================================
   Theraglee — sign in and sign up, shared by the member door and the
   therapist door. Each of the four pages (login, signup, therapist-login,
   therapist-signup) owns its own copy; this file owns the form and what
   happens when it is submitted.
   ========================================================================== */
import { sb, access, clearAccess, esc, qs, busy, $, DOORS, audienceOf } from './app.js';

// Only a page on this site may be a "next" destination.
const safeNext = (n) => (n && /^[A-Za-z0-9_-]+\.html(?:[?#].*)?$/.test(n)) ? n : null;

const homeName = (aud) => aud === 'therapist' ? 'practice dashboard' : 'dashboard';

/**
 * Draws the form into `#auth` and wires it up.
 *   audience  'member' | 'therapist'   which door this page is
 *   mode      'signin' | 'signup'
 */
export async function authPage({ audience, mode }) {
  const door = DOORS[audience];
  const up = mode === 'signup';
  const next = safeNext(qs('next'));
  const host = $('#auth');

  const alertBox = (msg, kind = 'err') => $('#alert').innerHTML =
    `<div class="notice ${kind}" style="margin-bottom:18px">${msg}</div>`;

  // Where an account goes once it is signed in. The wrong door still works,
  // but it says so and sends the account to its own dashboard.
  const go = (a) => {
    const mine = audienceOf(a.profile);
    if (a.profile?.role === 'admin' || mine === audience) {
      location.replace(next || door.home);
      return;
    }
    const theirs = DOORS[mine];
    host.hidden = true;
    alertBox(`<strong>This is a ${theirs.name} account.</strong><br>
      You are signed in, and we are taking you to your ${homeName(mine)}.
      Next time, use the <a href="${theirs.signin}">${theirs.name} sign-in page</a>.`, 'warn');
    setTimeout(() => location.replace(theirs.home), 3500);
  };

  // Already signed in? Straight through.
  const a0 = await access();
  if (a0.authenticated) { go(a0); return; }

  if (qs('why') === 'save' && up && audience === 'member') {
    alertBox(`<strong>Create a free account to keep that tool.</strong><br>
      Favorites, save for later and your dashboard are part of the free membership.
      No card, no cost, and you will be sent straight back to where you were.`, '');
  }
  if (qs('timeout') && !up) {
    alertBox(`<strong>You were signed out after a spell of inactivity.</strong><br>
      That keeps ${audience === 'therapist' ? 'client' : 'your'} information off an
      unattended screen. Sign in to pick up where you were.`, 'warn');
  }

  host.innerHTML = `
    <form id="form" class="stack" novalidate>
      ${up ? `<div class="field">
        <label for="name">Your name</label>
        <input id="name" type="text" autocomplete="name" placeholder="First and last name">
      </div>` : ''}
      <div class="field">
        <label for="email">Email</label>
        <input id="email" type="email" autocomplete="email" required placeholder="you@example.com"
               value="${esc(qs('email') || '')}">
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input id="password" type="password" autocomplete="${up ? 'new-password' : 'current-password'}"
               required minlength="8" placeholder="At least 8 characters">
        ${up ? '<div class="help">At least 8 characters.</div>' : ''}
      </div>
      ${up && audience === 'therapist' ? `<div class="help" style="margin:-6px 0 4px">
        Therapist accounts list a practice in the directory. Your license is verified
        against your state licensing board before anything is public.</div>` : ''}
      <button class="btn lg block" id="submit" type="submit">${
        !up ? 'Sign in' : audience === 'therapist' ? 'Create therapist account' : 'Create account'}</button>
      <p class="faint center" style="margin:0">By continuing, you agree to the
        <a href="terms.html">Terms of Service</a> and <a href="privacy.html">Privacy Policy</a>,
        and confirm that you are 18 or older and in the United States.</p>
    </form>
    ${!up ? `<p class="center faint" style="margin:18px 0 0">
      <a href="#" id="forgot">Forgot your password?</a></p>` : ''}`;

  const resetTo = location.origin + '/' + (audience === 'therapist' ? 'therapist-dashboard.html' : 'account.html');
  const confirmTo = location.origin + '/' + door.home;

  const sendReset = async (email) => {
    if (!email) return alertBox('Type your email above first.');
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: resetTo });
    alertBox(error ? error.message
      : `Reset link sent to ${esc(email)}. It can take a minute.`, error ? 'err' : 'warn');
  };

  $('#form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#email').value.trim();
    const password = $('#password').value;
    const full_name = up ? $('#name').value.trim() : '';
    $('#alert').innerHTML = '';

    if (!email || !password) return alertBox('Please fill in your email and password.');
    if (up && password.length < 8)
      return alertBox('Please choose a password of at least 8 characters.');

    const btn = $('#submit');
    busy(btn, true, up ? 'Creating…' : 'Signing in…');

    if (up) {
      const { data, error } = await sb.auth.signUp({
        email, password,
        options: { data: { full_name, role: audience }, emailRedirectTo: confirmTo },
      });
      busy(btn, false);
      if (error) return alertBox(error.message);

      // Supabase will not say outright that an address is taken, to stop people
      // fishing for who has an account. It signals it by returning a user with no
      // identities and sending no email. Without this check the page tells people
      // to wait for a message that is never coming.
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        const signin = `${door.signin}?email=${encodeURIComponent(email)}${next ? '&next=' + encodeURIComponent(next) : ''}`;
        return alertBox(
          `<strong>You already have an account with ${esc(email)}.</strong><br>
           <a href="${signin}">Sign in instead</a> — or
           <a href="#" id="send-reset">send yourself a reset link</a>
           if you have forgotten the password.`, 'warn');
      }

      if (!data.session) {
        return alertBox(
          `<strong>Check your email.</strong><br>
           We have sent a confirmation link to ${esc(email)}. It can take a minute, and it
           sometimes lands in spam. <a href="#" id="resend">Send it again</a>.`, 'warn');
      }
      clearAccess();
      location.href = next || door.home;
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        busy(btn, false);
        const m = error.message || '';
        if (/email not confirmed/i.test(m)) {
          return alertBox(
            `<strong>This account still needs confirming.</strong><br>
             Check your email for the link we sent to ${esc(email)}, or
             <a href="#" id="resend">send it again</a>.`, 'warn');
        }
        if (/invalid login credentials/i.test(m)) {
          return alertBox(
            `<strong>That email and password do not match.</strong><br>
             Try again, or <a href="#" id="send-reset">send yourself a reset link</a>.`);
        }
        return alertBox(m);
      }
      clearAccess();
      const a = await access(true);
      busy(btn, false);
      go(a);
    }
  });

  // Actions offered inside the message box above.
  $('#alert').addEventListener('click', async (e) => {
    const email = $('#email')?.value.trim();
    if (e.target.id === 'send-reset') { e.preventDefault(); sendReset(email); }
    if (e.target.id === 'resend') {
      e.preventDefault();
      const { error } = await sb.auth.resend({
        type: 'signup', email, options: { emailRedirectTo: confirmTo },
      });
      alertBox(error ? error.message
        : `Sent again to ${esc(email)}. Check your spam folder too.`, error ? 'err' : 'warn');
    }
  });

  $('#forgot')?.addEventListener('click', (e) => {
    e.preventDefault();
    const email = $('#email').value.trim();
    if (!email) return alertBox('Type your email above first, then click again.');
    sendReset(email);
  });
}
