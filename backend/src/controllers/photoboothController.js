import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { supabase, bucket } from "../services/supabase.js";
import { metadata, uuid } from "../validation.js";
import { getFrontendOrigin } from "../config.js";
const fields =
  "id,event_name,custom_text,layout,frame,photo_count,created_at,expires_at";
const alive = (q) =>
  q.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
export async function create(req, res) {
  const parsed = metadata.safeParse(req.body);
  if (!parsed.success || !req.file)
    return res
      .status(400)
      .json({ error: "Provide a PNG or JPG and valid photobooth details." });
  let info;
  try {
    info = await sharp(req.file.buffer, {
      limitInputPixels: 40000000,
    }).metadata();
  } catch {
    return res.status(400).json({ error: "This image could not be read." });
  }
  if (
    !["png", "jpeg"].includes(info.format) ||
    `image/${info.format}` !== req.file.mimetype
  )
    return res
      .status(400)
      .json({ error: "The image contents must match PNG or JPEG." });
  const image = await sharp(req.file.buffer, { limitInputPixels: 40000000 })
    .rotate()
    .png()
    .toBuffer();
  const id = randomUUID(),
    storage_path = `photobooths/${id}.png`;
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storage_path, image, { contentType: "image/png", upsert: false });
  if (uploadError) throw uploadError;
  const days = Number(process.env.PHOTO_RETENTION_DAYS ?? 7);
  const expires_at =
    days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null;
  const { data, error } = await supabase
    .from("photobooths")
    .insert({
      ...parsed.data,
      id,
      storage_path,
      image_url: `/api/photobooths/${id}/image`,
      expires_at,
    })
    .select(fields)
    .single();
  if (error) {
    await supabase.storage.from(bucket).remove([storage_path]);
    throw error;
  }
  res.status(201).json({
    ...data,
    image_url: `/api/photobooths/${id}/image`,
    share_url: `${getFrontendOrigin()}/photo/${id}`,
  });
}
export async function get(req, res) {
  if (!uuid.safeParse(req.params.id).success)
    return res.status(400).json({ error: "Invalid photo link." });
  const { data, error } = await alive(
    supabase.from("photobooths").select(fields).eq("id", req.params.id),
  ).maybeSingle();
  if (error) throw error;
  if (!data)
    return res.status(404).json({
      error: "This memory was deleted, expired, or could not be found.",
    });
  res.json({ ...data, image_url: `/api/photobooths/${data.id}/image` });
}
export async function image(req, res) {
  if (!uuid.safeParse(req.params.id).success) return res.status(400).end();
  const { data, error } = await alive(
    supabase.from("photobooths").select("storage_path").eq("id", req.params.id),
  ).maybeSingle();
  if (error) throw error;
  if (!data)
    return res.status(404).json({ error: "Photo not found or expired." });
  const { data: blob, error: downloadError } = await supabase.storage
    .from(bucket)
    .download(data.storage_path);
  if (downloadError) throw downloadError;
  res
    .set({
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
      "Cross-Origin-Resource-Policy": "cross-origin",
    })
    .send(Buffer.from(await blob.arrayBuffer()));
}
export async function list(req, res) {
  if (
    !uuid.safeParse(req.params.sessionId).success ||
    req.get("X-Session-Id") !== req.params.sessionId
  )
    return res
      .status(400)
      .json({ error: "A matching browser session is required." });
  const { data, error } = await alive(
    supabase
      .from("photobooths")
      .select(fields)
      .eq("session_id", req.params.sessionId),
  )
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  res.json(
    data.map((row) => ({
      ...row,
      image_url: `/api/photobooths/${row.id}/image`,
    })),
  );
}
export async function remove(req, res) {
  const session = req.get("X-Session-Id");
  if (
    !uuid.safeParse(req.params.id).success ||
    !uuid.safeParse(session).success
  )
    return res.status(400).json({ error: "Invalid photo or session." });
  const { data, error } = await supabase
    .from("photobooths")
    .select("storage_path")
    .eq("id", req.params.id)
    .eq("session_id", session)
    .maybeSingle();
  if (error) throw error;
  if (!data)
    return res
      .status(404)
      .json({ error: "This photo is not in your session." });
  const { error: storageError } = await supabase.storage
    .from(bucket)
    .remove([data.storage_path]);
  if (storageError) throw storageError;
  const { error: deleteError } = await supabase
    .from("photobooths")
    .delete()
    .eq("id", req.params.id)
    .eq("session_id", session);
  if (deleteError) throw deleteError;
  res.status(204).end();
}
