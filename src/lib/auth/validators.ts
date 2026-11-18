/**
 * Zod schemas shared by the client forms and the API routes — single source
 * of truth for validation. Client-safe: imports zod only.
 *
 * Adapted from Promethe src/lib/auth/validators.ts (login + signup only).
 * The updateProfileSchema is NOT copied — Gaïa has no profile settings page.
 * Messages are stable CODES (not prose), as in Promethe.
 */
import { z } from "zod";
import { LOCALES } from "@/i18n/config";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "emailRequired")
  .max(190, "emailMax")
  .email("emailInvalid");

const password = z
  .string()
  .min(1, "passwordRequired")
  .max(128, "passwordMax");

export const loginSchema = z.object({
  email,
  password,
});

export const signupSchema = z.object({
  email,
  password: z
    .string()
    .min(8, "passwordMin")
    .max(128, "passwordMax")
    .regex(/[A-Za-z]/, "passwordLetter")
    .regex(/[0-9]/, "passwordDigit"),
  displayName: z
    .string()
    .trim()
    .min(1, "displayNameMin")
    .max(60, "displayNameMax")
    .optional(),
  timezone: z
    .string()
    .trim()
    .max(64)
    .regex(/^[A-Za-z_][A-Za-z0-9_+\-/]*\/?[A-Za-z0-9_+\-/]*$/, "timezoneInvalid")
    .optional(),
  locale: z.enum(LOCALES).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

/** Flatten a ZodError into { field: messages[] } - compatible zod 3 & 4. */
export function zodFieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
