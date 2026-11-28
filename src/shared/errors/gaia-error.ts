/** Shared domain error and factories used by the Gaia server adapters. */
export class GaiaError extends Error {
  readonly error: string;
  readonly code: string;
  readonly status: number;
  readonly issues?: { path: string; message: string }[];

  constructor(
    error: string,
    code: string,
    status: number,
    message: string,
    issues?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = "GaiaError";
    this.error = error;
    this.code = code;
    this.status = status;
    this.issues = issues;
  }
}

export function notFound(code: string, message: string): GaiaError {
  return new GaiaError("NotFound", code, 404, message);
}

export function validationError(
  message: string,
  issues?: { path: string; message: string }[],
): GaiaError {
  return new GaiaError("ValidationError", "VALIDATION", 422, message, issues);
}

export function conflictError(code: string, message: string): GaiaError {
  return new GaiaError("Conflict", code, 409, message);
}
