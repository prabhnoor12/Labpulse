CREATE TABLE IF NOT EXISTS report_test_panels (
  id uuid PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  panel_key varchar(128) NOT NULL,
  position integer NOT NULL,
  template_id varchar(128) NOT NULL DEFAULT '',
  test_name text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  sample_type text NOT NULL DEFAULT '',
  method text NOT NULL DEFAULT '',
  price double precision NOT NULL DEFAULT 0,
  clinical_interpretation text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, panel_key),
  UNIQUE (report_id, position)
);

CREATE TABLE IF NOT EXISTS report_test_parameters (
  id uuid PRIMARY KEY,
  panel_id uuid NOT NULL REFERENCES report_test_panels(id) ON DELETE CASCADE,
  parameter_key varchar(128) NOT NULL,
  position integer NOT NULL,
  name text NOT NULL DEFAULT '',
  short_name text NOT NULL DEFAULT '',
  value text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT '',
  method text NOT NULL DEFAULT '',
  ref_range text NOT NULL DEFAULT '',
  min_val double precision,
  max_val double precision,
  critical_min double precision,
  critical_max double precision,
  flag varchar(32),
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  sub_category text NOT NULL DEFAULT '',
  is_calculated boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '',
  UNIQUE (panel_id, parameter_key),
  UNIQUE (panel_id, position)
);

CREATE TABLE IF NOT EXISTS report_billing (
  report_id uuid PRIMARY KEY REFERENCES reports(id) ON DELETE CASCADE,
  total_amount double precision NOT NULL DEFAULT 0,
  discount double precision NOT NULL DEFAULT 0,
  net_amount double precision NOT NULL DEFAULT 0,
  paid_amount double precision NOT NULL DEFAULT 0,
  payment_method varchar(32) NOT NULL DEFAULT 'UPI',
  payment_status varchar(32) NOT NULL DEFAULT 'UNPAID',
  transaction_ref text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (payment_method IN ('UPI', 'Cash', 'Card', 'Online')),
  CHECK (payment_status IN ('PAID', 'PARTIAL', 'UNPAID'))
);

CREATE INDEX IF NOT EXISTS report_test_panels_report_position_idx ON report_test_panels(report_id, position);
CREATE INDEX IF NOT EXISTS report_test_parameters_panel_position_idx ON report_test_parameters(panel_id, position);

INSERT INTO report_billing (report_id, total_amount, discount, net_amount, paid_amount, payment_method, payment_status, transaction_ref)
SELECT r.id,
       CASE WHEN COALESCE(r.data->'billing'->>'totalAmount', '') ~ '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' THEN (r.data->'billing'->>'totalAmount')::double precision ELSE 0 END,
       CASE WHEN COALESCE(r.data->'billing'->>'discount', '') ~ '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' THEN (r.data->'billing'->>'discount')::double precision ELSE 0 END,
       CASE WHEN COALESCE(r.data->'billing'->>'netAmount', '') ~ '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' THEN (r.data->'billing'->>'netAmount')::double precision ELSE 0 END,
       CASE WHEN COALESCE(r.data->'billing'->>'paidAmount', '') ~ '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' THEN (r.data->'billing'->>'paidAmount')::double precision ELSE 0 END,
       CASE WHEN r.data->'billing'->>'paymentMethod' IN ('UPI', 'Cash', 'Card', 'Online') THEN r.data->'billing'->>'paymentMethod' ELSE 'UPI' END,
       CASE WHEN r.data->'billing'->>'paymentStatus' IN ('PAID', 'PARTIAL', 'UNPAID') THEN r.data->'billing'->>'paymentStatus' ELSE 'UNPAID' END,
       NULLIF(r.data->'billing'->>'transactionRef', '')
  FROM reports r
 WHERE jsonb_typeof(r.data->'billing') = 'object'
ON CONFLICT (report_id) DO NOTHING;

