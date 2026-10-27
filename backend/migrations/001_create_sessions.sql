CREATE TABLE IF NOT EXISTS sessions (
  id_hash                  VARCHAR(64)  PRIMARY KEY,
  user_data                JSONB        NOT NULL,
  acr                      VARCHAR(8)   NOT NULL,
  csrf_token               VARCHAR(64)  NOT NULL,
  encrypted_refresh_token  TEXT         NOT NULL,
  encrypted_id_token       TEXT         NOT NULL,
  expires_at               TIMESTAMPTZ  NOT NULL,
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);
