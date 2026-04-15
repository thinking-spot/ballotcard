import { createClient } from "@supabase/supabase-js";

// Service role client: server-side only, bypasses RLS.
// All mutations are authorized in server actions before touching the DB.
// Never import this in client components.
export const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
