import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

export function getSupabaseAdmin() {
  const url = serverEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = serverEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export function getSupabasePublic() {
  const url = serverEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = serverEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!url || !anonKey) {
    return null;
  }

  return createClient(url, anonKey);
}
