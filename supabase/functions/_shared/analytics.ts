// The decisions behind the Google Analytics tab on the admin screen.
//
// Everything here is plain logic with no imports, so it runs under Deno in
// the google-analytics Edge Function and under Node in
// tests/google-analytics/check.mjs. The function itself (index.ts) does the
// network: it signs the service account's JWT, trades it for a token, and
// posts the report requests built here to the Google Analytics Data API.
//
// What the tab shows comes from one batchRunReport call (five reports: the
// totals against the previous window, a line per day, the top pages, the
// channels people arrived by, and the devices they used) plus one
// runRealtimeReport call for the number of people on the site right now.

/** The windows the tab offers, in days. The same list sits in
 *  site/assets/admin-analytics.js; the test holds them together. */
export const WINDOW_DAYS = [7, 30, 90, 365];

/** The GA4 Data API endpoint, and the one scope the service account needs. */
export const DATA_API = "https://analyticsdata.googleapis.com/v1beta";
export const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
export const TOKEN_URI = "https://oauth2.googleapis.com/token";

/** Keys in app_config that the tab writes and the function reads. */
export const CONFIG_KEYS = {
  measurementId: "ga_measurement_id", // G-XXXXXXXXXX, the tag on the pages
  propertyId: "ga_property_id",       // the numeric GA4 property, for the reports
  tagEnabled: "ga_tag_enabled",       // 'true' once the privacy policy allows the tag
} as const;

/** A GA4 measurement id: a G- followed by letters and digits. */
export function isMeasurementId(v: unknown): v is string {
  return typeof v === "string" && /^G-[A-Z0-9]{6,12}$/.test(v);
}

/** The numeric id of a GA4 property, with or without the "properties/" the
 *  Analytics admin screen sometimes shows. Returns the digits, or null. */
export function propertyIdFrom(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^(?:properties\/)?(\d{6,15})$/);
  return m ? m[1] : null;
}

/** The window the caller asked for, snapped to one the tab offers. */
export function windowFrom(v: unknown): number {
  const n = Number(v);
  return WINDOW_DAYS.includes(n) ? n : 30;
}

type ServiceAccount = { client_email: string; private_key: string; token_uri: string };

/** Reads the service account JSON from the GA_SERVICE_ACCOUNT_JSON secret.
 *  Returns the three fields the function uses, or a message saying what is
 *  wrong with it, in words an administrator can act on. */
export function parseServiceAccount(raw: string | undefined | null): { account: ServiceAccount } | { error: string } {
  if (!raw || !raw.trim()) {
    return { error: "Google Analytics is not connected yet. Add GA_SERVICE_ACCOUNT_JSON in Supabase → Edge Functions → Secrets." };
  }
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(raw); } catch {
    return { error: "GA_SERVICE_ACCOUNT_JSON is not valid JSON. Paste the whole key file Google Cloud downloaded, unchanged." };
  }
  const email = parsed.client_email, key = parsed.private_key;
  if (typeof email !== "string" || !email.includes("@") || typeof key !== "string" || !key.includes("PRIVATE KEY")) {
    return { error: "GA_SERVICE_ACCOUNT_JSON is missing client_email or private_key. It should be a service account key file." };
  }
  const tokenUri = typeof parsed.token_uri === "string" && parsed.token_uri ? parsed.token_uri : TOKEN_URI;
  return { account: { client_email: email, private_key: key, token_uri: tokenUri } };
}

/** The claims of the JWT a service account trades for an access token. */
export function tokenClaims(clientEmail: string, tokenUri: string, nowSeconds: number) {
  return { iss: clientEmail, scope: SCOPE, aud: tokenUri, iat: nowSeconds, exp: nowSeconds + 3600 };
}

/** The five report requests for a window of `days`, in the order the
 *  function and the tab both rely on: totals, days, pages, channels, devices. */
export function reportRequests(days: number) {
  const current = { startDate: `${days - 1}daysAgo`, endDate: "today" };
  const previous = { startDate: `${2 * days - 1}daysAgo`, endDate: `${days}daysAgo` };
  const m = (name: string) => ({ name });
  const byMetricDesc = (metricName: string) => [{ metric: { metricName }, desc: true }];
  return [
    { // 0 totals, this window and the one before it (two date ranges, no dimensions)
      dateRanges: [current, previous],
      metrics: ["activeUsers", "newUsers", "sessions", "screenPageViews", "averageSessionDuration", "engagementRate"].map(m),
    },
    { // 1 one row per day
      dateRanges: [current],
      dimensions: [{ name: "date" }],
      metrics: [m("activeUsers"), m("sessions"), m("screenPageViews")],
      orderBys: [{ dimension: { dimensionName: "date" } }],
      keepEmptyRows: true, // a day with nobody on the site is still a day on the line
      limit: 366,
    },
    { // 2 the pages people opened most
      dateRanges: [current],
      dimensions: [{ name: "pagePath" }],
      metrics: [m("screenPageViews"), m("activeUsers")],
      orderBys: byMetricDesc("screenPageViews"),
      limit: 12,
    },
    { // 3 how they arrived
      dateRanges: [current],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [m("sessions"), m("activeUsers")],
      orderBys: byMetricDesc("sessions"),
      limit: 10,
    },
    { // 4 what they used
      dateRanges: [current],
      dimensions: [{ name: "deviceCategory" }],
      metrics: [m("activeUsers")],
      orderBys: byMetricDesc("activeUsers"),
      limit: 5,
    },
  ];
}

