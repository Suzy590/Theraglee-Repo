// Stripe Identity for therapists: a government ID + selfie check before a
// listing goes live, so the person behind a verified license is the person who
// holds it.
//
//   action "start"  -> returns a Stripe-hosted URL to send the therapist to
//                      (reuses an open session rather than opening another)
//   action "status" -> re-reads the session from Stripe and stores the result,
//                      for the moment the therapist lands back on the dashboard
//                      before the webhook has arrived
//
// The webhook (identity.verification_session.*) remains the source of truth.
import { CORS, json, readBody } from "../_shared/http.ts";
import { admin, allowedOrigins, callerFrom, therapistFor } from "../_shared/supabase.ts";
import { stripeClient } from "../_shared/stripe.ts";
import { identityStatusFor, minuteBucket, safeReturnOrigin } from "../_shared/billing.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const stripe = stripeClient();
    if (!stripe) return json({ error: "billing_not_configured", message: "Stripe is not connected yet." }, 503);

    const caller = await callerFrom(req);
    if (!caller) return json({ error: "unauthorized", message: "Please sign in first." }, 401);
    if (caller.profile.role !== "therapist") {
      return json({ error: "wrong_account", message: "Identity checks are for therapist accounts." }, 400);
    }
    const T = await therapistFor(caller.user.id);
    if (!T) return json({ error: "no_listing", message: "Create your profile first." }, 400);

    const body = await readBody(req);
    const action = body.action === "status" ? "status" : "start";

    const store = async (vs: { id: string; status: string; last_error?: { reason?: string | null } | null }) => {
      const status = identityStatusFor(vs.status);
      await admin.from("therapist_profiles").update({
        identity_status: status,
        identity_session_id: vs.id,
        identity_last_error: vs.last_error?.reason ?? null,
        ...(status === "verified" ? { identity_verified_at: new Date().toISOString() } : {}),
      }).eq("id", T.id);
      return status;
    };

    if (action === "status") {
      if (!T.identity_session_id) return json({ status: T.identity_status ?? "unverified" });
      const vs = await stripe.identity.verificationSessions.retrieve(T.identity_session_id);
      return json({ status: await store(vs), reason: vs.last_error?.reason ?? null });
    }

    if (T.identity_status === "verified") return json({ status: "verified", verified: true });

    // Reuse an open session: it keeps the attempt history in one place and
    // hands back a fresh URL when the last attempt needs another try.
    if (T.identity_session_id) {
      const vs = await stripe.identity.verificationSessions.retrieve(T.identity_session_id);
      const status = await store(vs);
      if (status === "verified") return json({ status, verified: true });
      if (status === "pending") {
        return json({ status, message: "Your last submission is still being checked. This usually takes a few minutes." });
      }
      if (status === "requires_input" && vs.url) return json({ url: vs.url, status });
      // canceled, or no URL to hand back: fall through and open a new session
    }

    const site = safeReturnOrigin(body.return_url, allowedOrigins()) ?? Deno.env.get("SITE_URL") ?? "";
    const vs = await stripe.identity.verificationSessions.create({
      type: "document",
      options: {
        document: {
          allowed_types: ["driving_license", "passport", "id_card"],
          require_matching_selfie: true,
          require_live_capture: true,
        },
      },
      provided_details: { email: caller.user.email ?? undefined },
      metadata: { supabase_user_id: caller.user.id, therapist_id: T.id },
      return_url: `${site}/therapist-dashboard.html?identity=done#membership`,
    }, { idempotencyKey: `identity-${T.id}-${minuteBucket()}` });

    await store(vs);
    return json({ url: vs.url, status: "pending" });
  } catch (err) {
    console.error("identity error", err);
    return json({ error: "server_error", message: String((err as Error)?.message ?? err) }, 500);
  }
});
