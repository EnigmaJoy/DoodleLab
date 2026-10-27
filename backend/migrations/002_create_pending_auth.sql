CREATE TABLE IF NOT EXISTS pending_auth (
  id            VARCHAR(64)  PRIMARY KEY,
  state         VARCHAR(64)  NOT NULL UNIQUE,
  nonce         VARCHAR(64)  NOT NULL,
  code_verifier VARCHAR(128) NOT NULL,
  flow          VARCHAR(16)  NOT NULL,
  expires_at    TIMESTAMPTZ  NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pending_auth_expires_at_idx ON pending_auth (expires_at);
