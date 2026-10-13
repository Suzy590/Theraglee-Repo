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

// A password box with an eye button at its right edge that reveals what was
// typed. Both icons are drawn here; the `.on` class on the button picks the
// crossed-out one (styles.css).
const EYE_OPEN = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
  stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_SHUT = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
  stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>
  <path d="M4 4l16 16"/></svg>`;
const pwField = (id, autocomplete, placeholder) => `<div class="pw">
  <input id="${id}" type="password" autocomplete="${autocomplete}" required minlength="8"
         placeholder="${placeholder}">
  <button type="button" class="pw-eye" aria-label="Show password" aria-pressed="false"
          title="Show password"><span class="eye-open">${EYE_OPEN}</span><span class="eye-shut">${EYE_SHUT}</span></button>
</div>`;

/**
 * Draws the form into `#auth` and wires it up.
 *   audience  'member' | 'therapist'   which door this page is
 *   mode      'signin' | 'signup'
 *   next      optional page on this site to land on afterwards (else ?next=)
 */
export async function authPage({ audience, mode, next: nextGiven }) {
  const door = DOORS[audience];
  const up = mode === 'signup';
  // A page may choose the destination itself (the founding-member sign-up
  // does); otherwise it comes from ?next= on the address.
  // A member signing in always opens the dashboard on its Today tab: a return
  // to the dashboard, or to wherever an inactivity sign-out left them, is
  // dropped. A destination that finishes something they asked for (buying a
  // plan, starting a challenge) is kept.
  const memberSignin = audience === 'member' && !up;
  const asked = safeNext(nextGiven ?? qs('next'));
  const next = memberSignin && (qs('timeout') || /^dashboard\.html(?:[?#]|$)/.test(asked || ''))
    ? null : asked;
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
  // Sent here from a plan button on the pricing page: the page itself names
  // the plan and the price (signup.html); the button says what comes next.
  const planWanted = up && audience === 'member'
    ? ({ basic: 'Basic', premium: 'Premium' })[qs('plan')] ?? null : null;
  if (qs('timeout') && !up) {
    alertBox(`<strong>You were signed out after a period of inactivity.</strong><br>
      That keeps ${audience === 'therapist' ? 'client' : 'your'} information off an
      unattended screen. ${memberSignin ? 'Sign in to start again from Today.' : 'Sign in to pick up where you were.'}`, 'warn');
  }

  host.innerHTML = `
    <form id="form" class="stack" novalidate>
      ${up && audience === 'therapist' ? `<div class="field">
        <label for="name">Your name</label>
        <input id="name" type="text" autocomplete="name" placeholder="First and last name">
      </div>` : up ? `<div class="field">
        <label for="name">What should we call you? <span class="faint">(optional)</span></label>
        <input id="name" type="text" autocomplete="given-name" placeholder="A first name or nickname is fine">
        <div class="help">Only for greeting you. Therapists never see it; you give a therapist your
          real name only if you reply to one.</div>
      </div>` : ''}
      <div class="field">
        <label for="email">Email</label>
        <input id="email" type="email" autocomplete="email" required placeholder="you@example.com"
               value="${esc(qs('email') || '')}">
      </div>
      <div class="field">
        <label for="password">Password</label>
        ${pwField('password', up ? 'new-password' : 'current-password', 'At least 8 characters')}
        ${up ? '<div class="help" id="pw-hint" aria-live="polite">At least 8 characters.</div>' : ''}
      </div>
      ${up ? `<div class="field">
        <label for="password2">Confirm password</label>
        ${pwField('password2', 'new-password', 'Type it again')}
        <div class="help">Type the same password again so we know it is what you meant.</div>
      </div>` : ''}
      ${up && audience === 'therapist' ? `<div class="help" style="margin:-6px 0 4px">
        Therapist accounts list a practice in the directory. Next you start your membership
        and fill in your profile; your license is verified against your state licensing board,
        and your listing goes live the moment it clears.</div>` : ''}
      <button class="btn lg block" id="submit" type="submit">${
        !up ? 'Sign in' : audience === 'therapist' ? 'Create therapist account'
        : planWanted ? `Create account and continue to ${planWanted} checkout` : 'Create account'}</button>
      <p class="faint center" style="margin:0">By continuing, you agree to the
        <a href="terms.html">Terms of Service</a> and <a href="privacy.html">Privacy Policy</a>,
        and confirm that you are 18 or older and in the United States.</p>
    </form>
    ${!up ? `<p class="center faint" style="margin:18px 0 0">
      <a href="#" id="forgot">Forgot your password?</a></p>` : ''}`;

  const resetTo = location.origin + '/' + (audience === 'therapist' ? 'therapist-dashboard.html' : 'account.html');
  // The confirmation email's link lands wherever the sign-up was headed (the
  // pricing page, for someone buying a plan), else on the dashboard.
  const confirmTo = location.origin + '/' + (next || door.home);

  const sendReset = async (email) => {
    if (!email) return alertBox('Type your email above first.');
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: resetTo });
    alertBox(error ? error.message
      : `Reset link sent to ${esc(email)}. It can take a minute.`, error ? 'err' : 'warn');
  };

  // The eye beside a password box shows the password in plain text while it
  // is pressed, and hides it again on the next press.
  $('#form').addEventListener('click', (e) => {
    const eye = e.target.closest('.pw-eye');
    if (!eye) return;
    const input = eye.parentElement.querySelector('input');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    eye.setAttribute('aria-pressed', show ? 'true' : 'false');
    eye.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    eye.title = show ? 'Hide password' : 'Show password';
    eye.classList.toggle('on', show);
  });

  // The hint under a new password turns green, with a check, once the
  // password is long enough, so nobody has to count.
  if (up) {
    const hint = $('#pw-hint');
    $('#password').addEventListener('input', (e) => {
      const ok = e.target.value.length >= 8;
      hint.classList.toggle('ok', ok);
      hint.textContent = ok ? '\u2713 At least 8 characters.' : 'At least 8 characters.';
    });
  }

  $('#form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#email').value.trim();
    const password = $('#password').value;
    const password2 = up ? $('#password2').value : password;
    const full_name = up ? $('#name').value.trim() : '';
    $('#alert').innerHTML = '';

    if (!email || !password) return alertBox('Please fill in your email and password.');
    if (up && password.length < 8)
      return alertBox('Please choose a password of at least 8 characters.');
    if (up && !password2) return alertBox('Please type your password again in the second box.');
    if (up && password !== password2) {
      alertBox('Those passwords do not match. Please type the same password in both boxes.');
      $('#alert').scrollIntoView({ block: 'center', behavior: 'smooth' });
      $('#password2').focus({ preventScroll: true });
      return;
    }

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
           sometimes lands in spam. <a href="#" id="resend">Send it again</a>.${planWanted
             ? `<br>Once you confirm, we take you straight to checkout for ${planWanted}.` : ''}`, 'warn');
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
