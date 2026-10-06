// Supabase access shared by the Stripe Edge Functions.
import { createClient } from "jsr:@supabase/supabase-js@2";

export const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

export interface Caller {
  user: { id: string; email?: string | null };
  profile: {
    id: string; role: string; tier: string; full_name: string | null; email: string | null;
    stripe_customer_id: string | null; stripe_subscription_id: string | null;
    subscription_status: string | null; deletion_requested_at: string | null;
  };
}

/**
 * Validates the caller's Supabase JWT ourselves (verify_jwt is off on these
 * functions so we can answer with friendly JSON instead of a bare 401).
 * Returns null when there is no usable session.
 */
export async function callerFrom(req: Request): Promise<Caller | null> {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return null;
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data?.user) return null;
  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, tier, full_name, email, stripe_customer_id, stripe_subscription_id, subscription_status, deletion_requested_at")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile) return null;
  return { user: { id: data.user.id, email: data.user.email }, profile };
}

/** app_config as a plain object. */
export async function loadConfig(): Promise<Record<string, string>> {
  const { data } = await admin.from("app_config").select("key,value");
  return Object.fromEntries((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value ?? ""]));
}

/** The therapist listing owned by a user, if any. */
export async function therapistFor(userId: string) {
  const { data } = await admin.from("therapist_profiles").select("*").eq("user_id", userId).maybeSingle();
  return data;
}

/**
 * Origins a Stripe flow may send a member back to. SITE_URL plus the
 * production hosts, plus anything in ALLOWED_ORIGINS (comma separated) for
 * previews and local development.
 */
export function allowedOrigins(): string[] {
  const list = [
    Deno.env.get("SITE_URL") ?? "",
    "https://theraglee.com",
    "https://www.theraglee.com",
    "https://theraglee-site.vercel.app",
    ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(","),
  ];
  return list.map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean);
}

/**
 * Deletes a member's account for good: the auth user, and with it (by
 * cascade) the profile, the therapist listing and everything they created.
 * Files they uploaded go first, best effort. Returns an error message, or
 * null when the account is gone.
 *
 * A therapist who has taken session payments cannot be deleted
 * (session_payments keeps those rows for the money records); the message
 * says so and an administrator closes the account by hand.
 */
export async function deleteAccount(userId: string): Promise<string | null> {
  for (const [bucket, dirs] of [["therapist-photos", [userId, `${userId}/office`]]] as const) {
    for (const dir of dirs) {
      try {
        const { data } = await admin.storage.from(bucket).list(dir);
        const files = (data ?? []).filter((f) => f.id).map((f) => `${dir}/${f.name}`);
        if (files.length) await admin.storage.from(bucket).remove(files);
      } catch (err) { console.warn("storage cleanup", bucket, dir, err); }
    }
  }
  const { error } = await admin.auth.admin.deleteUser(userId);
  return error ? error.message : null;
}
