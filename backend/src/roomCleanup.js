import { supabase } from "./services/supabase.js";
import { roomBucket } from "./services/roomService.js";

// Includes superseded/orphaned retake objects by listing the room's prefix.
// Final results live in photobooth-images and keep the solo retention setting.
export async function cleanupRooms() {
  let removed = 0;
  while (true) {
    const { data: rooms, error } = await supabase.from("rooms").select("id").lt("expires_at", new Date().toISOString()).limit(100);
    if (error) {
      if (["42P01", "PGRST205"].includes(error.code)) return removed;
      throw error;
    }
    if (!rooms.length) return removed;
    for (const room of rooms) {
      while (true) {
        const { data: objects, error: listError } = await supabase.storage.from(roomBucket).list(room.id, { limit: 100 });
        if (listError) throw listError;
        if (!objects.length) break;
        const { error: removeError } = await supabase.storage.from(roomBucket).remove(objects.map((object) => `${room.id}/${object.name}`));
        if (removeError) throw removeError;
      }
      const { error: deleteError } = await supabase.from("rooms").delete().eq("id", room.id);
      if (deleteError) throw deleteError;
      removed++;
    }
  }
}
