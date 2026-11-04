ALTER TABLE kenfut_daily_event_totals DROP CONSTRAINT kenfut_daily_event_totals_pkey;
ALTER TABLE kenfut_daily_event_totals ADD PRIMARY KEY(day,kb_id,product_id,node_id,cta_id,kind);
ALTER TABLE kenfut_daily_event_totals DROP COLUMN surface;
DROP INDEX IF EXISTS kenfut_events_surface;
ALTER TABLE kenfut_events DROP COLUMN surface;
