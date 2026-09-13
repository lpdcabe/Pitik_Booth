import { createClient } from "@supabase/supabase-js";
export const bucket = "photobooth-images";
export const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } },
      )
    : null;
export function requireStorage(req, res, next) {
  if (!supabase)
    return res.status(503).json({
      error:
        "Cloud saving is not configured yet. You can still download your photos.",
    });
  next();
}
