ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS accession_number varchar(64);

CREATE UNIQUE INDEX IF NOT EXISTS reports_lab_accession_unique
  ON reports (lab_id, accession_number)
  WHERE accession_number IS NOT NULL;
