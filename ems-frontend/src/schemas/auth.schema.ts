import { z } from "zod";

/**
 * Mirrors ems-backend loginSchema behavior.
 * Schema sync note: validation rules must stay identical (required email/password,
 * valid email format). Zod major versions may differ in option names
 * (`required_error` vs `message`) — keep the *rules* in sync, not the API syntax.
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Invalid email format")
    .transform((v) => v.toLowerCase()),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
