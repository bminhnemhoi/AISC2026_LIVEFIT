import type { AuthorityReceipt, RoomRead, RoomSnapshot } from "./authority";

/** Immutable deployment binding; generation changes only on restore/replacement. */
export type ProductionContext = {
  workspaceId: string;
  roomId: string;
  generation: string;
};

export type RecoveryNotice = {
  restoredAtMs: number;
  backupTakenAtMs: number;
  backupRevision: number;
};

export type AuthSession = ProductionContext & {
  /** Includes the immutable authenticated actorId and operator/viewer role. */
  access: RoomRead["access"];
  expiresAtMs: number;
  recoveryNotice: RecoveryNotice | null;
};

export type LoginRequest = {
  username: string;
  password: string;
};

export type ProductionErrorCode =
  | "invalid_credentials"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "context_required"
  | "recovery_required"
  | "csrf_failed"
  | "invalid_request"
  | "payload_too_large"
  | "rate_limited"
  | "storage_unavailable"
  | "authority_unavailable";

export type ProductionError = {
  error: {
    code: ProductionErrorCode;
    message: string;
  };
};

/** Consistent REAL snapshot/history and durable receipts; not a restore format. */
export type WorkspaceExport = ProductionContext & {
  formatVersion: 1;
  exportedAtMs: number;
  snapshot: RoomSnapshot;
  receipts: {
    actorId: string;
    recordedAtMs: number;
    receipt: AuthorityReceipt;
  }[];
};
