import { OriginFailure, normalizeFailureReason, type OriginFailureReason } from "./reliability";
import { OriginAuthorizationError } from "./origin-contract";

export type ErrorCode =
  | "HUMAN_CONFIRMATION_REQUIRED"
  | "INVALID_INPUT"
  | "METHOD_NOT_ALLOWED"
  | "ORIGIN_MISMATCH"
  | "ORIGIN_NOT_ALLOWED"
  | "ORIGIN_AUTHORIZATION_INACTIVE"
  | "ORIGIN_UNAVAILABLE"
  | "OFFER_NOT_ELIGIBLE"
  | "PATH_NOT_ALLOWED"
  | "PRODUCT_NOT_FOUND"
  | "QUOTE_CHANGED"
  | "ROUTE_NOT_FOUND"
  | "UNSUPPORTED_MEDIA_TYPE";

export type ErrorPayload = {
  error: string;
  code: ErrorCode;
  retryable: boolean;
  reason?: OriginFailureReason;
  correlationId?: string;
};

export function classifyError(error: unknown, correlationId?: string): { payload: ErrorPayload; status: number } {
  const message = error instanceof Error ? error.message : "The allowlisted origin request could not be completed.";
  if (error instanceof OriginAuthorizationError) {
    return {
      payload: {
        error: message,
        code: "ORIGIN_AUTHORIZATION_INACTIVE",
        retryable: false,
        ...(correlationId ? { correlationId } : {}),
      },
      status: 403,
    };
  }
  if (error instanceof RangeError) {
    if (message.includes("human confirmation")) return known(message, "HUMAN_CONFIRMATION_REQUIRED", correlationId);
    if (message.includes("not eligible for merchant handoff")) {
      return { payload: { error: message, code: "OFFER_NOT_ELIGIBLE", retryable: false, ...(correlationId ? { correlationId } : {}) }, status: 409 };
    }
    if (message.includes("changed after the reviewed quote")) {
      return { payload: { error: message, code: "QUOTE_CHANGED", retryable: false, ...(correlationId ? { correlationId } : {}) }, status: 409 };
    }
    if (message.includes("does not match") || message.includes("origin does not match")) return known(message, "ORIGIN_MISMATCH", correlationId);
    if (message.includes("Origin is not allowlisted") || message.includes("Origin id")) return known(message, "ORIGIN_NOT_ALLOWED", correlationId);
    if (message.includes("path") || message.includes("URL")) return known(message, "PATH_NOT_ALLOWED", correlationId);
    if (message.includes("Product not found")) {
      return { payload: { error: message, code: "PRODUCT_NOT_FOUND", retryable: false, ...(correlationId ? { correlationId } : {}) }, status: 404 };
    }
    return known(message, "INVALID_INPUT", correlationId);
  }
  const reason = normalizeFailureReason(error);
  const retryable = reason === "timeout" || reason === "network" || reason === "http-error";
  return {
    payload: {
      error: "The allowlisted origin request could not be completed.",
      code: "ORIGIN_UNAVAILABLE",
      retryable,
      reason,
      ...(correlationId ? { correlationId } : {}),
    },
    status: error instanceof OriginFailure && error.reason === "timeout" ? 504 : 502,
  };
}

function known(error: string, code: ErrorCode, correlationId?: string): { payload: ErrorPayload; status: 400 } {
  return { payload: { error, code, retryable: false, ...(correlationId ? { correlationId } : {}) }, status: 400 };
}

export function fixedError(error: string, code: ErrorCode, status: number, correlationId?: string): { payload: ErrorPayload; status: number } {
  return { payload: { error, code, retryable: false, ...(correlationId ? { correlationId } : {}) }, status };
}
