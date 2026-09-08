// Stripe Connect for therapists: lets a verified therapist take session
// payments through Theraglee and be paid out to their own bank account.
//
// Connected accounts are created with controller properties (Stripe collects
// the requirements, the therapist gets the Express dashboard, Theraglee pays
// the Stripe fees and takes an application fee on each payment).
//
//   action "onboard"   -> create the account if needed, return a hosted
//                         onboarding link (also used for the refresh_url case)
//   action "dashboard" -> a one-time login link to the Express dashboard
//   action "status"    -> re-read the account and store its state
//
// The Connect webhook (account.updated) keeps the stored state fresh after this.
import { CORS, json, readBody } from "../_shared/http.ts";
import { admin, allowedOrigins, callerFrom, loadConfig, therapistFor } from "../_shared/supabase.ts";
import { type Stripe, stripeClient } from "../_shared/stripe.ts";
import { connectStatus, safeReturnOrigin } from "../_shared/billing.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const stripe = stripeClient();
    if (!stripe) return json({ error: "billing_not_configured", message: "Stripe is not connected yet." }, 503);

    const caller = await callerFrom(req);
    if (!caller) return json({ error: "unauthorized", message: "Please sign in first." }, 401);
    if (caller.profile.role !== "therapist") {
      return json({ error: "wrong_account", message: "Payouts are for therapist accounts." }, 400);
    }
    const T = await therapistFor(caller.user.id);
    if (!T) return json({ error: "no_listing", message: "Create your profile first." }, 400);

    const cfg = await loadConfig();
    if (cfg.connect_enabled !== "true") {
      return json({ error: "connect_off", message: "Session payments are not switched on yet." }, 503);
    }

    const body = await readBody(req);
    const action = ["onboard", "dashboard", "status"].includes(body.action) ? body.action : "onboard";
    const site = safeReturnOrigin(body.return_url, allowedOrigins()) ?? Deno.env.get("SITE_URL") ?? "";

    const store = async (acct: Stripe.Account) => {
      const status = connectStatus(acct);
      await admin.from("therapist_profiles").update({
        stripe_account_id: acct.id,
        stripe_account_status: status,
        charges_enabled: !!acct.charges_enabled,
        payouts_enabled: !!acct.payouts_enabled,
      }).eq("id", T.id);
      return {
        status,
        charges_enabled: !!acct.charges_enabled,
        payouts_enabled: !!acct.payouts_enabled,
        currently_due: acct.requirements?.currently_due?.length ?? 0,
      };
    };

    if (action === "status") {
      if (!T.stripe_account_id) return json({ status: "none" });
      return json(await store(await stripe.accounts.retrieve(T.stripe_account_id)));
    }

    if (action === "dashboard") {
      if (!T.stripe_account_id) return json({ error: "no_account", message: "Set up payouts first." }, 400);
      const link = await stripe.accounts.createLoginLink(T.stripe_account_id);
      return json({ url: link.url });
    }

    // onboard
    if (T.verification !== "verified") {
      return json({ error: "not_verified",
        message: "Payouts open once your license is verified." }, 400);
    }

    let accountId: string = T.stripe_account_id;
    if (!accountId) {
      const website = typeof T.website === "string" && /^https?:\/\//i.test(T.website) ? T.website : undefined;
      const acct = await stripe.accounts.create({
        country: "US",
        email: caller.user.email ?? undefined,
        controller: {
          fees: { payer: "application" },
          losses: { payments: "application" },
          stripe_dashboard: { type: "express" },
        },
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        business_profile: {
          mcc: "8099", // medical services and health practitioners, not elsewhere classified
          product_description: "Counseling and therapy sessions",
          ...(website ? { url: website } : {}),
        },
        metadata: { supabase_user_id: caller.user.id, therapist_id: T.id },
      }, { idempotencyKey: `connect-account-${T.id}` });
      accountId = acct.id;
      await store(acct);
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${site}/therapist-dashboard.html?connect=refresh#membership`,
      return_url: `${site}/therapist-dashboard.html?connect=return#membership`,
    });
    return json({ url: link.url });
  } catch (err) {
    console.error("connect error", err);
    return json({ error: "server_error", message: String((err as Error)?.message ?? err) }, 500);
  }
});
