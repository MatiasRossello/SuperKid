-- Which contingency a push was for. Sending still works if this column is missing;
-- dedupe by type starts once it exists.
alter table notifications_log add column if not exists contingency text;

create index if not exists notifications_log_zone_contingency
  on notifications_log (departamento, contingency, sent_at desc);