WITH legacy_panels AS (
  SELECT r.id AS report_id, panel,
         row_number() OVER (PARTITION BY r.id ORDER BY panel_position) AS position
    FROM reports r
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(r.data->'tests') = 'array' THEN r.data->'tests' ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS items(panel, panel_position)
)
INSERT INTO report_test_panels (id, report_id, panel_key, position, template_id, test_name, category, sample_type, method, price, clinical_interpretation)
SELECT (
         substr(md5(report_id::text || ':panel:' || position::text), 1, 8) || '-' ||
         substr(md5(report_id::text || ':panel:' || position::text), 9, 4) || '-' ||
         substr(md5(report_id::text || ':panel:' || position::text), 13, 4) || '-' ||
         substr(md5(report_id::text || ':panel:' || position::text), 17, 4) || '-' ||
         substr(md5(report_id::text || ':panel:' || position::text), 21, 12)
       )::uuid,
       report_id,
       left(COALESCE(NULLIF(panel->>'id', ''), 'legacy-panel'), 110) || '-' || position::text,
       position,
       COALESCE(panel->>'templateId', ''),
       COALESCE(panel->>'testName', ''),
       COALESCE(panel->>'category', ''),
       COALESCE(panel->>'sampleType', ''),
       COALESCE(panel->>'method', ''),
       CASE WHEN COALESCE(panel->>'price', '') ~ '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' THEN (panel->>'price')::double precision ELSE 0 END,
       COALESCE(panel->>'clinicalInterpretation', '')
  FROM legacy_panels
ON CONFLICT (report_id, panel_key) DO NOTHING;

WITH legacy_parameters AS (
  SELECT r.id AS report_id, panel, panel_position,
         row_number() OVER (PARTITION BY r.id ORDER BY panel_position) AS panel_position_number,
         parameter, parameter_position
    FROM reports r
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(r.data->'tests') = 'array' THEN r.data->'tests' ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS panels(panel, panel_position)
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(panel->'parameters') = 'array' THEN panel->'parameters' ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS parameters(parameter, parameter_position)
)
INSERT INTO report_test_parameters (id, panel_id, parameter_key, position, name, short_name, value, unit, method, ref_range, min_val, max_val, critical_min, critical_max, flag, options, sub_category, is_calculated, notes)
SELECT (
         substr(md5(l.report_id::text || ':parameter:' || panel_position_number::text || ':' || parameter_position::text), 1, 8) || '-' ||
         substr(md5(l.report_id::text || ':parameter:' || panel_position_number::text || ':' || parameter_position::text), 9, 4) || '-' ||
         substr(md5(l.report_id::text || ':parameter:' || panel_position_number::text || ':' || parameter_position::text), 13, 4) || '-' ||
         substr(md5(l.report_id::text || ':parameter:' || panel_position_number::text || ':' || parameter_position::text), 17, 4) || '-' ||
         substr(md5(l.report_id::text || ':parameter:' || panel_position_number::text || ':' || parameter_position::text), 21, 12)
       )::uuid,
       p.id,
       left(COALESCE(NULLIF(parameter->>'id', ''), 'legacy-parameter'), 110) || '-' || parameter_position::text,
       parameter_position,
       COALESCE(parameter->>'name', ''),
       COALESCE(parameter->>'shortName', ''),
       COALESCE(parameter->>'value', ''),
       COALESCE(parameter->>'unit', ''),
       COALESCE(parameter->>'method', ''),
       COALESCE(parameter->>'refRange', ''),
       CASE WHEN COALESCE(parameter->>'minVal', '') ~ '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' THEN (parameter->>'minVal')::double precision END,
       CASE WHEN COALESCE(parameter->>'maxVal', '') ~ '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' THEN (parameter->>'maxVal')::double precision END,
       CASE WHEN COALESCE(parameter->>'criticalMin', '') ~ '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' THEN (parameter->>'criticalMin')::double precision END,
       CASE WHEN COALESCE(parameter->>'criticalMax', '') ~ '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' THEN (parameter->>'criticalMax')::double precision END,
       NULLIF(parameter->>'flag', ''),
       CASE WHEN jsonb_typeof(parameter->'options') = 'array' THEN parameter->'options' ELSE '[]'::jsonb END,
       COALESCE(parameter->>'subCategory', ''),
       COALESCE((lower(parameter->>'isCalculated') = 'true'), false),
       COALESCE(parameter->>'notes', '')
  FROM legacy_parameters l
  JOIN report_test_panels p
    ON p.report_id = l.report_id
   AND p.position = l.panel_position_number
ON CONFLICT (panel_id, parameter_key) DO NOTHING;
