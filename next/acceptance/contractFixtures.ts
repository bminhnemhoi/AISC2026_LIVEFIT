import type {
  AuthSession,
  ProductionContext,
  ProductionErrorCode,
  RecoveryNotice,
  WorkspaceExport,
} from "@/contracts/production";
import type { RoomSnapshot } from "@/contracts/authority";
import {
  TEST_OPERATOR_ACTOR,
  TEST_VIEWER_ACTOR,
} from "../src/__tests__/phase2/fixtures/authorityFixtures";

export const TEST_WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";
export const TEST_ROOM_ID = "room-aud-01";
export const TEST_GENERATION = "11111111-1111-4111-8111-111111111111";
export const TEST_NEW_GENERATION = "22222222-2222-4222-8222-222222222222";

export const TEST_VALID_PASSWORDS = {
  min: "123456789012345", // Exactly 15 chars
  standard: "OperatorStrongPassword123!", // 27 chars
  max: "A".repeat(128), // Exactly 128 chars
};

export const TEST_INVALID_PASSWORDS = {
  tooShort: "12345678901234", // 14 chars
  tooLong: "A".repeat(129), // 129 chars
  empty: "",
};

export const TEST_VALID_USERNAMES = [
  "operator",
  "viewer",
  "op_user.1",
  "admin-lead",
  "user123",
];

export const TEST_INVALID_USERNAMES = [
  "", // empty
  ".leadingdot", // starts with non-alphanumeric
  "-leadinghyphen",
  "user with spaces",
  "user@domain.com", // '@' not allowed in strict regex
  "A".repeat(65), // > 64 chars
];

export const PRODUCTION_ERROR_CODES: ProductionErrorCode[] = [
  "invalid_credentials",
  "unauthenticated",
  "forbidden",
  "not_found",
  "context_required",
  "recovery_required",
  "csrf_failed",
  "invalid_request",
  "payload_too_large",
  "rate_limited",
  "storage_unavailable",
  "authority_unavailable",
];

export const TEST_PRODUCTION_CONTEXT: ProductionContext = {
  workspaceId: TEST_WORKSPACE_ID,
  roomId: TEST_ROOM_ID,
  generation: TEST_GENERATION,
};

export const TEST_RECOVERY_NOTICE: RecoveryNotice = {
  restoredAtMs: 1_700_000_200_000,
  backupTakenAtMs: 1_700_000_100_000,
  backupRevision: 42,
};

export const TEST_OPERATOR_AUTH_SESSION: AuthSession = {
  ...TEST_PRODUCTION_CONTEXT,
  access: {
    actorId: TEST_OPERATOR_ACTOR.actorId,
    name: TEST_OPERATOR_ACTOR.name,
    role: "operator",
  },
  expiresAtMs: 1_700_000_000_000 + 12 * 60 * 60 * 1000,
  recoveryNotice: null,
};

export const TEST_VIEWER_AUTH_SESSION: AuthSession = {
  ...TEST_PRODUCTION_CONTEXT,
  access: {
    actorId: TEST_VIEWER_ACTOR.actorId,
    name: TEST_VIEWER_ACTOR.name,
    role: "viewer",
  },
  expiresAtMs: 1_700_000_000_000 + 12 * 60 * 60 * 1000,
  recoveryNotice: null,
};

export const CANARY_SECRETS = {
  password: "CANARY_PW_998877665544332211_SECRET",
  token: "CANARY_TOKEN_abcdef1234567890abcdef1234567890",
  cookieValue: "CANARY_COOKIE_XYZ987654321",
  salt: "0123456789abcdef0123456789abcdef",
  canaryString: "SENSITIVE_CANARY_DO_NOT_LOG_9876543210",
};

export function createSampleWorkspaceExport(
  snapshot: RoomSnapshot,
  roomRevision = 1
): WorkspaceExport {
  return {
    workspaceId: TEST_WORKSPACE_ID,
    roomId: TEST_ROOM_ID,
    generation: TEST_GENERATION,
    formatVersion: 1,
    exportedAtMs: 1_700_000_150_000,
    snapshot,
    receipts: [
      {
        actorId: TEST_OPERATOR_ACTOR.actorId,
        recordedAtMs: 1_700_000_120_000,
        receipt: {
          commandId: "cmd-sample-01",
          type: "create_session",
          outcome: "committed",
          code: null,
          message: null,
          roomRevisionAfter: roomRevision,
          sessionId: "sess-01",
          sessionRevisionAfter: 1,
          eventIds: [],
        },
      },
    ],
  };
}
