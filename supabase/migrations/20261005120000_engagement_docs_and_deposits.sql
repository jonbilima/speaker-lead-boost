-- Engagement documents (contracts, AV riders) and deposit invoices.
--
-- Additive only: safe to apply before the new frontend and edge function.
-- The companion migration 20261005130000 closes the open read on
-- application_packages, and must run only AFTER the new PackageView is
-- published, because the current PackageView reads that table directly.

-- 1. Private storage --------------------------------------------------------
-- Contracts carry fees, deposit terms and client names. speaker-assets is a
-- PUBLIC bucket, so they cannot live there. Objects sit under
-- {speaker_id}/..., and only that speaker can touch them. Organizers reach a
-- document through package-view, which hands out a short-lived signed link
-- to the holder of that one package's link.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'engagement-docs', 'engagement-docs', false, 26214400,  -- 25 MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png', 'image/jpeg', 'image/webp',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Speakers read their own engagement docs" ON storage.objects;
CREATE POLICY "Speakers read their own engagement docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'engagement-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Speakers upload their own engagement docs" ON storage.objects;
CREATE POLICY "Speakers upload their own engagement docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'engagement-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Speakers update their own engagement docs" ON storage.objects;
CREATE POLICY "Speakers update their own engagement docs" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'engagement-docs' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'engagement-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Speakers delete their own engagement docs" ON storage.objects;
CREATE POLICY "Speakers delete their own engagement docs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'engagement-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 2. Documents ---------------------------------------------------------------
--   contract           one engagement's contract (match_id set)
--   contract_template  the speaker's own template, copied per engagement
--   av_requirements    tech rider, usually per topic (topic_id set)
--   other              anything else worth attaching

CREATE TABLE IF NOT EXISTS public.speaker_documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  speaker_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('contract', 'contract_template', 'av_requirements', 'other')),
  title       text NOT NULL CHECK (btrim(title) <> ''),
  file_path   text NOT NULL,
  file_name   text NOT NULL,
  mime_type   text,
  file_size   bigint,
  topic_id    uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  match_id    uuid REFERENCES public.opportunity_scores(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- The stored object must sit in the owner's own folder.
  CONSTRAINT speaker_documents_path_owned CHECK (split_part(file_path, '/', 1) = speaker_id::text)
);

CREATE INDEX IF NOT EXISTS speaker_documents_speaker_kind_idx ON public.speaker_documents (speaker_id, kind);
CREATE INDEX IF NOT EXISTS speaker_documents_match_idx ON public.speaker_documents (match_id) WHERE match_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS speaker_documents_topic_idx ON public.speaker_documents (topic_id) WHERE topic_id IS NOT NULL;

ALTER TABLE public.speaker_documents ENABLE ROW LEVEL SECURITY;

-- A document can only be attached to an engagement in the speaker's own
-- pipeline. That also keeps private gigs private: no one can hang a document
-- off someone else's match id.
DROP POLICY IF EXISTS "Speakers manage their own documents" ON public.speaker_documents;
CREATE POLICY "Speakers manage their own documents" ON public.speaker_documents
  FOR ALL TO authenticated
  USING (speaker_id = auth.uid())
  WITH CHECK (
    speaker_id = auth.uid()
    AND (match_id IS NULL OR EXISTS (
      SELECT 1 FROM public.opportunity_scores s
      WHERE s.id = match_id AND s.user_id = auth.uid()))
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.speaker_documents TO authenticated;
REVOKE ALL ON public.speaker_documents FROM anon;

-- 3. Packages carry the documents chosen for them ----------------------------
-- package-view only serves ids that belong to the package's own speaker, so a
-- speaker cannot attach another speaker's document by guessing its id.

ALTER TABLE public.application_packages
  ADD COLUMN IF NOT EXISTS document_ids uuid[] NOT NULL DEFAULT '{}';

-- 4. Deposit and balance invoices --------------------------------------------
-- Speakers usually bill a deposit (often 50%) when the contract is signed and
-- don't travel until it's paid, then bill the balance. A balance invoice
-- points at the deposit it follows.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_kind text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS deposit_percent numeric,
  ADD COLUMN IF NOT EXISTS parent_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_kind_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_kind_check
  CHECK (invoice_kind IN ('standard', 'deposit', 'balance'));

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_deposit_percent_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_deposit_percent_check
  CHECK (deposit_percent IS NULL OR (deposit_percent > 0 AND deposit_percent <= 100));

CREATE INDEX IF NOT EXISTS invoices_parent_idx ON public.invoices (parent_invoice_id)
  WHERE parent_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS invoices_booking_idx ON public.invoices (booking_id)
  WHERE booking_id IS NOT NULL;

-- 5. Track document downloads on the organizer's package page ----------------
-- Replaces whatever event_type CHECK exists (its name was auto-generated) with
-- the same list plus document_downloaded.

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.package_views'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%event_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.package_views DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.package_views ADD CONSTRAINT package_views_event_type_check
  CHECK (event_type IN ('opened', 'bio_viewed', 'headshot_downloaded', 'one_sheet_downloaded',
                        'video_played', 'contact_clicked', 'document_downloaded'));
