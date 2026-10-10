export const V1_SQL = `
          CREATE TABLE IF NOT EXISTS room_state (
            singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
            room_id TEXT NOT NULL UNIQUE,
            revision INTEGER NOT NULL CHECK (revision >= 0),
            clock_ms INTEGER NOT NULL
          ) STRICT;
          CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            room_id TEXT NOT NULL REFERENCES room_state(room_id),
            lifecycle TEXT NOT NULL CHECK (lifecycle IN ('planned', 'active', 'ended')),
            state_json TEXT NOT NULL CHECK (json_valid(state_json) AND json_extract(state_json, '$.environment') = 'REAL'),
            used_ids_json TEXT NOT NULL CHECK (json_valid(used_ids_json))
          ) STRICT;
          CREATE UNIQUE INDEX IF NOT EXISTS one_active_show ON sessions(room_id) WHERE lifecycle = 'active';
          CREATE TABLE IF NOT EXISTS command_log (
            command_id TEXT PRIMARY KEY,
            actor_id TEXT NOT NULL,
            canonical_request TEXT NOT NULL,
            receipt_json TEXT NOT NULL CHECK (json_valid(receipt_json)),
            http_status INTEGER NOT NULL,
            recorded_at_ms INTEGER NOT NULL,
            resolved_creation_json TEXT CHECK (resolved_creation_json IS NULL OR json_valid(resolved_creation_json))
          ) STRICT;
          CREATE TRIGGER IF NOT EXISTS command_log_no_update BEFORE UPDATE ON command_log
            BEGIN SELECT RAISE(ABORT, 'command log is immutable'); END;
          CREATE TRIGGER IF NOT EXISTS command_log_no_delete BEFORE DELETE ON command_log
            BEGIN SELECT RAISE(ABORT, 'command log is immutable'); END;
          CREATE TRIGGER IF NOT EXISTS command_log_no_replace BEFORE INSERT ON command_log
            WHEN EXISTS (SELECT 1 FROM command_log WHERE command_id = NEW.command_id)
            BEGIN SELECT RAISE(ABORT, 'command log is immutable'); END;
          PRAGMA user_version = 1;
        `;

/** Ordered, static v1 -> v2 migration; authority tables and history remain intact. */
export const V2_SQL = `
CREATE TABLE deployment (
  singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
  workspace_id TEXT NOT NULL UNIQUE,
  room_id TEXT NOT NULL REFERENCES room_state(room_id),
  generation TEXT NOT NULL,
  recovery_json TEXT CHECK(recovery_json IS NULL OR json_valid(recovery_json))
) STRICT;
CREATE TRIGGER deployment_identity BEFORE UPDATE OF workspace_id, room_id ON deployment
  BEGIN SELECT RAISE(ABORT, 'deployment identity is immutable'); END;
CREATE TABLE accounts (
  actor_id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('operator', 'viewer')),
  salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  enabled INTEGER NOT NULL CHECK(enabled IN (0, 1))
) STRICT;
CREATE TRIGGER account_identity BEFORE UPDATE OF actor_id ON accounts
  BEGIN SELECT RAISE(ABORT, 'actor identity is immutable'); END;
CREATE TABLE actor_ids (actor_id TEXT PRIMARY KEY) STRICT;
CREATE TRIGGER actor_ids_no_delete BEFORE DELETE ON actor_ids
  BEGIN SELECT RAISE(ABORT, 'actor identities are never reused'); END;
CREATE TRIGGER actor_ids_no_update BEFORE UPDATE ON actor_ids
  BEGIN SELECT RAISE(ABORT, 'actor identities are immutable'); END;
INSERT INTO actor_ids SELECT DISTINCT actor_id FROM command_log;
INSERT OR IGNORE INTO actor_ids SELECT DISTINCT json_extract(state_json, '$.operator.id') FROM sessions;
CREATE TRIGGER account_actor BEFORE INSERT ON accounts
  BEGIN INSERT INTO actor_ids VALUES(NEW.actor_id); END;
CREATE TABLE login_sessions (
  token_hash TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES accounts(actor_id) ON DELETE CASCADE,
  expires_at_ms INTEGER NOT NULL
) STRICT;
CREATE INDEX login_sessions_actor ON login_sessions(actor_id);
CREATE TRIGGER account_revoke AFTER UPDATE OF password_hash, salt, role, enabled ON accounts
  BEGIN DELETE FROM login_sessions WHERE actor_id = OLD.actor_id; END;
PRAGMA user_version = 2;
`;
