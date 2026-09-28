CREATE TABLE public.opportunities_eventbrite_junk_backup_20260928 AS
SELECT id AS opportunity_id, event_name, is_active AS was_active, now() AS deactivated_at
FROM public.opportunities WHERE id IN ('a805c2cc-8002-40ee-a02f-264b3bfb9cec','f51f8ac9-f929-4e77-9d1e-daf746f79fed','e513257f-f456-4e08-8c50-834387cab22c','460b9e71-d309-41cb-8a1c-0212ccd24db1','04fa5a3f-28c1-404b-9f7e-00efa66655cb','d21b0d50-4b33-4d83-a461-a984bd0a7d5a','c542b254-57b9-4950-a385-aece3eb38e47','fb976064-f808-41df-b054-23b1514b09c2');
GRANT ALL ON public.opportunities_eventbrite_junk_backup_20260928 TO service_role;
ALTER TABLE public.opportunities_eventbrite_junk_backup_20260928 ENABLE ROW LEVEL SECURITY;
UPDATE public.opportunities SET is_active = false
WHERE id IN (SELECT opportunity_id FROM public.opportunities_eventbrite_junk_backup_20260928);