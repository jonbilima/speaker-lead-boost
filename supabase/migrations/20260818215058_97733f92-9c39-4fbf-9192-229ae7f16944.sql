SELECT cron.unschedule('score-new-opportunities-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'score-new-opportunities-daily');

SELECT cron.schedule(
  'score-new-opportunities-daily',
  '30 7 * * *',
  $$
  select net.http_post(
    url:='https://jzrgcbgqpowmknjyjhon.supabase.co/functions/v1/score-new-opportunities',
    headers:='{"Content-Type": "application/json", "x-cron-secret": "nextmic-expiry-9f4k2m8x7q3w"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);