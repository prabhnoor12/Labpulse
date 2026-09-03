CREATE TABLE IF NOT EXISTS report_public_links (
  id uuid PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS report_public_links_report_idx ON report_public_links(report_id);
CREATE INDEX IF NOT EXISTS report_public_links_expiry_idx ON report_public_links(expires_at);
