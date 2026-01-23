
-- Create storage bucket for speaker assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'speaker-assets',
  'speaker-assets',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'video/mp4', 'video/webm', 'video/quicktime', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']
);

-- RLS policies for speaker-assets bucket
-- Users can view all public assets
CREATE POLICY "Public assets are viewable by everyone"
ON storage.objects FOR SELECT
USING (bucket_id = 'speaker-assets');

-- Users can upload to their own folder
CREATE POLICY "Users can upload their own assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'speaker-assets' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can update their own assets
CREATE POLICY "Users can update their own assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'speaker-assets' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own assets
CREATE POLICY "Users can delete their own assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'speaker-assets' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
