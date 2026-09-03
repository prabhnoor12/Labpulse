CREATE TABLE IF NOT EXISTS dispatch_attempts (
  id uuid PRIMARY KEY,
  lab_id uuid NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  initiated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  channel varchar(32) NOT NULL,
  recipient_phone varchar(32) NOT NULL,
  template_type varchar(32) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'SENT',
  provider_message_id varchar(256),
  error_message text,
  attempt_number integer NOT NULL DEFAULT 1,
  sent_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (channel IN ('DIRECT_WHATSAPP', 'WA_WEB', 'COPY')),
  CHECK (template_type IN ('standard', 'detailed', 'urgent', 'hindi')),
  CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'UNAVAILABLE')),
  CHECK (attempt_number > 0)
);

CREATE INDEX IF NOT EXISTS dispatch_attempts_report_created_idx ON dispatch_attempts(report_id, created_at DESC);
CREATE INDEX IF NOT EXISTS dispatch_attempts_lab_status_idx ON dispatch_attempts(lab_id, status, created_at DESC);
