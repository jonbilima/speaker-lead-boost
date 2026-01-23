-- Create invoices storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for invoices bucket
CREATE POLICY "Users can view their own invoices"
ON storage.objects FOR SELECT
USING (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own invoices"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own invoices"
ON storage.objects FOR DELETE
USING (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add invoice template columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS invoice_logo_url TEXT,
ADD COLUMN IF NOT EXISTS default_payment_instructions TEXT,
ADD COLUMN IF NOT EXISTS default_invoice_terms TEXT,
ADD COLUMN IF NOT EXISTS default_tax_rate NUMERIC DEFAULT 0;

-- Add pdf_url column to invoices
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS pdf_url TEXT;