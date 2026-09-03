CREATE TABLE IF NOT EXISTS labs (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  lab_id uuid NOT NULL REFERENCES labs(id),
  email varchar(320) NOT NULL,
  name text NOT NULL,
  password_hash text NOT NULL,
  role varchar(32) NOT NULL DEFAULT 'TECHNICIAN',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lab_id, email),
  CHECK (role IN ('OWNER', 'PATHOLOGIST', 'TECHNICIAN', 'RECEPTIONIST', 'VIEWER'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  ip_address varchar(128),
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY,
  lab_id uuid NOT NULL REFERENCES labs(id),
  uhid varchar(64) NOT NULL,
  name text NOT NULL,
  phone varchar(32) NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lab_id, uhid)
);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY,
  lab_id uuid NOT NULL REFERENCES labs(id),
  patient_id uuid NOT NULL REFERENCES patients(id),
  report_number varchar(64) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'DRAFT',
  current_version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified_by uuid REFERENCES users(id),
  verified_at timestamptz,
  dispatched_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lab_id, report_number),
  CHECK (status IN ('DRAFT', 'READY_FOR_REVIEW', 'VERIFIED', 'DISPATCHED', 'ARCHIVED'))
);

CREATE TABLE IF NOT EXISTS report_versions (
  id uuid PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  version integer NOT NULL,
  data jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, version)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY,
  lab_id uuid NOT NULL REFERENCES labs(id),
  user_id uuid REFERENCES users(id),
  action varchar(64) NOT NULL,
  entity_type varchar(64) NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lab_profiles (
  lab_id uuid PRIMARY KEY REFERENCES labs(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS test_templates (
  id uuid PRIMARY KEY,
  lab_id uuid NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
  template_key varchar(128) NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lab_id, template_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON users (lower(email));
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS patients_lab_name_idx ON patients(lab_id, name);
CREATE INDEX IF NOT EXISTS patients_lab_phone_idx ON patients(lab_id, phone);
CREATE INDEX IF NOT EXISTS reports_lab_status_idx ON reports(lab_id, status);
CREATE INDEX IF NOT EXISTS reports_lab_updated_idx ON reports(lab_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_lab_created_idx ON audit_events(lab_id, created_at DESC);
CREATE INDEX IF NOT EXISTS test_templates_lab_active_idx ON test_templates(lab_id, active);
