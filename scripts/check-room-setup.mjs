import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";

// Report only setup status and safe error codes. Never log keys or response data.
const env = parseEnv(
  await readFile(new URL("../backend/.env", import.meta.url), "utf8"),
);
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Room setup: missing backend Supabase configuration");
  process.exitCode = 1;
} else {
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (url, options) =>
        fetch(url, { ...options, signal: AbortSignal.timeout(15000) }),
    },
  });
  const checks = [
    [
      "Room tables",
      client
        .from("rooms")
        .select(
          "id,room_code,host_participant_id,invite_token_hash,capture_id,roster,version",
        )
        .limit(0),
    ],
    [
      "Participant table",
      client
        .from("room_participants")
        .select(
          "room_id,participant_id,token_hash,host_token_hash,capture_id,capture_at",
        )
        .limit(0),
    ],
    [
      "Room photo table",
      client
        .from("room_photos")
        .select("id,room_id,participant_id,round,capture_id,approved")
        .limit(0),
    ],
    ["Private room photo bucket", client.storage.getBucket("room-photos")],
    // Snapshot of a nonexistent room is a read-only way to verify RPC installation.
    [
      "Room database functions",
      client.rpc("booth_room_snapshot", {
        p_room: "00000000-0000-0000-0000-000000000000",
      }),
    ],
  ];
  const results = await Promise.allSettled(checks.map(([, check]) => check));
  for (const [index, result] of results.entries()) {
    const label = checks[index][0];
    const { error, data } =
      result.status === "fulfilled"
        ? result.value
        : { error: { code: "CONNECTION_FAILED" } };
    if (error) {
      const code = String(
        error.code || error.status || error.statusCode || "CONNECTION_FAILED",
      ).replace(/[^a-zA-Z0-9_-]/g, "");
      console.log(`${label}: FAIL (${code})`);
      process.exitCode = 1;
    } else if (index === 3 && data.public !== false) {
      console.log(`${label}: FAIL (bucket must be private)`);
      process.exitCode = 1;
    } else console.log(`${label}: PASS`);
  }
  if (process.exitCode)
    console.log(
      "For missing tables/functions/bucket, run supabase/booth-together.sql in the Supabase SQL Editor.",
    );
}
