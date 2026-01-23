-- Create invoices table
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  speaker_id UUID NOT NULL,
  contact_id UUID,
  booking_id UUID,
  invoice_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  payment_instructions TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payments table
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_method TEXT,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for invoices
CREATE POLICY "Users can view their own invoices"
ON public.invoices FOR SELECT
USING (auth.uid() = speaker_id);

CREATE POLICY "Users can insert their own invoices"
ON public.invoices FOR INSERT
WITH CHECK (auth.uid() = speaker_id);

CREATE POLICY "Users can update their own invoices"
ON public.invoices FOR UPDATE
USING (auth.uid() = speaker_id);

CREATE POLICY "Users can delete their own invoices"
ON public.invoices FOR DELETE
USING (auth.uid() = speaker_id);

-- Enable RLS on payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for payments (through invoice ownership)
CREATE POLICY "Users can view payments for their invoices"
ON public.payments FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.invoices
  WHERE invoices.id = payments.invoice_id
  AND invoices.speaker_id = auth.uid()
));

CREATE POLICY "Users can insert payments for their invoices"
ON public.payments FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.invoices
  WHERE invoices.id = payments.invoice_id
  AND invoices.speaker_id = auth.uid()
));

CREATE POLICY "Users can update payments for their invoices"
ON public.payments FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.invoices
  WHERE invoices.id = payments.invoice_id
  AND invoices.speaker_id = auth.uid()
));

CREATE POLICY "Users can delete payments for their invoices"
ON public.payments FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.invoices
  WHERE invoices.id = payments.invoice_id
  AND invoices.speaker_id = auth.uid()
));

-- Create a contacts table for unified contact management
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  speaker_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  title TEXT,
  contact_type TEXT NOT NULL DEFAULT 'prospect',
  industry TEXT,
  linkedin_url TEXT,
  website TEXT,
  notes TEXT,
  last_contact_date DATE,
  total_revenue NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on contacts
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for contacts
CREATE POLICY "Users can view their own contacts"
ON public.contacts FOR SELECT
USING (auth.uid() = speaker_id);

CREATE POLICY "Users can insert their own contacts"
ON public.contacts FOR INSERT
WITH CHECK (auth.uid() = speaker_id);

CREATE POLICY "Users can update their own contacts"
ON public.contacts FOR UPDATE
USING (auth.uid() = speaker_id);

CREATE POLICY "Users can delete their own contacts"
ON public.contacts FOR DELETE
USING (auth.uid() = speaker_id);

-- Create trigger for contacts updated_at
CREATE TRIGGER update_contacts_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();