import { Router } from "express";
import multer from "multer";
import { rateLimit } from "express-rate-limit";
import * as controller from "../controllers/photoboothController.js";
import { requireStorage } from "../services/supabase.js";
const router = Router();
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 8 },
  fileFilter(req, file, cb) {
    if (["image/png", "image/jpeg"].includes(file.mimetype)) cb(null, true);
    else
      cb(
        Object.assign(new Error("Only PNG and JPG images are supported."), {
          status: 400,
        }),
      );
  },
});
router.use(requireStorage);
router.post(
  "/",
  rateLimit({
    windowMs: 60000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
  upload.single("image"),
  wrap(controller.create),
);
router.get("/session/:sessionId", wrap(controller.list));
router.get("/:id/image", wrap(controller.image));
router.get("/:id", wrap(controller.get));
router.delete("/:id", wrap(controller.remove));
export default router;
