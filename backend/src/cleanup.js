import { supabase, bucket } from "./services/supabase.js";
if (!supabase) throw new Error("Configure Supabase before cleanup.");
let removed = 0;
while (true) {
  const { data, error } = await supabase
    .from("photobooths")
    .select("id,storage_path")
    .lt("expires_at", new Date().toISOString())
    .limit(100);
  if (error) throw error;
  if (!data.length) break;
  const { error: storageError } = await supabase.storage
    .from(bucket)
    .remove(data.map((x) => x.storage_path));
  if (storageError) throw storageError;
  const { error: deleteError } = await supabase
    .from("photobooths")
    .delete()
    .in(
      "id",
      data.map((x) => x.id),
    );
  if (deleteError) throw deleteError;
  removed += data.length;
}
console.log(`Removed ${removed} expired memories.`);
