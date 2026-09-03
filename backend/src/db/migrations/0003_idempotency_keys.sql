CREATE TABLE IF NOT EXISTS idempotency_keys (
  lab_id uuid NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key varchar(128) NOT NULL,
  request_hash char(64) NOT NULL,
  response_body jsonb,
  completed_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lab_id, user_id, key),
  CHECK (length(trim(key)) > 0)
);

CREATE INDEX IF NOT EXISTS idempotency_keys_expiry_idx ON idempotency_keys(expires_at);
