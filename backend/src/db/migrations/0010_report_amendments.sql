ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS supersedes_report_id uuid REFERENCES reports(id),
  ADD COLUMN IF NOT EXISTS amendment_reason text,
  ADD COLUMN IF NOT EXISTS amendment_number integer;

ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE reports ADD CONSTRAINT reports_status_check
  CHECK (status IN ('DRAFT', 'READY_FOR_REVIEW', 'VERIFIED', 'DISPATCHED', 'ARCHIVED', 'SUPERSEDED'));

DROP INDEX IF EXISTS reports_lab_accession_unique;
CREATE UNIQUE INDEX IF NOT EXISTS reports_lab_accession_unique
  ON reports (lab_id, accession_number)
  WHERE accession_number IS NOT NULL AND status <> 'SUPERSEDED';

CREATE INDEX IF NOT EXISTS reports_supersedes_idx ON reports(supersedes_report_id);
