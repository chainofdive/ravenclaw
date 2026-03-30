import type { Context } from "hono";
import { ZodError } from "zod";

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function createErrorResponse(
  code: string,
  message: string,
  details?: unknown
): ApiError {
  return {
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };
}

export async function errorHandler(c: Context, next: () => Promise<void>) {
  try {
    await next();
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      const details = err.errors.map((e) => ({
        path: e.path.join("."),
        message: e.message,
        code: e.code,
      }));

      console.error("[ERROR] Validation error:", JSON.stringify(details));

      return c.json(
        createErrorResponse("VALIDATION_ERROR", "Request validation failed", details),
        422
      );
    }

    if (err instanceof ApiHttpError) {
      console.error(`[ERROR] ${err.statusCode} ${err.code}: ${err.message}`);
      return c.json(
        createErrorResponse(err.code, err.message, err.details),
        err.statusCode as 400
      );
    }

    const message =
      err instanceof Error ? err.message : "An unexpected error occurred";
    const stack = err instanceof Error ? err.stack : undefined;

    console.error("[ERROR] Unhandled error:", message);
    if (stack) {
      console.error(stack);
    }

    return c.json(
      createErrorResponse("INTERNAL_ERROR", "An unexpected error occurred"),
      500
    );
  }
}

export class ApiHttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiHttpError";
  }
}

export function notFound(message = "Resource not found"): never {
  throw new ApiHttpError(404, "NOT_FOUND", message);
}

export function badRequest(message: string, details?: unknown): never {
  throw new ApiHttpError(400, "BAD_REQUEST", message, details);
}

export function unauthorized(message = "Unauthorized"): never {
  throw new ApiHttpError(401, "UNAUTHORIZED", message);
}

export function forbidden(message = "Forbidden"): never {
  throw new ApiHttpError(403, "FORBIDDEN", message);
}

export function conflict(message: string): never {
  throw new ApiHttpError(409, "CONFLICT", message);
}
