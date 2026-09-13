import { z } from "zod";
export const uuid = z.string().uuid();
export const metadata = z.object({
  session_id: uuid,
  layout: z.string().min(1).max(100),
  frame: z.string().min(1).max(100),
  photo_count: z.coerce
    .number()
    .refine((n) => [1, 2, 3, 4, 6, 8, 9].includes(n)),
  custom_text: z.string().max(240).default(""),
  event_name: z.string().max(100).default(""),
});