/** The realtime request: people on the site in the last 30 minutes. */
export const realtimeRequest = { metrics: [{ name: "activeUsers" }] };

type ApiRow = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] };
type ApiReport = { dimensionHeaders?: { name: string }[]; metricHeaders?: { name: string }[]; rows?: ApiRow[] };

/** One report's rows as plain objects: each dimension by name as a string,
 *  each metric by name as a number. A report with no rows gives []. */
export function rowsOf(report: ApiReport | undefined): Record<string, string | number>[] {
  if (!report) return [];
  const dims = (report.dimensionHeaders ?? []).map((h) => h.name);
  const mets = (report.metricHeaders ?? []).map((h) => h.name);
  return (report.rows ?? []).map((r) => {
    const out: Record<string, string | number> = {};
    dims.forEach((d, i) => { out[d] = r.dimensionValues?.[i]?.value ?? ""; });
    mets.forEach((mName, i) => { out[mName] = Number(r.metricValues?.[i]?.value ?? 0) || 0; });
    return out;
  });
}

const TOTAL_METRICS = ["activeUsers", "newUsers", "sessions", "screenPageViews", "averageSessionDuration", "engagementRate"];

/** A YYYYMMDD from the API as YYYY-MM-DD. */
export const isoDate = (d: string) => /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : d;

/** Turns the API's answers into what the tab draws. `reports` is the
 *  batchRunReport response's `reports` list, in the order of reportRequests();
 *  `realtime` is the runRealtimeReport response, or null when it failed. */
export function summarize(reports: ApiReport[], realtime: ApiReport | null, days: number) {
  const totals = rowsOf(reports[0]);
  // With two date ranges and no dimensions, GA adds a dateRange dimension:
  // date_range_0 is this window, date_range_1 the one before it. A window with
  // no traffic has no row at all, so every metric then reads 0.
  const pick = (range: string) => {
    const row = totals.find((r) => r.dateRange === range) ?? (totals.length === 1 && !totals[0].dateRange ? totals[0] : null);
    return Object.fromEntries(TOTAL_METRICS.map((k) => [k, Number(row?.[k] ?? 0)]));
  };
  const current = pick("date_range_0"), previous = pick("date_range_1");
  const byDate = rowsOf(reports[1]).map((r) => ({
    date: isoDate(String(r.date)), activeUsers: Number(r.activeUsers), sessions: Number(r.sessions), pageViews: Number(r.screenPageViews),
  }));
  return {
    days,
    now: realtime ? Number(rowsOf(realtime)[0]?.activeUsers ?? 0) : null,
    current,
    previous,
    byDate,
    pages: rowsOf(reports[2]).map((r) => ({ path: String(r.pagePath), pageViews: Number(r.screenPageViews), activeUsers: Number(r.activeUsers) })),
    channels: rowsOf(reports[3]).map((r) => ({ channel: String(r.sessionDefaultChannelGroup), sessions: Number(r.sessions), activeUsers: Number(r.activeUsers) })),
    devices: rowsOf(reports[4]).map((r) => ({ device: String(r.deviceCategory), activeUsers: Number(r.activeUsers) })),
  };
}

/** What to tell the administrator when Google answers with an error. */
export function apiErrorMessage(status: number, body: unknown): string {
  const detail = (body as { error?: { message?: string } })?.error?.message ?? "";
  if (status === 401) return "Google did not accept the service account key. Make a new key in Google Cloud and paste the whole file into GA_SERVICE_ACCOUNT_JSON.";
  if (status === 403) {
    if (/has not been used|is disabled|API has not been enabled/i.test(detail)) {
      return "The Google Analytics Data API is not enabled on the Google Cloud project that owns the service account. Enable it there, then try again.";
    }
    return "The service account cannot read this property. In Google Analytics, open Admin → Property access management and add the service account's email as a Viewer.";
  }
  if (status === 404) return "Google Analytics has no property with that id. The property id is the number under Admin → Property details, not the G- measurement id.";
  if (status === 429) return "Google Analytics is rate-limiting these reports. Wait a minute and try again.";
  return detail ? `Google Analytics answered: ${detail}` : `Google Analytics answered with status ${status}.`;
}
