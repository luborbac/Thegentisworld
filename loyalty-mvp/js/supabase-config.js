// Credenciais públicas do Supabase (seguro expor no client — protegido por RLS).
const SUPABASE_URL = "https://kyopaqxmkgqhgrngjjzm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_OGvm1WCJsAb0bBpynv-EOA_H382ilH6";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
