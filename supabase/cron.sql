-- Run once in the SQL editor after deploying. Replace <APP_URL> and <CRON_SECRET>.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('superkid-poll', '*/2 * * * *', $$
  select net.http_post(
    url := '<APP_URL>/api/poll',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>', 'Content-Type', 'application/json'),
    timeout_milliseconds := 55000
  );
$$);
