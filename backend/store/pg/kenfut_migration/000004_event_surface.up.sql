-- Separate article views from documentation views. Before this migration every
-- view was stored as kind='article_view', so documentation traffic was folded
-- into the article funnel denominator.
ALTER TABLE kenfut_events ADD COLUMN surface text NOT NULL DEFAULT 'article';

-- Historical rows did not persist a surface. Backfill view events from the
-- immutable release metadata: channel='article' releases were rendered on the
-- blog surface; docs/both releases were rendered on the documentation surface.
UPDATE kenfut_events e
SET surface = CASE
  WHEN COALESCE(cr.metadata->>'channel', 'docs') = 'article' THEN 'article'
  ELSE 'docs'
END
FROM kenfut_content_releases cr
WHERE cr.node_release_id = e.node_release_id AND e.kind = 'article_view';

-- CTA clicks inherit the surface of the view they belong to. Clicks whose view
-- row no longer exists keep the column default 'article': they predate surface
-- capture and the article surface was the only funnel entry exposed to operators.
UPDATE kenfut_events c
SET surface = v.surface
FROM kenfut_events v
WHERE c.kind = 'cta_click' AND c.view_id = v.event_id AND c.kb_id = v.kb_id;

CREATE INDEX kenfut_events_surface ON kenfut_events(kb_id, surface, occurred_at);

-- Daily totals must keep the same split when detail rows are purged.
ALTER TABLE kenfut_daily_event_totals ADD COLUMN surface text NOT NULL DEFAULT 'article';
ALTER TABLE kenfut_daily_event_totals DROP CONSTRAINT kenfut_daily_event_totals_pkey;
ALTER TABLE kenfut_daily_event_totals ADD PRIMARY KEY(day,kb_id,product_id,node_id,cta_id,kind,surface);
