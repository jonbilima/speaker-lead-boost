-- Close the open read on speaker packages.
--
-- APPLY ONLY AFTER the PackageView that uses the package-view edge function is
-- published. The old PackageView reads application_packages directly and
-- will show "Package not found" to organizers once this runs.
--
-- The policy was named "Public can view packages by tracking code", but its
-- rule was USING (true): every package, to anyone, with no tracking code
-- needed. Confirmed on 2026-10-05 that the public key could read all 135,
-- including organizer email addresses (emailed_to), cover messages and private
-- notes. Organizers now reach exactly one package, by its tracking code,
-- through package-view.
--
-- Speakers still read their own through "Users can view their own packages".

DROP POLICY IF EXISTS "Public can view packages by tracking code" ON public.application_packages;