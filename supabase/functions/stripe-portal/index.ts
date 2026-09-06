// Opens the Stripe billing portal so members manage or cancel their own plan.
import { CORS, json, readBody } from "../_shared/http.ts";
import { allowedOrigins, callerFrom } from "../_shared/supabase.ts";
import { stripeClient } from "../_shared/stripe.ts";
import { safeReturnOrigin } from "../_shared/billing.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const stripe = stripeClient();
    if (!stripe) return json({ error: "billing_not_configured", message: "Stripe is not connected yet." }, 503);

    const caller = await callerFrom(req);
    if (!caller) return json({ error: "unauthorized", message: "Please sign in first." }, 401);
    const { profile } = caller;

    if (!profile.stripe_customer_id) {
      return json({ error: "no_customer", message: "You do not have a paid membership yet." }, 400);
    }

    const body = await readBody(req);
    const site = safeReturnOrigin(body.return_url, allowedOrigins()) ?? Deno.env.get("SITE_URL") ?? "";
    const home = profile.role === "therapist" ? "therapist-dashboard.html#membership" : "account.html";

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${site}/${home}`,
    });
    return json({ url: session.url });
  } catch (err) {
    console.error(err);
    return json({ error: "server_error", message: String((err as Error)?.message ?? err) }, 500);
  }
});
