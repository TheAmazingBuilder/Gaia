import { validationError } from "@/shared/errors/gaia-error";

type SafeParser<T> = {
  safeParse: (
    input: unknown,
  ) =>
    | { success: true; data: T }
    | {
        success: false;
        error: { issues: Array<{ path: PropertyKey[]; message: string }> };
      };
};

type ValidationErrorFactory = (
  message: string,
  issues?: { path: string; message: string }[],
) => Error;

/** Parse un input et convertit les problèmes Zod en erreur métier Gaia. */
export function parseOrThrow<T>(
  schema: SafeParser<T>,
  input: unknown,
  makeValidationError: ValidationErrorFactory = validationError,
): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw makeValidationError(
      "Some fields are invalid.",
      parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }
  return parsed.data;
}
