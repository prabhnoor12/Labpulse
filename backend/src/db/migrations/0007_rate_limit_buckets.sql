CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key varchar(512) PRIMARY KEY,
  hits integer NOT NULL DEFAULT 0,
  reset_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (hits >= 0)
);

CREATE INDEX IF NOT EXISTS rate_limit_buckets_reset_idx ON rate_limit_buckets(reset_at);
