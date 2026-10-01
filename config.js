const SUPABASE_URL = "https://bsjnzpnulkhmhbwqkcuk.supabase.co";

const SUPABASE_KEY = "sb_publishable_zdgf2GuxNyJwdUA7muNUTQ_fY22f4WN";

window.sb = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);
