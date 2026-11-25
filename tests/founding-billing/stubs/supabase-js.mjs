// Stands in for jsr:@supabase/supabase-js@2 in tests/founding-billing/check.mjs:
// the client is whatever the test put on globalThis.
export const createClient = () => globalThis.__fakeSupabase;
