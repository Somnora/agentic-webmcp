import type { Adapter } from "./origins";

export type OriginFailureReason =
  | "timeout"
  | "network"
  | "http-error"
  | "off-origin-redirect"
  | "redirect-blocked"
  | "password-protected"
  | "response-too-large"
  | "invalid-response"
  | "contract-failure"
  | "unknown";

export type AdapterOperation = "catalog" | "product" | "page" | "conformance";

export type AdapterAttempt = {
  adapter: Adapter;
  operation: AdapterOperation;
  outcome: "success" | "failure";
  durationMs: number;
  httpStatus: number | null;
  responseBytes?: number;
  failureReason?: OriginFailureReason;
};

export type DiagnosticSink = {
  correlationId: string;
  attempts: AdapterAttempt[];
  record(attempt: AdapterAttempt): void;
};

export function markAdapterAttemptFailure(attempt: AdapterAttempt | undefined, error: unknown): void {
  if (!attempt || attempt.outcome !== "success") return;
  attempt.outcome = "failure";
  attempt.failureReason = normalizeFailureReason(error);
}

export class OriginFailure extends Error {
  readonly reason: OriginFailureReason;
  readonly httpStatus: number | undefined;

  constructor(reason: OriginFailureReason, message: string, httpStatus?: number) {
    super(message);
    this.name = "OriginFailure";
    this.reason = reason;
    this.httpStatus = httpStatus;
  }
}

export function createDiagnosticSink(correlationId: string): DiagnosticSink {
  const attempts: AdapterAttempt[] = [];
  return {
    correlationId,
    attempts,
    record(attempt) {
      if (attempts.length < 12) attempts.push(attempt);
    },
  };
}

export function normalizeFailureReason(error: unknown): OriginFailureReason {
  if (error instanceof OriginFailure) return error.reason;
  const message = error instanceof Error ? error.message.toLocaleLowerCase() : "";
  if (message.includes("timed out") || message.includes("abort")) return "timeout";
  if (message.includes("invalid json") || message.includes("did not return html") || message.includes("no data")) {
    return "invalid-response";
  }
  if (message.includes("violates origin") || message.includes("contract")) return "contract-failure";
  if (message.includes("fetch") || message.includes("network")) return "network";
  return "unknown";
}
