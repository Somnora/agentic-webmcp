export type ErrorCode =
  | "HUMAN_CONFIRMATION_REQUIRED"
  | "INVALID_INPUT"
  | "METHOD_NOT_ALLOWED"
  | "ORIGIN_MISMATCH"
  | "ORIGIN_NOT_ALLOWED"
  | "ORIGIN_UNAVAILABLE"
  | "PATH_NOT_ALLOWED"
  | "PRODUCT_NOT_FOUND"
  | "ROUTE_NOT_FOUND"
  | "UNSUPPORTED_MEDIA_TYPE";

export type ErrorPayload = {
  error: string;
  code: ErrorCode;
  retryable: boolean;
};

export function classifyError(error: unknown): { payload: ErrorPayload; status: number } {
  const message = error instanceof Error ? error.message : "The allowlisted origin request could not be completed.";
  if (error instanceof RangeError) {
    if (message.includes("human confirmation")) return known(message, "HUMAN_CONFIRMATION_REQUIRED");
    if (message.includes("does not match") || message.includes("origin does not match")) return known(message, "ORIGIN_MISMATCH");
    if (message.includes("Origin is not allowlisted") || message.includes("Origin id")) return known(message, "ORIGIN_NOT_ALLOWED");
    if (message.includes("path") || message.includes("URL")) return known(message, "PATH_NOT_ALLOWED");
    if (message.includes("Product not found")) return { payload: { error: message, code: "PRODUCT_NOT_FOUND", retryable: false }, status: 404 };
    return known(message, "INVALID_INPUT");
  }
  return {
    payload: {
      error: "The allowlisted origin request could not be completed.",
      code: "ORIGIN_UNAVAILABLE",
      retryable: true,
    },
    status: 502,
  };
}

function known(error: string, code: ErrorCode): { payload: ErrorPayload; status: 400 } {
  return { payload: { error, code, retryable: false }, status: 400 };
}

export function fixedError(error: string, code: ErrorCode, status: number): { payload: ErrorPayload; status: number } {
  return { payload: { error, code, retryable: false }, status };
}
