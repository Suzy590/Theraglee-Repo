// Response helpers shared by every Edge Function.
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

/** Reads a JSON body, returning {} on anything that is not JSON. */
export const readBody = async (req: Request): Promise<Record<string, any>> =>
  (await req.json().catch(() => ({}))) ?? {};
