import express from "express";
import multer from "multer";
import { rateLimit } from "express-rate-limit";
import * as controller from "../controllers/roomController.js";
import { requireStorage } from "../services/supabase.js";
import { fail, requireMember } from "../services/roomService.js";
import { openRoomEvents } from "../services/roomRealtime.js";
const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const limit = (requests, windowMs = 60000) => rateLimit({ windowMs, limit: requests, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "Too many room requests. Please wait a moment and try again." } });
const upload = multer({
  storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 8, parts: 10 },
  fileFilter(req, file, cb) { cb(["image/png", "image/jpeg"].includes(file.mimetype) ? null : fail(400, "Only PNG and JPG images are supported."), true); },
});
router.use(requireStorage, express.json({ limit: "100kb" }));
// Signalling bursts (ICE) have their own limit; guessing room codes is tighter.
router.post("/", limit(8, 600000), wrap(controller.create));
router.get("/:code/info", limit(40), wrap(controller.info));
router.post("/:code/join", limit(20, 600000), wrap(controller.join));
router.use("/:code", limit(600));
router.get("/:code/events", limit(15), requireMember, wrap(openRoomEvents));
router.post("/:code/signals", limit(240), requireMember, wrap(controller.signal));
router.post("/:code/actions", limit(120), requireMember, wrap(controller.action));
router.post("/:code/photos", limit(30), requireMember, upload.single("image"), wrap(controller.uploadPhoto));
router.get("/:code/photos/:photoId/image", requireMember, wrap(controller.photoImage));
router.post("/:code/result", limit(10), requireMember, upload.single("image"), wrap(controller.uploadResult));
router.get("/:code", requireMember, wrap(controller.snapshot));
export default router;
