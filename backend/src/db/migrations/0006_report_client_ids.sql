ALTER TABLE reports ADD COLUMN IF NOT EXISTS client_id varchar(128);

CREATE UNIQUE INDEX IF NOT EXISTS reports_lab_client_id_unique
  ON reports(lab_id, client_id)
  WHERE client_id IS NOT NULL;
